/* ==========================================================================
   EXPORTADOR PDF EN CLIENTE + HÍBRIDO SERVIDOR (REPORTLAB / VENTANA VECTORIAL)
   Plantas, elevaciones con 4 referencias, puertas con 9 medidas y mínimos
   ========================================================================== */
(function (global) {
  'use strict';

  async function downloadProjectPdf(project, confirmPreliminary = true) {
    const G = global.ASBuiltGeometry;
    const auditInfo = G.auditProjectForExport(project);
    if (auditInfo.requiresPreliminaryConfirmation && !confirmPreliminary) {
      throw new Error('Debe confirmar la exportación preliminar.');
    }

    const safeName = String(project.name || 'Levantamiento').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const filename = `${safeName}_ASBUILT_MM.pdf`;

    // 1. Intentar con servidor local ReportLab
    try {
      const resp = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, confirmPreliminary })
      });
      if (resp.ok) {
        const blob = await resp.blob();
        global.ASBuiltDxfExporter.triggerBlobDownload(blob, filename);
        return {
          mode: 'SERVER_REPORTLAB',
          filename,
          pages: Number(resp.headers.get('X-ASBUILT-PDF-Pages') || 1),
          exportPath: resp.headers.get('X-ASBUILT-Export-Path')
        };
      }
    } catch (_) {
      // Fallback en modo web estático / tablet offline: generador de láminas imprimibles vectoriales SVG/PDF
    }

    openClientPrintableVectorReport(project, auditInfo);
    return { mode: 'CLIENT_VECTOR_PRINT', filename };
  }

  function openClientPrintableVectorReport(project, auditInfo) {
    const G = global.ASBuiltGeometry;
    const sectionsHtml = [];
    for (const c of (project.concepts || [])) {
      if (c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL') {
        const ds = c.doorSurvey || {};
        const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm || project.predominantHeightMm, ds.baseOffsetMm);
        const mins = ev.referenceMinimumsMm || { widthMm: 0, heightMm: 0, thicknessMm: 0 };
        const rw = (ev.originalReadingsMm || {}).widths || {};
        const rh = (ev.originalReadingsMm || {}).heights || {};
        const rt = (ev.originalReadingsMm || {}).thicknesses || {};
        sectionsHtml.push(`
          <div class="sheet">
            <div class="sheet-header">
              <div><strong>PROYECTO:</strong> ${project.name} | <strong>CONCEPTO PUERTA:</strong> ${c.name}</div>
              <div><strong>UNIDADES:</strong> mm | <strong>ESCALA:</strong> Esquema Técnico Sin Escala (Cotas en mm gobiernan)</div>
            </div>
            <div class="stamp ${auditInfo.requiresPreliminaryConfirmation ? 'prelim' : 'ok'}">${auditInfo.stampText}</div>
            <h3>Vista Frontal del Vano — 9 Lecturas Originales y Mínimos de Referencia</h3>
            <table>
              <thead><tr><th>Grupo</th><th>Posición 1</th><th>Posición 2</th><th>Posición 3</th><th>MÍNIMO EXPORTADO</th></tr></thead>
              <tbody>
                <tr><td>Ancho del vano</td><td>Inf: ${rw.inferior || '-'} mm</td><td>Med: ${rw.medio || '-'} mm</td><td>Sup: ${rw.superior || '-'} mm</td><td><strong>${mins.widthMm} mm</strong></td></tr>
                <tr><td>Alto del vano</td><td>Izq: ${rh.izquierdo || '-'} mm</td><td>Cen: ${rh.centro || '-'} mm</td><td>Der: ${rh.derecho || '-'} mm</td><td><strong>${mins.heightMm} mm</strong></td></tr>
                <tr><td>Espesor del muro</td><td>Sup: ${rt.superior || '-'} mm</td><td>Med: ${rt.medio || '-'} mm</td><td>Inf: ${rt.inferior || '-'} mm</td><td><strong>${mins.thicknessMm} mm</strong></td></tr>
              </tbody>
            </table>
            <p class="warn-note">${ev.fabricationNotice}</p>
          </div>
        `);
        continue;
      }

      const vmap = G.getVertexMap(c);
      const wallRows = (c.walls || []).map((w) => {
        const m = G.wallGeometryMetrics(w, vmap);
        return `<tr><td><strong>${w.label} (${w.code})</strong></td><td>${w.realLengthMm ? w.realLengthMm + ' mm' : '~' + m.provisionalLengthM + ' m (Prov.)'}</td><td>${w.heightMm || c.heightMm || project.predominantHeightMm} mm</td><td>${w.thicknessMm || 150} mm</td><td>${w.angleDeg ?? m.geomAngleDeg}°</td><td>${w.status.toUpperCase()}</td></tr>`;
      }).join('');

      const elevBlocks = (c.walls || []).map((w) => {
        const elRows = (w.elements || []).map((el) => {
          const r = el.references || {};
          return `<tr><td>${el.code}</td><td>${el.label}</td><td>${r.distLeftMm} mm</td><td>${r.distRightMm} mm</td><td>${r.distFloorMm} mm</td><td>${r.distTopMm} mm</td><td>${el.provenance}</td></tr>`;
        }).join('') || '<tr><td colspan="7">Sin instalaciones registradas en este muro.</td></tr>';
        return `
          <div style="margin-top:12px;">
            <h4>Elevación ${w.label} (${w.code}) — Ancho: ${w.realLengthMm || '-'} mm | Altura: ${w.heightMm || c.heightMm || project.predominantHeightMm} mm</h4>
            <table>
              <thead><tr><th>ID</th><th>Dispositivo / Vano</th><th>Ref. Izquierda</th><th>Ref. Derecha</th><th>Altura Piso</th><th>Ref. Superior</th><th>Origen</th></tr></thead>
              <tbody>${elRows}</tbody>
            </table>
          </div>
        `;
      }).join('');

      sectionsHtml.push(`
        <div class="sheet">
          <div class="sheet-header">
            <div><strong>PROYECTO:</strong> ${project.name} | <strong>CONCEPTO:</strong> ${c.name} (${c.conceptType})</div>
            <div><strong>UNIDADES:</strong> Milímetros (mm) | <strong>ESCALA:</strong> Sin escala (Cotas en mm gobiernan)</div>
          </div>
          <div class="stamp ${auditInfo.requiresPreliminaryConfirmation ? 'prelim' : 'ok'}">${auditInfo.stampText}</div>
          <h3>Planta Arquitectónica AS-BUILT — Tabla de Muros (Orden Izquierda → Derecha)</h3>
          <table>
            <thead><tr><th>ID Muro</th><th>Longitud Real (mm)</th><th>Altura (mm)</th><th>Espesor (mm)</th><th>Ángulo</th><th>Estado</th></tr></thead>
            <tbody>${wallRows}</tbody>
          </table>
          ${elevBlocks}
        </div>
      `);
    }

    let win = null;
    try {
      win = window.open('', '_blank');
    } catch (_) {}

    if (!win) {
      renderPrintModalInPage(project, sectionsHtml);
      return;
    }

    try {
      win.document.write(`<!DOCTYPE html>
        <html lang="es"><head><meta charset="UTF-8"><title>Reporte PDF AS-BUILT - ${project.name}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 20px; }
          .sheet { border: 2px solid #cbd5e1; padding: 18px; margin-bottom: 24px; page-break-after: always; }
          .sheet-header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; font-size: 13px; }
          .stamp { padding: 6px 10px; font-weight: bold; font-size: 12px; margin-bottom: 12px; border-radius: 4px; }
          .stamp.ok { background: #d1fae5; color: #047857; }
          .stamp.prelim { background: #fee2e2; color: #b91c1c; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; }
          th { background: #f1f5f9; }
          .warn-note { color: #b91c1c; font-weight: bold; font-size: 12px; margin-top: 10px; }
        </style></head><body>
        ${sectionsHtml.join('')}
        <script>window.onload = function(){ window.print(); };<\/script>
        </body></html>`);
      win.document.close();
    } catch (_) {
      renderPrintModalInPage(project, sectionsHtml);
    }
  }

  function renderPrintModalInPage(project, sectionsHtml) {
    let overlay = document.getElementById('asbuiltPrintModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'asbuiltPrintModalOverlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="print-overlay-backdrop">
        <div class="print-overlay-toolbar no-print">
          <div>
            <strong>Reporte PDF / Láminas Imprimibles</strong> — ${project.name}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" onclick="window.print()">🖨 Imprimir / Guardar en PDF</button>
            <button class="btn" onclick="document.getElementById('asbuiltPrintModalOverlay').style.display='none'">✖ Cerrar</button>
          </div>
        </div>
        <div class="print-overlay-content">
          ${sectionsHtml.join('')}
        </div>
      </div>
    `;
    overlay.style.display = 'block';
  }

  global.ASBuiltPdfExporter = {
    downloadProjectPdf
  };
})(window);
