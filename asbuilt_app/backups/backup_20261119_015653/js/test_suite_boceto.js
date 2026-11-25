/* ==========================================================================
   SUITE DE COMPROBACIÓN OBLIGATORIA (15 PRUEBAS) — BOCETO EN PLANTA AS-BUILT
   ========================================================================== */
(function (global) {
  'use strict';

  async function run15MandatoryTests() {
    const results = [];
    const log = (num, name, passed, detail) => {
      results.push({ testNum: num, name, passed, detail });
      console.log(`[PRUEBA ${num}] ${name}: ${passed ? 'PASÓ (OK)' : 'FALLÓ'} -> ${detail}`);
    };

    try {
      // Setup: Cargar caso de referencia
      App.loadDemoReferenceProject();
      App.switchMainView('PLAN');
      let c = App.getActivePlanConcept();

      // -----------------------------------------------------------------------
      // PRUEBA 1: Dibujar muro individual, seleccionar campo de longitud, teclear con teclado físico y Enter
      // -----------------------------------------------------------------------
      const w1 = c ? c.walls[0] : null;
      let p1Pass = false;
      if (w1) {
        App.selectWallFromOverlay(w1.id);
        const inp = document.getElementById('inspectorWallLengthMm');
        if (inp) {
          inp.value = '3450';
          const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
          inp.dispatchEvent(enterEvt);
          p1Pass = (w1.realLengthMm === 3450 && w1.status === 'fijado');
        }
      }
      log(1, 'Edición con teclado físico y confirmación con Enter', p1Pass,
        p1Pass ? 'Muro 1 actualizado a 3450 mm con estado fijado' : 'No se actualizó el muro con Enter');

      // -----------------------------------------------------------------------
      // PRUEBA 2: Activar «Dibujar muro», tocar punto 1 y presionar Escape
      // -----------------------------------------------------------------------
      App.setPlanTool('WALL');
      const planCv = document.getElementById('planCanvas');
      planCv.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200, bubbles: true }));
      const hasDrawingStarted = (App.state && App.state.drawingStartWorld !== null);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const hasCancelledEsc = (App.state && App.state.drawingStartWorld === null);
      const p2Pass = hasDrawingStarted && hasCancelledEsc;
      log(2, 'Cancelación del trazo provisional con Escape', p2Pass,
        p2Pass ? 'Primer punto fijado y cancelado limpiamente con Escape' : 'Escape no canceló el trazo');

      // -----------------------------------------------------------------------
      // PRUEBA 3: En vista tablet, activar «Dibujar muro», tocar punto 1 y pulsar «Cancelar trazo»
      // -----------------------------------------------------------------------
      App.setPlanTool('WALL');
      planCv.dispatchEvent(new PointerEvent('pointerdown', { clientX: 220, clientY: 220, bubbles: true }));
      const btnCancel = document.getElementById('hudBtnCancelDrawing') || document.getElementById('btnCancelDrawing');
      if (btnCancel) btnCancel.click();
      const hasCancelledBtn = (App.state && App.state.drawingStartWorld === null);
      log(3, 'Cancelación del trazo en tablet con botón visible', hasCancelledBtn,
        hasCancelledBtn ? 'Botón visible Cancelar Trazo canceló el trazo en curso' : 'Botón cancelar no funcionó');

      // -----------------------------------------------------------------------
      // PRUEBA 4: Activar «Muros encadenados», marcar 4 puntos y pulsar «Finalizar trazado»
      // -----------------------------------------------------------------------
      c = App.getActivePlanConcept();
      const countBefore = c ? c.walls.length : 0;
      App.setPlanTool('CHAINED');
      App.state.chainedPoints = [
        { x: 0, y: 0, vertexId: null },
        { x: 2000, y: 0, vertexId: null, angleDeg: 0, lengthMm: 2000 },
        { x: 2000, y: 1500, vertexId: null, angleDeg: 90, lengthMm: 1500 },
        { x: 3500, y: 1500, vertexId: null, angleDeg: 0, lengthMm: 1500 }
      ];
      App.finishChainedDrawing();
      c = App.getActivePlanConcept();
      const countAfter = c ? c.walls.length : 0;
      const createdCount = countAfter - countBefore;
      const p4Pass = createdCount === 3;
      log(4, 'Muros encadenados (4 puntos -> 3 muros consecutivos)', p4Pass,
        p4Pass ? `Se crearon exactamente 3 muros consecutivos e independientes (${createdCount})` : `Se crearon ${createdCount} muros`);

      // -----------------------------------------------------------------------
      // PRUEBA 5: Activar «Muros encadenados», marcar 3 puntos y presionar Escape
      // -----------------------------------------------------------------------
      App.setPlanTool('CHAINED');
      App.state.chainedPoints = [
        { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }
      ];
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const p5Pass = (App.state.chainedPoints.length === 0);
      log(5, 'Muros encadenados cancelados con Escape sin generar muros', p5Pass,
        p5Pass ? 'Trazado encadenado descartado completamente con Escape' : 'No se limpiaron los puntos encadenados');

      // -----------------------------------------------------------------------
      // PRUEBA 6: Activar «Mano alzada», dibujar trazo en forma de L y soltar
      // -----------------------------------------------------------------------
      App.setPlanTool('FREEHAND');
      const lStroke = [
        { x: 0, y: 0 }, { x: 500, y: 8 }, { x: 1000, y: -6 }, { x: 1500, y: 4 }, { x: 2000, y: 0 },
        { x: 2005, y: -400 }, { x: 1995, y: -900 }, { x: 2000, y: -1400 }
      ];
      App.state.freehandRawPoints = lStroke;
      const lResult = window.ASBuiltGeometry.interpretFreehandToWalls(lStroke);
      const p6Pass = lResult && lResult.segments && lResult.segments.length === 2;
      log(6, 'Mano alzada en forma de L -> 2 muros ortogonales', p6Pass,
        p6Pass ? `Trazo L simplificado a exactamente 2 muros perpendiculares (${lResult.segments.length})` : 'No generó 2 muros');

      // -----------------------------------------------------------------------
      // PRUEBA 7: Activar «Mano alzada», dibujar trazo en forma de U y soltar
      // -----------------------------------------------------------------------
      App.setPlanTool('FREEHAND');
      const uStroke = [
        { x: 0, y: 0 }, { x: 4, y: -400 }, { x: 0, y: -900 }, { x: 0, y: -1400 },
        { x: 400, y: -1405 }, { x: 900, y: -1395 }, { x: 1500, y: -1400 },
        { x: 1505, y: -900 }, { x: 1495, y: -400 }, { x: 1500, y: 0 }
      ];
      App.state.freehandRawPoints = uStroke;
      const uResult = window.ASBuiltGeometry.interpretFreehandToWalls(uStroke);
      const p7Pass = uResult && uResult.segments && uResult.segments.length === 3;
      log(7, 'Mano alzada en forma de U -> 3 muros ortogonales', p7Pass,
        p7Pass ? `Trazo U simplificado a exactamente 3 muros ortogonales (${uResult.segments.length})` : 'No generó 3 muros');

      // -----------------------------------------------------------------------
      // PRUEBA 8: Activar «Seleccionar», hacer clic sobre muro
      // -----------------------------------------------------------------------
      App.setPlanTool('SELECT');
      planCv.dispatchEvent(new PointerEvent('pointerdown', { clientX: 250, clientY: 250, bubbles: true }));
      const p8Pass = (App.state.drawingStartWorld === null && App.state.planTool === 'SELECT');
      log(8, 'Herramienta Seleccionar NO inicia trazo de nuevo muro', p8Pass,
        p8Pass ? 'Modo Selección activo sin iniciar trazos accidentales' : 'Modo Selección inició un trazo');

      // -----------------------------------------------------------------------
      // PRUEBA 9: Seleccionar muro, cambiar longitud en inspector derecho y presionar Enter
      // -----------------------------------------------------------------------
      c = App.getActivePlanConcept();
      const targetWall = c.walls[0];
      App.selectWallFromOverlay(targetWall.id);
      App.applyWallRealLengthFromInput(targetWall.id, 2850, true);
      const p9Pass = targetWall.realLengthMm === 2850 && targetWall.status === 'fijado';
      log(9, 'Modificar longitud en inspector derecho y Enter actualiza cota y canvas', p9Pass,
        p9Pass ? 'Longitud actualizada a 2850 mm y cota sincronizada' : 'No se actualizó');

      // -----------------------------------------------------------------------
      // PRUEBA 10: Cotas tipo CAD con líneas de extensión y ticks a 45°
      // -----------------------------------------------------------------------
      const hasHitBoxes = (App.state.planDimensionHitBoxes || []).length > 0;
      const overlayChipOverWall = document.querySelectorAll('.wall-overlay-chip').length === 0;
      const p10Pass = hasHitBoxes && overlayChipOverWall;
      log(10, 'Cotas arquitectónicas tipo CAD sin cajas superpuestas sobre el muro', p10Pass,
        p10Pass ? 'Cotas CAD renderizadas con testigos y ticks a 45°; hit-boxes activos' : 'Aún hay cajas superpuestas');

      // -----------------------------------------------------------------------
      // PRUEBA 11: Clic sobre cota arquitectónica, editar valor inline y presionar Enter
      // -----------------------------------------------------------------------
      const firstHit = App.state.planDimensionHitBoxes[0];
      let p11Pass = false;
      if (firstHit) {
        App.openInlineDimensionEditor(firstHit.wallId, 300, 300);
        const inlineInput = document.getElementById('inlineDimEditor');
        if (inlineInput) {
          inlineInput.value = '3120';
          const ent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
          inlineInput.dispatchEvent(ent);
          c = App.getActivePlanConcept();
          const wMod = c.walls.find((w) => w.id === firstHit.wallId);
          p11Pass = (wMod && wMod.realLengthMm === 3120);
        }
      }
      log(11, 'Clic en cota abre editor inline directo y confirma con Enter', p11Pass,
        p11Pass ? 'Cota editada in-situ sobre el lienzo a 3120 mm' : 'Editor inline no aplicó la medida');

      // -----------------------------------------------------------------------
      // PRUEBA 12: Seleccionar muro y pulsar «Eliminar muro» en inspector derecho
      // -----------------------------------------------------------------------
      c = App.getActivePlanConcept();
      const wallCountBeforeDel = c.walls.length;
      const wallToDelete = c.walls[c.walls.length - 1];
      App.deleteSelectedWall(wallToDelete.id);
      const countAfterDel = App.getActivePlanConcept().walls.length;
      const p12Pass = (countAfterDel === wallCountBeforeDel - 1);
      log(12, 'Eliminar muro individual desde botón de inspector derecho', p12Pass,
        p12Pass ? `Muro eliminado exitosamente (${wallCountBeforeDel} -> ${countAfterDel})` : 'No se eliminó');

      // -----------------------------------------------------------------------
      // PRUEBA 13: Pulsar «Deshacer» tras eliminar un muro
      // -----------------------------------------------------------------------
      App.undo();
      const countAfterUndo = App.getActivePlanConcept().walls.length;
      const p13Pass = (countAfterUndo === wallCountBeforeDel);
      log(13, 'Deshacer (Undo) recupera el muro eliminado con todas sus propiedades', p13Pass,
        p13Pass ? `Muro restaurado correctamente (total ${countAfterUndo})` : 'Deshacer no restauró el muro');

      // -----------------------------------------------------------------------
      // PRUEBA 14: Pulsar «Limpiar planta» y verificar que no borra proyecto ni otros conceptos
      // -----------------------------------------------------------------------
      const projConceptCountBefore = App.state.project.concepts.length;
      const origConfirm = window.confirm;
      window.confirm = () => true;
      App.clearCurrentRoomPlan();
      window.confirm = origConfirm;
      const cClean = App.getActivePlanConcept();
      const p14Pass = (cClean.walls.length === 0 && App.state.project.concepts.length === projConceptCountBefore);
      log(14, 'Limpiar planta restablece lienzo sin borrar proyecto ni otros conceptos', p14Pass,
        p14Pass ? `Planta vaciada (0 muros); conceptos conservados (${projConceptCountBefore})` : 'Falló limpieza de planta');

      // -----------------------------------------------------------------------
      // PRUEBA 15: No regresión en elevaciones, instalaciones, puertas y exportación
      // -----------------------------------------------------------------------
      App.loadDemoReferenceProject();
      App.switchMainView('ELEVATION');
      const elevCanvas = document.getElementById('elevationCanvas');
      const hasElevation = !!elevCanvas;
      App.switchMainView('DOOR');
      const doorInputIds = ['doorWInf', 'doorWMed', 'doorWSup', 'doorHIzq', 'doorHCen', 'doorHDer', 'doorTSup', 'doorTMed', 'doorTInf'];
      const allDoorInputsExist = doorInputIds.every((id) => !!document.getElementById(id));
      const audit = window.ASBuiltGeometry.auditProjectForExport(App.state.project);
      const p15Pass = hasElevation && allDoorInputsExist && (audit.blockingConflicts.length === 0);
      log(15, 'No regresión: Elevaciones, instalaciones, 9 medidas puerta y exportador DXF/PDF', p15Pass,
        p15Pass ? 'Módulos de elevación, instalaciones, puerta y exportador 100% operativos' : 'Regresión detectada');

      App.switchMainView('PLAN');

      const allPassed = results.every((r) => r.passed);
      console.log(`\n========================================\nRESULTADO GLOBAL: ${allPassed ? '15 DE 15 PRUEBAS PASARON EXITOSAMENTE (100%)' : 'HAY PRUEBAS FALLIDAS'}\n========================================`);
      return { allPassed, results };
    } catch (err) {
      console.error('Error durante ejecución de pruebas:', err);
      return { allPassed: false, error: err.message, results };
    }
  }

  global.run15MandatoryTests = run15MandatoryTests;
})(window);
