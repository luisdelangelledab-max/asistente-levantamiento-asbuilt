/* ==========================================================================
   NÚCLEO GEOMÉTRICO Y TOPOLÓGICO 2D EN CLIENTE (FLOAT64 EN MILÍMETROS)
   Espejo exacto de core_engine.py para operación 100% offline en PC y Tablet
   ========================================================================== */
(function (global) {
  'use strict';

  const CONCEPT_TYPES = [
    { id: 'COCINA', label: 'Cocina', mode: 'PLAN_ELEVATION' },
    { id: 'BANO', label: 'Baño', mode: 'PLAN_ELEVATION' },
    { id: 'CLOSET', label: 'Clóset', mode: 'PLAN_ELEVATION' },
    { id: 'VESTIDOR', label: 'Vestidor', mode: 'PLAN_ELEVATION' },
    { id: 'SALA', label: 'Sala', mode: 'PLAN_ELEVATION' },
    { id: 'COMEDOR', label: 'Comedor', mode: 'PLAN_ELEVATION' },
    { id: 'PASILLO', label: 'Pasillo', mode: 'PLAN_ELEVATION' },
    { id: 'OTRO', label: 'Otro ambiente', mode: 'PLAN_ELEVATION' },
    { id: 'PUERTA', label: 'Puerta de intercomunicación', mode: 'DOOR_FRONTAL' }
  ];

  const CEREBRO_PRESETS = {
    electrical: {
      CONTACTO_DUPLEX: {
        label: 'Contacto Dúplex 127V (Placa 1-Gang)',
        category: 'ELECTRICAL',
        subType: 'CONTACTO_DUPLEX',
        widthMm: 70,
        heightMm: 115,
        gfci: false,
        defaultHeightNptMm: 1150,
        source: 'Leviton 80703 / NMX-J-136-ANCE-2019 (Preset editable)',
        provenance: 'DEFAULT_PRESET'
      },
      CONTACTO_GFCI: {
        label: 'Contacto GFCI / ICFT (Zona Húmeda)',
        category: 'ELECTRICAL',
        subType: 'CONTACTO_GFCI',
        widthMm: 70,
        heightMm: 115,
        gfci: true,
        defaultHeightNptMm: 1150,
        source: 'NOM-001-SEDE-2012 Art. 210-8 (Preset editable)',
        provenance: 'DEFAULT_PRESET'
      },
      CONTACTO_MODUS: {
        label: 'Contacto Modular Bticino (85×120 mm)',
        category: 'ELECTRICAL',
        subType: 'CONTACTO_MODUS',
        widthMm: 85,
        heightMm: 120,
        gfci: false,
        defaultHeightNptMm: 300,
        source: 'Bticino Modus Pro E5N1PTL (Preset editable)',
        provenance: 'DEFAULT_PRESET'
      },
      TOMA_220V: {
        label: 'Toma Especial 220V (Caja 4×4")',
        category: 'ELECTRICAL',
        subType: 'TOMA_220V',
        widthMm: 102,
        heightMm: 102,
        gfci: false,
        defaultHeightNptMm: 600,
        source: 'Caja cuadrada 4x4" RACO (Preset editable)',
        provenance: 'DEFAULT_PRESET'
      },
      APAGADOR: {
        label: 'Apagador / Interruptor Sencillo',
        category: 'ELECTRICAL',
        subType: 'APAGADOR',
        widthMm: 70,
        heightMm: 115,
        gfci: false,
        defaultHeightNptMm: 1100,
        source: 'NMX-J-136-ANCE-2019 (Preset editable)',
        provenance: 'DEFAULT_PRESET'
      }
    },
    plumbing: {
      CONJUNTO_TARJA_CONAVI: {
        label: 'Conjunto Hidrosanitario Tarja Cocina (AC+AF+Dren)',
        category: 'PLUMBING',
        subType: 'CONJUNTO_TARJA_CONAVI',
        isSet: true,
        separationAfAcMm: 200,
        hotOffsetUMm: -100,
        hotOffsetVMm: 50,
        coldOffsetUMm: 100,
        coldOffsetVMm: 50,
        drainDiameterMm: 50,
        supplyDiameterMm: 13,
        widthMm: 220,
        heightMm: 120,
        defaultHeightNptMm: 500,
        source: 'CONAVI 2023 / UNAM (Sep. 200 mm edit., Dren 500, Alim 550)',
        provenance: 'DEFAULT_PRESET'
      },
      CONJUNTO_LAVABO_CONAVI: {
        label: 'Conjunto Hidrosanitario Lavabo Baño (AC+AF+Dren)',
        category: 'PLUMBING',
        subType: 'CONJUNTO_LAVABO_CONAVI',
        isSet: true,
        separationAfAcMm: 200,
        hotOffsetUMm: -100,
        hotOffsetVMm: 50,
        coldOffsetUMm: 100,
        coldOffsetVMm: 50,
        drainDiameterMm: 50,
        supplyDiameterMm: 13,
        widthMm: 220,
        heightMm: 120,
        defaultHeightNptMm: 500,
        source: 'CONAVI 2023 / Helvex (Sep. 200 mm edit., Dren 500, Alim 550)',
        provenance: 'DEFAULT_PRESET'
      },
      SALIDA_AGUA_FRIA: {
        label: 'Salida Aislada Agua Fría (AF Ø13 mm)',
        category: 'PLUMBING',
        subType: 'SALIDA_AGUA_FRIA',
        isSet: false,
        kind: 'AF',
        diameterMm: 13,
        widthMm: 40,
        heightMm: 40,
        defaultHeightNptMm: 550,
        source: 'Salida hidráulica Ø13 mm editable',
        provenance: 'DEFAULT_PRESET'
      },
      SALIDA_AGUA_CALIENTE: {
        label: 'Salida Aislada Agua Caliente (AC Ø13 mm)',
        category: 'PLUMBING',
        subType: 'SALIDA_AGUA_CALIENTE',
        isSet: false,
        kind: 'AC',
        diameterMm: 13,
        widthMm: 40,
        heightMm: 40,
        defaultHeightNptMm: 550,
        source: 'Salida hidráulica Ø13 mm editable',
        provenance: 'DEFAULT_PRESET'
      },
      SALIDA_DRENAJE: {
        label: 'Salida Aislada Drenaje Sanitario (Ø50 mm)',
        category: 'PLUMBING',
        subType: 'SALIDA_DRENAJE',
        isSet: false,
        kind: 'DRENAJE',
        diameterMm: 50,
        widthMm: 60,
        heightMm: 60,
        defaultHeightNptMm: 500,
        source: 'Salida sanitaria Ø50 mm editable',
        provenance: 'DEFAULT_PRESET'
      }
    },
    openings: {
      VENTANA_ESTANDAR: {
        label: 'Ventana Acotada en Muro',
        category: 'WINDOW',
        subType: 'VENTANA_ESTANDAR',
        widthMm: 1200,
        heightMm: 1100,
        sillHeightMm: 1100,
        defaultHeightNptMm: 1650,
        source: 'Vano de ventana (dimensiones editables)',
        provenance: 'DEFAULT_PRESET'
      },
      VANO_PASO: {
        label: 'Vano Abierto en Muro',
        category: 'OPENING',
        subType: 'VANO_PASO',
        widthMm: 900,
        heightMm: 2100,
        sillHeightMm: 0,
        defaultHeightNptMm: 1050,
        source: 'Vano libre sin marco (editable)',
        provenance: 'DEFAULT_PRESET'
      }
    }
  };

  function newId(prefix) {
    const rnd = Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4);
    return `${prefix || 'id'}-${rnd}`;
  }

  function snapOrthogonalAngle(angleDeg) {
    const norm = ((angleDeg % 360) + 360) % 360;
    const candidates = [0, 90, 180, 270, 360];
    let best = 0;
    let bestDiff = 999;
    for (const c of candidates) {
      const d = Math.abs(norm - c);
      if (d < bestDiff) {
        bestDiff = d;
        best = c;
      }
    }
    return best === 360 ? 0 : best;
  }

  function unitVectorDeg(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    let cx = Math.cos(rad);
    let sy = Math.sin(rad);
    if (Math.abs(cx) < 1e-12) cx = 0;
    if (Math.abs(sy) < 1e-12) sy = 0;
    return { x: cx, y: sy };
  }

  function outwardNormalForWall(tx, ty, sign) {
    const s = (sign === undefined || sign >= 0) ? 1 : -1;
    return { x: s * ty, y: -s * tx };
  }

  function getVertexMap(concept) {
    const map = {};
    for (const v of (concept.vertices || [])) {
      map[v.id] = v;
    }
    return map;
  }

  function wallGeometryMetrics(wall, vmap) {
    const va = vmap[wall.startVertexId] || { xMm: 0, yMm: 0 };
    const vb = vmap[wall.endVertexId] || { xMm: 1000, yMm: 0 };
    const ax = Number(va.xMm) || 0;
    const ay = Number(va.yMm) || 0;
    const bx = Number(vb.xMm) || 0;
    const by = Number(vb.yMm) || 0;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const ang = dist > 1e-9 ? ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360 : (Number(wall.angleDeg) || 0);
    return {
      ax, ay, bx, by,
      minX: Math.min(ax, bx),
      maxX: Math.max(ax, bx),
      midX: 0.5 * (ax + bx),
      minY: Math.min(ay, by),
      maxY: Math.max(ay, by),
      midY: 0.5 * (ay + by),
      geomLengthMm: Number(dist.toFixed(3)),
      provisionalLengthM: Number((dist / 1000).toFixed(2)),
      geomAngleDeg: Number(ang.toFixed(3))
    };
  }

  function computeLeftToRightWallOrder(concept) {
    const vmap = getVertexMap(concept);
    const walls = concept.walls || [];
    const enriched = walls.map((w, idx) => {
      const m = wallGeometryMetrics(w, vmap);
      return {
        minX: Number(m.minX.toFixed(2)),
        midX: Number(m.midX.toFixed(2)),
        minY: Number(m.minY.toFixed(2)),
        oldIdx: idx,
        wall: w,
        metrics: m
      };
    });

    enriched.sort((a, b) => {
      if (a.minX !== b.minX) return a.minX - b.minX;
      if (a.midX !== b.midX) return a.midX - b.midX;
      if (a.minY !== b.minY) return a.minY - b.minY;
      return a.oldIdx - b.oldIdx;
    });

    return enriched.map((item, idx) => {
      const newPos = idx + 1;
      const newLabel = `Muro ${newPos}`;
      const newCode = `M${String(newPos).padStart(2, '0')}`;
      const oldLabel = item.wall.label || `Muro ${item.oldIdx + 1}`;
      const oldCode = item.wall.code || `M${String(item.oldIdx + 1).padStart(2, '0')}`;
      return {
        wallId: item.wall.id,
        oldOrder: item.wall.orderIndex || (item.oldIdx + 1),
        newOrder: newPos,
        oldLabel,
        newLabel,
        oldCode,
        newCode,
        changed: oldLabel !== newLabel || oldCode !== newCode,
        minX: item.metrics.minX,
        midX: item.metrics.midX,
        minY: item.metrics.minY
      };
    });
  }

  function previewRenumberLeftToRight(concept) {
    const proposal = computeLeftToRightWallOrder(concept);
    const needsRenumbering = proposal.some((p) => p.changed);
    return {
      needsRenumbering,
      preview: proposal,
      message: needsRenumbering
        ? 'El orden actual de los muros difiere del orden espacial izquierda→derecha. Revise la vista previa para confirmar la renumeración.'
        : 'Los muros están numerados correctamente en orden izquierda→derecha.'
    };
  }

  function applyRenumberLeftToRight(concept) {
    const proposal = computeLeftToRightWallOrder(concept);
    const byId = {};
    for (const p of proposal) byId[p.wallId] = p;
    for (const w of (concept.walls || [])) {
      const p = byId[w.id];
      if (p) {
        w.orderIndex = p.newOrder;
        w.label = p.newLabel;
        w.code = p.newCode;
      }
    }
    concept.walls.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    return { applied: true, renumberMap: proposal };
  }

  function progressiveFixWallLength(concept, wallId, newRealLengthMm, newAngleDeg, allowUnlockFixedTarget) {
    const Lnew = Number(newRealLengthMm);
    if (!Number.isFinite(Lnew) || Lnew <= 0) {
      throw new Error('La longitud real del muro debe ser un valor positivo en milímetros (mm).');
    }

    const walls = concept.walls || [];
    const vmap = getVertexMap(concept);
    const targetIdx = walls.findIndex((w) => w.id === wallId);
    if (targetIdx < 0) throw new Error(`No se encontró el muro ${wallId}`);

    const targetWall = walls[targetIdx];
    if (targetWall.status === 'fijado' && !allowUnlockFixedTarget) {
      return {
        status: 'blocked_by_lock',
        wallId,
        requiresPermission: true,
        message: `El muro ${targetWall.label} ya tiene una medida FIJADA (${targetWall.realLengthMm} mm). Para editarla, autorice desbloquearlo.`
      };
    }

    const va = vmap[targetWall.startVertexId];
    const vb = vmap[targetWall.endVertexId];
    const ax = Number(va.xMm);
    const ay = Number(va.yMm);
    const bxOld = Number(vb.xMm);
    const byOld = Number(vb.yMm);

    let angleDeg;
    if (newAngleDeg !== undefined && newAngleDeg !== null && newAngleDeg !== '') {
      angleDeg = ((Number(newAngleDeg) % 360) + 360) % 360;
      targetWall.angleMode = 'MANUAL';
    } else if (targetWall.angleDeg !== undefined && targetWall.angleDeg !== null) {
      angleDeg = ((Number(targetWall.angleDeg) % 360) + 360) % 360;
    } else {
      angleDeg = ((Math.atan2(byOld - ay, bxOld - ax) * 180) / Math.PI + 360) % 360;
      if ((targetWall.angleMode || 'ORTHO') === 'ORTHO') {
        angleDeg = snapOrthogonalAngle(angleDeg);
      }
    }

    const u = unitVectorDeg(angleDeg);
    const bxNew = Number((ax + Lnew * u.x).toFixed(4));
    const byNew = Number((ay + Lnew * u.y).toFixed(4));
    const dxShift = bxNew - bxOld;
    const dyShift = byNew - byOld;

    const firstVid = walls.length ? walls[0].startVertexId : null;
    const lastVid = walls.length ? walls[walls.length - 1].endVertexId : null;
    const topologicallyClosed = Boolean(concept.isClosedLoop) || (walls.length >= 3 && firstVid === lastVid);

    if (!topologicallyClosed) {
      const visited = new Set([targetWall.endVertexId]);
      for (let i = targetIdx + 1; i < walls.length; i++) {
        const w = walls[i];
        if (visited.has(w.startVertexId)) visited.add(w.endVertexId);
        if (visited.has(w.endVertexId)) visited.add(w.startVertexId);
      }
      for (const vid of visited) {
        const v = vmap[vid];
        if (v) {
          v.xMm = Number((Number(v.xMm) + dxShift).toFixed(4));
          v.yMm = Number((Number(v.yMm) + dyShift).toFixed(4));
        }
      }
      targetWall.realLengthMm = Number(Lnew.toFixed(3));
      targetWall.provisionalLengthM = Number((Lnew / 1000).toFixed(2));
      targetWall.angleDeg = Number(angleDeg.toFixed(3));
      targetWall.status = 'fijado';
      targetWall.conflictInfo = null;
      return {
        status: 'fijado',
        wallId,
        realLengthMm: targetWall.realLengthMm,
        angleDeg: targetWall.angleDeg,
        conflict: null
      };
    }

    // Planta cerrada: verificar si muros provisionales pueden absorber el ajuste sin tocar muros fijados
    const provIndices = [];
    const lengths = [];
    const angles = [];
    for (let i = 0; i < walls.length; i++) {
      const m = wallGeometryMetrics(walls[i], vmap);
      lengths.push(i === targetIdx ? Lnew : Number(walls[i].realLengthMm || m.geomLengthMm));
      angles.push(i === targetIdx ? angleDeg : Number(walls[i].angleDeg ?? m.geomAngleDeg));
      if (i !== targetIdx && (walls[i].status || 'provisional') === 'provisional') {
        provIndices.push(i);
      }
    }

    if (provIndices.length > 0) {
      let remX = -dxShift;
      let remY = -dyShift;
      const newLengths = lengths.slice();
      for (const idx of provIndices) {
        const uv = unitVectorDeg(angles[idx]);
        if (Math.abs(uv.x) > 0.999 && Math.abs(uv.y) < 1e-6 && Math.abs(remX) > 1e-4) {
          const dL = remX / uv.x;
          if (newLengths[idx] + dL >= 50) {
            newLengths[idx] += dL;
            remX = 0;
          }
        } else if (Math.abs(uv.y) > 0.999 && Math.abs(uv.x) < 1e-6 && Math.abs(remY) > 1e-4) {
          const dL = remY / uv.y;
          if (newLengths[idx] + dL >= 50) {
            newLengths[idx] += dL;
            remY = 0;
          }
        }
      }
      if (Math.hypot(remX, remY) <= 0.5) {
        const v0 = vmap[walls[0].startVertexId];
        let cx = Number(v0.xMm);
        let cy = Number(v0.yMm);
        for (let i = 0; i < walls.length; i++) {
          const uv = unitVectorDeg(angles[i]);
          const nx = Number((cx + newLengths[i] * uv.x).toFixed(4));
          const ny = Number((cy + newLengths[i] * uv.y).toFixed(4));
          if (i < walls.length - 1 || walls[i].endVertexId !== walls[0].startVertexId) {
            vmap[walls[i].endVertexId].xMm = nx;
            vmap[walls[i].endVertexId].yMm = ny;
          }
          cx = nx;
          cy = ny;
          if (i !== targetIdx && (walls[i].status || 'provisional') === 'provisional') {
            walls[i].provisionalLengthM = Number((newLengths[i] / 1000).toFixed(2));
          }
        }
        targetWall.realLengthMm = Number(Lnew.toFixed(3));
        targetWall.provisionalLengthM = Number((Lnew / 1000).toFixed(2));
        targetWall.angleDeg = Number(angleDeg.toFixed(3));
        targetWall.status = 'fijado';
        targetWall.conflictInfo = null;
        return { status: 'fijado', wallId, realLengthMm: targetWall.realLengthMm, conflict: null };
      }
    }

    // Evaluar residuo de cierre R
    let rx = 0;
    let ry = 0;
    for (let i = 0; i < walls.length; i++) {
      const uv = unitVectorDeg(angles[i]);
      rx += lengths[i] * uv.x;
      ry += lengths[i] * uv.y;
    }
    const resNorm = Math.hypot(rx, ry);
    if (resNorm <= 0.5) {
      const v0 = vmap[walls[0].startVertexId];
      let cx = Number(v0.xMm);
      let cy = Number(v0.yMm);
      for (let i = 0; i < walls.length; i++) {
        const uv = unitVectorDeg(angles[i]);
        const nx = Number((cx + lengths[i] * uv.x).toFixed(4));
        const ny = Number((cy + lengths[i] * uv.y).toFixed(4));
        if (i < walls.length - 1 || walls[i].endVertexId !== walls[0].startVertexId) {
          vmap[walls[i].endVertexId].xMm = nx;
          vmap[walls[i].endVertexId].yMm = ny;
        }
        cx = nx;
        cy = ny;
      }
      targetWall.realLengthMm = Number(Lnew.toFixed(3));
      targetWall.provisionalLengthM = Number((Lnew / 1000).toFixed(2));
      targetWall.angleDeg = Number(angleDeg.toFixed(3));
      targetWall.status = 'fijado';
      targetWall.conflictInfo = null;
      return { status: 'fijado', wallId, realLengthMm: targetWall.realLengthMm, conflict: null };
    }

    const conflictPayload = {
      wallId,
      wallLabel: targetWall.label || wallId,
      attemptedLengthMm: Number(Lnew.toFixed(3)),
      previousLengthMm: targetWall.realLengthMm || wallGeometryMetrics(targetWall, vmap).geomLengthMm,
      residualVectorMm: { rx: Number(rx.toFixed(2)), ry: Number(ry.toFixed(2)) },
      residualNormMm: Number(resNorm.toFixed(2)),
      message: `Conflicto geométrico de cierre: Al fijar ${targetWall.label} en ${Lnew.toFixed(1)} mm, los muros ya fijados presentan un descuadre de ${resNorm.toFixed(1)} mm (ΔX=${rx.toFixed(1)}, ΔY=${ry.toFixed(1)} mm). Ninguna medida fijada se alteró sin su permiso.`
    };
    targetWall.status = 'conflicto';
    targetWall.conflictInfo = conflictPayload;
    return { status: 'conflicto', wallId, conflict: conflictPayload };
  }

  function computeFourReferences(wallWidthMm, wallHeightMm, distLeftMm, distRightMm, distFloorMm, distTopMm) {
    const L = Number(wallWidthMm);
    const H = Number(wallHeightMm);
    if (!Number.isFinite(L) || L <= 0 || !Number.isFinite(H) || H <= 0) {
      throw new Error('El ancho y la altura del muro deben ser positivos.');
    }

    const hasL = distLeftMm !== undefined && distLeftMm !== null && distLeftMm !== '';
    const hasR = distRightMm !== undefined && distRightMm !== null && distRightMm !== '';
    const hasF = distFloorMm !== undefined && distFloorMm !== null && distFloorMm !== '';
    const hasT = distTopMm !== undefined && distTopMm !== null && distTopMm !== '';

    const errors = [];
    const warnings = [];
    let xLeft, xRight, horizAnchor;

    if (hasL && hasR) {
      xLeft = Number(distLeftMm);
      xRight = Number(distRightMm);
      const sumX = xLeft + xRight;
      const dX = sumX - L;
      if (Math.abs(dX) > 0.5) {
        errors.push(`Inconsistencia horizontal: Izq (${xLeft.toFixed(1)}) + Der (${xRight.toFixed(1)}) = ${sumX.toFixed(1)} mm ≠ Ancho del muro (${L.toFixed(1)} mm). Diferencia: ${dX.toFixed(1)} mm.`);
        horizAnchor = 'CONFLICT';
      } else {
        horizAnchor = 'BOTH_VALIDATED';
      }
    } else if (hasL) {
      xLeft = Number(distLeftMm);
      xRight = Number((L - xLeft).toFixed(3));
      horizAnchor = 'LEFT';
    } else if (hasR) {
      xRight = Number(distRightMm);
      xLeft = Number((L - xRight).toFixed(3));
      horizAnchor = 'RIGHT';
    } else {
      throw new Error('Ingrese al menos una referencia horizontal (Izquierda o Derecha).');
    }

    let yFloor, yTop, vertAnchor;
    if (hasF && hasT) {
      yFloor = Number(distFloorMm);
      yTop = Number(distTopMm);
      const sumY = yFloor + yTop;
      const dY = sumY - H;
      if (Math.abs(dY) > 0.5) {
        errors.push(`Inconsistencia vertical: Piso (${yFloor.toFixed(1)}) + Arriba (${yTop.toFixed(1)}) = ${sumY.toFixed(1)} mm ≠ Altura del muro (${H.toFixed(1)} mm). Diferencia: ${dY.toFixed(1)} mm.`);
        vertAnchor = 'CONFLICT';
      } else {
        vertAnchor = 'BOTH_VALIDATED';
      }
    } else if (hasF) {
      yFloor = Number(distFloorMm);
      yTop = Number((H - yFloor).toFixed(3));
      vertAnchor = 'FLOOR';
    } else if (hasT) {
      yTop = Number(distTopMm);
      yFloor = Number((H - yTop).toFixed(3));
      vertAnchor = 'TOP';
    } else {
      throw new Error('Ingrese al menos una referencia vertical (Piso o Parte superior).');
    }

    if (xLeft < 0 || xRight < 0 || xLeft > L) {
      warnings.push(`Centro horizontal (${xLeft.toFixed(1)} mm) fuera de los límites del muro [0, ${L.toFixed(1)} mm].`);
    }
    if (yFloor < 0 || yTop < 0 || yFloor > H) {
      warnings.push(`Centro vertical (${yFloor.toFixed(1)} mm) fuera de la altura del muro [0, ${H.toFixed(1)} mm].`);
    }

    return {
      distLeftMm: Number(xLeft.toFixed(3)),
      distRightMm: Number(xRight.toFixed(3)),
      distFloorMm: Number(yFloor.toFixed(3)),
      distTopMm: Number(yTop.toFixed(3)),
      horizontalAnchor: horizAnchor,
      verticalAnchor: vertAnchor,
      consistent: errors.length === 0,
      errors,
      warnings
    };
  }

  function evaluateDoorNineReadings(widthsMm, heightsMm, thicknessesMm, ceilingHeightMm, baseOffsetMm) {
    const reqW = ['inferior', 'medio', 'superior'];
    const reqH = ['izquierdo', 'centro', 'derecho'];
    const reqT = ['superior', 'medio', 'inferior'];

    const missing = [];
    const checkGroup = (obj, keys, label) => {
      const vals = [];
      for (const k of keys) {
        const v = Number((obj || {})[k]);
        if (!Number.isFinite(v) || v <= 0) {
          missing.push(`${label}.${k}`);
        } else {
          vals.push(Number(v.toFixed(3)));
        }
      }
      return vals;
    };

    const wVals = checkGroup(widthsMm, reqW, 'ancho');
    const hVals = checkGroup(heightsMm, reqH, 'alto');
    const tVals = checkGroup(thicknessesMm, reqT, 'espesor');

    if (missing.length > 0) {
      return {
        isComplete: false,
        missingFields: missing,
        originalReadingsMm: { widths: widthsMm, heights: heightsMm, thicknesses: thicknessesMm },
        referenceMinimumsMm: null,
        maximumsMm: null,
        spreadsMm: null,
        topStripConceptualMm: null,
        warnings: [`Faltan lecturas válidas (>0 mm): ${missing.join(', ')}`],
        fabricationNotice: 'GEOMETRÍA AS-BUILT DE REFERENCIA (MÍNIMOS DEL VANO). NO DESCUENTA HOLGURAS NI AUTORIZA FABRICACIÓN.'
      };
    }

    const wMin = Math.min(...wVals), wMax = Math.max(...wVals);
    const hMin = Math.min(...hVals), hMax = Math.max(...hVals);
    const tMin = Math.min(...tVals), tMax = Math.max(...tVals);
    const wSpread = Number((wMax - wMin).toFixed(3));
    const hSpread = Number((hMax - hMin).toFixed(3));
    const tSpread = Number((tMax - tMin).toFixed(3));

    const ceilH = Number(ceilingHeightMm || 2600);
    const baseH = Number(baseOffsetMm || 0);
    const topStrip = Number((ceilH - (baseH + hMin)).toFixed(3));

    const warnings = [];
    if (wSpread > 5) warnings.push(`Variación de ancho ΔW = ${wSpread.toFixed(1)} mm (> 5 mm): posible desplome en jambas.`);
    if (hSpread > 5) warnings.push(`Variación de alto ΔH = ${hSpread.toFixed(1)} mm (> 5 mm): posible desnivel en piso o cabezal.`);
    if (tSpread > 5) warnings.push(`Variación de espesor ΔT = ${tSpread.toFixed(1)} mm (mín ${tMin.toFixed(1)} / máx ${tMax.toFixed(1)} mm): considerar espesor máximo para chambrana.`);
    if (topStrip < 0) warnings.push(`Conflicto vertical: el cabezal (${(baseH + hMin).toFixed(1)} mm) supera la altura de techo (${ceilH.toFixed(1)} mm).`);

    return {
      isComplete: true,
      missingFields: [],
      originalReadingsMm: {
        widths: { inferior: wVals[0], medio: wVals[1], superior: wVals[2] },
        heights: { izquierdo: hVals[0], centro: hVals[1], derecho: hVals[2] },
        thicknesses: { superior: tVals[0], medio: tVals[1], inferior: tVals[2] }
      },
      referenceMinimumsMm: { widthMm: wMin, heightMm: hMin, thicknessMm: tMin },
      maximumsMm: { widthMm: wMax, heightMm: hMax, thicknessMm: tMax },
      spreadsMm: { widthMm: wSpread, heightMm: hSpread, thicknessMm: tSpread },
      topStripConceptualMm: topStrip,
      warnings,
      isFabricationDimension: false,
      clearanceDeductedMm: 0,
      fabricationNotice: 'GEOMETRÍA AS-BUILT DE REFERENCIA (MÍNIMOS DEL VANO). NO DESCUENTA HOLGURAS NI AUTORIZA FABRICACIÓN.'
    };
  }

  function auditProjectForExport(project) {
    const blockingConflicts = [];
    const missingDataWarnings = [];
    const presetNotices = [];

    for (const c of (project.concepts || [])) {
      const cname = c.name || 'Concepto';
      if (c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL') {
        const ds = c.doorSurvey || {};
        const ev = evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm || project.predominantHeightMm, ds.baseOffsetMm);
        if (!ev.isComplete) {
          missingDataWarnings.push(`[${cname}] Puerta con lecturas incompletas (${ev.missingFields.length} faltantes de 9).`);
        }
        for (const wmsg of (ev.warnings || [])) {
          if (wmsg.includes('Conflicto')) blockingConflicts.push(`[${cname}] ${wmsg}`);
          else missingDataWarnings.push(`[${cname}] ${wmsg}`);
        }
        continue;
      }

      const walls = c.walls || [];
      if (walls.length === 0) {
        missingDataWarnings.push(`[${cname}] Sin muros dibujados en planta.`);
      }
      const renum = previewRenumberLeftToRight(c);
      if (renum.needsRenumbering) {
        missingDataWarnings.push(`[${cname}] Numeración izquierda→derecha pendiente de confirmar en vista previa.`);
      }

      const vmap = getVertexMap(c);
      for (const w of walls) {
        const wlabel = w.label || w.id;
        if (w.status === 'conflicto') {
          blockingConflicts.push(`[${cname} · ${wlabel}] ${(w.conflictInfo || {}).message || 'Conflicto geométrico.'}`);
        } else if (w.status !== 'fijado' || !w.realLengthMm) {
          missingDataWarnings.push(`[${cname} · ${wlabel}] Longitud aún PROVISIONAL (~${w.provisionalLengthM || 0} m) sin fijar en mm.`);
        }

        const L = Number(w.realLengthMm || wallGeometryMetrics(w, vmap).geomLengthMm);
        const H = Number(w.heightMm || c.heightMm || project.predominantHeightMm || 2600);
        for (const el of (w.elements || [])) {
          const refs = el.references || {};
          try {
            const chk = computeFourReferences(L, H, refs.distLeftMm, refs.distRightMm, refs.distFloorMm, refs.distTopMm);
            for (const err of chk.errors) blockingConflicts.push(`[${cname} · ${wlabel} · ${el.code}] ${err}`);
            for (const warn of chk.warnings) missingDataWarnings.push(`[${cname} · ${wlabel} · ${el.code}] ${warn}`);
          } catch (e) {
            missingDataWarnings.push(`[${cname} · ${wlabel} · ${el.code}] ${e.message}`);
          }
          if (el.provenance === 'DEFAULT_PRESET') {
            presetNotices.push(`[${cname} · ${wlabel} · ${el.code}] Usa valores de plantilla editable (DEFAULT_PRESET).`);
          }
        }
      }
    }

    const isClean = blockingConflicts.length === 0 && missingDataWarnings.length === 0;
    return {
      isCleanForFinalExport: isClean,
      requiresPreliminaryConfirmation: !isClean,
      blockingConflicts,
      missingDataWarnings,
      presetNotices,
      stampText: isClean
        ? 'LEVANTAMIENTO AS-BUILT VALIDADO (COTAS EN MM)'
        : 'EXPORTACION PRELIMINAR / INCOMPLETA - CONTIENE DATOS PENDIENTES O CONFLICTOS'
    };
  }

  function distPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function simplifyPolylineRDP(points, epsilon) {
    if (!points || points.length <= 2) return points ? points.slice() : [];
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;
    const p1 = points[0];
    const p2 = points[end];

    for (let i = 1; i < end; i++) {
      const d = distPointToSegment(points[i].x, points[i].y, p1.x, p1.y, p2.x, p2.y);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const rec1 = simplifyPolylineRDP(points.slice(0, index + 1), epsilon);
      const rec2 = simplifyPolylineRDP(points.slice(index), epsilon);
      return rec1.slice(0, -1).concat(rec2);
    } else {
      return [p1, p2];
    }
  }

  function orthogonalizeCorners(corners, isClosed) {
    if (!corners || corners.length < 2) return [];
    const rawSegs = [];
    for (let i = 0; i < corners.length - 1; i++) {
      const p1 = corners[i];
      const p2 = corners[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const l = Math.hypot(dx, dy);
      if (l < 150) continue;
      const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const snapA = snapOrthogonalAngle(ang);
      rawSegs.push({ p1, p2, ang: snapA, len: l });
    }

    if (rawSegs.length === 0) return [];

    const merged = [];
    for (const s of rawSegs) {
      if (merged.length === 0) {
        merged.push({ ...s });
      } else {
        const last = merged[merged.length - 1];
        if (last.ang === s.ang) {
          last.p2 = s.p2;
          last.len += s.len;
        } else {
          merged.push({ ...s });
        }
      }
    }

    if (merged.length === 0) return [];

    const verts = [{ x: merged[0].p1.x, y: merged[0].p1.y }];
    for (const s of merged) {
      const curr = verts[verts.length - 1];
      const target = s.p2;
      const ang = s.ang;
      let nextV;
      if (ang === 0 || ang === 180) {
        nextV = { x: target.x, y: curr.y };
      } else {
        nextV = { x: curr.x, y: target.y };
      }
      const segLen = Math.hypot(nextV.x - curr.x, nextV.y - curr.y);
      if (segLen >= 150) {
        verts.push(nextV);
      }
    }

    if (isClosed && verts.length >= 4) {
      verts[verts.length - 1] = { x: verts[0].x, y: verts[0].y };
    }

    return verts;
  }

  function interpretFreehandToWalls(rawPoints) {
    if (!rawPoints || rawPoints.length < 5) return null;
    const startPt = rawPoints[0];
    const endPt = rawPoints[rawPoints.length - 1];
    const closeDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    const isClosed = closeDist < 450;

    let pts = rawPoints.slice();
    if (isClosed) {
      pts.push({ x: startPt.x, y: startPt.y });
    }

    const corners = simplifyPolylineRDP(pts, 260);
    const verts = orthogonalizeCorners(corners, isClosed);
    if (verts.length < 2) return null;

    const segments = [];
    for (let i = 0; i < verts.length - 1; i++) {
      const p1 = verts[i];
      const p2 = verts[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 150) continue;
      const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      segments.push({
        p1,
        p2,
        lengthMm: Number(len.toFixed(1)),
        angleDeg: snapOrthogonalAngle(ang)
      });
    }

    if (segments.length === 0) return null;
    return {
      isClosed,
      segments
    };
  }

  function deleteWallAndCleanTopology(concept, wallId) {
    if (!concept || !concept.walls) return false;
    const idx = concept.walls.findIndex((w) => w.id === wallId);
    if (idx < 0) return false;
    concept.walls.splice(idx, 1);

    const usedV = new Set();
    for (const w of concept.walls) {
      if (w.startVertexId) usedV.add(w.startVertexId);
      if (w.endVertexId) usedV.add(w.endVertexId);
    }
    concept.vertices = (concept.vertices || []).filter((v) => usedV.has(v.id));

    concept.walls.forEach((w, i) => {
      w.orderIndex = i + 1;
      w.label = `Muro ${i + 1}`;
      w.code = `M${String(i + 1).padStart(2, '0')}`;
    });

    return true;
  }

  /* ==========================================================================
     EVALUADOR MATEMÁTICO SEGURO (SIN EVAL ARBITRARIO)
     Admite +, -, *, /, paréntesis (), números decimales y operadores unarios.
     Ejemplos: "2500+1000" -> 3500; "3200-150" -> 3050; "1200*2" -> 2400
     ========================================================================== */
  function evaluateSafeArithmetic(input, fallback = null) {
    if (input === undefined || input === null) return fallback;
    if (typeof input === 'number') return Number.isFinite(input) ? input : fallback;
    const raw = String(input).trim();
    if (!raw) return fallback;

    // Permitir dígitos, puntos, comas decimales, operadores +, -, *, /, paréntesis y espacios
    const sanitized = raw.replace(/,/g, '.');
    if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(sanitized)) {
      return fallback;
    }

    const tokens = [];
    let i = 0;
    while (i < sanitized.length) {
      const ch = sanitized[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if ('+-*/()'.includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }
      if (/\d|\./.test(ch)) {
        let numStr = '';
        while (i < sanitized.length && /[\d\.]/.test(sanitized[i])) {
          numStr += sanitized[i];
          i++;
        }
        const num = parseFloat(numStr);
        if (Number.isNaN(num)) return fallback;
        tokens.push(num);
        continue;
      }
      return fallback;
    }

    if (tokens.length === 0) return fallback;

    let pos = 0;
    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }

    function parseExpr() {
      let result = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const rhs = parseTerm();
        if (op === '+') result += rhs;
        else result -= rhs;
      }
      return result;
    }

    function parseTerm() {
      let result = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const rhs = parseFactor();
        if (op === '*') result *= rhs;
        else {
          if (Math.abs(rhs) < 1e-12) throw new Error('División entre cero');
          result /= rhs;
        }
      }
      return result;
    }

    function parseFactor() {
      const token = peek();
      if (token === '+') {
        consume();
        return parseFactor();
      }
      if (token === '-') {
        consume();
        return -parseFactor();
      }
      if (token === '(') {
        consume();
        const val = parseExpr();
        if (consume() !== ')') throw new Error('Paréntesis desbalanceados');
        return val;
      }
      if (typeof token === 'number') {
        consume();
        return token;
      }
      throw new Error('Token inválido: ' + token);
    }

    try {
      const val = parseExpr();
      if (pos !== tokens.length) return fallback;
      return Number.isFinite(val) ? Number(val.toFixed(4)) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  /* ==========================================================================
     RAY-CASTING PARA DETERMINAR SI UN PUNTO ESTÁ DENTRO DE UN POLÍGONO
     ========================================================================== */
  function pointInPolygon(px, py, polyPoints) {
    if (!polyPoints || polyPoints.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
      const xi = polyPoints[i].x, yi = polyPoints[i].y;
      const xj = polyPoints[j].x, yj = polyPoints[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /* ==========================================================================
     ORIENTACIÓN CONSISTENTE DE MUROS (CARAS Y COTAS EXTERIORES)
     En plantas cerradas: las cotas se colocan siempre hacia el exterior
     independientemente de si se trazó en sentido horario o antihorario.
     En plantas abiertas: se orienta hacia afuera del centroide del ambiente.
     ========================================================================== */
  function autoOrientWallNormals(concept) {
    if (!concept || !concept.walls || concept.walls.length === 0) return;
    const vmap = getVertexMap(concept);
    const walls = concept.walls;

    const allVerts = (concept.vertices || []).map((v) => ({ x: Number(v.xMm), y: Number(v.yMm) }));
    if (allVerts.length === 0) return;

    let cx = 0, cy = 0;
    for (const pt of allVerts) {
      cx += pt.x;
      cy += pt.y;
    }
    cx /= allVerts.length;
    cy /= allVerts.length;

    const isClosed = Boolean(concept.isClosedLoop) || (
      walls.length >= 3 &&
      walls[0].startVertexId === walls[walls.length - 1].endVertexId
    );

    let poly = [];
    if (isClosed) {
      for (const w of walls) {
        const v = vmap[w.startVertexId];
        if (v) poly.push({ x: Number(v.xMm), y: Number(v.yMm) });
      }
    }

    for (const w of walls) {
      const m = wallGeometryMetrics(w, vmap);
      const L = Math.max(m.geomLengthMm, 1);
      const tx = (m.bx - m.ax) / L;
      const ty = (m.by - m.ay) / L;

      if (isClosed && poly.length >= 3) {
        const pTestPlus = { x: m.midX + 25 * ty, y: m.midY - 25 * tx };
        const pTestMinus = { x: m.midX - 25 * ty, y: m.midY + 25 * tx };
        const inPlus = pointInPolygon(pTestPlus.x, pTestPlus.y, poly);
        const inMinus = pointInPolygon(pTestMinus.x, pTestMinus.y, poly);

        if (!inPlus && inMinus) {
          w.outwardNormalSign = 1;
        } else if (inPlus && !inMinus) {
          w.outwardNormalSign = -1;
        } else {
          const vx = m.midX - cx;
          const vy = m.midY - cy;
          const dot1 = ty * vx + (-tx) * vy;
          w.outwardNormalSign = dot1 >= 0 ? 1 : -1;
        }
      } else {
        const vx = m.midX - cx;
        const vy = m.midY - cy;
        const dot1 = ty * vx + (-tx) * vy;
        w.outwardNormalSign = dot1 >= 0 ? 1 : -1;
      }
    }
  }

  function invertWallNormal(concept, wallId) {
    if (!concept || !concept.walls) return;
    const w = concept.walls.find((item) => item.id === wallId);
    if (!w) return;
    w.outwardNormalSign = (w.outwardNormalSign === -1 ? 1 : -1);
    return w.outwardNormalSign;
  }

  /* ==========================================================================
     HERRAMIENTA HUECOS / SEPARACIONES (MEDICIÓN Y COTA ENTRE EXTREMOS DE MUROS)
     Permite ajustar la distancia entre dos extremos sin unir físicamente los muros
     y sin alterar muros previamente fijados sin autorización.
     ========================================================================== */
  function adjustGapDistance(concept, gapId, newDistMm, allowUnlockFixed = false) {
    if (!concept || !concept.separations) throw new Error('No hay separaciones en el concepto');
    const sep = concept.separations.find((s) => s.id === gapId);
    if (!sep) throw new Error(`Hueco ${gapId} no encontrado`);

    const Lnew = Number(newDistMm);
    if (!Number.isFinite(Lnew) || Lnew <= 0) {
      throw new Error('La distancia del hueco debe ser un número positivo en milímetros.');
    }

    const vmap = getVertexMap(concept);
    const v1 = vmap[sep.vertex1Id];
    const v2 = vmap[sep.vertex2Id];

    const x1 = v1 ? Number(v1.xMm) : Number(sep.x1Mm);
    const y1 = v1 ? Number(v1.yMm) : Number(sep.y1Mm);
    const x2 = v2 ? Number(v2.xMm) : Number(sep.x2Mm);
    const y2 = v2 ? Number(v2.yMm) : Number(sep.y2Mm);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const currentDist = Math.hypot(dx, dy);
    if (currentDist < 1e-4) {
      throw new Error('Los extremos del hueco son idénticos.');
    }

    const ux = dx / currentDist;
    const uy = dy / currentDist;

    const w1 = sep.wall1Id ? (concept.walls || []).find((w) => w.id === sep.wall1Id) : null;
    const w2 = sep.wall2Id ? (concept.walls || []).find((w) => w.id === sep.wall2Id) : null;

    if (w1 && w1.status === 'fijado' && w2 && w2.status === 'fijado' && !allowUnlockFixed) {
      return {
        status: 'blocked_by_lock',
        requiresPermission: true,
        message: 'Ambos muros vinculados al hueco están FIJADOS. Autorice desbloquear el muro a desplazar para ajustar la separación.'
      };
    }

    const newX2 = x1 + Lnew * ux;
    const newY2 = y1 + Lnew * uy;
    const shiftX = newX2 - x2;
    const shiftY = newY2 - y2;

    if (v2) {
      v2.xMm = Number(newX2.toFixed(4));
      v2.yMm = Number(newY2.toFixed(4));
    }
    sep.x1Mm = Number(x1.toFixed(3));
    sep.y1Mm = Number(y1.toFixed(3));
    sep.x2Mm = Number(newX2.toFixed(3));
    sep.y2Mm = Number(newY2.toFixed(3));
    sep.distanceMm = Math.round(Lnew);
    sep.dxMm = Math.round(Math.abs(newX2 - x1));
    sep.dyMm = Math.round(Math.abs(newY2 - y1));

    if (w2 && vmap[w2.startVertexId] && vmap[w2.endVertexId]) {
      const otherVid = (w2.startVertexId === sep.vertex2Id) ? w2.endVertexId : w2.startVertexId;
      if (w2.status !== 'fijado') {
        const ov = vmap[otherVid];
        if (ov) {
          ov.xMm = Number((Number(ov.xMm) + shiftX).toFixed(4));
          ov.yMm = Number((Number(ov.yMm) + shiftY).toFixed(4));
        }
      }
    }

    return {
      status: 'ok',
      gapId,
      distanceMm: sep.distanceMm,
      dxMm: sep.dxMm,
      dyMm: sep.dyMm
    };
  }

  /* ==========================================================================
     BASE DE CONCRETO / POLLO POLIGONAL EDITABLE
     Segmentos, perímetros y cotas por tramo para bases L, U o multi-segmento.
     ========================================================================== */
  function computePolygonalBaseSegments(base) {
    if (!base) return [];
    let pts = base.points || [];
    if (pts.length < 2 && base.xMm !== undefined && base.lengthMm) {
      const ang = Number(base.angleDeg) || 0;
      const u = unitVectorDeg(ang);
      const n = { x: -u.y, y: u.x };
      const L = Number(base.lengthMm) || 1000;
      const W = Number(base.widthMm) || 600;
      const p0 = { x: Number(base.xMm), y: Number(base.yMm) };
      const p1 = { x: p0.x + L * u.x, y: p0.y + L * u.y };
      const p2 = { x: p1.x + W * n.x, y: p1.y + W * n.y };
      const p3 = { x: p0.x + W * n.x, y: p0.y + W * n.y };
      pts = [p0, p1, p2, p3];
      base.points = pts;
    }

    const segments = [];
    for (let i = 0; i < pts.length; i++) {
      const pA = pts[i];
      const pB = pts[(i + 1) % pts.length];
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const len = Math.hypot(dx, dy);
      segments.push({
        index: i + 1,
        label: `Tramo ${i + 1}`,
        lengthMm: Math.round(len),
        pA,
        pB
      });
    }
    return segments;
  }

  global.ASBuiltGeometry = {
    CONCEPT_TYPES,
    CEREBRO_PRESETS,
    newId,
    snapOrthogonalAngle,
    unitVectorDeg,
    outwardNormalForWall,
    getVertexMap,
    wallGeometryMetrics,
    computeLeftToRightWallOrder,
    previewRenumberLeftToRight,
    applyRenumberLeftToRight,
    progressiveFixWallLength,
    computeFourReferences,
    evaluateDoorNineReadings,
    auditProjectForExport,
    distPointToSegment,
    simplifyPolylineRDP,
    orthogonalizeCorners,
    interpretFreehandToWalls,
    deleteWallAndCleanTopology,
    evaluateSafeArithmetic,
    pointInPolygon,
    autoOrientWallNormals,
    invertWallNormal,
    adjustGapDistance,
    computePolygonalBaseSegments
  };
})(window);
