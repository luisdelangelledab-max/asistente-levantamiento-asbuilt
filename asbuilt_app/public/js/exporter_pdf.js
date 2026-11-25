/* ==========================================================================
   EXPORTADOR PDF EN CLIENTE + HÍBRIDO SERVIDOR (REPORTLAB / VENTANA VECTORIAL)
   Exportación dual: Dossier AS-BUILT + Versión del DXF en PDF con Cotas
   ========================================================================== */
(function (global) {
  'use strict';

  /**
   * Genera una versión del plano CAD DXF en formato PDF vectorial nativo (PDF 1.4)
   * con todas las cotas en milímetros, muros, elevaciones y carátula.
   */
  function generateDxfLayoutPdfBlob(project, auditInfo) {
    const G = global.ASBuiltGeometry;
    const safeName = String(project.name || 'Levantamiento').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    
    // Dimensiones de lámina tipo A3 Landscape (1190.55 x 841.89 pt)
    const pageW = 1190.55;
    const pageH = 841.89;
    const margin = 28.0;

    // Calcular límites espaciales del proyecto en mm (siguiendo el layout del exportador DXF)
    const concepts = project.concepts || [];
    let totalDxfW = 4000.0;
    let totalDxfH = 3000.0;

    let currentBandY = 0;
    const bandGapY = 3200;
    const viewGapX = 1800;

    const layoutBoxes = [];

    for (const c of concepts) {
      if (c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL') {
        const ds = c.doorSurvey || {};
        const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm || project.predominantHeightMm, ds.baseOffsetMm);
        const mins = ev.referenceMinimumsMm || { widthMm: 900, heightMm: 2100, thicknessMm: 150 };
        layoutBoxes.push({
          type: 'DOOR',
          concept: c,
          x: 400,
          y: currentBandY + 500,
          w: mins.widthMm + mins.thicknessMm + 1200,
          h: mins.heightMm + 600,
          mins,
          ev
        });
        currentBandY += mins.heightMm + bandGapY;
        continue;
      }

      const vmap = G.getVertexMap(c);
      const xs = (c.vertices || []).map((v) => Number(v.xMm));
      const ys = (c.vertices || []).map((v) => Number(v.yMm));
      const minX = xs.length ? Math.min(...xs) : 0;
      const maxX = xs.length ? Math.max(...xs) : 2500;
      const minY = ys.length ? Math.min(...ys) : 0;
      const maxY = ys.length ? Math.max(...ys) : 2000;
      const planW = Math.max(maxX - minX, 1000);
      const planH = Math.max(maxY - minY, 1000);

      let rowW = planW + 1200;
      let rowMaxH = planH + 1000;

      const elevs = [];
      let nextElevX = planW + 1200 + viewGapX;

      for (const w of (c.walls || [])) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = Number(w.realLengthMm || m.geomLengthMm || 1000);
        const H = Number(w.heightMm || c.heightMm || project.predominantHeightMm || 2600);
        const maxH = G.getWallMaxHeight(w, H, L);
        elevs.push({ wall: w, L, H, maxH, relX: nextElevX });
        nextElevX += L + viewGapX;
        rowMaxH = Math.max(rowMaxH, maxH + 1200);
      }
      rowW = nextElevX;

      layoutBoxes.push({
        type: 'ROOM',
        concept: c,
        vmap,
        minX,
        minY,
        planW,
        planH,
        elevs,
        shiftX: -minX + 500,
        shiftY: currentBandY - minY + 500,
        bandY: currentBandY,
        totalW: rowW,
        totalH: rowMaxH
      });

      currentBandY += rowMaxH + bandGapY;
    }

    totalDxfW = Math.max(...layoutBoxes.map((b) => (b.type === 'DOOR' ? b.w : b.totalW)), 5000);
    totalDxfH = Math.max(currentBandY, 3500);

    // Escala métrica para encajar en el área de dibujo del PDF
    const drawAreaW = pageW - margin * 2 - 14.0;
    const drawAreaH = pageH - margin * 2 - 55.0; // Espacio para cabecera y pie de plano
    const scale = Math.min(drawAreaW / totalDxfW, drawAreaH / totalDxfH);

    const originPtX = margin + 7.0;
    const originPtY = margin + 35.0;

    function toPt(xMm, yMm) {
      return [
        originPtX + xMm * scale,
        originPtY + yMm * scale
      ];
    }

    // Comandos del stream de contenido PDF (PDF 1.4 Vectorial)
    const stream = [];
    const texts = [];

    // 1. Marco exterior y fondo
    stream.push('1 1 1 rg');
    stream.push(`0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)} re f`);
    stream.push('0.80 0.84 0.88 RG 1 w');
    stream.push(`${margin.toFixed(2)} ${margin.toFixed(2)} ${(pageW - margin * 2).toFixed(2)} ${(pageH - margin * 2).toFixed(2)} re s`);

    // 2. Cabecera y Cuadro de Rotulación (Title Block CAD)
    const topBarY = pageH - margin - 24.0;
    stream.push('0.96 0.97 0.99 rg');
    stream.push(`${margin.toFixed(2)} ${topBarY.toFixed(2)} ${(pageW - margin * 2).toFixed(2)} 24 re f`);
    stream.push('0.06 0.09 0.16 RG 1.5 w');
    stream.push(`${margin.toFixed(2)} ${topBarY.toFixed(2)} ${(pageW - margin * 2).toFixed(2)} 24 re s`);

    texts.push({
      font: 'F2',
      size: 11,
      x: margin + 10,
      y: topBarY + 8,
      text: `PLANO AS-BUILT 2D (LAYOUT DXF CON COTAS) — PROYECTO: ${project.name || 'Levantamiento'}`,
      color: [0.06, 0.09, 0.16]
    });

    const stampIsOk = !auditInfo.requiresPreliminaryConfirmation;
    texts.push({
      font: 'F2',
      size: 9,
      x: pageW - margin - 340,
      y: topBarY + 8,
      text: `UNIDADES: mm (Float64) | ${auditInfo.stampText}`,
      color: stampIsOk ? [0.02, 0.47, 0.34] : [0.73, 0.11, 0.11]
    });

    // 3. Dibujar conceptos (Planta + Elevaciones + Cotas)
    for (const box of layoutBoxes) {
      if (box.type === 'DOOR') {
        const c = box.concept;
        const mins = box.mins;
        const ev = box.ev;
        const p0 = toPt(box.x, box.y);
        const pw = mins.widthMm * scale;
        const ph = mins.heightMm * scale;
        const pTh = mins.thicknessMm * scale;

        // Vano
        stream.push('0.90 0.96 1.00 rg 0.08 0.55 0.80 RG 1.5 w');
        stream.push(`${p0[0].toFixed(2)} ${p0[1].toFixed(2)} ${pw.toFixed(2)} ${ph.toFixed(2)} re b`);

        // Marco espesor
        const psx = p0[0] + pw + 25 * scale;
        stream.push('0.95 0.95 0.95 rg 0.30 0.35 0.40 RG 1 w');
        stream.push(`${psx.toFixed(2)} ${p0[1].toFixed(2)} ${pTh.toFixed(2)} ${ph.toFixed(2)} re b`);

        // Cotas
        texts.push({
          font: 'F2',
          size: 8,
          x: p0[0] + pw * 0.5 - 35,
          y: p0[1] - 12,
          text: `Ancho Mín: ${mins.widthMm} mm`,
          color: [0.1, 0.2, 0.8]
        });
        texts.push({
          font: 'F2',
          size: 8,
          x: p0[0] - 55,
          y: p0[1] + ph * 0.5,
          text: `Alto: ${mins.heightMm} mm`,
          color: [0.1, 0.2, 0.8]
        });
        texts.push({
          font: 'F2',
          size: 8.5,
          x: p0[0],
          y: p0[1] + ph + 10,
          text: `PUERTA FRONTAL: ${c.name} (9 Mediciones)`,
          color: [0.06, 0.09, 0.16]
        });
        continue;
      }

      // Concepto de ambiente arquitectónico
      const c = box.concept;
      const vmap = box.vmap;
      const shiftX = box.shiftX;
      const shiftY = box.shiftY;

      // 3.1. Dibujar muros de planta con sus espesores y cotas
      for (const w of (c.walls || [])) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = m.geomLengthMm || 1;
        const tx = (m.bx - m.ax) / L;
        const ty = (m.by - m.ay) / L;
        const th = Number(w.thicknessMm || 150);
        const n = G.outwardNormalForWall(tx, ty, w.outwardNormalSign ?? 1);

        const pa = toPt(m.ax + shiftX, m.ay + shiftY);
        const pb = toPt(m.bx + shiftX, m.by + shiftY);
        const p3 = toPt(m.bx + shiftX + th * n.x, m.by + shiftY + th * n.y);
        const p4 = toPt(m.ax + shiftX + th * n.x, m.ay + shiftY + th * n.y);

        // Muro relleno
        stream.push('0.97 0.98 0.99 rg 0.06 0.09 0.16 RG 1.8 w');
        stream.push(`${pa[0].toFixed(2)} ${pa[1].toFixed(2)} m ${pb[0].toFixed(2)} ${pb[1].toFixed(2)} l ${p3[0].toFixed(2)} ${p3[1].toFixed(2)} l ${p4[0].toFixed(2)} ${p4[1].toFixed(2)} l h b`);

        // Eje del muro
        stream.push('0.55 0.60 0.68 RG [2 2] 0 d 0.6 w');
        stream.push(`${pa[0].toFixed(2)} ${pa[1].toFixed(2)} m ${pb[0].toFixed(2)} ${pb[1].toFixed(2)} l s`);
        stream.push('[] 0 d');

        // Línea de cota exterior
        const cotaOffsetMm = -260;
        const cotaPt1 = toPt(m.ax + shiftX + cotaOffsetMm * n.x, m.ay + shiftY + cotaOffsetMm * n.y);
        const cotaPt2 = toPt(m.bx + shiftX + cotaOffsetMm * n.x, m.by + shiftY + cotaOffsetMm * n.y);

        stream.push('0.15 0.39 0.92 RG 0.8 w');
        // Líneas de extensión
        stream.push(`${pa[0].toFixed(2)} ${pa[1].toFixed(2)} m ${cotaPt1[0].toFixed(2)} ${cotaPt1[1].toFixed(2)} l s`);
        stream.push(`${pb[0].toFixed(2)} ${pb[1].toFixed(2)} m ${cotaPt2[0].toFixed(2)} ${cotaPt2[1].toFixed(2)} l s`);
        // Línea de cota principal
        stream.push(`${cotaPt1[0].toFixed(2)} ${cotaPt1[1].toFixed(2)} m ${cotaPt2[0].toFixed(2)} ${cotaPt2[1].toFixed(2)} l s`);

        // Ticks diagonales a 45°
        const tickLen = 4.0;
        stream.push(`${(cotaPt1[0] - tickLen).toFixed(2)} ${(cotaPt1[1] - tickLen).toFixed(2)} m ${(cotaPt1[0] + tickLen).toFixed(2)} ${(cotaPt1[1] + tickLen).toFixed(2)} l s`);
        stream.push(`${(cotaPt2[0] - tickLen).toFixed(2)} ${(cotaPt2[1] - tickLen).toFixed(2)} m ${(cotaPt2[0] + tickLen).toFixed(2)} ${(cotaPt2[1] + tickLen).toFixed(2)} l s`);

        // Texto de cota
        const midCotaX = (cotaPt1[0] + cotaPt2[0]) * 0.5;
        const midCotaY = (cotaPt1[1] + cotaPt2[1]) * 0.5;
        const realMm = w.realLengthMm;
        const dimStr = (realMm && w.status === 'fijado') ? `${realMm} mm` : `~${m.provisionalLengthM} m`;

        texts.push({
          font: 'F2',
          size: 7.5,
          x: midCotaX - 22,
          y: midCotaY + 4,
          text: `${w.code}: ${dimStr}`,
          color: [0.10, 0.25, 0.65]
        });

        // Muros ramificados
        const att = G.detectWallHostAttachment(c, w);
        if (att) {
          const pjPt = toPt(att.joinPoint.x + shiftX, att.joinPoint.y + shiftY);
          stream.push('0.30 0.22 0.75 RG 1.0 w');
          stream.push(`${(pjPt[0] - 3).toFixed(2)} ${(pjPt[1] - 3).toFixed(2)} m ${(pjPt[0] + 3).toFixed(2)} ${(pjPt[1] + 3).toFixed(2)} l s`);
          texts.push({
            font: 'F2',
            size: 6.8,
            x: pjPt[0] + 5,
            y: pjPt[1] + 6,
            text: `Anclaje ${w.code}: +${att.offsetFromStartMm}mm`,
            color: [0.30, 0.22, 0.75]
          });
        }
      }

      // Bases de concreto (pollos)
      for (const pb of (c.concreteBases || [])) {
        const x0 = Number(pb.xMm || 0) + shiftX;
        const y0 = Number(pb.yMm || 0) + shiftY;
        const l = Number(pb.lengthMm || 1000);
        const w = Number(pb.widthMm || 600);
        const pbl = toPt(x0, y0);
        stream.push('0.95 0.96 0.98 rg 0.45 0.50 0.58 RG [3 2] 0 d 0.8 w');
        stream.push(`${pbl[0].toFixed(2)} ${pbl[1].toFixed(2)} ${(l * scale).toFixed(2)} ${(w * scale).toFixed(2)} re b`);
        stream.push('[] 0 d');
        texts.push({
          font: 'F1',
          size: 6.5,
          x: pbl[0] + 4,
          y: pbl[1] + 4,
          text: `${pb.label || 'Pollo'}: ${l}x${w}mm`,
          color: [0.25, 0.30, 0.38]
        });
      }

      // Título de la Planta
      const planTitlePt = toPt(box.minX + shiftX, box.minY + shiftY - 450);
      texts.push({
        font: 'F2',
        size: 9.5,
        x: planTitlePt[0],
        y: planTitlePt[1],
        text: `PLANTA CENITAL: ${c.name} (${c.conceptType || 'AMBIENTE'})`,
        color: [0.06, 0.09, 0.16]
      });

      // 3.2. Dibujar Elevaciones a la derecha
      for (const elev of box.elevs) {
        const w = elev.wall;
        const L = elev.L;
        const H = elev.H;
        const ex0 = elev.relX;
        const ey0 = box.bandY + 500;
        const topPts = G.ensureWallTopControlPoints(w, H, L);

        const pOrigin = toPt(ex0, ey0);
        const wallW = L * scale;

        // Polígono del muro con Puntos de Control Superiores
        stream.push('1 1 1 rg 0.08 0.12 0.20 RG 1.5 w');
        const firstPt = toPt(ex0, ey0);
        stream.push(`${firstPt[0].toFixed(2)} ${firstPt[1].toFixed(2)} m`);
        const pCornerB = toPt(ex0 + L, ey0);
        stream.push(`${pCornerB[0].toFixed(2)} ${pCornerB[1].toFixed(2)} l`);

        for (let i = topPts.length - 1; i >= 0; i--) {
          const ptTop = toPt(ex0 + Number(topPts[i].uMm), ey0 + Number(topPts[i].heightMm));
          stream.push(`${ptTop[0].toFixed(2)} ${ptTop[1].toFixed(2)} l`);
        }
        stream.push('h b');

        // Línea verde de Piso Terminado (NPT 0 mm)
        const pFloor1 = toPt(ex0 - 150, ey0);
        const pFloor2 = toPt(ex0 + L + 150, ey0);
        stream.push('0.05 0.58 0.41 RG 2.0 w');
        stream.push(`${pFloor1[0].toFixed(2)} ${pFloor1[1].toFixed(2)} m ${pFloor2[0].toFixed(2)} ${pFloor2[1].toFixed(2)} l s`);

        // Puntos de control superiores
        for (const pt of topPts) {
          const pTop = toPt(ex0 + Number(pt.uMm), ey0 + Number(pt.heightMm));
          stream.push('0.86 0.15 0.15 RG 1.0 w');
          stream.push(`${(pTop[0] - 2.5).toFixed(2)} ${(pTop[1] - 2.5).toFixed(2)} 5 5 re s`);
          texts.push({
            font: 'F2',
            size: 6.5,
            x: pTop[0] - 14,
            y: pTop[1] + 5,
            text: `${pt.label}: ${Math.round(pt.heightMm)}mm`,
            color: [0.15, 0.23, 0.36]
          });
        }

        // Cota de ancho total del muro
        const pDimL1 = toPt(ex0, ey0 - 220);
        const pDimL2 = toPt(ex0 + L, ey0 - 220);
        stream.push('0.15 0.39 0.92 RG 0.8 w');
        stream.push(`${pDimL1[0].toFixed(2)} ${pDimL1[1].toFixed(2)} m ${pDimL2[0].toFixed(2)} ${pDimL2[1].toFixed(2)} l s`);
        texts.push({
          font: 'F2',
          size: 7.5,
          x: (pDimL1[0] + pDimL2[0]) * 0.5 - 20,
          y: pDimL1[1] - 10,
          text: `Ancho ${w.label}: ${Math.round(L)} mm`,
          color: [0.10, 0.25, 0.65]
        });

        // Título de la elevación
        texts.push({
          font: 'F2',
          size: 8.5,
          x: pOrigin[0],
          y: pOrigin[1] + elev.maxH * scale + 18,
          text: `ELEVACIÓN: ${w.label} (${w.code})`,
          color: [0.06, 0.09, 0.16]
        });

        // Elementos y Vanos con sus cotas
        for (const el of (w.elements || [])) {
          if (G.isOpeningElement(el)) {
            // Vano de Puerta o Ventana con Cotas Rojas a Paños
            const ew = Number(el.widthMm || 900);
            const eh = Number(el.heightMm || 2100);
            const uMid = Number(el.references?.distLeftMm || 0) + ew * 0.5;
            const hAtMid = G.getWallHeightAtU(w, uMid, H, L);
            const r = G.normalizeOpeningReferences(el, L, hAtMid);
            const uStart = Number(r.distLeftMm ?? 0);
            const uEnd = uStart + ew;
            const uRight = Number(r.distRightMm ?? (L - uEnd));
            const vStart = Number(r.distFloorMm ?? 0);
            const vEnd = vStart + eh;
            const vTop = Number(r.distTopMm ?? (hAtMid - vEnd));

            const pVanoBL = toPt(ex0 + uStart, ey0 + vStart);
            const vw = ew * scale;
            const vh = eh * scale;

            // Rectángulo del vano
            stream.push('0.88 0.95 0.99 rg 0.01 0.52 0.78 RG 1.2 w');
            stream.push(`${pVanoBL[0].toFixed(2)} ${pVanoBL[1].toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)} re b`);

            // Cotas Rojas a Paños de Inicio y Fin
            stream.push('0.86 0.15 0.15 RG 0.9 w');
            const cy = pVanoBL[1] + vh * 0.5;
            const cx = pVanoBL[0] + vw * 0.5;

            // Izquierda
            if (uStart > 0) {
              stream.push(`${pOrigin[0].toFixed(2)} ${cy.toFixed(2)} m ${pVanoBL[0].toFixed(2)} ${cy.toFixed(2)} l s`);
            }
            // Derecha
            if (uRight > 0) {
              stream.push(`${(pVanoBL[0] + vw).toFixed(2)} ${cy.toFixed(2)} m ${(pOrigin[0] + wallW).toFixed(2)} ${cy.toFixed(2)} l s`);
            }
            // Piso
            if (vStart > 0) {
              stream.push(`${cx.toFixed(2)} ${pOrigin[1].toFixed(2)} m ${cx.toFixed(2)} ${pVanoBL[1].toFixed(2)} l s`);
            }
            // Techo
            const pCeilY = toPt(ex0 + uMid, ey0 + hAtMid)[1];
            if (vTop > 0) {
              stream.push(`${cx.toFixed(2)} ${(pVanoBL[1] + vh).toFixed(2)} m ${cx.toFixed(2)} ${pCeilY.toFixed(2)} l s`);
            }

            texts.push({
              font: 'F2',
              size: 6.8,
              x: pVanoBL[0] + 3,
              y: pVanoBL[1] + vh * 0.5 - 3,
              text: `${el.code} (${ew}x${eh}) Izq:${Math.round(uStart)} Der:${Math.round(uRight)}`,
              color: [0.86, 0.15, 0.15]
            });
            continue;
          }

          // Dispositivo Eléctrico o Hidrosanitario
          const refs = el.references || {};
          const uL = Number(refs.distLeftMm ?? L * 0.5);
          const vF = Number(refs.distFloorMm ?? 1100);
          const pEl = toPt(ex0 + uL, ey0 + vF);
          const isElec = el.category === 'ELECTRICAL';

          stream.push(isElec ? '0.86 0.15 0.15 RG 1 w' : '0.15 0.39 0.92 RG 1 w');
          stream.push(`${(pEl[0] - 3).toFixed(2)} ${(pEl[1] - 3).toFixed(2)} 6 6 re s`);

          // Líneas guía axiales
          stream.push('0.60 0.65 0.72 RG [2 2] 0 d 0.5 w');
          stream.push(`${pOrigin[0].toFixed(2)} ${pEl[1].toFixed(2)} m ${(pOrigin[0] + wallW).toFixed(2)} ${pEl[1].toFixed(2)} l s`);
          stream.push(`${pEl[0].toFixed(2)} ${pOrigin[1].toFixed(2)} m ${pEl[0].toFixed(2)} ${(pOrigin[1] + H * scale).toFixed(2)} l s`);
          stream.push('[] 0 d');

          texts.push({
            font: 'F1',
            size: 6.2,
            x: pEl[0] + 5,
            y: pEl[1] + 3,
            text: `${el.code} (${Math.round(uL)} / Piso ${Math.round(vF)})`,
            color: [0.15, 0.23, 0.36]
          });
        }
      }
    }

    // Pie de página de la lámina
    texts.push({
      font: 'F1',
      size: 8,
      x: margin + 10,
      y: margin + 12,
      text: `EXPEDIENTE AS-BUILT · LÁMINA DXF CON COTAS · Generado el ${new Date().toLocaleString()} · Rhino 8 Compatible`,
      color: [0.35, 0.42, 0.52]
    });

    // 4. Compilar archivo PDF 1.4 Vectorial Nativo
    const streamContent = [];
    for (const op of stream) streamContent.push(op);
    for (const t of texts) {
      const escaped = String(t.text || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      const r = t.color[0], g = t.color[1], b = t.color[2];
      streamContent.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
      streamContent.push(`BT /${t.font} ${t.size} Tf ${t.x.toFixed(2)} ${t.y.toFixed(2)} Td (${escaped}) Tj ET`);
    }

    const streamBytes = new TextEncoder().encode(streamContent.join('\n'));
    const pdfParts = [];
    const offsets = [];

    pdfParts.push(new TextEncoder().encode('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));

    function addObj(objData) {
      const curOffset = pdfParts.reduce((acc, p) => acc + p.length, 0);
      offsets.push(curOffset);
      const prefix = new TextEncoder().encode(`${offsets.length} 0 obj\n`);
      const suffix = new TextEncoder().encode('\nendobj\n');
      pdfParts.push(prefix, objData, suffix);
    }

    addObj(new TextEncoder().encode('<< /Type /Catalog /Pages 2 0 R >>'));
    addObj(new TextEncoder().encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    addObj(new TextEncoder().encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`));
    
    // Contenido
    const streamHeader = new TextEncoder().encode(`<< /Length ${streamBytes.length} >>\nstream\n`);
    const streamFooter = new TextEncoder().encode('\nendstream');
    const fullStreamObj = new Uint8Array(streamHeader.length + streamBytes.length + streamFooter.length);
    fullStreamObj.set(streamHeader, 0);
    fullStreamObj.set(streamBytes, streamHeader.length);
    fullStreamObj.set(streamFooter, streamHeader.length + streamBytes.length);
    addObj(fullStreamObj);

    addObj(new TextEncoder().encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
    addObj(new TextEncoder().encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'));

    const xrefOffset = pdfParts.reduce((acc, p) => acc + p.length, 0);
    let xrefStr = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      xrefStr += String(off).padStart(10, '0') + ' 00000 n \n';
    }
    xrefStr += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    pdfParts.push(new TextEncoder().encode(xrefStr));

    return new Blob(pdfParts, { type: 'application/pdf' });
  }

  /**
   * Genera el HTML / SVG interactivo para visualización instantánea en pantalla
   */
  function generateDxfLayoutSvgHtml(project, auditInfo) {
    const G = global.ASBuiltGeometry;
    const safeName = String(project.name || 'Levantamiento');

    // Mismo cálculo espacial que para el PDF
    const concepts = project.concepts || [];
    let currentBandY = 0;
    const bandGapY = 3200;
    const viewGapX = 1800;

    let svgElements = [];
    let maxXOverall = 5000;

    for (const c of concepts) {
      if (c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL') {
        const ds = c.doorSurvey || {};
        const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm || project.predominantHeightMm, ds.baseOffsetMm);
        const mins = ev.referenceMinimumsMm || { widthMm: 900, heightMm: 2100, thicknessMm: 150 };
        const x0 = 400, y0 = currentBandY + 500;
        svgElements.push(`
          <g class="cad-door">
            <rect x="${x0}" y="${y0}" width="${mins.widthMm}" height="${mins.heightMm}" fill="#e0f2fe" stroke="#0284c7" stroke-width="6"/>
            <rect x="${x0 + mins.widthMm + 250}" y="${y0}" width="${mins.thicknessMm}" height="${mins.heightMm}" fill="#f1f5f9" stroke="#475569" stroke-width="4"/>
            <text x="${x0 + mins.widthMm * 0.5}" y="${y0 - 60}" fill="#1e40af" font-size="110" font-weight="bold" text-anchor="middle">Ancho Mín: ${mins.widthMm} mm</text>
            <text x="${x0 - 80}" y="${y0 + mins.heightMm * 0.5}" fill="#1e40af" font-size="110" font-weight="bold" text-anchor="end">Alto Mín: ${mins.heightMm} mm</text>
            <text x="${x0}" y="${y0 + mins.heightMm + 220}" fill="#0f172a" font-size="140" font-weight="bold">PUERTA FRONTAL: ${c.name} (9 Mediciones)</text>
          </g>
        `);
        currentBandY += mins.heightMm + bandGapY;
        continue;
      }

      const vmap = G.getVertexMap(c);
      const xs = (c.vertices || []).map((v) => Number(v.xMm));
      const ys = (c.vertices || []).map((v) => Number(v.yMm));
      const minX = xs.length ? Math.min(...xs) : 0;
      const maxX = xs.length ? Math.max(...xs) : 2500;
      const minY = ys.length ? Math.min(...ys) : 0;
      const maxY = ys.length ? Math.max(...ys) : 2000;
      const shiftX = -minX + 500;
      const shiftY = currentBandY - minY + 500;

      // Planta
      for (const w of (c.walls || [])) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = m.geomLengthMm || 1;
        const tx = (m.bx - m.ax) / L;
        const ty = (m.by - m.ay) / L;
        const th = Number(w.thicknessMm || 150);
        const n = G.outwardNormalForWall(tx, ty, w.outwardNormalSign ?? 1);

        const x1 = m.ax + shiftX, y1 = m.ay + shiftY;
        const x2 = m.bx + shiftX, y2 = m.by + shiftY;
        const x3 = x2 + th * n.x, y3 = y2 + th * n.y;
        const x4 = x1 + th * n.x, y4 = y1 + th * n.y;

        svgElements.push(`
          <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="#f8fafc" stroke="#0f172a" stroke-width="25"/>
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-dasharray="25,25" stroke-width="8"/>
        `);

        // Cota exterior
        const cOff = -320;
        const cx1 = x1 + cOff * n.x, cy1 = y1 + cOff * n.y;
        const cx2 = x2 + cOff * n.x, cy2 = y2 + cOff * n.y;
        const dimStr = (w.realLengthMm && w.status === 'fijado') ? `${w.realLengthMm} mm` : `~${m.provisionalLengthM} m`;

        svgElements.push(`
          <g class="dim-line">
            <line x1="${x1}" y1="${y1}" x2="${cx1}" y2="${cy1}" stroke="#2563eb" stroke-width="10"/>
            <line x1="${x2}" y1="${y2}" x2="${cx2}" y2="${cy2}" stroke="#2563eb" stroke-width="10"/>
            <line x1="${cx1}" y1="${cy1}" x2="${cx2}" y2="${cy2}" stroke="#2563eb" stroke-width="14"/>
            <line x1="${cx1 - 35}" y1="${cy1 - 35}" x2="${cx1 + 35}" y2="${cy1 + 35}" stroke="#2563eb" stroke-width="16"/>
            <line x1="${cx2 - 35}" y1="${cy2 - 35}" x2="${cx2 + 35}" y2="${cy2 + 35}" stroke="#2563eb" stroke-width="16"/>
            <text x="${(cx1 + cx2) * 0.5}" y="${(cy1 + cy2) * 0.5 - 40}" fill="#1e3a8a" font-size="115" font-weight="bold" text-anchor="middle">${w.label} (${w.code}): ${dimStr}</text>
          </g>
        `);

        const att = G.detectWallHostAttachment(c, w);
        if (att) {
          const px = att.joinPoint.x + shiftX;
          const py = att.joinPoint.y + shiftY;
          svgElements.push(`
            <circle cx="${px}" cy="${py}" r="45" fill="#4338ca"/>
            <text x="${px + 60}" y="${py + 70}" fill="#4338ca" font-size="95" font-weight="bold">📍 Anclaje ${w.code}: +${att.offsetFromStartMm}mm</text>
          `);
        }
      }

      // Elevaciones a la derecha
      let nextElevX = (maxX - minX) + 1200 + viewGapX;
      let bandMaxH = (maxY - minY) + 1200;

      for (const w of (c.walls || [])) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = Number(w.realLengthMm || m.geomLengthMm || 1000);
        const H = Number(w.heightMm || c.heightMm || project.predominantHeightMm || 2600);
        const topPts = G.ensureWallTopControlPoints(w, H, L);
        const maxH = G.getWallMaxHeight(w, H, L);
        const ex0 = nextElevX;
        const ey0 = currentBandY + 500;

        const polyPts = [`${ex0},${ey0}`, `${ex0 + L},${ey0}`];
        for (let i = topPts.length - 1; i >= 0; i--) {
          polyPts.push(`${ex0 + Number(topPts[i].uMm)},${ey0 + Number(topPts[i].heightMm)}`);
        }

        svgElements.push(`
          <g class="elevation-block">
            <polygon points="${polyPts.join(' ')}" fill="#ffffff" stroke="#0f172a" stroke-width="22"/>
            <line x1="${ex0 - 200}" y1="${ey0}" x2="${ex0 + L + 200}" y2="${ey0}" stroke="#059669" stroke-width="28"/>
            <text x="${ex0 - 220}" y="${ey0 - 30}" fill="#059669" font-size="90" font-weight="bold" text-anchor="end">NPT 0.00</text>
            <text x="${ex0}" y="${ey0 + maxH + 280}" fill="#0f172a" font-size="130" font-weight="bold">ELEVACIÓN ${w.label} (${w.code})</text>
            <text x="${ex0 + L * 0.5}" y="${ey0 - 100}" fill="#1e3a8a" font-size="110" font-weight="bold" text-anchor="middle">Ancho: ${L} mm</text>
          </g>
        `);

        for (const pt of topPts) {
          svgElements.push(`
            <rect x="${ex0 + Number(pt.uMm) - 25}" y="${ey0 + Number(pt.heightMm) - 25}" width="50" height="50" fill="#dc2626"/>
            <text x="${ex0 + Number(pt.uMm)}" y="${ey0 + Number(pt.heightMm) + 90}" fill="#0f172a" font-size="90" font-weight="bold" text-anchor="middle">${pt.label}: ${Math.round(pt.heightMm)}mm</text>
          `);
        }

        // Vanos e instalaciones
        for (const el of (w.elements || [])) {
          if (G.isOpeningElement(el)) {
            const ew = Number(el.widthMm || 900);
            const eh = Number(el.heightMm || 2100);
            const uMid = Number(el.references?.distLeftMm || 0) + ew * 0.5;
            const hAtMid = G.getWallHeightAtU(w, uMid, H, L);
            const r = G.normalizeOpeningReferences(el, L, hAtMid);
            const uStart = Number(r.distLeftMm ?? 0);
            const uEnd = uStart + ew;
            const uRight = Number(r.distRightMm ?? (L - uEnd));
            const vStart = Number(r.distFloorMm ?? 0);
            const vEnd = vStart + eh;
            const vTop = Number(r.distTopMm ?? (hAtMid - vEnd));

            const x1 = ex0 + uStart, y1 = ey0 + vStart;
            const x2 = ex0 + uEnd, y2 = ey0 + vEnd;
            const cy = (y1 + y2) * 0.5;
            const cx = (x1 + x2) * 0.5;

            svgElements.push(`
              <g class="cad-opening">
                <rect x="${x1}" y="${y1}" width="${ew}" height="${eh}" fill="#e0f2fe" stroke="#0284c7" stroke-width="16"/>
                <!-- Cotas Rojas a Paños -->
                <line x1="${ex0}" y1="${cy}" x2="${x1}" y2="${cy}" stroke="#dc2626" stroke-width="12"/>
                <line x1="${x2}" y1="${cy}" x2="${ex0 + L}" y2="${cy}" stroke="#dc2626" stroke-width="12"/>
                <line x1="${cx}" y1="${ey0}" x2="${cx}" y2="${y1}" stroke="#dc2626" stroke-width="12"/>
                <line x1="${cx}" y1="${y2}" x2="${cx}" y2="${ey0 + hAtMid}" stroke="#dc2626" stroke-width="12"/>
                <!-- Ticks diagonales rojos -->
                <line x1="${x1 - 25}" y1="${cy - 25}" x2="${x1 + 25}" y2="${cy + 25}" stroke="#dc2626" stroke-width="16"/>
                <line x1="${x2 - 25}" y1="${cy - 25}" x2="${x2 + 25}" y2="${cy + 25}" stroke="#dc2626" stroke-width="16"/>
                <text x="${cx}" y="${y2 + 80}" fill="#dc2626" font-size="95" font-weight="bold" text-anchor="middle">${el.code} (${ew}x${eh}) Izq:${Math.round(uStart)} Der:${Math.round(uRight)} Piso:${Math.round(vStart)}</text>
              </g>
            `);
          } else {
            const refs = el.references || {};
            const uL = Number(refs.distLeftMm ?? L * 0.5);
            const vF = Number(refs.distFloorMm ?? 1100);
            const cx = ex0 + uL;
            const cy = ey0 + vF;
            const isElec = el.category === 'ELECTRICAL';

            svgElements.push(`
              <g class="cad-mep">
                <rect x="${cx - 40}" y="${cy - 40}" width="80" height="80" fill="${isElec ? '#fee2e2' : '#dbeafe'}" stroke="${isElec ? '#dc2626' : '#2563eb'}" stroke-width="10"/>
                <line x1="${ex0}" y1="${cy}" x2="${ex0 + L}" y2="${cy}" stroke="#94a3b8" stroke-dasharray="25,25" stroke-width="6"/>
                <line x1="${cx}" y1="${ey0}" x2="${cx}" y2="${ey0 + H}" stroke="#94a3b8" stroke-dasharray="25,25" stroke-width="6"/>
                <text x="${cx + 50}" y="${cy + 50}" fill="#0f172a" font-size="80" font-weight="bold">${el.code} (${Math.round(uL)}/P:${Math.round(vF)})</text>
              </g>
            `);
          }
        }

        nextElevX += L + viewGapX;
        bandMaxH = Math.max(bandMaxH, maxH + 1200);
      }

      maxXOverall = Math.max(maxXOverall, nextElevX);
      currentBandY += bandMaxH + bandGapY;
    }

    const totalSvgH = currentBandY + 1500;
    const totalSvgW = maxXOverall + 1000;

    return `
      <svg viewBox="0 0 ${totalSvgW} ${totalSvgH}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto; background:#ffffff; font-family:Arial, sans-serif;">
        <defs>
          <pattern id="grid" width="500" height="500" patternUnits="userSpaceOnUse">
            <path d="M 500 0 L 0 0 0 500" fill="none" stroke="#f1f5f9" stroke-width="4"/>
          </pattern>
        </defs>
        <rect width="${totalSvgW}" height="${totalSvgH}" fill="url(#grid)"/>
        
        <!-- Borde perimetral de lámina -->
        <rect x="150" y="150" width="${totalSvgW - 300}" height="${totalSvgH - 300}" fill="none" stroke="#0f172a" stroke-width="30"/>

        <!-- Cuadro de datos superior -->
        <rect x="250" y="250" width="${totalSvgW - 500}" height="450" fill="#f8fafc" stroke="#0f172a" stroke-width="15"/>
        <text x="350" y="450" fill="#0f172a" font-size="200" font-weight="bold">PLANO AS-BUILT 2D (LAYOUT DXF CON COTAS) — ${safeName.toUpperCase()}</text>
        <text x="350" y="600" fill="#475569" font-size="120">Cliente/Obra: ${project.client || 'N/A'} | Unidades: mm | Sello: ${auditInfo.stampText}</text>

        <!-- Elementos del plano -->
        <g transform="translate(100, 400)">
          ${svgElements.join('\n')}
        </g>
      </svg>
    `;
  }

  /**
   * Abre una ventana interactiva de visualización instantánea del plano DXF en PDF/SVG
   */
  function openDxfPdfVisualizer(project) {
    const G = global.ASBuiltGeometry;
    const auditInfo = G.auditProjectForExport(project);
    const safeName = String(project.name || 'Levantamiento').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const svgHtml = generateDxfLayoutSvgHtml(project, auditInfo);

    let win = null;
    try {
      win = window.open('', '_blank');
    } catch (_) {}

    const viewerHtml = `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Plano DXF con Cotas (Visualización Instantánea) — ${project.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
          .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: #1e293b; border-bottom: 2px solid #334155; flex-shrink: 0; }
          .toolbar-title { font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
          .badge { background: #047857; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .btn-group { display: flex; gap: 8px; }
          .btn { background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
          .btn:hover { background: #2563eb; }
          .btn-success { background: #10b981; }
          .btn-success:hover { background: #059669; }
          .btn-outline { background: transparent; border: 1.5px solid #64748b; color: #f8fafc; }
          .btn-outline:hover { background: #334155; }
          .viewport { flex: 1; overflow: auto; padding: 20px; display: flex; justify-content: center; align-items: flex-start; background: #090d16; }
          .sheet-container { background: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 4px; max-width: 98%; width: 100%; margin: auto; }
          @media print {
            .toolbar { display: none !important; }
            .viewport { padding: 0; background: #fff; }
            .sheet-container { box-shadow: none; max-width: 100%; width: 100%; }
            body { background: #fff; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar no-print">
          <div class="toolbar-title">
            <span>📐 Plano AS-BUILT 2D (Versión DXF con Cotas en mm)</span>
            <span class="badge">Rhino 8 Compatible</span>
            <span style="font-size:12px; color:#94a3b8;">${escapeHtml(project.name)}</span>
          </div>
          <div class="btn-group">
            <button class="btn btn-success" onclick="downloadDxfPdf()">💾 Descargar PDF de este Plano</button>
            <button class="btn btn-outline" onclick="window.print()">🖨 Imprimir / Guardar en PDF</button>
            <button class="btn btn-outline" onclick="window.close()">✖ Cerrar</button>
          </div>
        </div>
        <div class="viewport">
          <div class="sheet-container" id="sheetContainer">
            ${svgHtml}
          </div>
        </div>
        <script>
          function downloadDxfPdf() {
            if (window.opener && window.opener.ASBuiltPdfExporter) {
              window.opener.ASBuiltPdfExporter.triggerDxfPdfDownload();
            } else {
              window.print();
            }
          }
        <\/script>
      </body>
      </html>`;

    if (win) {
      win.document.open();
      win.document.write(viewerHtml);
      win.document.close();
    } else {
      renderPrintModalInPage(project, [
        `<div style="background:#fff; padding:10px; border-radius:8px;">
          <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <h3>Plano AS-BUILT 2D (Versión DXF con Cotas)</h3>
            <button class="btn btn-success" onclick="ASBuiltPdfExporter.triggerDxfPdfDownload()">💾 Descargar PDF</button>
          </div>
          ${svgHtml}
        </div>`
      ]);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  /**
   * Descarga dual: Expediente PDF AS-BUILT + Versión del DXF en PDF con Cotas
   */
  async function downloadProjectPdf(project, confirmPreliminary = true) {
    const G = global.ASBuiltGeometry;
    const auditInfo = G.auditProjectForExport(project);
    if (auditInfo.requiresPreliminaryConfirmation && !confirmPreliminary) {
      throw new Error('Debe confirmar la exportación preliminar.');
    }

    const safeName = String(project.name || 'Levantamiento').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const filenamePdf = `${safeName}_ASBUILT_MM.pdf`;
    const filenameDxfPdf = `${safeName}_DXF_CON_COTAS.pdf`;

    let serverPdfDownloaded = false;

    // 1. Intentar con servidor local ReportLab
    try {
      const resp = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, confirmPreliminary })
      });
      if (resp.ok) {
        const blob = await resp.blob();
        triggerBlobDownload(blob, filenamePdf);
        serverPdfDownloaded = true;
      }
    } catch (_) {}

    // 2. Exportar la versión del DXF en PDF con cotas (vectorial)
    try {
      let serverDxfPdfDownloaded = false;
      try {
        const respDxf = await fetch('/api/export/dxf-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project, confirmPreliminary })
        });
        if (respDxf.ok) {
          const blobDxf = await respDxf.blob();
          triggerBlobDownload(blobDxf, filenameDxfPdf);
          serverDxfPdfDownloaded = true;
        }
      } catch (_) {}

      if (!serverDxfPdfDownloaded) {
        const dxfPdfBlob = generateDxfLayoutPdfBlob(project, auditInfo);
        triggerBlobDownload(dxfPdfBlob, filenameDxfPdf);
      }
    } catch (err) {
      console.warn('Error generando DXF PDF vectorial local:', err);
    }

    // 3. Abrir la visualización instantánea en pantalla
    openDxfPdfVisualizer(project);

    // 4. Si el servidor no estaba activo, abrir también el reporte imprimible
    if (!serverPdfDownloaded) {
      openClientPrintableVectorReport(project, auditInfo);
    }

    return {
      mode: serverPdfDownloaded ? 'SERVER_REPORTLAB_PLUS_DXF_PDF' : 'CLIENT_VECTOR_PRINT_PLUS_DXF_PDF',
      filename: filenamePdf,
      dxfPdfFilename: filenameDxfPdf
    };
  }

  function triggerDxfPdfDownload() {
    if (!global.App || !global.App.state || !global.App.state.project) return;
    const project = global.App.state.project;
    const G = global.ASBuiltGeometry;
    const auditInfo = G.auditProjectForExport(project);
    const safeName = String(project.name || 'Levantamiento').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const blob = generateDxfLayoutPdfBlob(project, auditInfo);
    triggerBlobDownload(blob, `${safeName}_DXF_CON_COTAS.pdf`);
  }

  function openClientPrintableVectorReport(project, auditInfo) {
    const G = global.ASBuiltGeometry;
    const sectionsHtml = [];

    // Incluir como primera lámina el Plano General DXF con Cotas
    const dxfSvg = generateDxfLayoutSvgHtml(project, auditInfo);
    sectionsHtml.push(`
      <div class="sheet" style="padding:10px;">
        <div class="sheet-header">
          <div><strong>LÁMINA 1: PLANO AS-BUILT 2D (VERSIÓN DXF CON COTAS)</strong> — ${project.name}</div>
          <div><strong>UNIDADES:</strong> mm | <strong>ESCALA:</strong> Cotas en mm gobiernan</div>
        </div>
        <div class="stamp ${auditInfo.requiresPreliminaryConfirmation ? 'prelim' : 'ok'}">${auditInfo.stampText}</div>
        <div style="width:100%; overflow:hidden; border:1px solid #cbd5e1; border-radius:4px; margin-top:8px;">
          ${dxfSvg}
        </div>
      </div>
    `);

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
        const att = G.detectWallHostAttachment(c, w);
        const attNote = att ? ` <br><small style="color:#4338ca;">📍 Nace en ${att.hostWallLabel}: Inicio ${att.offsetFromStartMm} mm | Fin ${att.offsetFromEndMm} mm</small>` : '';
        return `<tr><td><strong>${w.label} (${w.code})</strong>${attNote}</td><td>${w.realLengthMm ? w.realLengthMm + ' mm' : '~' + m.provisionalLengthM + ' m (Prov.)'}</td><td>${w.heightMm || c.heightMm || project.predominantHeightMm} mm</td><td>${w.thicknessMm || 150} mm</td><td>${w.angleDeg ?? m.geomAngleDeg}°</td><td>${w.status.toUpperCase()}</td></tr>`;
      }).join('');

      const elevBlocks = (c.walls || []).map((w) => {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
        const H = Number(w.heightMm || c.heightMm || project.predominantHeightMm || 2600);
        const topPts = G.ensureWallTopControlPoints(w, H, L);
        const topSummary = topPts.map((pt) => `${pt.label}: H=${Math.round(pt.heightMm)} mm (X=${Math.round(pt.uMm)})`).join(' | ');

        const elRows = (w.elements || []).map((el) => {
          const isOp = G.isOpeningElement(el);
          const r = el.references || {};
          const modeLabel = isOp
            ? `${el.label} (${el.widthMm}×${el.heightMm} mm · Paño Inicio/Fin)`
            : `${el.label} (Eje Central)`;
          return `<tr><td>${el.code}</td><td>${modeLabel}</td><td>${Math.round(r.distLeftMm || 0)} mm</td><td>${Math.round(r.distRightMm || 0)} mm</td><td>${Math.round(r.distFloorMm || 0)} mm</td><td>${Math.round(r.distTopMm || 0)} mm</td><td>${el.provenance}</td></tr>`;
        }).join('') || '<tr><td colspan="7">Sin instalaciones registradas en este muro.</td></tr>';
        return `
          <div style="margin-top:12px;">
            <h4>Elevación ${w.label} (${w.code}) — Ancho: ${L} mm | Puntos de Control Superiores: ${topSummary}</h4>
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
            <strong>Reporte PDF / Láminas Imprimibles</strong> — ${escapeHtml(project.name)}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-success" onclick="ASBuiltPdfExporter.triggerDxfPdfDownload()">💾 Descargar DXF en PDF</button>
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
    downloadProjectPdf,
    openDxfPdfVisualizer,
    generateDxfLayoutPdfBlob,
    generateDxfLayoutSvgHtml,
    triggerDxfPdfDownload
  };
})(window);
