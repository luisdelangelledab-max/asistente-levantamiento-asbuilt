/* ==========================================================================
   EXPORTADOR DXF 2D R2010 (AC1024) EN CLIENTE + HÍBRIDO SERVIDOR
   Garantiza geometría 2D editable en mm para Rhinoceros 8 en modo Web/Tablet
   ========================================================================== */
(function (global) {
  'use strict';

  const LAYERS = [
    { name: 'A_MUROS_CONTORNO', color: 7 },
    { name: 'A_MUROS_EJES', color: 8 },
    { name: 'A_BASES_CONCRETO', color: 9 },
    { name: 'A_SARDINELES', color: 6 },
    { name: 'A_VANOS', color: 30 },
    { name: 'A_VENTANAS', color: 4 },
    { name: 'I_ELECTRICA', color: 1 },
    { name: 'I_HIDROSANITARIA', color: 5 },
    { name: 'C_COTAS', color: 3 },
    { name: 'C_IDENTIFICADORES', color: 2 },
    { name: 'REF_ELEVACIONES', color: 8 }
  ];

  function sanitizeText(str) {
    return String(str || '')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  function generateClientDxfString(project, auditInfo) {
    let handleCounter = 1000;
    const nextHandle = () => (++handleCounter).toString(16).toUpperCase();

    const entities = [];

    const addLwPolyline = (pts, layer, closed = true) => {
      const clean = [];
      for (const p of pts) {
        if (!clean.length || Math.hypot(p[0] - clean[clean.length - 1][0], p[1] - clean[clean.length - 1][1]) >= 0.01) {
          clean.push([Number(p[0].toFixed(3)), Number(p[1].toFixed(3))]);
        }
      }
      if (clean.length >= 2 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 0.01) {
        clean.pop();
      }
      if (clean.length < 2) return;
      const lines = [
        '  0', 'LWPOLYLINE',
        '  5', nextHandle(),
        '330', '17',
        '100', 'AcDbEntity',
        '  8', layer,
        '100', 'AcDbPolyline',
        ' 90', String(clean.length),
        ' 70', closed ? '1' : '0',
        ' 43', '0.0',
        ' 38', '0.0'
      ];
      for (const pt of clean) {
        lines.push(' 10', pt[0].toFixed(3), ' 20', pt[1].toFixed(3));
      }
      entities.push(lines.join('\r\n'));
    };

    const addLine = (p1, p2, layer) => {
      entities.push([
        '  0', 'LINE',
        '  5', nextHandle(),
        '330', '17',
        '100', 'AcDbEntity',
        '  8', layer,
        '100', 'AcDbLine',
        ' 10', Number(p1[0]).toFixed(3),
        ' 20', Number(p1[1]).toFixed(3),
        ' 30', '0.0',
        ' 11', Number(p2[0]).toFixed(3),
        ' 21', Number(p2[1]).toFixed(3),
        ' 31', '0.0'
      ].join('\r\n'));
    };

    const addCircle = (center, radius, layer) => {
      entities.push([
        '  0', 'CIRCLE',
        '  5', nextHandle(),
        '330', '17',
        '100', 'AcDbEntity',
        '  8', layer,
        '100', 'AcDbCircle',
        ' 10', Number(center[0]).toFixed(3),
        ' 20', Number(center[1]).toFixed(3),
        ' 30', '0.0',
        ' 40', Math.max(Number(radius), 1).toFixed(3)
      ].join('\r\n'));
    };

    const addText = (textStr, x, y, height, layer) => {
      const clean = sanitizeText(textStr);
      if (!clean) return;
      entities.push([
        '  0', 'TEXT',
        '  5', nextHandle(),
        '330', '17',
        '100', 'AcDbEntity',
        '  8', layer,
        '100', 'AcDbText',
        ' 10', Number(x).toFixed(3),
        ' 20', Number(y).toFixed(3),
        ' 30', '0.0',
        ' 40', Number(height).toFixed(3),
        '  1', clean
      ].join('\r\n'));
    };

    const addLinearDim = (p1, p2, offset, labelText) => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const L = Math.hypot(dx, dy);
      if (L < 1e-3) return;
      const tx = dx / L, ty = dy / L;
      const nx = -ty, ny = tx;
      const d1 = [p1[0] + offset * nx, p1[1] + offset * ny];
      const d2 = [p2[0] + offset * nx, p2[1] + offset * ny];
      addLine(p1, d1, 'C_COTAS');
      addLine(p2, d2, 'C_COTAS');
      addLine(d1, d2, 'C_COTAS');
      addText(labelText, 0.5 * (d1[0] + d2[0]) - 120, 0.5 * (d1[1] + d2[1]) + 25, 50, 'C_COTAS');
    };

    const G = global.ASBuiltGeometry;
    const stampText = (auditInfo && auditInfo.stampText) || 'LEVANTAMIENTO AS-BUILT (MM)';
    addText(`PROYECTO AS-BUILT: ${project.name || 'Proyecto'} | UNIDADES: MILIMETROS (MM)`, 0, -900, 130, 'C_IDENTIFICADORES');
    addText(`ESTADO: ${stampText}`, 0, -1100, 90, 'C_IDENTIFICADORES');

    let currentBandY = 0;
    const bandGapY = 3500;
    const viewGapX = 1800;

    for (const concept of (project.concepts || [])) {
      const cname = concept.name || 'Concepto';
      if (concept.conceptType === 'PUERTA' || concept.mode === 'DOOR_FRONTAL') {
        const ds = concept.doorSurvey || {};
        const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm || project.predominantHeightMm, ds.baseOffsetMm);
        const mins = ev.referenceMinimumsMm || { widthMm: 900, heightMm: 2100, thicknessMm: 150 };
        const x0 = 400, y0 = currentBandY + 500;
        addLwPolyline([[x0, y0], [x0 + mins.widthMm, y0], [x0 + mins.widthMm, y0 + mins.heightMm], [x0, y0 + mins.heightMm]], 'A_VANOS', true);
        const sx0 = x0 + mins.widthMm + 650;
        addLwPolyline([[sx0, y0], [sx0 + mins.thicknessMm, y0], [sx0 + mins.thicknessMm, y0 + mins.heightMm], [sx0, y0 + mins.heightMm]], 'A_VANOS', true);
        addLinearDim([x0, y0], [x0 + mins.widthMm, y0], -200, `ANCHO MIN REF: ${mins.widthMm} mm`);
        addLinearDim([x0, y0], [x0, y0 + mins.heightMm], 200, `ALTO MIN REF: ${mins.heightMm} mm`);
        addLinearDim([sx0, y0], [sx0 + mins.thicknessMm, y0], -200, `ESPESOR MIN REF: ${mins.thicknessMm} mm`);
        const rw = (ev.originalReadingsMm || {}).widths || {};
        const rh = (ev.originalReadingsMm || {}).heights || {};
        const rt = (ev.originalReadingsMm || {}).thicknesses || {};
        addText(`PUERTA: ${cname} | 9 LECTURAS ORIGINALES (MM):`, sx0 + 450, y0 + mins.heightMm - 100, 55, 'C_IDENTIFICADORES');
        addText(`ANCHOS Inf:${rw.inferior} Med:${rw.medio} Sup:${rw.superior} mm -> MIN: ${mins.widthMm} mm`, sx0 + 450, y0 + mins.heightMm - 210, 48, 'C_IDENTIFICADORES');
        addText(`ALTOS Izq:${rh.izquierdo} Cen:${rh.centro} Der:${rh.derecho} mm -> MIN: ${mins.heightMm} mm`, sx0 + 450, y0 + mins.heightMm - 320, 48, 'C_IDENTIFICADORES');
        addText(`ESPESORES Sup:${rt.superior} Med:${rt.medio} Inf:${rt.inferior} mm -> MIN: ${mins.thicknessMm} mm`, sx0 + 450, y0 + mins.heightMm - 430, 48, 'C_IDENTIFICADORES');
        currentBandY += mins.heightMm + bandGapY;
        continue;
      }

      const vmap = G.getVertexMap(concept);
      const walls = concept.walls || [];
      const xs = (concept.vertices || []).map((v) => Number(v.xMm));
      const ys = (concept.vertices || []).map((v) => Number(v.yMm));
      const minX = xs.length ? Math.min(...xs) : 0;
      const maxX = xs.length ? Math.max(...xs) : 2500;
      const minY = ys.length ? Math.min(...ys) : 0;
      const maxY = ys.length ? Math.max(...ys) : 2000;
      const shiftX = -minX + 500;
      const shiftY = currentBandY - minY + 500;

      for (const w of walls) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = m.geomLengthMm || 1;
        const tx = (m.bx - m.ax) / L;
        const ty = (m.by - m.ay) / L;
        const th = Number(w.thicknessMm || 150);
        const n = G.outwardNormalForWall(tx, ty, w.outwardNormalSign ?? 1);
        const p1 = [m.ax + shiftX, m.ay + shiftY];
        const p2 = [m.bx + shiftX, m.by + shiftY];
        const p3 = [p2[0] + th * n.x, p2[1] + th * n.y];
        const p4 = [p1[0] + th * n.x, p1[1] + th * n.y];
        addLwPolyline([p1, p2, p3, p4], 'A_MUROS_CONTORNO', true);
        addLine(p1, p2, 'A_MUROS_EJES');
        const cota = (w.realLengthMm && w.status === 'fijado') ? `${w.realLengthMm} mm` : `~${m.provisionalLengthM} m [${w.status}]`;
        addLinearDim(p1, p2, -220, `${w.label} (${w.code}): ${cota}`);

        const att = G.detectWallHostAttachment(concept, w);
        if (att) {
          const ph1 = [att.hostStartPoint.x + shiftX, att.hostStartPoint.y + shiftY];
          const pjn = [att.joinPoint.x + shiftX, att.joinPoint.y + shiftY];
          const ph2 = [att.hostEndPoint.x + shiftX, att.hostEndPoint.y + shiftY];
          addLinearDim(ph1, pjn, 180, `${w.code} DESDE INICIO ${att.hostWallLabel}: ${att.offsetFromStartMm} mm`);
          addLinearDim(pjn, ph2, 180, `${w.code} HASTA FIN ${att.hostWallLabel}: ${att.offsetFromEndMm} mm`);
        }
      }

      for (const pb of (concept.concreteBases || [])) {
        const x0 = Number(pb.xMm || 0) + shiftX;
        const y0 = Number(pb.yMm || 0) + shiftY;
        const l = Number(pb.lengthMm || 1000);
        const w = Number(pb.widthMm || 600);
        addLwPolyline([[x0, y0], [x0 + l, y0], [x0 + l, y0 + w], [x0, y0 + w]], 'A_BASES_CONCRETO', true);
        addText(`${pb.label || 'Pollo'}: ${l}x${w} mm`, x0 + 40, y0 + 50, 45, 'C_IDENTIFICADORES');
      }

      addText(`PLANTA: ${cname} | ${stampText}`, 400, currentBandY + (maxY - minY) + 950, 80, 'C_IDENTIFICADORES');

      // Elevaciones separadas hacia la derecha
      let nextElevX = (maxX - minX) + 1200 + viewGapX;
      let bandMaxH = (maxY - minY) + 1200;

      for (const w of walls) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = Number(w.realLengthMm || m.geomLengthMm || 1000);
        const H = Number(w.heightMm || concept.heightMm || project.predominantHeightMm || 2600);
        const topPts = G.ensureWallTopControlPoints(w, H, L);
        const maxH = G.getWallMaxHeight(w, H, L);
        const ex0 = nextElevX;
        const ey0 = currentBandY + 500;

        // Polígono real del muro según Puntos de Control Superiores
        const wallPoly = [[ex0, ey0], [ex0 + L, ey0]];
        for (let i = topPts.length - 1; i >= 0; i--) {
          wallPoly.push([ex0 + Number(topPts[i].uMm), ey0 + Number(topPts[i].heightMm)]);
        }
        addLwPolyline(wallPoly, 'A_MUROS_CONTORNO', true);
        addLinearDim([ex0, ey0], [ex0 + L, ey0], -220, `ANCHO ${w.label}: ${L} mm`);

        for (const pt of topPts) {
          addCircle([ex0 + Number(pt.uMm), ey0 + Number(pt.heightMm)], 18, 'C_COTAS');
          addText(`${pt.label}: H=${Math.round(pt.heightMm)}mm`, ex0 + Number(pt.uMm) - 60, ey0 + Number(pt.heightMm) + 45, 36, 'C_COTAS');
        }
        addText(`ELEVACION: ${cname} - ${w.label} (${w.code})`, ex0, ey0 + maxH + 170, 70, 'C_IDENTIFICADORES');

        for (const el of (w.elements || [])) {
          if (G.isOpeningElement(el)) {
            const ew = Number(el.widthMm || 900);
            const eh = Number(el.heightMm || 2100);
            const uMidInit = Number(el.references?.distLeftMm || 0) + ew * 0.5;
            const hAtMid = G.getWallHeightAtU(w, uMidInit, H, L);
            const r = G.normalizeOpeningReferences(el, L, hAtMid);
            const uStart = Number(r.distLeftMm ?? 0);
            const uEnd = uStart + ew;
            const uRight = Number(r.distRightMm ?? (L - uEnd));
            const vStart = Number(r.distFloorMm ?? 0);
            const vEnd = vStart + eh;
            const vTop = Number(r.distTopMm ?? (hAtMid - vEnd));

            const x1 = ex0 + uStart;
            const x2 = ex0 + uEnd;
            const y1 = ey0 + vStart;
            const y2 = ey0 + vEnd;
            const cx = 0.5 * (x1 + x2);
            const cy = 0.5 * (y1 + y2);

            addLwPolyline([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], 'A_VENTANAS', true);
            // 4 líneas de cota ligadas al inicio y fin de la ventana/puerta en ambos sentidos
            if (uStart > 0) addLine([ex0, cy], [x1, cy], 'C_COTAS');
            if (uRight > 0) addLine([x2, cy], [ex0 + L, cy], 'C_COTAS');
            if (vStart > 0) addLine([cx, ey0], [cx, y1], 'C_COTAS');
            if (vTop > 0) addLine([cx, y2], [cx, ey0 + hAtMid], 'C_COTAS');
            addText(`${el.code} (${ew}x${eh}) InicioIzq:${Math.round(uStart)} FinDer:${Math.round(uRight)} Piso:${Math.round(vStart)} Sup:${Math.round(vTop)}mm`, x1, y2 + 30, 36, 'C_IDENTIFICADORES');
            continue;
          }

          const refs = el.references || {};
          const uL = Number(refs.distLeftMm ?? L * 0.5);
          const uR = Number(refs.distRightMm ?? (L - uL));
          const vF = Number(refs.distFloorMm ?? 1100);
          const hAtEl = G.getWallHeightAtU(w, uL, H, L);
          const vT = Number(refs.distTopMm ?? (hAtEl - vF));
          const cx = ex0 + uL;
          const cy = ey0 + vF;
          const ew = Number(el.widthMm || 70);
          const eh = Number(el.heightMm || 115);
          if (el.category === 'ELECTRICAL') {
            addLwPolyline([[cx - ew / 2, cy - eh / 2], [cx + ew / 2, cy - eh / 2], [cx + ew / 2, cy + eh / 2], [cx - ew / 2, cy + eh / 2]], 'I_ELECTRICA', true);
          } else if (el.category === 'PLUMBING') {
            addCircle([cx, cy], 25, 'I_HIDROSANITARIA');
            if (el.isSet) {
              addCircle([cx + Number(el.hotOffsetUMm ?? -100), cy + Number(el.hotOffsetVMm ?? 50)], 12, 'I_HIDROSANITARIA');
              addCircle([cx + Number(el.coldOffsetUMm ?? 100), cy + Number(el.coldOffsetVMm ?? 50)], 12, 'I_HIDROSANITARIA');
            }
          }
          addLine([ex0, cy], [ex0 + L, cy], 'C_COTAS');
          addLine([cx, ey0], [cx, ey0 + hAtEl], 'C_COTAS');
          addText(`${el.code} Izq:${uL} Der:${uR} Piso:${vF} Sup:${Math.round(vT)}mm`, cx + 30, cy + 30, 36, 'C_IDENTIFICADORES');
        }

        nextElevX += L + viewGapX;
        bandMaxH = Math.max(bandMaxH, maxH + 1200);
      }
      currentBandY += bandMaxH + bandGapY;
    }

    if (global.DXF_TEMPLATE_HEAD && global.DXF_TEMPLATE_TAIL) {
      const handseed = (handleCounter + 200).toString(16).toUpperCase();
      const head = global.DXF_TEMPLATE_HEAD.replace(/(\$HANDSEED\r?\n\s*5\r?\n\s*)([0-9A-Fa-f]+)/, '$1' + handseed);
      return head + entities.join('\r\n') + global.DXF_TEMPLATE_TAIL;
    }

    const layerEntries = LAYERS.map((l) => [
      '0', 'LAYER',
      '5', nextHandle(),
      '100', 'AcDbSymbolTableRecord',
      '100', 'AcDbLayerTableRecord',
      '2', l.name,
      '70', '0',
      '62', String(l.color),
      '6', 'CONTINUOUS'
    ].join('\r\n')).join('\r\n');

    const handseed = (handleCounter + 100).toString(16).toUpperCase();
    const dxfSections = [
      '0', 'SECTION',
      '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1024',
      '9', '$HANDSEED', '5', handseed,
      '9', '$INSUNITS', '70', '4',
      '9', '$MEASUREMENT', '70', '1',
      '9', '$LUNITS', '70', '2',
      '0', 'ENDSEC',
      '0', 'SECTION',
      '2', 'TABLES',
      '0', 'TABLE',
      '2', 'LAYER',
      '5', '2',
      '100', 'AcDbSymbolTable',
      '70', String(LAYERS.length),
      layerEntries,
      '0', 'ENDTAB',
      '0', 'ENDSEC',
      '0', 'SECTION',
      '2', 'ENTITIES',
      entities.join('\r\n'),
      '0', 'ENDSEC',
      '0', 'EOF', ''
    ];
    return dxfSections.join('\r\n');
  }

  async function downloadProjectDxf(project, confirmPreliminary = true) {
    const G = global.ASBuiltGeometry;
    const auditInfo = G.auditProjectForExport(project);
    if (auditInfo.requiresPreliminaryConfirmation && !confirmPreliminary) {
      throw new Error('Debe confirmar la exportación preliminar.');
    }

    const safeName = String(project.name || 'Levantamiento').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const filename = `${safeName}_ASBUILT_MM.dxf`;

    // Intentar primero con el servidor local Python (ezdxf 1.4.5 certificado)
    try {
      const resp = await fetch('/api/export/dxf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, confirmPreliminary })
      });
      if (resp.ok) {
        const blob = await resp.blob();
        triggerBlobDownload(blob, filename);
        return {
          mode: 'SERVER_EZDXF',
          filename,
          auditErrors: Number(resp.headers.get('X-ASBUILT-Audit-Errors') || 0),
          exportPath: resp.headers.get('X-ASBUILT-Export-Path')
        };
      }
    } catch (_) {
      // Fallback 100% autónomo en cliente (modo Web/Tablet offline)
    }

    const dxfText = generateClientDxfString(project, auditInfo);
    const blob = new Blob([dxfText], { type: 'application/dxf;charset=utf-8' });
    triggerBlobDownload(blob, filename);
    return { mode: 'CLIENT_AC1024', filename, auditErrors: 0 };
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
    }, 350);
  }

  global.ASBuiltDxfExporter = {
    generateClientDxfString,
    downloadProjectDxf,
    triggerBlobDownload
  };
})(window);
