/* ==========================================================================
   CONTROLADOR PRINCIPAL INTERACTIVO 2D — CODEX AS-BUILT MOBILIARIO
   Soporte completo Mouse + Touch (Pointer Events), Undo/Redo, Persistencia
   Dual (LocalStorage / IndexedDB + Servidor Local) y Exportación PDF / DXF
   ========================================================================== */
(function (global) {
  'use strict';

  const G = global.ASBuiltGeometry;
  const LOCAL_STORAGE_KEY = 'codex_asbuilt_active_project_v1';
  const LOCAL_LIST_KEY = 'codex_asbuilt_projects_index_v1';

  const state = {
    mainView: 'PROJECT', // 'PROJECT' | 'PLAN' | 'ELEVATION' | 'DOOR'
    project: null,
    activeConceptId: null,
    activeWallId: null,
    selectedEntity: null, // { kind: 'WALL' | 'POLLO' | 'GAP' | 'ELEMENT', id: string }
    planTool: 'WALL', // 'WALL' | 'CHAINED' | 'FREEHAND' | 'GAP' | 'POLLO' | 'SARDINEL' | 'SELECT' | 'PAN'
    orthoMode: true,
    manualAngleDeg: 135,
    drawingStartWorld: null,
    drawingPreviewWorld: null,
    chainedPoints: [], // [{ x, y, vertexId, angleDeg, lengthMm }]
    polloPoints: [], // [{ x, y }] para base de concreto poligonal
    gapStartNode: null, // { vertexId, wallId, wallLabel, x, y } para herramienta Huecos
    isFreehandDrawing: false,
    freehandRawPoints: [], // [{ x, y }]
    planDimensionHitBoxes: [], // [{ wallId, rect, currentVal }]
    activeInlineDimWallId: null,
    planCam: { x: 140, y: 420, scale: 0.11 }, // px por mm
    elevCam: { x: 100, y: 420, scale: 0.14 },
    isPanning: false,
    panStartClient: null,
    panStartCam: null,
    draggingElevElementId: null,
    undoStack: [],
    redoStack: [],
    activeNumpadInput: null,
    activeNumpadWallId: null
  };

  // ==========================================================================
  // 1. INICIALIZACIÓN Y PERSISTENCIA LOCAL + SERVIDOR
  // ==========================================================================

  async function init() {
    bindCanvasEvents();
    bindGlobalNumpadFocus();
    bindGlobalKeyboardEvents();
    window.addEventListener('resize', () => {
      resizeCanvases();
      renderAll();
    });

    // Intentar recuperar último proyecto de LocalStorage o del servidor local
    let loaded = null;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (_) {}

    if (!loaded) {
      try {
        const resp = await fetch('/api/projects/proy-asbuilt-referencia-2026');
        if (resp.ok) {
          const data = await resp.json();
          loaded = data.project;
        }
      } catch (_) {}
    }

    if (!loaded) {
      loaded = buildDefaultReferenceProjectClient();
    }

    loadProjectIntoState(loaded, false);
    saveCurrentProject(false);
    await refreshRecentProjects();
    resizeCanvases();
    fitPlanToScreen();
    renderAll();

    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key !== 'asbuilt-mobiliario-v2.4.0') {
            caches.delete(key);
          }
        });
      }).catch(() => {});
    }

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js?v=2.4.0').then((reg) => {
        reg.update();
      }).catch(() => {});
    }
  }

  function buildDefaultReferenceProjectClient() {
    // Mismo proyecto de referencia de 7 muros + pollo + elevaciones + puerta de 9 lecturas
    const v1 = 'v-c-1', v2 = 'v-c-2', v3 = 'v-c-3', v4 = 'v-c-4', v5 = 'v-c-5', v6 = 'v-c-6', v7 = 'v-c-7', v8 = 'v-c-8', v9 = 'v-c-9';
    const w1 = 'w-c-1', w2 = 'w-c-2', w3 = 'w-c-3', w4 = 'w-c-4', w5 = 'w-c-5', w6 = 'w-c-6', w7 = 'w-c-7';

    const cocina = {
      id: 'conc-cocina-7m',
      name: 'Cocina Principal (7 Muros)',
      conceptType: 'COCINA',
      mode: 'PLAN_ELEVATION',
      isClosedLoop: false,
      heightMm: 2600,
      heightMode: 'INHERITED',
      vertices: [
        { id: v1, xMm: 0, yMm: 2800 },
        { id: v2, xMm: 0, yMm: 0 },
        { id: v3, xMm: 1600, yMm: 0 },
        { id: v4, xMm: 2500, yMm: 0 },
        { id: v5, xMm: 4100, yMm: 0 },
        { id: v6, xMm: 4100, yMm: 1900 },
        { id: v7, xMm: 3200, yMm: 2800 },
        { id: v8, xMm: 1800, yMm: 2800 },
        { id: v9, xMm: 1800, yMm: 3300 }
      ],
      walls: [
        {
          id: w1, orderIndex: 1, label: 'Muro 1', code: 'M01', startVertexId: v1, endVertexId: v2,
          provisionalLengthM: 2.8, realLengthMm: 2800, heightMm: 2600, thicknessMm: 150, angleDeg: 270, angleMode: 'ORTHO', outwardNormalSign: 1, status: 'fijado',
          elements: [
            {
              id: 'el-e01', code: 'E01', category: 'ELECTRICAL', subType: 'CONTACTO_GFCI', label: 'Contacto GFCI Refrigerador',
              widthMm: 70, heightMm: 115, gfci: true, provenance: 'MEASURED',
              references: { distLeftMm: 650, distRightMm: 2150, distFloorMm: 1150, distTopMm: 1450, horizontalAnchor: 'LEFT', verticalAnchor: 'FLOOR' }
            }
          ]
        },
        {
          id: w2, orderIndex: 2, label: 'Muro 2', code: 'M02', startVertexId: v2, endVertexId: v3,
          provisionalLengthM: 1.6, realLengthMm: 1600, heightMm: 2600, thicknessMm: 150, angleDeg: 0, angleMode: 'ORTHO', outwardNormalSign: 1, status: 'fijado',
          elements: []
        },
        {
          id: w3, orderIndex: 3, label: 'Muro 3', code: 'M03', startVertexId: v7, endVertexId: v8,
          provisionalLengthM: 1.4, realLengthMm: 1400, heightMm: 2600, thicknessMm: 150, angleDeg: 180, angleMode: 'ORTHO', outwardNormalSign: 1, status: 'fijado',
          elements: []
        },
        {
          id: w4, orderIndex: 4, label: 'Muro 4', code: 'M04', startVertexId: v8, endVertexId: v9,
          provisionalLengthM: 0.5, realLengthMm: 500, heightMm: 2600, thicknessMm: 120, angleDeg: 90, angleMode: 'ORTHO', outwardNormalSign: 1, status: 'fijado',
          elements: []
        },
        {
          id: w5, orderIndex: 5, label: 'Muro 5', code: 'M05', startVertexId: v4, endVertexId: v5,
          provisionalLengthM: 1.6, realLengthMm: 1600, heightMm: 2600, thicknessMm: 150, angleDeg: 0, angleMode: 'ORTHO', outwardNormalSign: 1, status: 'fijado',
          elements: [
            {
              id: 'el-h01', code: 'H01', category: 'PLUMBING', subType: 'CONJUNTO_TARJA_CONAVI', label: 'Conjunto Tarja (AC+AF+Dren)',
              isSet: true, separationAfAcMm: 200, hotOffsetUMm: -100, hotOffsetVMm: 50, coldOffsetUMm: 100, coldOffsetVMm: 50,
              drainDiameterMm: 50, supplyDiameterMm: 13, widthMm: 220, heightMm: 120, provenance: 'MEASURED',
              references: { distLeftMm: 800, distRightMm: 800, distFloorMm: 500, distTopMm: 2100, horizontalAnchor: 'LEFT', verticalAnchor: 'FLOOR' }
            },
            {
              id: 'el-e02', code: 'E02', category: 'ELECTRICAL', subType: 'CONTACTO_GFCI', label: 'Contacto GFCI Cubierta',
              widthMm: 70, heightMm: 115, gfci: true, provenance: 'MEASURED',
              references: { distLeftMm: 350, distRightMm: 1250, distFloorMm: 1150, distTopMm: 1450, horizontalAnchor: 'LEFT', verticalAnchor: 'FLOOR' }
            }
          ]
        },
        {
          id: w6, orderIndex: 6, label: 'Muro 6', code: 'M06', startVertexId: v6, endVertexId: v7,
          provisionalLengthM: 1.27, realLengthMm: 1272.792, heightMm: 2600, thicknessMm: 150, angleDeg: 135, angleMode: 'MANUAL', outwardNormalSign: 1, status: 'fijado',
          elements: []
        },
        {
          id: w7, orderIndex: 7, label: 'Muro 7', code: 'M07', startVertexId: v5, endVertexId: v6,
          provisionalLengthM: 1.9, realLengthMm: 1900, heightMm: 2600, thicknessMm: 150, angleDeg: 90, angleMode: 'ORTHO', outwardNormalSign: 1, status: 'fijado',
          elements: [
            {
              id: 'el-v01', code: 'V01', category: 'WINDOW', subType: 'VENTANA_ESTANDAR', label: 'Ventana sobre tarja',
              widthMm: 1000, heightMm: 1100, sillHeightMm: 1100, provenance: 'MEASURED',
              references: { distLeftMm: 950, distRightMm: 950, distFloorMm: 1650, distTopMm: 950, horizontalAnchor: 'LEFT', verticalAnchor: 'FLOOR' }
            }
          ]
        }
      ],
      separations: [
        { id: 'sep-01', label: 'Paso abierto a comedor', x1Mm: 1600, y1Mm: 0, x2Mm: 2500, y2Mm: 0, distanceMm: 900 }
      ],
      concreteBases: [
        {
          id: 'pollo-01', code: 'P01', kind: 'POLLO', label: 'Base de concreto / Pollo Tarja',
          xMm: 2500, yMm: 0, lengthMm: 1600, widthMm: 580, heightMm: 100, angleDeg: 0, hostWallId: w5,
          references: { distLeftWallMm: 0, distRightWallMm: 0, distBackWallMm: 0, referenceWallLabel: 'Muro 5 (M05)' }
        }
      ],
      notes: 'Levantamiento de 7 muros en orden izquierda→derecha con separación de 900 mm y chaflán manual a 135°.'
    };
    G.applyRenumberLeftToRight(cocina);

    const puerta = {
      id: 'conc-puerta-01',
      name: 'Puerta Intercomunicación Cocina-Pasillo (P-01)',
      conceptType: 'PUERTA',
      mode: 'DOOR_FRONTAL',
      doorSurvey: {
        id: 'door-p01',
        code: 'P-01',
        ceilingHeightMm: 2600,
        baseOffsetMm: 0,
        widths: { inferior: 904, medio: 898, superior: 901 },
        heights: { izquierdo: 2115, centro: 2112, derecho: 2108 },
        thicknesses: { superior: 152, medio: 148, inferior: 155 }
      }
    };

    return {
      id: 'proy-asbuilt-referencia-2026',
      schemaVersion: '1.0.0',
      name: 'Residencial Reforma · Levantamiento AS-BUILT Mobiliario',
      client: 'Arquitectura & Mobiliario Custom',
      siteAddress: 'Av. Paseo de la Reforma, CDMX',
      displayUnit: 'mm',
      predominantHeightMm: 2600,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: 'Expediente AS-BUILT en milímetros (mm) compatible con Rhinoceros 8.',
      concepts: [cocina, puerta]
    };
  }

  function pushUndoSnapshot() {
    if (!state.project) return;
    state.undoStack.push(JSON.stringify(state.project));
    if (state.undoStack.length > 40) state.undoStack.shift();
    state.redoStack = [];
  }

  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify(state.project));
    const prev = JSON.parse(state.undoStack.pop());
    loadProjectIntoState(prev, false);
    saveCurrentProject(false);
    renderAll();
  }

  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify(state.project));
    const next = JSON.parse(state.redoStack.pop());
    loadProjectIntoState(next, false);
    saveCurrentProject(false);
    renderAll();
  }

  function loadProjectIntoState(proj, recordUndo = false) {
    if (recordUndo) pushUndoSnapshot();
    state.project = proj;
    const concepts = proj.concepts || [];
    const firstPlan = concepts.find((c) => c.conceptType !== 'PUERTA' && c.mode !== 'DOOR_FRONTAL') || concepts[0];
    state.activeConceptId = firstPlan ? firstPlan.id : null;
    if (firstPlan && firstPlan.walls && firstPlan.walls.length > 0) {
      state.activeWallId = firstPlan.walls[0].id;
      state.selectedEntity = { kind: 'WALL', id: firstPlan.walls[0].id };
    } else {
      state.activeWallId = null;
      state.selectedEntity = null;
    }
    syncProjectFormInputs();
  }

  async function saveCurrentProject(showToast = false) {
    if (!state.project) return;
    state.project.updatedAt = new Date().toISOString();
    const pill = document.getElementById('saveStatusPill');

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.project));
      let idx = [];
      try {
        idx = JSON.parse(localStorage.getItem(LOCAL_LIST_KEY) || '[]');
      } catch (_) {}
      idx = idx.filter((item) => item.id !== state.project.id);
      idx.unshift({
        id: state.project.id,
        name: state.project.name,
        client: state.project.client || '',
        updatedAt: state.project.updatedAt,
        conceptsCount: (state.project.concepts || []).length
      });
      localStorage.setItem(LOCAL_LIST_KEY, JSON.stringify(idx.slice(0, 25)));
      localStorage.setItem(`codex_proj_${state.project.id}`, JSON.stringify(state.project));
    } catch (_) {}

    try {
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: state.project })
      });
      if (resp.ok) {
        if (pill) {
          pill.className = 'status-pill';
          pill.textContent = `Guardado + Respaldo (${new Date().toLocaleTimeString()})`;
        }
        if (showToast) refreshRecentProjects();
        return;
      }
    } catch (_) {}

    if (pill) {
      pill.className = 'status-pill';
      pill.textContent = `Guardado Local (${new Date().toLocaleTimeString()})`;
    }
    if (showToast) refreshRecentProjects();
  }

  function showToastNotification(msg) {
    const pill = document.getElementById('saveStatusPill');
    if (pill) {
      const origText = pill.textContent;
      pill.textContent = `✔ ${msg}`;
      pill.style.background = '#dcfce7';
      pill.style.color = '#15803d';
      setTimeout(() => {
        pill.textContent = origText || 'Guardado en este equipo OK';
        pill.style.background = '';
        pill.style.color = '';
      }, 3500);
    }
  }

  async function refreshRecentProjects() {
    const container = document.getElementById('recentProjectsList');
    if (!container) return;
    let list = [];
    try {
      const resp = await fetch('/api/projects');
      if (resp.ok) {
        const data = await resp.json();
        list = data.projects || [];
      }
    } catch (_) {}

    if (!list.length) {
      try {
        list = JSON.parse(localStorage.getItem(LOCAL_LIST_KEY) || '[]');
      } catch (_) {}
    }

    if (!list.length) {
      container.innerHTML = '<div style="font-size:12.5px; color:var(--text-muted);">No hay proyectos adicionales guardados.</div>';
      return;
    }

    container.innerHTML = list.map((p) => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border:1.5px solid var(--border-color); border-radius:8px; background:#fff;">
        <div>
          <div style="font-weight:800; font-size:13px;">${escapeHtml(p.name)}</div>
          <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(p.client || 'Sin cliente')} · ${p.conceptsCount || 0} conceptos</div>
        </div>
        <button class="btn btn-sm" onclick="App.openSavedProject('${escapeHtml(p.id)}')">Abrir</button>
      </div>
    `).join('');
  }

  async function openSavedProject(projectId) {
    try {
      const resp = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      if (resp.ok) {
        const data = await resp.json();
        loadProjectIntoState(data.project, true);
        saveCurrentProject(false);
        fitPlanToScreen();
        renderAll();
        return;
      }
    } catch (_) {}

    const raw = localStorage.getItem(`codex_proj_${projectId}`);
    if (raw) {
      loadProjectIntoState(JSON.parse(raw), true);
      saveCurrentProject(false);
      fitPlanToScreen();
      renderAll();
    }
  }

  function createNewProjectPrompt() {
    const name = prompt('Nombre del nuevo proyecto AS-BUILT:', 'Levantamiento Mobiliario ' + new Date().toLocaleDateString());
    if (!name) return;
    const newProj = {
      id: G.newId('proy'),
      schemaVersion: '1.0.0',
      name: name.trim(),
      client: '',
      siteAddress: '',
      displayUnit: 'mm',
      predominantHeightMm: 2600,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: '',
      concepts: [
        {
          id: G.newId('conc'),
          name: 'Cocina 01',
          conceptType: 'COCINA',
          mode: 'PLAN_ELEVATION',
          isClosedLoop: false,
          heightMm: 2600,
          heightMode: 'INHERITED',
          vertices: [],
          walls: [],
          separations: [],
          concreteBases: [],
          notes: ''
        }
      ]
    };
    loadProjectIntoState(newProj, true);
    saveCurrentProject(true);
    renderAll();
  }

  async function loadDemoReferenceProject() {
    try {
      const resp = await fetch('/api/seed-demo', { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json();
        loadProjectIntoState(data.project, true);
        saveCurrentProject(true);
        fitPlanToScreen();
        renderAll();
        return;
      }
    } catch (_) {}
    loadProjectIntoState(buildDefaultReferenceProjectClient(), true);
    saveCurrentProject(true);
    fitPlanToScreen();
    renderAll();
  }

  function importProjectFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const proj = parsed.project || parsed;
        if (!proj.concepts) throw new Error('Archivo JSON no contiene conceptos AS-BUILT válidos.');
        loadProjectIntoState(proj, true);
        saveCurrentProject(true);
        fitPlanToScreen();
        renderAll();
        showToastNotification(`Proyecto transferido cargado: ${proj.name || 'Sin nombre'} (${(proj.concepts || []).length} conceptos).`);
      } catch (err) {
        alert('Error al cargar el proyecto: ' + err.message);
      } finally {
        const fileInput = document.getElementById('fileImportInput');
        if (fileInput) fileInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  function downloadBackupJson() {
    if (!state.project) return;
    const safe = String(state.project.name || 'Proyecto_AsBuilt').replace(/[^a-zA-Z0-9_\-]+/g, '_');
    const blob = new Blob([JSON.stringify(state.project, null, 2)], { type: 'application/json;charset=utf-8' });
    global.ASBuiltDxfExporter.triggerBlobDownload(blob, `${safe}.asbuilt.json`);
    showToastNotification(`Archivo transferible descargado: ${safe}.asbuilt.json`);
  }

  // ==========================================================================
  // 2. GESTIÓN DE PROYECTO Y CONCEPTOS
  // ==========================================================================

  function syncProjectFormInputs() {
    if (!state.project) return;
    const p = state.project;
    document.getElementById('topProjectTitle').textContent = p.name || 'Proyecto AS-BUILT';
    document.getElementById('projNameInput').value = p.name || '';
    document.getElementById('projClientInput').value = p.client || '';
    document.getElementById('projSiteInput').value = p.siteAddress || '';
    document.getElementById('projHeightInput').value = p.predominantHeightMm || 2600;
    document.getElementById('projNotesInput').value = p.notes || '';
  }

  function updateProjectMeta() {
    if (!state.project) return;
    state.project.name = document.getElementById('projNameInput').value;
    state.project.client = document.getElementById('projClientInput').value;
    state.project.siteAddress = document.getElementById('projSiteInput').value;
    const h = Number(document.getElementById('projHeightInput').value);
    if (Number.isFinite(h) && h > 0) {
      state.project.predominantHeightMm = h;
      for (const c of (state.project.concepts || [])) {
        if (c.heightMode !== 'OVERRIDE') c.heightMm = h;
        for (const w of (c.walls || [])) {
          if (w.heightMode !== 'OVERRIDE') w.heightMm = h;
        }
      }
    }
    state.project.notes = document.getElementById('projNotesInput').value;
    document.getElementById('topProjectTitle').textContent = state.project.name || 'Proyecto AS-BUILT';
    saveCurrentProject(false);
    renderProjectDashboard();
  }

  function onConceptTypeChange() {
    const sel = document.getElementById('newConceptTypeSelect').value;
    const inp = document.getElementById('newConceptNameInput');
    const found = G.CONCEPT_TYPES.find((t) => t.id === sel);
    if (found) {
      const count = (state.project.concepts || []).filter((c) => c.conceptType === sel).length + 1;
      inp.value = `${found.label} ${String(count).padStart(2, '0')}`;
    }
  }

  function addConcept() {
    if (!state.project) return;
    pushUndoSnapshot();
    const typeId = document.getElementById('newConceptTypeSelect').value;
    const typeInfo = G.CONCEPT_TYPES.find((t) => t.id === typeId) || G.CONCEPT_TYPES[0];
    const rawName = document.getElementById('newConceptNameInput').value.trim();
    const count = (state.project.concepts || []).length + 1;
    const name = rawName || `${typeInfo.label} ${String(count).padStart(2, '0')}`;

    let newC;
    if (typeId === 'PUERTA') {
      newC = {
        id: G.newId('conc-door'),
        name,
        conceptType: 'PUERTA',
        mode: 'DOOR_FRONTAL',
        doorSurvey: {
          id: G.newId('door'),
          code: `P-${String(count).padStart(2, '0')}`,
          ceilingHeightMm: state.project.predominantHeightMm || 2600,
          baseOffsetMm: 0,
          widths: { inferior: 900, medio: 900, superior: 900 },
          heights: { izquierdo: 2100, centro: 2100, derecho: 2100 },
          thicknesses: { superior: 150, medio: 150, inferior: 150 }
        }
      };
    } else {
      newC = {
        id: G.newId('conc'),
        name,
        conceptType: typeId,
        mode: 'PLAN_ELEVATION',
        isClosedLoop: false,
        heightMm: state.project.predominantHeightMm || 2600,
        heightMode: 'INHERITED',
        vertices: [],
        walls: [],
        separations: [],
        concreteBases: [],
        notes: ''
      };
    }

    state.project.concepts.push(newC);
    state.activeConceptId = newC.id;
    document.getElementById('newConceptNameInput').value = '';
    saveCurrentProject(false);
    renderAll();

    if (typeId === 'PUERTA') {
      switchMainView('DOOR');
    } else {
      switchMainView('PLAN');
    }
  }

  function deleteConcept(conceptId) {
    if (!state.project) return;
    if ((state.project.concepts || []).length <= 1) {
      alert('El proyecto debe conservar al menos un concepto.');
      return;
    }
    pushUndoSnapshot();
    state.project.concepts = state.project.concepts.filter((c) => c.id !== conceptId);
    state.activeConceptId = state.project.concepts[0].id;
    saveCurrentProject(false);
    renderAll();
  }

  function getActivePlanConcept() {
    if (!state.project) return null;
    const planConcepts = (state.project.concepts || []).filter((c) => c.conceptType !== 'PUERTA' && c.mode !== 'DOOR_FRONTAL');
    return planConcepts.find((c) => c.id === state.activeConceptId) || planConcepts[0] || null;
  }

  function getActiveDoorConcept() {
    if (!state.project) return null;
    const doorConcepts = (state.project.concepts || []).filter((c) => c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL');
    return doorConcepts.find((c) => c.id === state.activeConceptId) || doorConcepts[0] || null;
  }

  const navigationHistory = [];

  function updateBackButtonState() {
    const backBtn = document.getElementById('globalBackBtn');
    if (!backBtn) return;
    if (state.mainView === 'PROJECT') {
      backBtn.style.display = 'none';
      backBtn.setAttribute('disabled', 'true');
      backBtn.disabled = true;
    } else {
      backBtn.style.display = 'inline-flex';
      backBtn.removeAttribute('disabled');
      backBtn.disabled = false;
      const prevName = getPreviousViewName();
      backBtn.title = `Regresar a ${prevName}`;
    }
  }

  function getPreviousViewName() {
    if (navigationHistory.length > 0) {
      const last = navigationHistory[navigationHistory.length - 1];
      if (last === 'PROJECT') return 'Proyecto y Conceptos';
      if (last === 'PLAN') return 'Boceto en Planta';
      if (last === 'ELEVATION') return 'Elevaciones';
      if (last === 'DOOR') return 'Puertas (9 Medidas)';
    }
    if (state.mainView === 'ELEVATION') return 'Boceto en Planta';
    if (state.mainView === 'DOOR') return 'Proyecto y Conceptos';
    if (state.mainView === 'PLAN') return 'Proyecto y Conceptos';
    return 'Pantalla anterior';
  }

  function navigateBack() {
    // 1. Conservar los datos y cambios realizados al regresar
    saveCurrentProject(false);

    // 2. Determinar la pantalla destino desde el historial
    let targetView = 'PROJECT';
    if (navigationHistory.length > 0) {
      targetView = navigationHistory.pop();
      while (targetView === state.mainView && navigationHistory.length > 0) {
        targetView = navigationHistory.pop();
      }
    } else {
      if (state.mainView === 'ELEVATION') targetView = 'PLAN';
      else if (state.mainView === 'DOOR') targetView = 'PROJECT';
      else if (state.mainView === 'PLAN') targetView = 'PROJECT';
    }

    switchMainView(targetView, true);
  }

  function switchMainView(viewName, isBackNavigation = false) {
    if (!isBackNavigation && state.mainView && state.mainView !== viewName) {
      navigationHistory.push(state.mainView);
    }
    state.mainView = viewName;
    document.querySelectorAll('.view-panel').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.nav-step').forEach((el) => el.classList.remove('active'));

    if (viewName === 'PROJECT') {
      document.getElementById('viewProject').classList.add('active');
      document.getElementById('navBtnProject').classList.add('active');
    } else if (viewName === 'PLAN') {
      document.getElementById('viewPlan').classList.add('active');
      document.getElementById('navBtnPlan').classList.add('active');
      const pc = getActivePlanConcept();
      if (pc) state.activeConceptId = pc.id;
    } else if (viewName === 'ELEVATION') {
      document.getElementById('viewElevation').classList.add('active');
      document.getElementById('navBtnElevation').classList.add('active');
      const pc = getActivePlanConcept();
      if (pc && pc.walls && pc.walls.length && !pc.walls.some((w) => w.id === state.activeWallId)) {
        state.activeWallId = pc.walls[0].id;
      }
    } else if (viewName === 'DOOR') {
      document.getElementById('viewDoor').classList.add('active');
      document.getElementById('navBtnDoor').classList.add('active');
      let dc = getActiveDoorConcept();
      if (!dc && state.project) {
        // Crear concepto puerta automáticamente si el usuario entra a la pestaña de puertas
        dc = {
          id: G.newId('conc-door'),
          name: 'Puerta Intercomunicación P-01',
          conceptType: 'PUERTA',
          mode: 'DOOR_FRONTAL',
          doorSurvey: {
            id: G.newId('door'),
            code: 'P-01',
            ceilingHeightMm: state.project.predominantHeightMm || 2600,
            baseOffsetMm: 0,
            widths: { inferior: 904, medio: 898, superior: 901 },
            heights: { izquierdo: 2115, centro: 2112, derecho: 2108 },
            thicknesses: { superior: 152, medio: 148, inferior: 155 }
          }
        };
        state.project.concepts.push(dc);
      }
      if (dc) state.activeConceptId = dc.id;
    }

    updateBackButtonState();
    saveCurrentProject(false);

    setTimeout(() => {
      resizeCanvases();
      if (viewName === 'PLAN') fitPlanToScreen();
      if (viewName === 'ELEVATION') fitElevationToScreen();
      renderAll();
    }, 30);
  }

  function openConceptInProperView(conceptId) {
    if (!state.project) return;
    const c = (state.project.concepts || []).find((item) => item.id === conceptId);
    if (!c) return;
    state.activeConceptId = c.id;
    if (c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL') {
      switchMainView('DOOR');
    } else {
      if (c.walls && c.walls.length > 0) {
        state.activeWallId = c.walls[0].id;
        state.selectedEntity = { kind: 'WALL', id: c.walls[0].id };
      }
      switchMainView('PLAN');
    }
  }

  function openWallElevation(wallId) {
    state.activeWallId = wallId;
    const c = getActivePlanConcept();
    if (c) {
      const w = (c.walls || []).find((item) => item.id === wallId);
      if (w && w.elements && w.elements.length > 0) {
        state.selectedEntity = { kind: 'ELEMENT', id: w.elements[0].id };
      } else {
        state.selectedEntity = null;
      }
    }
    switchMainView('ELEVATION');
  }

  // ==========================================================================
  // 3. INTERACCIÓN Y DIBUJO 2D EN PLANTA (MOUSE + TABLET TOUCH)
  // ==========================================================================

  function setPlanTool(toolName) {
    cancelCurrentDrawing();
    state.planTool = toolName;
    const mapIds = {
      WALL: 'toolBtnWall',
      CHAINED: 'toolBtnChained',
      FREEHAND: 'toolBtnFreehand',
      GAP: 'toolBtnGap',
      POLLO: 'toolBtnPollo',
      SARDINEL: 'toolBtnSardinel',
      SELECT: 'toolBtnSelect',
      PAN: 'toolBtnPan'
    };
    Object.values(mapIds).forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });
    if (mapIds[toolName]) {
      const btn = document.getElementById(mapIds[toolName]);
      if (btn) btn.classList.add('active');
    }

    const hints = {
      WALL: '✏️ Muro individual (2 puntos): toque punto inicial y punto final. Cota real en mm fija el muro.',
      CHAINED: '🔗 Muros encadenados: marque puntos consecutivos (P1→P2→P3...). Pulse "Finalizar trazado" o Enter para crearlos.',
      FREEHAND: '✍️ Mano alzada: dibuje libremente el contorno con mouse o lápiz/dedo. Al soltar se convertirá en muros ortogonales editables.',
      GAP: '↔️ Separación / Hueco: toque extremo A (nodo muro 1) y extremo B (nodo muro 2) para registrar separación en mm (no une los muros).',
      POLLO: '🧱 Base de concreto / Pollo: toque puntos consecutivos para trazar base poligonal (L, U o recta). Pulse "Finalizar Base" o Enter.',
      SARDINEL: '🚿 Sardinel de piso: toque puntos para definir base de sardinel en piso.',
      SELECT: '👆 Seleccionar: toque cualquier muro, base o hueco para editar sus medidas o presione Supr / Delete para eliminarlo.',
      PAN: '✋ Panorámica: arrastre con mouse o dedo para desplazar la vista.'
    };
    const hintEl = document.getElementById('planToolHint');
    if (hintEl) hintEl.textContent = hints[toolName] || '';
    updateDrawingActionButtons();
    renderPlanCanvas();
  }

  function cancelCurrentDrawing() {
    state.drawingStartWorld = null;
    state.drawingPreviewWorld = null;
    state.chainedPoints = [];
    state.polloPoints = [];
    state.gapStartNode = null;
    state.isFreehandDrawing = false;
    state.freehandRawPoints = [];
    cancelInlineDimension();
    updateDrawingActionButtons();
    renderPlanCanvas();
  }

  function updateDrawingActionButtons() {
    const isChained = state.planTool === 'CHAINED' && state.chainedPoints && state.chainedPoints.length >= 2;
    const isPollo = state.planTool === 'POLLO' && state.polloPoints && state.polloPoints.length >= 2;
    const isDrawingActive = !!(
      state.drawingStartWorld ||
      (state.chainedPoints && state.chainedPoints.length > 0) ||
      (state.polloPoints && state.polloPoints.length > 0) ||
      state.gapStartNode ||
      state.isFreehandDrawing
    );

    const btnFinish = document.getElementById('btnFinishChained');
    const hudFinish = document.getElementById('hudBtnFinishChained');
    const dispFinish = isChained ? 'block' : 'none';
    if (btnFinish) btnFinish.style.display = dispFinish;
    if (hudFinish) hudFinish.style.display = dispFinish;

    const btnFinishPollo = document.getElementById('btnFinishPollo');
    const hudFinishPollo = document.getElementById('hudBtnFinishPollo');
    const dispPollo = isPollo ? 'block' : 'none';
    if (btnFinishPollo) btnFinishPollo.style.display = dispPollo;
    if (hudFinishPollo) hudFinishPollo.style.display = dispPollo;

    const btnCancel = document.getElementById('btnCancelDrawing');
    const hudCancel = document.getElementById('hudBtnCancelDrawing');
    if (btnCancel) btnCancel.style.opacity = isDrawingActive ? '1' : '0.7';
    if (hudCancel) hudCancel.style.opacity = isDrawingActive ? '1' : '0.7';
  }

  function bindGlobalKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);

      if (e.key === 'Escape') {
        cancelCurrentDrawing();
      } else if (e.key === 'Enter') {
        if (!isInput && state.planTool === 'CHAINED' && state.chainedPoints && state.chainedPoints.length >= 2) {
          e.preventDefault();
          finishChainedDrawing();
        } else if (!isInput && state.planTool === 'POLLO' && state.polloPoints && state.polloPoints.length >= 2) {
          e.preventDefault();
          finishPolloDrawing();
        }
      } else if (e.key === 'Delete' || e.key === 'Del') {
        // Habilitar tecla Suprimir / Delete para muros, bases o huecos seleccionados
        if (!isInput && (state.planTool === 'SELECT' || state.selectedEntity)) {
          e.preventDefault();
          deleteSelectedEntity();
        }
      }
    });
  }

  function finishChainedDrawing() {
    const c = getActivePlanConcept();
    if (!c || !state.chainedPoints || state.chainedPoints.length < 2) {
      cancelCurrentDrawing();
      return;
    }

    pushUndoSnapshot();
    c.vertices = c.vertices || [];
    c.walls = c.walls || [];

    const pts = state.chainedPoints;
    let prevVertexId = null;
    let firstVertexId = null;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];

      let v1Id = prevVertexId || p1.vertexId;
      if (!v1Id) {
        v1Id = G.newId('v');
        c.vertices.push({ id: v1Id, xMm: p1.x, yMm: p1.y });
      }
      if (i === 0) firstVertexId = v1Id;

      let v2Id = p2.vertexId;
      const isLast = i === pts.length - 2;
      const distToFirst = firstVertexId ? Math.hypot(p2.x - pts[0].x, p2.y - pts[0].y) : 9999;
      if (isLast && distToFirst < 60) {
        v2Id = firstVertexId;
        c.isClosedLoop = true;
      } else if (!v2Id) {
        v2Id = G.newId('v');
        c.vertices.push({ id: v2Id, xMm: p2.x, yMm: p2.y });
      }
      prevVertexId = v2Id;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenMm = Math.hypot(dx, dy);
      const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

      const nextNum = (c.walls || []).length + 1;
      const newWall = {
        id: G.newId('w'),
        orderIndex: nextNum,
        label: `Muro ${nextNum}`,
        code: `M${String(nextNum).padStart(2, '0')}`,
        startVertexId: v1Id,
        endVertexId: v2Id,
        provisionalLengthM: Number((lenMm / 1000).toFixed(2)),
        realLengthMm: null,
        heightMm: c.heightMm || state.project.predominantHeightMm || 2600,
        heightMode: 'INHERITED',
        thicknessMm: 150,
        angleDeg: G.snapOrthogonalAngle(ang),
        angleMode: state.orthoMode ? 'ORTHO' : 'MANUAL',
        outwardNormalSign: 1,
        status: 'provisional',
        elements: []
      };
      c.walls.push(newWall);
      state.activeWallId = newWall.id;
      state.selectedEntity = { kind: 'WALL', id: newWall.id };
    }

    G.autoOrientWallNormals(c);
    state.chainedPoints = [];
    state.drawingStartWorld = null;
    state.drawingPreviewWorld = null;
    updateDrawingActionButtons();
    saveCurrentProject(false);
    renderAll();
  }

  function finishPolloDrawing() {
    const c = getActivePlanConcept();
    if (!c || !state.polloPoints || state.polloPoints.length < 2) {
      cancelCurrentDrawing();
      return;
    }

    pushUndoSnapshot();
    c.concreteBases = c.concreteBases || [];
    const idx = c.concreteBases.length + 1;
    let pts = state.polloPoints.slice();

    if (pts.length === 2) {
      const p0 = pts[0];
      const p1 = pts[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const u = { x: dx / len, y: dy / len };
      const n = { x: -u.y, y: u.x };
      const W = 600;
      pts = [
        p0,
        p1,
        { x: p1.x + W * n.x, y: p1.y + W * n.y },
        { x: p0.x + W * n.x, y: p0.y + W * n.y }
      ];
    }

    const hostW = (c.walls && c.walls[0]) ? c.walls[0].id : null;
    const pb = {
      id: G.newId('pollo'),
      code: `P0${idx}`,
      kind: 'POLLO',
      label: `Base de concreto / Pollo ${idx}`,
      heightMm: 100,
      widthMm: 600,
      lengthMm: Math.round(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)),
      points: pts,
      hostWallId: hostW,
      references: {
        distLeftWallMm: 0,
        distRightWallMm: 0,
        distBackWallMm: 0,
        referenceWallLabel: hostW ? 'Muro 1' : 'Referencia local'
      }
    };

    c.concreteBases.push(pb);
    state.selectedEntity = { kind: 'POLLO', id: pb.id };
    state.polloPoints = [];
    state.drawingStartWorld = null;
    state.drawingPreviewWorld = null;
    updateDrawingActionButtons();
    saveCurrentProject(false);
    renderAll();
    showToastNotification(`Base de concreto creada: ${pb.label} (${pts.length} vértices).`);
  }

  function commitFreehandDrawing() {
    const c = getActivePlanConcept();
    if (!c || !state.freehandRawPoints || state.freehandRawPoints.length < 5) {
      state.freehandRawPoints = [];
      renderPlanCanvas();
      return;
    }
    const result = G.interpretFreehandToWalls(state.freehandRawPoints);
    state.freehandRawPoints = [];
    if (!result || !result.segments || result.segments.length === 0) {
      renderPlanCanvas();
      return;
    }

    pushUndoSnapshot();
    c.vertices = c.vertices || [];
    c.walls = c.walls || [];

    let prevVertexId = null;
    let firstVertexId = null;

    result.segments.forEach((seg, idx) => {
      let v1Id = prevVertexId;
      if (!v1Id) {
        const snap1 = snapToExistingVertexPlan(c, seg.p1.x, seg.p1.y, 14);
        v1Id = snap1.vertexId || G.newId('v');
        if (!snap1.vertexId) {
          c.vertices.push({ id: v1Id, xMm: seg.p1.x, yMm: seg.p1.y });
        }
        firstVertexId = v1Id;
      }

      let v2Id;
      const isLast = idx === result.segments.length - 1;
      if (isLast && result.isClosed && firstVertexId) {
        v2Id = firstVertexId;
      } else {
        const snap2 = snapToExistingVertexPlan(c, seg.p2.x, seg.p2.y, 14);
        v2Id = snap2.vertexId || G.newId('v');
        if (!snap2.vertexId) {
          c.vertices.push({ id: v2Id, xMm: seg.p2.x, yMm: seg.p2.y });
        }
      }
      prevVertexId = v2Id;

      const nextNum = (c.walls || []).length + 1;
      const newWall = {
        id: G.newId('w'),
        orderIndex: nextNum,
        label: `Muro ${nextNum}`,
        code: `M${String(nextNum).padStart(2, '0')}`,
        startVertexId: v1Id,
        endVertexId: v2Id,
        provisionalLengthM: Number((seg.lengthMm / 1000).toFixed(2)),
        realLengthMm: null,
        heightMm: c.heightMm || state.project.predominantHeightMm || 2600,
        heightMode: 'INHERITED',
        thicknessMm: 150,
        angleDeg: seg.angleDeg,
        angleMode: 'ORTHO',
        outwardNormalSign: 1,
        status: 'provisional',
        elements: []
      };
      c.walls.push(newWall);
      state.activeWallId = newWall.id;
      state.selectedEntity = { kind: 'WALL', id: newWall.id };
    });

    if (result.isClosed) {
      c.isClosedLoop = true;
    }
    G.autoOrientWallNormals(c);

    saveCurrentProject(false);
    renderAll();
  }

  function toggleOrthoMode() {
    state.orthoMode = !state.orthoMode;
    const btn = document.getElementById('btnToggleOrtho');
    const box = document.getElementById('manualAngleBox');
    if (state.orthoMode) {
      btn.textContent = '📐 Ortogonal: ACTIVO (0°/90°)';
      box.style.display = 'none';
    } else {
      btn.textContent = '📐 Ángulo Manual: ACTIVO';
      box.style.display = 'block';
    }
  }

  function toggleClosedLoop() {
    const c = getActivePlanConcept();
    if (!c) return;
    pushUndoSnapshot();
    c.isClosedLoop = !c.isClosedLoop;
    saveCurrentProject(false);
    renderAll();
  }

  function screenToWorldPlan(sx, sy) {
    return {
      x: (sx - state.planCam.x) / state.planCam.scale,
      y: (state.planCam.y - sy) / state.planCam.scale
    };
  }

  function worldToScreenPlan(wx, wy) {
    return {
      x: state.planCam.x + wx * state.planCam.scale,
      y: state.planCam.y - wy * state.planCam.scale
    };
  }

  function snapToExistingVertexPlan(concept, wx, wy, pixelRadius = 18) {
    const tolMm = pixelRadius / Math.max(state.planCam.scale, 0.01);
    let best = null;
    let bestDist = tolMm;
    for (const v of (concept.vertices || [])) {
      const d = Math.hypot(Number(v.xMm) - wx, Number(v.yMm) - wy);
      if (d <= bestDist) {
        bestDist = d;
        best = v;
      }
    }
    if (best) return { x: Number(best.xMm), y: Number(best.yMm), vertexId: best.id };
    return { x: Math.round(wx / 10) * 10, y: Math.round(wy / 10) * 10, vertexId: null };
  }

  function findWallVertexNearPlan(concept, wx, wy, pixelRadius = 26) {
    if (!concept || !concept.walls) return null;
    const vmap = G.getVertexMap(concept);
    const tolMm = pixelRadius / Math.max(state.planCam.scale, 0.01);
    let best = null;
    let bestDist = tolMm;

    for (const w of concept.walls) {
      const vStart = vmap[w.startVertexId];
      const vEnd = vmap[w.endVertexId];
      if (vStart) {
        const d1 = Math.hypot(Number(vStart.xMm) - wx, Number(vStart.yMm) - wy);
        if (d1 <= bestDist) {
          bestDist = d1;
          best = {
            vertexId: vStart.id,
            wallId: w.id,
            wallLabel: w.label,
            isStart: true,
            x: Number(vStart.xMm),
            y: Number(vStart.yMm)
          };
        }
      }
      if (vEnd) {
        const d2 = Math.hypot(Number(vEnd.xMm) - wx, Number(vEnd.yMm) - wy);
        if (d2 <= bestDist) {
          bestDist = d2;
          best = {
            vertexId: vEnd.id,
            wallId: w.id,
            wallLabel: w.label,
            isStart: false,
            x: Number(vEnd.xMm),
            y: Number(vEnd.yMm)
          };
        }
      }
    }
    return best;
  }

  function computeConstrainedEndPoint(startPt, rawEndPt) {
    const dx = rawEndPt.x - startPt.x;
    const dy = rawEndPt.y - startPt.y;
    const dist = Math.max(Math.hypot(dx, dy), 200);
    let ang;
    if (state.orthoMode) {
      const rawAng = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      ang = G.snapOrthogonalAngle(rawAng);
    } else {
      const man = Number(document.getElementById('manualAngleInput').value);
      ang = Number.isFinite(man) ? ((man % 360) + 360) % 360 : (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
    }
    const uv = G.unitVectorDeg(ang);
    return {
      x: Number((startPt.x + dist * uv.x).toFixed(2)),
      y: Number((startPt.y + dist * uv.y).toFixed(2)),
      angleDeg: ang,
      lengthMm: Number(dist.toFixed(1))
    };
  }

  function bindCanvasEvents() {
    const planCanvas = document.getElementById('planCanvas');
    if (planCanvas) {
      planCanvas.addEventListener('pointerdown', onPlanPointerDown);
      planCanvas.addEventListener('pointermove', onPlanPointerMove);
      planCanvas.addEventListener('pointerup', onPlanPointerUp);
      planCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        zoomPlan(factor, e.offsetX, e.offsetY);
      }, { passive: false });

      // Gestos táctiles de pellizco (Pinch-to-zoom con dos dedos) en iPad / Tablet
      planCanvas.addEventListener('touchstart', onPlanTouchStart, { passive: false });
      planCanvas.addEventListener('touchmove', onPlanTouchMove, { passive: false });
      planCanvas.addEventListener('touchend', onPlanTouchEnd, { passive: false });
      planCanvas.addEventListener('touchcancel', onPlanTouchEnd, { passive: false });
    }

    const elevCanvas = document.getElementById('elevationCanvas');
    if (elevCanvas) {
      elevCanvas.addEventListener('pointerdown', onElevPointerDown);
      elevCanvas.addEventListener('pointermove', onElevPointerMove);
      elevCanvas.addEventListener('pointerup', onElevPointerUp);
      elevCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        zoomElevation(factor, e.offsetX, e.offsetY);
      }, { passive: false });

      elevCanvas.addEventListener('touchstart', onElevTouchStart, { passive: false });
      elevCanvas.addEventListener('touchmove', onElevTouchMove, { passive: false });
      elevCanvas.addEventListener('touchend', onElevTouchEnd, { passive: false });
      elevCanvas.addEventListener('touchcancel', onElevTouchEnd, { passive: false });
    }
  }

  // --- Handlers de gestos táctiles con dos dedos (iPad/Tablet) ---
  function onPlanTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      state.isPinching = true;
      // Anular trazo provisional de muro accidental si se inició con un toque previo
      if (state.planTool === 'WALL' && state.drawingStartWorld) {
        state.drawingStartWorld = null;
        state.drawingPreviewWorld = null;
      }
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const rect = e.target.getBoundingClientRect();
      const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) * 0.5 - rect.left;
      const midY = (t0.clientY + t1.clientY) * 0.5 - rect.top;
      state.lastTouchDistance = d;
      state.lastTouchCenter = { x: midX, y: midY };
    }
  }

  function onPlanTouchMove(e) {
    if (e.touches.length === 2 && state.lastTouchDistance > 0) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const rect = e.target.getBoundingClientRect();
      const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) * 0.5 - rect.left;
      const midY = (t0.clientY + t1.clientY) * 0.5 - rect.top;

      if (d > 5 && state.lastTouchDistance > 5) {
        const rawRatio = d / state.lastTouchDistance;
        const ratio = Math.max(0.65, Math.min(1.5, rawRatio));
        zoomPlan(ratio, midX, midY);
        if (state.lastTouchCenter) {
          const dx = midX - state.lastTouchCenter.x;
          const dy = midY - state.lastTouchCenter.y;
          state.planCam.x += dx;
          state.planCam.y += dy;
        }
      }
      state.lastTouchDistance = d;
      state.lastTouchCenter = { x: midX, y: midY };
      renderPlanCanvas();
    }
  }

  function onPlanTouchEnd(e) {
    if (e.touches.length < 2) {
      if (state.isPinching) {
        state.isPinching = false;
        state.lastPinchTime = Date.now();
        state.lastTouchDistance = 0;
        state.lastTouchCenter = null;
      }
    }
  }

  function onElevTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      state.isPinching = true;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const rect = e.target.getBoundingClientRect();
      const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) * 0.5 - rect.left;
      const midY = (t0.clientY + t1.clientY) * 0.5 - rect.top;
      state.lastTouchDistance = d;
      state.lastTouchCenter = { x: midX, y: midY };
    }
  }

  function onElevTouchMove(e) {
    if (e.touches.length === 2 && state.lastTouchDistance > 0) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const rect = e.target.getBoundingClientRect();
      const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX = (t0.clientX + t1.clientX) * 0.5 - rect.left;
      const midY = (t0.clientY + t1.clientY) * 0.5 - rect.top;

      if (d > 5 && state.lastTouchDistance > 5) {
        const rawRatio = d / state.lastTouchDistance;
        const ratio = Math.max(0.65, Math.min(1.5, rawRatio));
        zoomElevation(ratio, midX, midY);
        if (state.lastTouchCenter) {
          const dx = midX - state.lastTouchCenter.x;
          const dy = midY - state.lastTouchCenter.y;
          state.elevCam.x += dx;
          state.elevCam.y += dy;
        }
      }
      state.lastTouchDistance = d;
      state.lastTouchCenter = { x: midX, y: midY };
      renderElevationCanvas();
    }
  }

  function onElevTouchEnd(e) {
    if (e.touches.length < 2) {
      if (state.isPinching) {
        state.isPinching = false;
        state.lastPinchTime = Date.now();
        state.lastTouchDistance = 0;
        state.lastTouchCenter = null;
      }
    }
  }

  function onPlanPointerDown(e) {
    // Evitar acciones accidentales si el usuario estaba pellizcando o acaba de soltar los dos dedos
    if (state.isPinching || (Date.now() - (state.lastPinchTime || 0) < 400)) {
      return;
    }

    const c = getActivePlanConcept();
    if (!c) return;
    const rect = e.target.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (e.button === 1 || e.button === 2 || state.planTool === 'PAN') {
      state.isPanning = true;
      state.panStartClient = { x: e.clientX, y: e.clientY };
      state.panStartCam = { x: state.planCam.x, y: state.planCam.y };
      return;
    }

    const wPt = screenToWorldPlan(sx, sy);

    // Clic sobre cota arquitectónica tipo CAD abre editor inline
    if (state.planTool === 'SELECT' || state.planTool === 'WALL') {
      const dimHit = hitTestPlanDimension(sx, sy);
      if (dimHit) {
        openInlineDimensionEditor(dimHit.wallId, dimHit.rect.x + dimHit.rect.width / 2, dimHit.rect.y + dimHit.rect.height / 2);
        return;
      }
    }

    // MODO SELECCIÓN EXCLUSIVA (NUNCA inicia trazo)
    if (state.planTool === 'SELECT') {
      const hit = hitTestPlan(c, sx, sy);
      if (hit) {
        state.selectedEntity = hit;
        if (hit.kind === 'WALL') state.activeWallId = hit.id;
      } else {
        state.selectedEntity = null;
        state.isPanning = true;
        state.panStartClient = { x: e.clientX, y: e.clientY };
        state.panStartCam = { x: state.planCam.x, y: state.planCam.y };
      }
      renderAll();
      return;
    }

    // MODO MANO ALZADA (BOCETO LIBRE)
    if (state.planTool === 'FREEHAND') {
      state.isFreehandDrawing = true;
      state.freehandRawPoints = [wPt];
      renderPlanCanvas();
      return;
    }

    // MODO BASE DE CONCRETO / POLLO POLIGONAL (L, U O RECTA)
    if (state.planTool === 'POLLO') {
      state.polloPoints = state.polloPoints || [];
      const snapped = snapToExistingVertexPlan(c, wPt.x, wPt.y, 22);
      if (state.polloPoints.length >= 2) {
        const p0 = state.polloPoints[0];
        if (Math.hypot(snapped.x - p0.x, snapped.y - p0.y) < 160) {
          finishPolloDrawing();
          return;
        }
      }
      state.polloPoints.push({ x: snapped.x, y: snapped.y });
      updateDrawingActionButtons();
      renderPlanCanvas();
      return;
    }

    // MODO SEPARACIÓN / HUECO (MEDICIÓN ENTRE EXTREMOS DE MUROS)
    if (state.planTool === 'GAP') {
      const snapNode = findWallVertexNearPlan(c, wPt.x, wPt.y, 30);
      if (!state.gapStartNode) {
        if (snapNode) {
          state.gapStartNode = snapNode;
          showToastNotification(`Extremo 1 seleccionado en ${snapNode.wallLabel}. Toque el extremo del segundo muro.`);
        } else {
          const snapV = snapToExistingVertexPlan(c, wPt.x, wPt.y, 22);
          state.gapStartNode = {
            vertexId: snapV.vertexId,
            wallId: null,
            wallLabel: 'Extremo 1',
            x: snapV.x,
            y: snapV.y
          };
          showToastNotification(`Punto A del hueco seleccionado. Toque el segundo extremo.`);
        }
        updateDrawingActionButtons();
        renderPlanCanvas();
        return;
      }

      // Segundo toque para GAP
      let endNode = snapNode;
      if (!endNode) {
        const snapV = snapToExistingVertexPlan(c, wPt.x, wPt.y, 22);
        endNode = {
          vertexId: snapV.vertexId,
          wallId: null,
          wallLabel: 'Extremo 2',
          x: snapV.x,
          y: snapV.y
        };
      }

      const dist = Math.hypot(endNode.x - state.gapStartNode.x, endNode.y - state.gapStartNode.y);
      if (dist < 15) {
        showToastNotification('Los extremos deben ser distintos.');
        return;
      }

      pushUndoSnapshot();
      c.separations = c.separations || [];
      const idx = c.separations.length + 1;
      const sep = {
        id: G.newId('gap'),
        code: `H0${idx}`,
        label: `Hueco ${idx}`,
        wall1Id: state.gapStartNode.wallId,
        vertex1Id: state.gapStartNode.vertexId,
        wall2Id: endNode.wallId,
        vertex2Id: endNode.vertexId,
        x1Mm: state.gapStartNode.x,
        y1Mm: state.gapStartNode.y,
        x2Mm: endNode.x,
        y2Mm: endNode.y,
        distanceMm: Math.round(dist),
        dxMm: Math.round(Math.abs(endNode.x - state.gapStartNode.x)),
        dyMm: Math.round(Math.abs(endNode.y - state.gapStartNode.y))
      };
      c.separations.push(sep);
      state.selectedEntity = { kind: 'GAP', id: sep.id };
      state.gapStartNode = null;
      saveCurrentProject(false);
      renderAll();
      showToastNotification(`Hueco registrado: ${sep.distanceMm} mm (Muros no unidos físicamente).`);
      return;
    }

    const snapped = snapToExistingVertexPlan(c, wPt.x, wPt.y);

    // MODO MUROS ENCADENADOS (MULTI-PUNTO)
    if (state.planTool === 'CHAINED') {
      if (state.chainedPoints.length === 0) {
        state.chainedPoints.push(snapped);
        updateDrawingActionButtons();
        renderPlanCanvas();
        return;
      }
      const lastPt = state.chainedPoints[state.chainedPoints.length - 1];
      const endConstrained = computeConstrainedEndPoint(lastPt, wPt);
      const snapNext = snapToExistingVertexPlan(c, endConstrained.x, endConstrained.y, 14);
      state.chainedPoints.push({
        x: snapNext.x,
        y: snapNext.y,
        vertexId: snapNext.vertexId,
        angleDeg: endConstrained.angleDeg,
        lengthMm: endConstrained.lengthMm
      });
      updateDrawingActionButtons();
      renderPlanCanvas();
      return;
    }

    // MODO MURO INDIVIDUAL (2 PUNTOS), SARDINEL
    if (!state.drawingStartWorld) {
      state.drawingStartWorld = snapped;
      state.drawingPreviewWorld = snapped;
      updateDrawingActionButtons();
      renderPlanCanvas();
      return;
    }

    // Segundo toque: completar trazo
    const startPt = state.drawingStartWorld;
    const endConstrained = computeConstrainedEndPoint(startPt, wPt);
    pushUndoSnapshot();

    if (state.planTool === 'WALL') {
      let vStartId = startPt.vertexId;
      if (!vStartId) {
        vStartId = G.newId('v');
        c.vertices.push({ id: vStartId, xMm: startPt.x, yMm: startPt.y });
      }
      const endSnap = snapToExistingVertexPlan(c, endConstrained.x, endConstrained.y, 14);
      let vEndId = endSnap.vertexId;
      if (!vEndId || vEndId === vStartId) {
        vEndId = G.newId('v');
        c.vertices.push({ id: vEndId, xMm: endConstrained.x, yMm: endConstrained.y });
      } else {
        c.isClosedLoop = true;
      }

      const nextNum = (c.walls || []).length + 1;
      const newWall = {
        id: G.newId('w'),
        orderIndex: nextNum,
        label: `Muro ${nextNum}`,
        code: `M${String(nextNum).padStart(2, '0')}`,
        startVertexId: vStartId,
        endVertexId: vEndId,
        provisionalLengthM: Number((endConstrained.lengthMm / 1000).toFixed(2)),
        realLengthMm: null,
        heightMm: c.heightMm || state.project.predominantHeightMm || 2600,
        heightMode: 'INHERITED',
        thicknessMm: 150,
        angleDeg: endConstrained.angleDeg,
        angleMode: state.orthoMode ? 'ORTHO' : 'MANUAL',
        outwardNormalSign: 1,
        status: 'provisional',
        elements: []
      };
      c.walls.push(newWall);
      G.autoOrientWallNormals(c);
      state.activeWallId = newWall.id;
      state.selectedEntity = { kind: 'WALL', id: newWall.id };
    } else if (state.planTool === 'SARDINEL') {
      c.concreteBases = c.concreteBases || [];
      const idx = c.concreteBases.length + 1;
      const hostW = (c.walls && c.walls[0]) ? c.walls[0].id : null;
      const pb = {
        id: G.newId('sard'),
        code: `S0${idx}`,
        kind: 'SARDINEL',
        label: `Sardinel ${idx}`,
        xMm: startPt.x,
        yMm: startPt.y,
        lengthMm: Math.round(endConstrained.lengthMm),
        widthMm: 120,
        heightMm: 150,
        angleDeg: endConstrained.angleDeg,
        hostWallId: hostW,
        references: {
          distLeftWallMm: 0,
          distRightWallMm: 0,
          distBackWallMm: 0,
          referenceWallLabel: hostW ? 'Muro 1' : 'Referencia local'
        }
      };
      c.concreteBases.push(pb);
      state.selectedEntity = { kind: 'POLLO', id: pb.id };
    }

    state.drawingStartWorld = null;
    state.drawingPreviewWorld = null;
    updateDrawingActionButtons();
    saveCurrentProject(false);
    renderAll();
  }

  function onPlanPointerMove(e) {
    const rect = e.target.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (state.isPanning && state.panStartClient) {
      state.planCam.x = state.panStartCam.x + (e.clientX - state.panStartClient.x);
      state.planCam.y = state.panStartCam.y + (e.clientY - state.panStartClient.y);
      renderPlanCanvas();
      return;
    }

    const wPt = screenToWorldPlan(sx, sy);

    if (state.planTool === 'FREEHAND' && state.isFreehandDrawing) {
      const last = state.freehandRawPoints[state.freehandRawPoints.length - 1];
      if (!last || Math.hypot(wPt.x - last.x, wPt.y - last.y) > 25) {
        state.freehandRawPoints.push(wPt);
        renderPlanCanvas();
      }
      return;
    }

    if (state.planTool === 'CHAINED' && state.chainedPoints && state.chainedPoints.length > 0) {
      const lastPt = state.chainedPoints[state.chainedPoints.length - 1];
      state.drawingPreviewWorld = computeConstrainedEndPoint(lastPt, wPt);
      renderPlanCanvas();
      return;
    }

    if (state.planTool === 'POLLO' && state.polloPoints && state.polloPoints.length > 0) {
      state.drawingPreviewWorld = wPt;
      renderPlanCanvas();
      return;
    }

    if (state.planTool === 'GAP' && state.gapStartNode) {
      state.drawingPreviewWorld = wPt;
      renderPlanCanvas();
      return;
    }

    if (state.drawingStartWorld) {
      state.drawingPreviewWorld = computeConstrainedEndPoint(state.drawingStartWorld, wPt);
      renderPlanCanvas();
    }
  }

  function onPlanPointerUp() {
    state.isPanning = false;
    if (state.planTool === 'FREEHAND' && state.isFreehandDrawing) {
      state.isFreehandDrawing = false;
      commitFreehandDrawing();
    }
  }

  function hitTestPlan(concept, sx, sy) {
    const vmap = G.getVertexMap(concept);
    for (const w of (concept.walls || [])) {
      const m = G.wallGeometryMetrics(w, vmap);
      const p1 = worldToScreenPlan(m.ax, m.ay);
      const p2 = worldToScreenPlan(m.bx, m.by);
      if (distPointToSegment(sx, sy, p1.x, p1.y, p2.x, p2.y) <= 22) {
        return { kind: 'WALL', id: w.id };
      }
    }
    for (const pb of (concept.concreteBases || [])) {
      if (pb.points && pb.points.length >= 3) {
        const screenPts = pb.points.map((pt) => worldToScreenPlan(pt.x, pt.y));
        if (G.pointInPolygon(sx, sy, screenPts)) {
          return { kind: 'POLLO', id: pb.id };
        }
        for (let i = 0; i < screenPts.length; i++) {
          const pA = screenPts[i];
          const pB = screenPts[(i + 1) % screenPts.length];
          if (distPointToSegment(sx, sy, pA.x, pA.y, pB.x, pB.y) <= 22) {
            return { kind: 'POLLO', id: pb.id };
          }
        }
      } else {
        const p1 = worldToScreenPlan(pb.xMm, pb.yMm);
        const p2 = worldToScreenPlan(pb.xMm + (pb.lengthMm || 1000), pb.yMm + (pb.widthMm || 600));
        const minX = Math.min(p1.x, p2.x) - 15, maxX = Math.max(p1.x, p2.x) + 15;
        const minY = Math.min(p1.y, p2.y) - 15, maxY = Math.max(p1.y, p2.y) + 15;
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          return { kind: 'POLLO', id: pb.id };
        }
      }
    }
    for (const sep of (concept.separations || [])) {
      const v1 = vmap[sep.vertex1Id];
      const v2 = vmap[sep.vertex2Id];
      const x1 = v1 ? Number(v1.xMm) : Number(sep.x1Mm);
      const y1 = v1 ? Number(v1.yMm) : Number(sep.y1Mm);
      const x2 = v2 ? Number(v2.xMm) : Number(sep.x2Mm);
      const y2 = v2 ? Number(v2.yMm) : Number(sep.y2Mm);
      const p1 = worldToScreenPlan(x1, y1);
      const p2 = worldToScreenPlan(x2, y2);
      if (distPointToSegment(sx, sy, p1.x, p1.y, p2.x, p2.y) <= 24) {
        return { kind: 'GAP', id: sep.id };
      }
    }
    return null;
  }

  function distPointToSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(px - xx, py - yy);
  }

  function zoomPlan(factor, centerX, centerY) {
    const canvas = document.getElementById('planCanvas');
    const cx = centerX !== undefined ? centerX : (canvas ? canvas.width * 0.5 : 400);
    const cy = centerY !== undefined ? centerY : (canvas ? canvas.height * 0.5 : 300);
    const worldBefore = screenToWorldPlan(cx, cy);
    state.planCam.scale = Math.min(Math.max(state.planCam.scale * factor, 0.025), 0.85);
    state.planCam.x = cx - worldBefore.x * state.planCam.scale;
    state.planCam.y = cy + worldBefore.y * state.planCam.scale;
    renderPlanCanvas();
  }

  function fitPlanToScreen() {
    const c = getActivePlanConcept();
    const canvas = document.getElementById('planCanvas');
    if (!c || !canvas || canvas.width < 50) return;
    const vs = c.vertices || [];
    if (!vs.length) {
      state.planCam = { x: canvas.width * 0.25, y: canvas.height * 0.7, scale: 0.11 };
      renderPlanCanvas();
      return;
    }
    const xs = vs.map((v) => Number(v.xMm));
    const ys = vs.map((v) => Number(v.yMm));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1200);
    const spanY = Math.max(maxY - minY, 1200);
    const pad = 110;
    const sc = Math.min((canvas.width - pad * 2) / spanX, (canvas.height - pad * 2) / spanY, 0.35);
    state.planCam.scale = Math.max(sc, 0.03);
    state.planCam.x = pad - minX * state.planCam.scale + (canvas.width - pad * 2 - spanX * state.planCam.scale) * 0.5;
    state.planCam.y = canvas.height - pad + minY * state.planCam.scale - (canvas.height - pad * 2 - spanY * state.planCam.scale) * 0.5;
    renderPlanCanvas();
  }

  // ==========================================================================
  // 4. RENDERIZADO 2D DE PLANTA Y OVERLAYS RECTANGULARES DE MUROS
  // ==========================================================================

  function resizeCanvases() {
    for (const id of ['planCanvas', 'elevationCanvas', 'doorCanvas']) {
      const cv = document.getElementById(id);
      if (cv && cv.parentElement) {
        const r = cv.parentElement.getBoundingClientRect();
        if (r.width > 20 && r.height > 20) {
          cv.width = r.width;
          cv.height = r.height;
        }
      }
    }
  }

  function renderPlanCanvas() {
    const canvas = document.getElementById('planCanvas');
    const overlayLayer = document.getElementById('wallOverlaysLayer');
    if (!canvas || !overlayLayer) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Fondo blanco con cuadrícula métrica suave
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    drawMetricGrid(ctx, W, H, state.planCam);

    const c = getActivePlanConcept();
    if (!c) {
      overlayLayer.innerHTML = '';
      return;
    }

    const closedBtn = document.getElementById('btnToggleClosedLoop');
    if (closedBtn) {
      closedBtn.textContent = c.isClosedLoop ? '🔗 Planta: CERRADA' : '🔓 Planta: ABIERTA';
    }

    const vmap = G.getVertexMap(c);

    // 1. Dibujar Bases de Concreto / Pollos y Sardineles (Poligonales o Rectangulares)
    for (const pb of (c.concreteBases || [])) {
      const segs = G.computePolygonalBaseSegments(pb);
      let screenPts = [];
      if (pb.points && pb.points.length >= 3) {
        screenPts = pb.points.map((pt) => worldToScreenPlan(pt.x, pt.y));
      } else {
        const ang = ((Number(pb.angleDeg) || 0) * Math.PI) / 180;
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const vx = -uy, vy = ux;
        const l = Number(pb.lengthMm || 1000);
        const w = Number(pb.widthMm || 600);
        screenPts = [
          worldToScreenPlan(pb.xMm, pb.yMm),
          worldToScreenPlan(pb.xMm + l * ux, pb.yMm + l * uy),
          worldToScreenPlan(pb.xMm + l * ux + w * vx, pb.yMm + l * uy + w * vy),
          worldToScreenPlan(pb.xMm + w * vx, pb.yMm + w * vy)
        ];
      }

      const isSelected = state.selectedEntity && state.selectedEntity.kind === 'POLLO' && state.selectedEntity.id === pb.id;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
      ctx.closePath();

      // Relleno característico de concreto: fondo neutro con textura suave
      ctx.fillStyle = pb.kind === 'SARDINEL' ? 'rgba(217, 70, 239, 0.12)' : 'rgba(148, 163, 184, 0.22)';
      ctx.fill();

      // Contorno de la base
      ctx.setLineDash([7, 4]);
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = isSelected ? '#1d4ed8' : (pb.kind === 'SARDINEL' ? '#a21caf' : '#475569');
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiqueta principal de la base
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText(`${pb.label} (H=${pb.heightMm || 100} mm)`, screenPts[0].x + 8, screenPts[0].y - 8);

      // Cotas de los tramos exteriores de la base
      for (const seg of segs) {
        const sA = worldToScreenPlan(seg.pA.x, seg.pA.y);
        const sB = worldToScreenPlan(seg.pB.x, seg.pB.y);
        const smx = 0.5 * (sA.x + sB.x);
        const smy = 0.5 * (sA.y + sB.y);
        const sdx = sB.x - sA.x;
        const sdy = sB.y - sA.y;
        const slen = Math.hypot(sdx, sdy);
        if (slen > 35) {
          const snx = -sdy / slen;
          const sny = sdx / slen;
          const labelX = smx + snx * 12;
          const labelY = smy + sny * 12;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
          const tw = ctx.measureText(`${seg.lengthMm}`).width + 10;
          ctx.fillRect(labelX - tw / 2, labelY - 8, tw, 16);
          ctx.strokeRect(labelX - tw / 2, labelY - 8, tw, 16);
          ctx.fillStyle = '#334155';
          ctx.font = '600 10.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${seg.lengthMm}`, labelX, labelY);
        }
      }
      ctx.restore();
    }

    // 2. Dibujar Separaciones / Huecos entre extremos de muros
    for (const sep of (c.separations || [])) {
      const v1 = vmap[sep.vertex1Id];
      const v2 = vmap[sep.vertex2Id];
      const x1 = v1 ? Number(v1.xMm) : Number(sep.x1Mm);
      const y1 = v1 ? Number(v1.yMm) : Number(sep.y1Mm);
      const x2 = v2 ? Number(v2.xMm) : Number(sep.x2Mm);
      const y2 = v2 ? Number(v2.yMm) : Number(sep.y2Mm);

      const p1 = worldToScreenPlan(x1, y1);
      const p2 = worldToScreenPlan(x2, y2);
      const isSelected = state.selectedEntity && state.selectedEntity.kind === 'GAP' && state.selectedEntity.id === sep.id;

      ctx.save();
      const gdx = p2.x - p1.x;
      const gdy = p2.y - p1.y;
      const glen = Math.hypot(gdx, gdy);
      const gnx = glen > 1e-4 ? -gdy / glen : 0;
      const gny = glen > 1e-4 ? gdx / glen : 0;

      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#d97706';
      ctx.lineWidth = 1.5;

      // Líneas de testigo en ambos extremos
      ctx.beginPath();
      ctx.moveTo(p1.x - gnx * 8, p1.y - gny * 8);
      ctx.lineTo(p1.x + gnx * 8, p1.y + gny * 8);
      ctx.moveTo(p2.x - gnx * 8, p2.y - gny * 8);
      ctx.lineTo(p2.x + gnx * 8, p2.y + gny * 8);
      ctx.stroke();

      // Ticks arquitectónicos a 45°
      const tick = 6;
      ctx.beginPath();
      ctx.moveTo(p1.x - tick, p1.y - tick);
      ctx.lineTo(p1.x + tick, p1.y + tick);
      ctx.moveTo(p2.x - tick, p2.y - tick);
      ctx.lineTo(p2.x + tick, p2.y + tick);
      ctx.stroke();

      // Línea de separación discontinua
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pastilla de cota de hueco
      const mx = 0.5 * (p1.x + p2.x);
      const my = 0.5 * (p1.y + p2.y);
      const diagExtra = (sep.dxMm && sep.dyMm && sep.dxMm > 50 && sep.dyMm > 50) ? ` (ΔX:${sep.dxMm} ΔY:${sep.dyMm})` : '';
      const textGap = `↔ Hueco: ${sep.distanceMm} mm${diagExtra}`;
      ctx.font = 'bold 11.5px Inter, sans-serif';
      const gw = Math.max(ctx.measureText(textGap).width + 18, 110);
      const gh = 24;

      ctx.fillStyle = isSelected ? '#eff6ff' : '#fef3c7';
      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#d97706';
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.fillRect(mx - gw / 2, my - gh / 2, gw, gh);
      ctx.strokeRect(mx - gw / 2, my - gh / 2, gw, gh);

      ctx.fillStyle = isSelected ? '#1e40af' : '#92400e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textGap, mx, my);
      ctx.restore();
    }

    // 3. Dibujar Muros y Cotas Arquitectónicas tipo CAD
    state.planDimensionHitBoxes = [];
    const overlayControlsHtml = [];

    for (const w of (c.walls || [])) {
      const m = G.wallGeometryMetrics(w, vmap);
      const p1 = worldToScreenPlan(m.ax, m.ay);
      const p2 = worldToScreenPlan(m.bx, m.by);
      const L = Math.max(m.geomLengthMm, 1);
      const tx = (m.bx - m.ax) / L;
      const ty = (m.by - m.ay) / L;
      const th = Number(w.thicknessMm || 150);
      const n = G.outwardNormalForWall(tx, ty, w.outwardNormalSign ?? 1);
      const q1 = worldToScreenPlan(m.ax + th * n.x, m.ay + th * n.y);
      const q2 = worldToScreenPlan(m.bx + th * n.x, m.by + th * n.y);

      const isSelected = state.selectedEntity && state.selectedEntity.kind === 'WALL' && state.selectedEntity.id === w.id;
      const status = w.status || 'provisional';

      ctx.save();
      // Huella con espesor
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.lineTo(q1.x, q1.y);
      ctx.closePath();
      if (status === 'conflicto') {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.16)';
      } else if (status === 'fijado') {
        ctx.fillStyle = isSelected ? 'rgba(29, 78, 216, 0.20)' : 'rgba(15, 23, 42, 0.12)';
      } else {
        ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.08)';
      }
      ctx.fill();

      // Cara interior medida
      ctx.beginPath();
      if (status === 'provisional') ctx.setLineDash([8, 5]);
      ctx.lineWidth = isSelected ? 4.5 : 3;
      ctx.strokeStyle = status === 'conflicto' ? '#dc2626' : (status === 'fijado' ? (isSelected ? '#1d4ed8' : '#0f172a') : '#2563eb');
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vértices extremos
      for (const pt of [p1, p2]) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
      }

      // =====================================================================
      // COTA ARQUITECTÓNICA TIPO CAD (LÍNEA PARALELA, TESTIGOS Y TICKS A 45°)
      // =====================================================================
      const screenDx = p2.x - p1.x;
      const screenDy = p2.y - p1.y;
      const screenLen = Math.max(Math.hypot(screenDx, screenDy), 1);
      const stx = screenDx / screenLen;
      const sty = screenDy / screenLen;
      const sign = (w.outwardNormalSign === undefined || w.outwardNormalSign >= 0) ? 1 : -1;
      const snx = -sty * sign;
      const sny = stx * sign;

      const thPx = Math.max(th * state.planCam.scale, 8);
      const dimOffsetPx = thPx + 30;
      const witnessStartPx = thPx + 4;
      const witnessEndPx = dimOffsetPx + 10;

      const d1 = { x: p1.x + dimOffsetPx * snx, y: p1.y + dimOffsetPx * sny };
      const d2 = { x: p2.x + dimOffsetPx * snx, y: p2.y + dimOffsetPx * sny };

      // Líneas de extensión / testigo
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = status === 'conflicto' ? '#f87171' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(p1.x + witnessStartPx * snx, p1.y + witnessStartPx * sny);
      ctx.lineTo(p1.x + witnessEndPx * snx, p1.y + witnessEndPx * sny);
      ctx.moveTo(p2.x + witnessStartPx * snx, p2.y + witnessStartPx * sny);
      ctx.lineTo(p2.x + witnessEndPx * snx, p2.y + witnessEndPx * sny);
      ctx.stroke();

      // Línea de cota paralela
      ctx.lineWidth = isSelected ? 2.2 : 1.4;
      const dimColor = status === 'conflicto' ? '#dc2626' : (status === 'fijado' ? '#0f172a' : '#2563eb');
      ctx.strokeStyle = dimColor;
      ctx.beginPath();
      ctx.moveTo(d1.x, d1.y);
      ctx.lineTo(d2.x, d2.y);
      ctx.stroke();

      // Marcas de remate: Ticks a 45°
      const tickCos = 0.7071;
      const tickSin = 0.7071;
      const tickVx = (stx * tickCos - sty * tickSin) * 8;
      const tickVy = (stx * tickSin + sty * tickCos) * 8;

      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(d1.x - tickVx, d1.y - tickVy);
      ctx.lineTo(d1.x + tickVx, d1.y + tickVy);
      ctx.moveTo(d2.x - tickVx, d2.y - tickVy);
      ctx.lineTo(d2.x + tickVx, d2.y + tickVy);
      ctx.stroke();

      // Texto de cota en milímetros sobre pastilla blanca
      const midX = 0.5 * (d1.x + d2.x);
      const midY = 0.5 * (d1.y + d2.y);
      const displayText = status === 'fijado'
        ? `${w.realLengthMm} mm`
        : `~${Math.round(m.geomLengthMm)} mm`;

      ctx.font = 'bold 12px Inter, sans-serif';
      const textMetrics = ctx.measureText(displayText);
      const pillW = Math.max(textMetrics.width + 18, 80);
      const pillH = 22;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isSelected ? '#1d4ed8' : (status === 'fijado' ? '#10b981' : '#94a3b8');
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, 5);
      } else {
        ctx.rect(midX - pillW / 2, midY - pillH / 2, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = dimColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, midX, midY + 0.5);

      // Hit-box para clic / toque sobre el texto de la cota
      state.planDimensionHitBoxes.push({
        wallId: w.id,
        rect: { x: midX - pillW / 2, y: midY - pillH / 2, width: pillW, height: pillH },
        currentVal: w.realLengthMm ?? Math.round(m.geomLengthMm)
      });

      // Etiqueta del muro
      const labelX = 0.5 * (p1.x + p2.x) - snx * (thPx + 16);
      const labelY = 0.5 * (p1.y + p2.y) - sny * (thPx + 16);
      ctx.fillStyle = '#475569';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText(w.label, labelX, labelY);

      ctx.restore();

      // Botón sutil de Elevación en capa superior
      if (midX > -100 && midX < W + 100 && midY > -50 && midY < H + 50) {
        overlayControlsHtml.push(`
          <button
            class="cad-elev-tag"
            style="position:absolute; left:${(midX + pillW/2 + 20).toFixed(1)}px; top:${midY.toFixed(1)}px; transform:translate(-50%, -50%); pointer-events:auto;"
            onclick="App.openWallElevation('${w.id}')"
            title="Abrir Elevación de ${escapeHtml(w.label)}"
          >
            + Elev
          </button>
        `);
      }
    }

    overlayLayer.innerHTML = overlayControlsHtml.join('');

    // 4. Previsualización de Muros Encadenados
    if (state.planTool === 'CHAINED' && state.chainedPoints && state.chainedPoints.length > 0) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2563eb';
      for (let i = 0; i < state.chainedPoints.length - 1; i++) {
        const pA = worldToScreenPlan(state.chainedPoints[i].x, state.chainedPoints[i].y);
        const pB = worldToScreenPlan(state.chainedPoints[i + 1].x, state.chainedPoints[i + 1].y);
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
      if (state.drawingPreviewWorld) {
        const last = state.chainedPoints[state.chainedPoints.length - 1];
        const pA = worldToScreenPlan(last.x, last.y);
        const pB = worldToScreenPlan(state.drawingPreviewWorld.x, state.drawingPreviewWorld.y);
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let i = 0; i < state.chainedPoints.length; i++) {
        const pt = worldToScreenPlan(state.chainedPoints[i].x, state.chainedPoints[i].y);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`P${i + 1}`, pt.x + 8, pt.y - 8);
      }
      ctx.restore();
    }

    // 5. Previsualización de Mano Alzada
    if (state.planTool === 'FREEHAND' && state.freehandRawPoints && state.freehandRawPoints.length > 0) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2563eb';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const p0 = worldToScreenPlan(state.freehandRawPoints[0].x, state.freehandRawPoints[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < state.freehandRawPoints.length; i++) {
        const pt = worldToScreenPlan(state.freehandRawPoints[i].x, state.freehandRawPoints[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 6. Previsualización de trazo individual en curso (WALL, SARDINEL)
    if (state.drawingStartWorld && state.drawingPreviewWorld && state.planTool !== 'CHAINED' && state.planTool !== 'POLLO' && state.planTool !== 'GAP') {
      const p0 = worldToScreenPlan(state.drawingStartWorld.x, state.drawingStartWorld.y);
      const p1 = worldToScreenPlan(state.drawingPreviewWorld.x, state.drawingPreviewWorld.y);
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2563eb';
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const provM = ((state.drawingPreviewWorld.lengthMm || 0) / 1000).toFixed(2);
      ctx.fillStyle = '#1d4ed8';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(`~${provM} m (Provisional) · ${state.drawingPreviewWorld.angleDeg || 0}°`, p1.x + 12, p1.y - 10);
      ctx.restore();
    }

    // 7. Previsualización de Base de Concreto Poligonal en curso
    if (state.planTool === 'POLLO' && state.polloPoints && state.polloPoints.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      const prevPts = state.polloPoints.map((pt) => worldToScreenPlan(pt.x, pt.y));
      if (state.drawingPreviewWorld) {
        prevPts.push(worldToScreenPlan(state.drawingPreviewWorld.x, state.drawingPreviewWorld.y));
      }
      ctx.beginPath();
      ctx.moveTo(prevPts[0].x, prevPts[0].y);
      for (let i = 1; i < prevPts.length; i++) ctx.lineTo(prevPts[i].x, prevPts[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < state.polloPoints.length; i++) {
        const pt = worldToScreenPlan(state.polloPoints[i].x, state.polloPoints[i].y);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 8. Previsualización de Separación / Hueco en curso
    if (state.planTool === 'GAP' && state.gapStartNode) {
      const pA = worldToScreenPlan(state.gapStartNode.x, state.gapStartNode.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(pA.x, pA.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (state.drawingPreviewWorld) {
        const pB = worldToScreenPlan(state.drawingPreviewWorld.x, state.drawingPreviewWorld.y);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
        const distProv = Math.round(Math.hypot(state.drawingPreviewWorld.x - state.gapStartNode.x, state.drawingPreviewWorld.y - state.gapStartNode.y));
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(`Hueco: ~${distProv} mm`, pB.x + 12, pB.y - 10);
      }
      ctx.restore();
    }
  }

  function drawMetricGrid(ctx, W, H, cam) {
    const stepMm = cam.scale > 0.18 ? 200 : (cam.scale > 0.07 ? 500 : 1000);
    const stepPx = stepMm * cam.scale;
    if (stepPx < 14) return;
    ctx.save();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const startX = cam.x % stepPx;
    for (let x = startX; x < W; x += stepPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const startY = cam.y % stepPx;
    for (let y = startY; y < H; y += stepPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function selectWallFromOverlay(wallId) {
    state.activeWallId = wallId;
    state.selectedEntity = { kind: 'WALL', id: wallId };
    renderAll();
  }

  function hitTestPlanDimension(sx, sy) {
    for (const item of (state.planDimensionHitBoxes || [])) {
      const r = item.rect;
      if (sx >= r.x - 6 && sx <= r.x + r.width + 6 && sy >= r.y - 6 && sy <= r.y + r.height + 6) {
        return item;
      }
    }
    return null;
  }

  function openInlineDimensionEditor(wallId, screenX, screenY) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    state.activeWallId = wallId;
    state.selectedEntity = { kind: 'WALL', id: wallId };
    renderPlanInspector();

    const overlayLayer = document.getElementById('wallOverlaysLayer');
    if (!overlayLayer) return;

    cancelInlineDimension();

    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const currentVal = w.realLengthMm ?? Math.round(m.geomLengthMm);

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.id = 'inlineDimEditor';
    input.className = 'inline-dim-editor';
    input.value = currentVal;
    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.placeholder = `${Math.round(m.geomLengthMm)} mm`;

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const raw = input.value;
      const evaluated = G.evaluateSafeArithmetic(raw, null);
      input.remove();
      if (Number.isFinite(evaluated) && evaluated > 0) {
        applyWallRealLengthFromInput(wallId, evaluated, true);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        committed = true;
        input.remove();
      }
    });

    input.addEventListener('blur', () => {
      commit();
    });

    overlayLayer.appendChild(input);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 20);
  }

  function cancelInlineDimension() {
    const old = document.getElementById('inlineDimEditor');
    if (old) old.remove();
  }

  function deleteSelectedWall(wallId) {
    const c = getActivePlanConcept();
    if (!c) return;
    const targetId = wallId || (state.selectedEntity && state.selectedEntity.kind === 'WALL' ? state.selectedEntity.id : state.activeWallId);
    const w = (c.walls || []).find((item) => item.id === targetId);
    if (!w) return;

    if (w.elements && w.elements.length > 0) {
      const ok = confirm(`El muro ${w.label} contiene ${w.elements.length} instalación(es) (contactos, salidas o vanos). ¿Confirma que desea eliminarlo?`);
      if (!ok) return;
    }

    pushUndoSnapshot();
    G.deleteWallAndCleanTopology(c, targetId);
    G.autoOrientWallNormals(c);
    state.activeWallId = (c.walls && c.walls[0]) ? c.walls[0].id : null;
    state.selectedEntity = state.activeWallId ? { kind: 'WALL', id: state.activeWallId } : null;
    saveCurrentProject(false);
    renderAll();
  }

  function clearCurrentRoomPlan() {
    const c = getActivePlanConcept();
    if (!c) return;
    const ok = confirm(`¿Desea limpiar todos los muros, cotas y elementos del ambiente "${c.name}" para comenzar un nuevo boceto desde cero?\n\nLos demás conceptos y el proyecto se conservarán intactos. Podrá deshacer esta acción con el botón Deshacer.`);
    if (!ok) return;

    pushUndoSnapshot();
    c.vertices = [];
    c.walls = [];
    c.separations = [];
    c.concreteBases = [];
    c.isClosedLoop = false;
    state.selectedEntity = null;
    state.activeWallId = null;
    cancelCurrentDrawing();
    saveCurrentProject(false);
    renderAll();
  }

  function applyWallRealLengthFromInput(wallId, rawValue, allowUnlock = false) {
    const c = getActivePlanConcept();
    if (!c) return;
    const evaluated = G.evaluateSafeArithmetic(rawValue, null);
    if (!evaluated || evaluated <= 0) return;
    const val = evaluated;
    pushUndoSnapshot();
    const w = (c.walls || []).find((item) => item.id === wallId);
    const forceUnlock = allowUnlock || (w && w.status === 'fijado' && confirm(`El muro ${w.label} ya está FIJADO en ${w.realLengthMm} mm. ¿Autoriza desbloquearlo para actualizar su cota a ${val} mm?`));
    const res = G.progressiveFixWallLength(c, wallId, val, null, forceUnlock);
    G.autoOrientWallNormals(c);
    state.activeWallId = wallId;
    state.selectedEntity = { kind: 'WALL', id: wallId };
    saveCurrentProject(false);
    renderAll();
    if (res.status === 'conflicto' && res.conflict) {
      alert(res.conflict.message);
    }
  }

  // ==========================================================================
  // 5. ELEVACIÓN DE CADA MURO, DRAG & DROP Y 4 REFERENCIAS VISIBLES
  // ==========================================================================

  function selectElevationWall(wallId) {
    state.activeWallId = wallId;
    const c = getActivePlanConcept();
    if (c) {
      const w = (c.walls || []).find((item) => item.id === wallId);
      if (w && w.elements && w.elements.length > 0) {
        state.selectedEntity = { kind: 'ELEMENT', id: w.elements[0].id };
      } else {
        state.selectedEntity = null;
      }
    }
    fitElevationToScreen();
    renderAll();
  }

  function stepElevationWall(delta) {
    const c = getActivePlanConcept();
    if (!c || !c.walls || !c.walls.length) return;
    const idx = c.walls.findIndex((w) => w.id === state.activeWallId);
    const nextIdx = ((idx + delta) % c.walls.length + c.walls.length) % c.walls.length;
    selectElevationWall(c.walls[nextIdx].id);
  }

  function updateElevationWallHeight(rawVal) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === state.activeWallId);
    if (!w) return;
    const H = Number(rawVal);
    if (!Number.isFinite(H) || H <= 0) return;
    pushUndoSnapshot();
    w.heightMm = H;
    w.heightMode = (H !== (state.project.predominantHeightMm || 2600)) ? 'OVERRIDE' : 'INHERITED';
    // Recalcular referencia superior de los elementos manteniendo su altura desde piso
    for (const el of (w.elements || [])) {
      const r = el.references || {};
      if (r.distFloorMm !== undefined) {
        r.distTopMm = Number((H - Number(r.distFloorMm)).toFixed(3));
      }
    }
    saveCurrentProject(false);
    fitElevationToScreen();
    renderAll();
  }

  function zoomElevation(factor, centerX, centerY) {
    const cv = document.getElementById('elevationCanvas');
    if (!cv) return;
    const cx = centerX !== undefined ? centerX : cv.width * 0.5;
    const cy = centerY !== undefined ? centerY : cv.height * 0.5;
    const uBefore = (cx - state.elevCam.x) / state.elevCam.scale;
    const vBefore = (state.elevCam.y - cy) / state.elevCam.scale;
    state.elevCam.scale = Math.min(Math.max(state.elevCam.scale * factor, 0.02), 0.95);
    state.elevCam.x = cx - uBefore * state.elevCam.scale;
    state.elevCam.y = cy + vBefore * state.elevCam.scale;
    renderElevationCanvas();
  }

  function fitElevationToScreen() {
    const c = getActivePlanConcept();
    const cv = document.getElementById('elevationCanvas');
    if (!c || !cv || cv.width < 50) return;
    const w = (c.walls || []).find((item) => item.id === state.activeWallId) || (c.walls || [])[0];
    if (!w) return;
    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);
    const pad = 110;
    const sc = Math.min((cv.width - pad * 2) / L, (cv.height - pad * 2) / H, 0.35);
    state.elevCam.scale = Math.max(sc, 0.04);
    state.elevCam.x = (cv.width - L * state.elevCam.scale) * 0.5;
    state.elevCam.y = cv.height - (cv.height - H * state.elevCam.scale) * 0.5;
    renderElevationCanvas();
  }

  function onPaletteDragStart(event, category, subType) {
    event.dataTransfer.setData('text/plain', JSON.stringify({ category, subType }));
  }

  function onElevationCanvasDrop(event) {
    event.preventDefault();
    try {
      const data = JSON.parse(event.dataTransfer.getData('text/plain'));
      const rect = document.getElementById('elevationCanvas').getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const uMm = Math.round((sx - state.elevCam.x) / state.elevCam.scale);
      const vMm = Math.round((state.elevCam.y - sy) / state.elevCam.scale);
      insertElevationElement(data.category, data.subType, uMm, vMm);
    } catch (_) {}
  }

  function insertElevationElement(category, subType, customLeftMm, customFloorMm) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === state.activeWallId) || (c.walls || [])[0];
    if (!w) return;
    pushUndoSnapshot();
    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);

    const groupKey = category === 'ELECTRICAL' ? 'electrical' : (category === 'PLUMBING' ? 'plumbing' : 'openings');
    const preset = (G.CEREBRO_PRESETS[groupKey] || {})[subType] || {
      label: subType,
      widthMm: 70,
      heightMm: 115,
      defaultHeightNptMm: 1100,
      provenance: 'DEFAULT_PRESET'
    };

    const uLeft = customLeftMm !== undefined ? Math.max(0, Math.min(L, customLeftMm)) : Math.round(L * 0.5);
    const vFloor = customFloorMm !== undefined ? Math.max(0, Math.min(H, customFloorMm)) : Number(preset.defaultHeightNptMm || 1100);
    const refs = G.computeFourReferences(L, H, uLeft, null, vFloor, null);

    w.elements = w.elements || [];
    const prefix = category === 'ELECTRICAL' ? 'E' : (category === 'PLUMBING' ? 'H' : 'V');
    const count = w.elements.filter((e) => e.category === category).length + 1;

    const newEl = {
      id: G.newId('el'),
      code: `${prefix}${String(count).padStart(2, '0')}`,
      category,
      subType,
      label: preset.label,
      isSet: Boolean(preset.isSet),
      separationAfAcMm: preset.separationAfAcMm ?? 200,
      hotOffsetUMm: preset.hotOffsetUMm ?? -100,
      hotOffsetVMm: preset.hotOffsetVMm ?? 50,
      coldOffsetUMm: preset.coldOffsetUMm ?? 100,
      coldOffsetVMm: preset.coldOffsetVMm ?? 50,
      drainDiameterMm: preset.drainDiameterMm ?? 50,
      supplyDiameterMm: preset.supplyDiameterMm ?? 13,
      diameterMm: preset.diameterMm ?? 25,
      widthMm: preset.widthMm ?? 70,
      heightMm: preset.heightMm ?? 115,
      gfci: Boolean(preset.gfci),
      provenance: 'DEFAULT_PRESET',
      references: refs
    };

    w.elements.push(newEl);
    state.selectedEntity = { kind: 'ELEMENT', id: newEl.id };
    saveCurrentProject(false);
    renderAll();
  }

  function onElevPointerDown(e) {
    if (state.isPinching || (Date.now() - (state.lastPinchTime || 0) < 400)) {
      return;
    }

    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === state.activeWallId);
    if (!w) return;
    const rect = e.target.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const uMm = (sx - state.elevCam.x) / state.elevCam.scale;
    const vMm = (state.elevCam.y - sy) / state.elevCam.scale;

    // Buscar si tocó algún dispositivo para arrastrarlo o seleccionarlo
    for (const el of (w.elements || [])) {
      const r = el.references || {};
      const ex = Number(r.distLeftMm || 0);
      const ey = Number(r.distFloorMm || 0);
      const hw = Math.max(Number(el.widthMm || 80) * 0.6, 120);
      const hh = Math.max(Number(el.heightMm || 115) * 0.6, 120);
      if (Math.abs(uMm - ex) <= hw && Math.abs(vMm - ey) <= hh) {
        pushUndoSnapshot();
        state.selectedEntity = { kind: 'ELEMENT', id: el.id };
        state.draggingElevElementId = el.id;
        renderAll();
        return;
      }
    }
  }

  function onElevPointerMove(e) {
    if (!state.draggingElevElementId) return;
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === state.activeWallId);
    if (!w) return;
    const el = (w.elements || []).find((item) => item.id === state.draggingElevElementId);
    if (!el) return;

    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);

    const rect = e.target.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const uLeft = Math.round(Math.max(0, Math.min(L, (sx - state.elevCam.x) / state.elevCam.scale)) / 5) * 5;
    const vFloor = Math.round(Math.max(0, Math.min(H, (state.elevCam.y - sy) / state.elevCam.scale)) / 5) * 5;

    el.references = G.computeFourReferences(L, H, uLeft, null, vFloor, null);
    renderElevationCanvas();
    renderElevationInspector();
  }

  function onElevPointerUp() {
    if (state.draggingElevElementId) {
      state.draggingElevElementId = null;
      saveCurrentProject(false);
    }
  }

  function renderElevationCanvas() {
    const cv = document.getElementById('elevationCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, Hc = cv.height;
    ctx.clearRect(0, 0, W, Hc);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, Hc);
    drawMetricGrid(ctx, W, Hc, state.elevCam);

    const c = getActivePlanConcept();
    if (!c || !c.walls || !c.walls.length) return;
    const w = c.walls.find((item) => item.id === state.activeWallId) || c.walls[0];
    if (!w) return;

    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);

    document.getElementById('elevHeaderTitle').textContent = `Elevación Frontal: ${w.label} (${w.code})`;
    document.getElementById('elevWallWidthLabel').textContent = `${L.toFixed(1)} mm`;
    const hInp = document.getElementById('elevWallHeightInput');
    if (document.activeElement !== hInp) hInp.value = H;

    const x0 = state.elevCam.x;
    const y0 = state.elevCam.y;
    const ww = L * state.elevCam.scale;
    const wh = H * state.elevCam.scale;

    // Paramento frontal del muro
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.fillRect(x0, y0 - wh, ww, wh);
    ctx.strokeRect(x0, y0 - wh, ww, wh);

    // Línea de piso terminado NPT = 0
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0 - 40, y0);
    ctx.lineTo(x0 + ww + 40, y0);
    ctx.stroke();
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('PISO TERMINADO (NPT = 0 mm)', x0, y0 + 20);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`Extremo Izquierdo (0 mm)`, x0, y0 - wh - 10);
    ctx.textAlign = 'right';
    ctx.fillText(`Extremo Derecho (${L.toFixed(0)} mm) · Altura ${H.toFixed(0)} mm`, x0 + ww, y0 - wh - 10);
    ctx.restore();

    // Proyección de Pollo de concreto si está alojado en este muro
    for (const pb of (c.concreteBases || [])) {
      if (pb.hostWallId === w.id) {
        const pbh = Number(pb.heightMm || 100) * state.elevCam.scale;
        const pbl = Math.min(L, Number(pb.lengthMm || L)) * state.elevCam.scale;
        const pbu0 = Number((pb.references || {}).distLeftWallMm || 0) * state.elevCam.scale;
        ctx.save();
        ctx.fillStyle = 'rgba(100, 116, 139, 0.22)';
        ctx.strokeStyle = '#475569';
        ctx.setLineDash([5, 3]);
        ctx.fillRect(x0 + pbu0, y0 - pbh, pbl, pbh);
        ctx.strokeRect(x0 + pbu0, y0 - pbh, pbl, pbh);
        ctx.setLineDash([]);
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`${pb.label} (H=${pb.heightMm} mm)`, x0 + pbu0 + 8, y0 - 6);
        ctx.restore();
      }
    }

    // Dispositivos e instalaciones con sus 4 referencias respecto al centro
    for (const el of (w.elements || [])) {
      const r = el.references || {};
      const uL = Number(r.distLeftMm ?? L * 0.5);
      const uR = Number(r.distRightMm ?? (L - uL));
      const vF = Number(r.distFloorMm ?? 1100);
      const vT = Number(r.distTopMm ?? (H - vF));

      const cx = x0 + uL * state.elevCam.scale;
      const cy = y0 - vF * state.elevCam.scale;
      const ew = Math.max(Number(el.widthMm || 70) * state.elevCam.scale, 18);
      const eh = Math.max(Number(el.heightMm || 115) * state.elevCam.scale, 18);
      const isSelected = state.selectedEntity && state.selectedEntity.kind === 'ELEMENT' && state.selectedEntity.id === el.id;

      // Dibujar las 4 líneas de referencia visibles (Izquierda, Derecha, Piso, Arriba)
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = isSelected ? 1.8 : 1;
      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#94a3b8';
      // 1. Izquierda
      ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(cx, cy); ctx.stroke();
      // 2. Derecha
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x0 + ww, cy); ctx.stroke();
      // 3. Piso
      ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, cy); ctx.stroke();
      // 4. Superior
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, y0 - wh); ctx.stroke();
      ctx.setLineDash([]);

      // Etiquetas de las 4 referencias
      if (isSelected || (w.elements || []).length <= 4) {
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#1e40af';
        ctx.textAlign = 'center';
        ctx.fillText(`← Izq: ${uL.toFixed(0)} mm`, 0.5 * (x0 + cx), cy - 6);
        ctx.fillText(`Der: ${uR.toFixed(0)} mm →`, 0.5 * (cx + x0 + ww), cy - 6);
        ctx.textAlign = 'left';
        ctx.fillText(`↓ Piso: ${vF.toFixed(0)} mm`, cx + 6, 0.5 * (cy + y0));
        ctx.fillText(`↑ Arriba: ${vT.toFixed(0)} mm`, cx + 6, 0.5 * (cy + y0 - wh));
      }

      // Símbolo gráfico según categoría
      if (el.category === 'ELECTRICAL') {
        ctx.fillStyle = '#fef2f2';
        ctx.strokeStyle = isSelected ? '#1d4ed8' : '#dc2626';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.fillRect(cx - ew * 0.5, cy - eh * 0.5, ew, eh);
        ctx.strokeRect(cx - ew * 0.5, cy - eh * 0.5, ew, eh);
      } else if (el.category === 'PLUMBING') {
        if (el.isSet) {
          const hotX = cx + Number(el.hotOffsetUMm ?? -100) * state.elevCam.scale;
          const hotY = cy - Number(el.hotOffsetVMm ?? 50) * state.elevCam.scale;
          const coldX = cx + Number(el.coldOffsetUMm ?? 100) * state.elevCam.scale;
          const coldY = cy - Number(el.coldOffsetVMm ?? 50) * state.elevCam.scale;
          // Drenaje en el centro
          ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#e2e8f0'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0f172a'; ctx.stroke();
          // Agua caliente (Izq - Rojo)
          ctx.beginPath(); ctx.arc(hotX, hotY, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.stroke();
          // Agua fría (Der - Azul)
          ctx.beginPath(); ctx.arc(coldX, coldY, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#2563eb'; ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
          ctx.fillStyle = '#dbeafe'; ctx.fill();
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.strokeStyle = '#1d4ed8'; ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
        ctx.strokeStyle = isSelected ? '#1d4ed8' : '#0891b2';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.fillRect(cx - ew * 0.5, cy - eh * 0.5, ew, eh);
        ctx.strokeRect(cx - ew * 0.5, cy - eh * 0.5, ew, eh);
      }

      // Cruz de centro del símbolo
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(`${el.code} (${el.provenance === 'MEASURED' ? 'MEDIDO' : 'PRESET'})`, cx - ew * 0.5, cy - eh * 0.5 - 6);
      ctx.restore();
    }
  }

  // ==========================================================================
  // 6. PUERTAS DE INTERCOMUNICACIÓN (VISTA FRONTAL Y 9 MEDIDAS)
  // ==========================================================================

  function selectDoorConcept(conceptId) {
    state.activeConceptId = conceptId;
    syncDoorInputsFromConcept();
    renderDoorCanvas();
  }

  function syncDoorInputsFromConcept() {
    const dc = getActiveDoorConcept();
    if (!dc) return;
    const ds = dc.doorSurvey || {};
    const rw = ds.widths || {};
    const rh = ds.heights || {};
    const rt = ds.thicknesses || {};
    document.getElementById('doorWInf').value = rw.inferior ?? '';
    document.getElementById('doorWMed').value = rw.medio ?? '';
    document.getElementById('doorWSup').value = rw.superior ?? '';
    document.getElementById('doorHIzq').value = rh.izquierdo ?? '';
    document.getElementById('doorHCen').value = rh.centro ?? '';
    document.getElementById('doorHDer').value = rh.derecho ?? '';
    document.getElementById('doorTSup').value = rt.superior ?? '';
    document.getElementById('doorTMed').value = rt.medio ?? '';
    document.getElementById('doorTInf').value = rt.inferior ?? '';
    document.getElementById('doorCeilingH').value = ds.ceilingHeightMm ?? (state.project ? state.project.predominantHeightMm : 2600);
    document.getElementById('doorBaseOffset').value = ds.baseOffsetMm ?? 0;
    updateDoorComputedUI();
  }

  function onDoorInputChanged() {
    const dc = getActiveDoorConcept();
    if (!dc) return;
    dc.doorSurvey = dc.doorSurvey || {};
    const parseVal = (id) => {
      const raw = document.getElementById(id).value;
      return raw === '' ? null : Number(raw);
    };
    dc.doorSurvey.widths = {
      inferior: parseVal('doorWInf'),
      medio: parseVal('doorWMed'),
      superior: parseVal('doorWSup')
    };
    dc.doorSurvey.heights = {
      izquierdo: parseVal('doorHIzq'),
      centro: parseVal('doorHCen'),
      derecho: parseVal('doorHDer')
    };
    dc.doorSurvey.thicknesses = {
      superior: parseVal('doorTSup'),
      medio: parseVal('doorTMed'),
      inferior: parseVal('doorTInf')
    };
    dc.doorSurvey.ceilingHeightMm = parseVal('doorCeilingH') || 2600;
    dc.doorSurvey.baseOffsetMm = parseVal('doorBaseOffset') || 0;
    saveCurrentProject(false);
    updateDoorComputedUI();
    renderDoorCanvas();
  }

  function updateDoorComputedUI() {
    const dc = getActiveDoorConcept();
    if (!dc) return;
    const ds = dc.doorSurvey || {};
    const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm, ds.baseOffsetMm);
    if (ev.isComplete && ev.referenceMinimumsMm) {
      document.getElementById('doorMinWLabel').textContent = `${ev.referenceMinimumsMm.widthMm} mm`;
      document.getElementById('doorMinHLabel').textContent = `${ev.referenceMinimumsMm.heightMm} mm`;
      document.getElementById('doorMinTLabel').textContent = `${ev.referenceMinimumsMm.thicknessMm} mm`;
      document.getElementById('doorSpreadWLabel').textContent = `Máx: ${ev.maximumsMm.widthMm} | Δ = ${ev.spreadsMm.widthMm} mm`;
      document.getElementById('doorSpreadHLabel').textContent = `Máx: ${ev.maximumsMm.heightMm} | Δ = ${ev.spreadsMm.heightMm} mm`;
      document.getElementById('doorSpreadTLabel').textContent = `Máx: ${ev.maximumsMm.thicknessMm} | Δ = ${ev.spreadsMm.thicknessMm} mm`;
    } else {
      document.getElementById('doorMinWLabel').textContent = 'Incompleto';
      document.getElementById('doorMinHLabel').textContent = 'Incompleto';
      document.getElementById('doorMinTLabel').textContent = 'Incompleto';
    }

    const wbox = document.getElementById('doorWarningsBox');
    const msgs = (ev.warnings || []).map((m) => `<div style="color:#b45309; font-weight:700; margin-bottom:4px;">⚠️ ${escapeHtml(m)}</div>`).join('');
    const topInfo = ev.topStripConceptualMm !== null
      ? `<div style="color:#0f172a; font-weight:700;">Franja conceptual superior al techo local: ${ev.topStripConceptualMm} mm</div>`
      : '';
    wbox.innerHTML = msgs + topInfo;
  }

  function renderDoorCanvas() {
    const cv = document.getElementById('doorCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, Hc = cv.height;
    ctx.clearRect(0, 0, W, Hc);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, Hc);

    const dc = getActiveDoorConcept();
    if (!dc) return;
    const ds = dc.doorSurvey || {};
    const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm, ds.baseOffsetMm);
    const mins = ev.referenceMinimumsMm || { widthMm: 900, heightMm: 2100, thicknessMm: 150 };
    const rw = (ev.originalReadingsMm || {}).widths || {};
    const rh = (ev.originalReadingsMm || {}).heights || {};
    const rt = (ev.originalReadingsMm || {}).thicknesses || {};

    const pad = 65;
    const sc = Math.min((W * 0.55 - pad) / Math.max(mins.widthMm, 500), (Hc - pad * 2) / Math.max(mins.heightMm, 1500));
    const dw = mins.widthMm * sc;
    const dh = mins.heightMm * sc;
    const x0 = 70;
    const y0 = Hc - 55;

    ctx.save();
    // Vano frontal con dimensiones mínimas
    ctx.fillStyle = '#fff7ed';
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 3;
    ctx.fillRect(x0, y0 - dh, dw, dh);
    ctx.strokeRect(x0, y0 - dh, dw, dh);

    // 3 Lecturas de Ancho (Superior, Medio, Inferior)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Ancho Superior: ${rw.superior ?? '-'} mm`, x0 + dw * 0.5, y0 - dh + 20);
    ctx.fillText(`Ancho Medio: ${rw.medio ?? '-'} mm`, x0 + dw * 0.5, y0 - dh * 0.5);
    ctx.fillText(`Ancho Inferior: ${rw.inferior ?? '-'} mm`, x0 + dw * 0.5, y0 - 10);

    // 3 Lecturas de Alto (Izquierdo, Centro, Derecho) escalonadas verticalmente para evitar traslape en tablets angostas
    ctx.fillStyle = '#1d4ed8';
    ctx.textAlign = 'left';
    ctx.fillText(`Alto Izq: ${rh.izquierdo ?? '-'} mm`, x0 + 8, y0 - dh * 0.78);
    ctx.textAlign = 'center';
    ctx.fillText(`Alto Centro: ${rh.centro ?? '-'} mm`, x0 + dw * 0.5, y0 - dh * 0.28);
    ctx.textAlign = 'right';
    ctx.fillText(`Alto Der: ${rh.derecho ?? '-'} mm`, x0 + dw - 8, y0 - dh * 0.64);

    // Perfil de Espesor del Muro a la derecha
    const tx0 = x0 + dw + 110;
    const tw = Math.max(mins.thicknessMm * sc * 1.4, 38);
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.fillRect(tx0, y0 - dh, tw, dh);
    ctx.strokeRect(tx0, y0 - dh, tw, dh);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`Espesor Sup: ${rt.superior ?? '-'} mm`, tx0 + tw + 12, y0 - dh + 22);
    ctx.fillText(`Espesor Med: ${rt.medio ?? '-'} mm`, tx0 + tw + 12, y0 - dh * 0.5);
    ctx.fillText(`Espesor Inf: ${rt.inferior ?? '-'} mm`, tx0 + tw + 12, y0 - 10);

    // Resumen de mínimos de referencia exportados
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(
      `GEOMETRÍA MÍNIMA EXPORTADA: ${mins.widthMm} × ${mins.heightMm} × ${mins.thicknessMm} mm (Sin descontar holguras)`,
      x0,
      y0 + 32
    );
    ctx.restore();
  }

  // ==========================================================================
  // 7. INSPECTORES CONTEXTUALES (PLANTA Y ELEVACIÓN)
  // ==========================================================================

  function renderPlanInspector() {
    const box = document.getElementById('planInspectorContent');
    if (!box) return;
    const c = getActivePlanConcept();
    if (!c) {
      box.innerHTML = '<div style="color:var(--text-muted);">Seleccione o cree un concepto de planta.</div>';
      return;
    }

    const renum = G.previewRenumberLeftToRight(c);
    const renumBanner = renum.needsRenumbering
      ? `<div style="background:#fef3c7; border:1.5px solid #f59e0b; padding:10px; border-radius:8px; margin-bottom:10px;">
           <div style="font-weight:800; font-size:12.5px; color:#92400e;">⚠️ Orden Izquierda→Derecha disponible</div>
           <div style="font-size:11.5px; color:#78350f; margin:4px 0 8px;">Los muros actuales se dibujaron en otro orden. Puede previsualizar y aplicar la enumeración izquierda→derecha sin cambios silenciosos.</div>
           <button class="btn btn-warning btn-sm" style="width:100%;" onclick="App.openRenumberPreviewModal()">🔢 Ver Vista Previa Renumeración</button>
         </div>`
      : '';

    if (state.selectedEntity && state.selectedEntity.kind === 'POLLO') {
      const pb = (c.concreteBases || []).find((item) => item.id === state.selectedEntity.id);
      if (pb) {
        const refs = pb.references || {};
        const wallOpts = (c.walls || []).map((w) => `<option value="${w.id}" ${pb.hostWallId === w.id ? 'selected' : ''}>${escapeHtml(w.label)} (${w.code})</option>`).join('');
        const segs = G.computePolygonalBaseSegments(pb);
        const segsHtml = (segs && segs.length > 0)
          ? `<div class="tool-section-title" style="margin-top:10px;">Tramos de la Base Poligonal</div>
             <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:6px;">Ajuste la longitud de cada tramo en mm (admite operaciones como 1800+200):</div>
             ${segs.map((s) => `
               <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-subtle); padding:6px 10px; border-radius:6px; margin-bottom:6px;">
                 <span style="font-weight:700; font-size:12px;">${escapeHtml(s.label)}</span>
                 <div style="display:flex; align-items:center; gap:4px;">
                   <input
                     type="text"
                     inputmode="decimal"
                     class="form-input numpad-target"
                     style="width:95px; padding:3px 6px; font-size:12px;"
                     value="${s.lengthMm}"
                     onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.updatePolloSegmentLength('${pb.id}', ${s.index}, this.value); }"
                     onchange="App.updatePolloSegmentLength('${pb.id}', ${s.index}, this.value)"
                   />
                   <span style="font-size:11px; color:var(--text-muted);">mm</span>
                 </div>
               </div>
             `).join('')}`
          : '';

        box.innerHTML = `
          ${renumBanner}
          <div class="card-header"><h3 class="card-title">🧱 ${escapeHtml(pb.label)}</h3></div>
          <div class="form-group">
            <label class="form-label">Nombre / Etiqueta</label>
            <input type="text" class="form-input" value="${escapeHtml(pb.label)}" onchange="App.updatePolloField('${pb.id}', 'label', this.value)" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div class="form-group">
              <label class="form-label">Largo / Eje (mm)</label>
              <input
                type="text"
                inputmode="decimal"
                class="form-input numpad-target"
                value="${pb.lengthMm}"
                onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.updatePolloField('${pb.id}', 'lengthMm', this.value); }"
                onchange="App.updatePolloField('${pb.id}', 'lengthMm', this.value)"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Ancho / Prof. (mm)</label>
              <input
                type="text"
                inputmode="decimal"
                class="form-input numpad-target"
                value="${pb.widthMm}"
                onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.updatePolloField('${pb.id}', 'widthMm', this.value); }"
                onchange="App.updatePolloField('${pb.id}', 'widthMm', this.value)"
              />
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div class="form-group">
              <label class="form-label">Altura sobre NPT (mm) *</label>
              <input
                type="text"
                inputmode="decimal"
                class="form-input numpad-target"
                value="${pb.heightMm || 100}"
                onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.updatePolloField('${pb.id}', 'heightMm', this.value); }"
                onchange="App.updatePolloField('${pb.id}', 'heightMm', this.value)"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Muro de Referencia</label>
              <select class="form-input" onchange="App.updatePolloField('${pb.id}', 'hostWallId', this.value)">${wallOpts}</select>
            </div>
          </div>
          ${segsHtml}
          <div class="tool-section-title">Distancias a Muros / Referencias (mm)</div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
            <div>
              <label class="form-label">A Muro Izq</label>
              <input type="text" inputmode="decimal" class="form-input numpad-target" value="${refs.distLeftWallMm ?? 0}" onchange="App.updatePolloRef('${pb.id}', 'distLeftWallMm', this.value)" />
            </div>
            <div>
              <label class="form-label">A Muro Der</label>
              <input type="text" inputmode="decimal" class="form-input numpad-target" value="${refs.distRightWallMm ?? 0}" onchange="App.updatePolloRef('${pb.id}', 'distRightWallMm', this.value)" />
            </div>
            <div>
              <label class="form-label">A Fondo</label>
              <input type="text" inputmode="decimal" class="form-input numpad-target" value="${refs.distBackWallMm ?? 0}" onchange="App.updatePolloRef('${pb.id}', 'distBackWallMm', this.value)" />
            </div>
          </div>
          <button class="btn btn-danger" style="margin-top:12px; width:100%;" onclick="App.deleteSelectedEntity()">🗑️ Eliminar Base / Pollo (Supr)</button>
        `;
        return;
      }
    }

    if (state.selectedEntity && state.selectedEntity.kind === 'GAP') {
      const sep = (c.separations || []).find((item) => item.id === state.selectedEntity.id);
      if (sep) {
        const w1 = sep.wall1Id ? (c.walls || []).find((item) => item.id === sep.wall1Id) : null;
        const w2 = sep.wall2Id ? (c.walls || []).find((item) => item.id === sep.wall2Id) : null;
        box.innerHTML = `
          ${renumBanner}
          <div class="card-header"><h3 class="card-title">↔️ Separación / Hueco (${escapeHtml(sep.code || 'H01')})</h3></div>
          <div class="form-group">
            <label class="form-label">Identificador / Etiqueta</label>
            <input type="text" class="form-input" value="${escapeHtml(sep.label || '')}" onchange="App.updateGapField('${sep.id}', 'label', this.value)" />
          </div>
          <div class="form-group">
            <label class="form-label">Distancia Directa de Separación (mm) *</label>
            <div style="display:flex; gap:6px;">
              <input
                type="text"
                inputmode="decimal"
                class="form-input numpad-target"
                id="inspectorGapDistMm"
                value="${sep.distanceMm}"
                placeholder="Ej. 1200 o 1000+200"
                onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.onGapDistanceChange('${sep.id}', this.value); }"
                onchange="App.onGapDistanceChange('${sep.id}', this.value)"
              />
              <button class="btn btn-primary" onclick="App.onGapDistanceChange('${sep.id}', document.getElementById('inspectorGapDistMm').value)">
                ✔ Aplicar
              </button>
            </div>
          </div>
          <div style="background:var(--bg-subtle); padding:10px; border-radius:8px; margin:10px 0; font-size:12px; line-height:1.5;">
            <div><strong>Distancia proyectada ΔX:</strong> ${sep.dxMm ?? 0} mm</div>
            <div><strong>Distancia proyectada ΔY:</strong> ${sep.dyMm ?? 0} mm</div>
            <div><strong>Muros vinculados:</strong> ${w1 ? escapeHtml(w1.label) : 'Punto 1'} ↔ ${w2 ? escapeHtml(w2.label) : 'Punto 2'}</div>
          </div>
          <div style="font-size:11.5px; color:var(--text-muted); line-height:1.4;">
            💡 <strong>Regla AS-BUILT:</strong> Vincular dos nodos mediante una cota de hueco no une físicamente los muros. Conservan la separación registrada.
          </div>
          <button class="btn btn-danger" style="margin-top:12px; width:100%;" onclick="App.deleteSelectedEntity()">🗑️ Eliminar Separación (Supr)</button>
        `;
        return;
      }
    }

    const w = (c.walls || []).find((item) => item.id === state.activeWallId) || (c.walls || [])[0];
    if (!w) {
      box.innerHTML = `${renumBanner}<div style="color:var(--text-muted); font-size:13px;">Toque dos puntos en el lienzo blanco para trazar el primer muro.</div>`;
      return;
    }

    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const status = w.status || 'provisional';
    const conflictHtml = (status === 'conflicto' && w.conflictInfo)
      ? `<div style="background:#fee2e2; border:1.5px solid #dc2626; padding:10px; border-radius:8px; margin-bottom:10px;">
           <div style="font-weight:800; color:#b91c1c; font-size:12.5px;">🚨 Conflicto de Fijación Progresiva</div>
           <div style="font-size:12px; color:#7f1d1d; margin:4px 0 8px;">${escapeHtml(w.conflictInfo.message)}</div>
           <div style="display:flex; flex-direction:column; gap:6px;">
             <button class="btn btn-sm" onclick="App.resolveConflictOpenLoop('${w.id}')">🔓 Abrir lazo y conservar todas las medidas fijadas</button>
             <button class="btn btn-sm btn-warning" onclick="App.resolveConflictUnlockOpposite('${w.id}')">🔑 Desbloquear muros para permitir ajuste</button>
           </div>
         </div>`
      : '';

    box.innerHTML = `
      ${renumBanner}
      ${conflictHtml}
      <div class="card-header">
        <div>
          <h3 class="card-title">${escapeHtml(w.label)} (${escapeHtml(w.code)})</h3>
          <div style="font-size:11.5px; color:var(--text-muted);">Longitud provisional trazo: ~${m.provisionalLengthM.toFixed(2)} m</div>
        </div>
        <span class="state-badge ${status}">${status}</span>
      </div>

      <div class="form-group">
        <label class="form-label">Longitud Real Medida en Campo (mm) *</label>
        <div style="display:flex; gap:6px;">
          <input
            type="text"
            inputmode="decimal"
            class="form-input numpad-target"
            id="inspectorWallLengthMm"
            value="${w.realLengthMm ?? ''}"
            placeholder="${Math.round(m.geomLengthMm)} mm (ej. 2500+1000)"
            onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.applyWallRealLengthFromInput('${w.id}', this.value, true); }"
            onchange="App.applyWallRealLengthFromInput('${w.id}', this.value, true)"
          />
          <button class="btn btn-success" onclick="App.applyWallRealLengthFromInput('${w.id}', document.getElementById('inspectorWallLengthMm').value, true)" title="Fijar cota real (Enter)">
            🔒 Fijar
          </button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="form-group">
          <label class="form-label">Altura Real (mm)</label>
          <input
            type="text"
            inputmode="decimal"
            class="form-input numpad-target"
            value="${w.heightMm || c.heightMm || 2600}"
            onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.updateWallProp('${w.id}', 'heightMm', this.value); }"
            onchange="App.updateWallProp('${w.id}', 'heightMm', this.value)"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Espesor Muro (mm)</label>
          <input
            type="text"
            inputmode="decimal"
            class="form-input numpad-target"
            value="${w.thicknessMm || 150}"
            onkeydown="if(event.key==='Enter'){ event.preventDefault(); App.updateWallProp('${w.id}', 'thicknessMm', this.value); }"
            onchange="App.updateWallProp('${w.id}', 'thicknessMm', this.value)"
          />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Ángulo del Muro (° grados)</label>
        <div style="display:flex; gap:6px;">
          <input type="text" inputmode="decimal" class="form-input numpad-target" id="inspectorWallAngleDeg" value="${w.angleDeg ?? m.geomAngleDeg}" step="0.5" />
          <button class="btn btn-sm" onclick="App.applyWallAngle('${w.id}', document.getElementById('inspectorWallAngleDeg').value)">
            📐 Definir Ángulo
          </button>
        </div>
      </div>

      <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px 10px; border-radius:8px; margin:6px 0; font-size:11.5px; color:#166534; line-height:1.4;">
        🧭 <strong>Orientación de Caras:</strong> Las cotas arquitectónicas se sitúan hacia el exterior; la cara interior mira al espacio habitable (para elevaciones e instalaciones).
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:4px;">
        <button class="btn btn-sm" onclick="App.unlockWall('${w.id}')">🔓 Desbloquear</button>
        <button class="btn btn-sm" onclick="App.flipWallNormal('${w.id}')" title="Invertir cara interior/exterior">🔄 Invertir Cara</button>
      </div>

      <button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="App.openWallElevation('${w.id}')">
        ➕ Abrir Elevación de ${escapeHtml(w.label)} (${(w.elements || []).length} inst.)
      </button>

      <button class="btn btn-danger" style="width:100%; margin-top:8px;" onclick="App.deleteSelectedWall('${w.id}')">
        🗑️ Eliminar Muro ${escapeHtml(w.label)} (Supr)
      </button>
    `;
  }

  function renderElevationInspector() {
    const box = document.getElementById('elevInspectorContent');
    if (!box) return;
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === state.activeWallId) || (c.walls || [])[0];
    if (!w) return;

    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);

    const el = (w.elements || []).find((item) => state.selectedEntity && state.selectedEntity.kind === 'ELEMENT' && item.id === state.selectedEntity.id)
      || (w.elements || [])[0];

    if (!el) {
      box.innerHTML = `
        <div class="card-header"><h3 class="card-title">Elevación ${escapeHtml(w.label)}</h3></div>
        <p style="font-size:13px; color:var(--text-muted);">
          Toque o arrastre un contacto eléctrico, salida hidrosanitaria o ventana desde la paleta izquierda para posicionarlo con sus 4 referencias respecto al centro.
        </p>
      `;
      return;
    }

    const r = el.references || {};
    const chk = G.computeFourReferences(L, H, r.distLeftMm, r.distRightMm, r.distFloorMm, r.distTopMm);
    const errHtml = (chk.errors || []).map((err) => `<div style="background:#fee2e2; color:#b91c1c; padding:8px; border-radius:6px; font-weight:700; font-size:12px; margin-bottom:6px;">🚨 ${escapeHtml(err)}</div>`).join('');

    const plumbingSetControls = el.isSet
      ? `<div style="background:var(--bg-subtle); padding:10px; border-radius:8px; margin-top:8px;">
           <div style="font-weight:800; font-size:12px; margin-bottom:6px;">Parámetros Editables del Conjunto (Centro Conservado)</div>
           <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
             <div>
               <label class="form-label">Offset AC Izq (mm)</label>
               <input type="number" class="form-input numpad-target" value="${el.hotOffsetUMm ?? -100}" onchange="App.updateElementProp('${w.id}', '${el.id}', 'hotOffsetUMm', Number(this.value))" />
             </div>
             <div>
               <label class="form-label">Offset AF Der (mm)</label>
               <input type="number" class="form-input numpad-target" value="${el.coldOffsetUMm ?? 100}" onchange="App.updateElementProp('${w.id}', '${el.id}', 'coldOffsetUMm', Number(this.value))" />
             </div>
           </div>
         </div>`
      : '';

    box.innerHTML = `
      <div class="card-header">
        <div>
          <h3 class="card-title">${escapeHtml(el.code)} · ${escapeHtml(el.label)}</h3>
          <div style="font-size:11.5px; color:var(--text-muted);">Muro anfitrión: ${escapeHtml(w.label)} (${L} × ${H} mm)</div>
        </div>
        <span class="state-badge ${el.provenance === 'MEASURED' ? 'fijado' : 'provisional'}">
          ${el.provenance === 'MEASURED' ? 'MEDIDO' : 'PRESET'}
        </span>
      </div>

      ${errHtml}

      <div class="tool-section-title">4 Referencias Visibles al Centro (mm)</div>
      <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
        Al editar una referencia horizontal o vertical se calcula automáticamente su complementaria. Si introduce ambas de un eje, se valida su suma contra el muro.
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="form-group">
          <label class="form-label">1. Desde Izquierda (mm)</label>
          <input type="number" class="form-input numpad-target" id="refInputLeft" value="${r.distLeftMm ?? 0}" onchange="App.updateElementSingleRef('${w.id}', '${el.id}', 'LEFT', this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">2. Desde Derecha (mm)</label>
          <input type="number" class="form-input numpad-target" id="refInputRight" value="${r.distRightMm ?? 0}" onchange="App.updateElementSingleRef('${w.id}', '${el.id}', 'RIGHT', this.value)" />
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="form-group">
          <label class="form-label">3. Altura desde Piso (mm)</label>
          <input type="number" class="form-input numpad-target" id="refInputFloor" value="${r.distFloorMm ?? 0}" onchange="App.updateElementSingleRef('${w.id}', '${el.id}', 'FLOOR', this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">4. Desde Parte Superior (mm)</label>
          <input type="number" class="form-input numpad-target" id="refInputTop" value="${r.distTopMm ?? 0}" onchange="App.updateElementSingleRef('${w.id}', '${el.id}', 'TOP', this.value)" />
        </div>
      </div>

      <button class="btn btn-sm" style="width:100%; margin-bottom:8px;" onclick="App.validateDualAxisEntry('${w.id}', '${el.id}')">
        🔍 Validar Consistencia de Doble Lectura (Izq+Der y Piso+Sup)
      </button>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="form-group">
          <label class="form-label">Ancho Símbolo/Vano (mm)</label>
          <input type="number" class="form-input numpad-target" value="${el.widthMm || 70}" onchange="App.updateElementProp('${w.id}', '${el.id}', 'widthMm', Number(this.value))" />
        </div>
        <div class="form-group">
          <label class="form-label">Alto Símbolo/Vano (mm)</label>
          <input type="number" class="form-input numpad-target" value="${el.heightMm || 115}" onchange="App.updateElementProp('${w.id}', '${el.id}', 'heightMm', Number(this.value))" />
        </div>
      </div>

      ${plumbingSetControls}

      <button class="btn btn-danger" style="width:100%; margin-top:12px;" onclick="App.deleteElevationElement('${w.id}', '${el.id}')">
        🗑️ Eliminar Dispositivo (${escapeHtml(el.code)})
      </button>
    `;
  }

  function updateElementSingleRef(wallId, elId, changedSide, rawVal) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    const el = (w.elements || []).find((item) => item.id === elId);
    if (!el) return;
    const val = Number(rawVal);
    if (!Number.isFinite(val)) return;

    pushUndoSnapshot();
    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);
    const cur = el.references || {};

    let dL = cur.distLeftMm, dR = null, dF = cur.distFloorMm, dT = null;
    if (changedSide === 'LEFT') { dL = val; dR = null; }
    else if (changedSide === 'RIGHT') { dL = null; dR = val; }
    else if (changedSide === 'FLOOR') { dF = val; dT = null; }
    else if (changedSide === 'TOP') { dF = null; dT = val; }

    el.references = G.computeFourReferences(L, H, dL, dR, dF, dT);
    el.provenance = 'MEASURED';
    saveCurrentProject(false);
    renderAll();
  }

  function validateDualAxisEntry(wallId, elId) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    const el = (w.elements || []).find((item) => item.id === elId);
    if (!el) return;

    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 2000);
    const H = Number(w.heightMm || c.heightMm || state.project.predominantHeightMm || 2600);

    const dL = Number(document.getElementById('refInputLeft').value);
    const dR = Number(document.getElementById('refInputRight').value);
    const dF = Number(document.getElementById('refInputFloor').value);
    const dT = Number(document.getElementById('refInputTop').value);

    el.references = G.computeFourReferences(L, H, dL, dR, dF, dT);
    saveCurrentProject(false);
    renderAll();
    if (!el.references.consistent) {
      alert(el.references.errors.join('\n'));
    } else {
      alert(`Consistencia verificada: Izq (${dL}) + Der (${dR}) = ${L} mm | Piso (${dF}) + Sup (${dT}) = ${H} mm.`);
    }
  }

  function updateElementProp(wallId, elId, prop, val) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    const el = (w.elements || []).find((item) => item.id === elId);
    if (!el) return;
    pushUndoSnapshot();
    el[prop] = val;
    el.provenance = 'MEASURED';
    saveCurrentProject(false);
    renderAll();
  }

  function deleteElevationElement(wallId, elId) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    pushUndoSnapshot();
    w.elements = (w.elements || []).filter((item) => item.id !== elId);
    state.selectedEntity = w.elements[0] ? { kind: 'ELEMENT', id: w.elements[0].id } : null;
    saveCurrentProject(false);
    renderAll();
  }

  // ==========================================================================
  // 8. EDICIÓN DE PROPIEDADES, CONFLICTOS Y RENUMERACIÓN IZQUIERDA -> DERECHA
  // ==========================================================================

  function updateWallProp(wallId, prop, val) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    pushUndoSnapshot();
    w[prop] = val;
    if (prop === 'heightMm') w.heightMode = 'OVERRIDE';
    saveCurrentProject(false);
    renderAll();
  }

  function applyWallAngle(wallId, rawAngle) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    const ang = Number(rawAngle);
    if (!Number.isFinite(ang)) return;
    pushUndoSnapshot();
    const vmap = G.getVertexMap(c);
    const m = G.wallGeometryMetrics(w, vmap);
    const L = Number(w.realLengthMm || m.geomLengthMm || 1000);
    G.progressiveFixWallLength(c, wallId, L, ang, true);
    saveCurrentProject(false);
    renderAll();
  }

  function unlockWall(wallId) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    pushUndoSnapshot();
    w.status = 'provisional';
    w.conflictInfo = null;
    saveCurrentProject(false);
    renderAll();
  }

  function flipWallNormal(wallId) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    pushUndoSnapshot();
    w.outwardNormalSign = (w.outwardNormalSign ?? 1) * -1;
    saveCurrentProject(false);
    renderAll();
  }

  function resolveConflictOpenLoop(wallId) {
    const c = getActivePlanConcept();
    if (!c) return;
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (!w) return;
    pushUndoSnapshot();
    c.isClosedLoop = false;
    // Si el último muro compartía vértice con el primero, desacoplar el vértice final
    const walls = c.walls || [];
    if (walls.length >= 2 && walls[walls.length - 1].endVertexId === walls[0].startVertexId) {
      const vmap = G.getVertexMap(c);
      const v0 = vmap[walls[0].startVertexId];
      const vCloneId = G.newId('v');
      c.vertices.push({ id: vCloneId, xMm: v0.xMm, yMm: v0.yMm });
      walls[walls.length - 1].endVertexId = vCloneId;
    }
    const attempted = (w.conflictInfo && w.conflictInfo.attemptedLengthMm) || w.realLengthMm || 1000;
    G.progressiveFixWallLength(c, wallId, attempted, w.angleDeg, true);
    saveCurrentProject(false);
    renderAll();
  }

  function resolveConflictUnlockOpposite(wallId) {
    const c = getActivePlanConcept();
    if (!c) return;
    pushUndoSnapshot();
    for (const ow of (c.walls || [])) {
      if (ow.id !== wallId) {
        ow.status = 'provisional';
        ow.conflictInfo = null;
      }
    }
    const w = (c.walls || []).find((item) => item.id === wallId);
    if (w) {
      const attempted = (w.conflictInfo && w.conflictInfo.attemptedLengthMm) || w.realLengthMm || 1000;
      G.progressiveFixWallLength(c, wallId, attempted, w.angleDeg, true);
    }
    saveCurrentProject(false);
    renderAll();
  }

  function updatePolloField(polloId, prop, rawVal) {
    const c = getActivePlanConcept();
    if (!c) return;
    const pb = (c.concreteBases || []).find((item) => item.id === polloId);
    if (!pb) return;
    let val = rawVal;
    if (prop === 'lengthMm' || prop === 'widthMm' || prop === 'heightMm') {
      const evalVal = G.evaluateSafeArithmetic(rawVal, null);
      if (evalVal && evalVal > 0) val = evalVal;
    }
    pushUndoSnapshot();
    pb[prop] = val;
    saveCurrentProject(false);
    renderAll();
  }

  function updatePolloSegmentLength(polloId, segmentIndex, rawVal) {
    const c = getActivePlanConcept();
    if (!c) return;
    const pb = (c.concreteBases || []).find((item) => item.id === polloId);
    if (!pb || !pb.points || pb.points.length < 2) return;
    const evalVal = G.evaluateSafeArithmetic(rawVal, null);
    if (!evalVal || evalVal <= 0) return;
    pushUndoSnapshot();

    const idx = segmentIndex - 1;
    const pA = pb.points[idx];
    const pB = pb.points[(idx + 1) % pb.points.length];
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const curLen = Math.hypot(dx, dy);
    if (curLen > 1e-4) {
      const u = { x: dx / curLen, y: dy / curLen };
      const shiftX = (pA.x + evalVal * u.x) - pB.x;
      const shiftY = (pA.y + evalVal * u.y) - pB.y;
      pB.x = pA.x + evalVal * u.x;
      pB.y = pA.y + evalVal * u.y;
      for (let j = idx + 2; j < pb.points.length; j++) {
        pb.points[j].x += shiftX;
        pb.points[j].y += shiftY;
      }
    }
    saveCurrentProject(false);
    renderAll();
  }

  function updatePolloRef(polloId, refKey, rawVal) {
    const c = getActivePlanConcept();
    if (!c) return;
    const pb = (c.concreteBases || []).find((item) => item.id === polloId);
    if (!pb) return;
    const evalVal = G.evaluateSafeArithmetic(rawVal, 0);
    pushUndoSnapshot();
    pb.references = pb.references || {};
    pb.references[refKey] = evalVal;
    saveCurrentProject(false);
    renderAll();
  }

  function updateGapField(gapId, prop, val) {
    const c = getActivePlanConcept();
    if (!c) return;
    const sep = (c.separations || []).find((item) => item.id === gapId);
    if (!sep) return;
    pushUndoSnapshot();
    sep[prop] = val;
    saveCurrentProject(false);
    renderAll();
  }

  function onGapDistanceChange(gapId, rawVal) {
    const c = getActivePlanConcept();
    if (!c) return;
    const evalVal = G.evaluateSafeArithmetic(rawVal, null);
    if (!evalVal || evalVal <= 0) return;
    pushUndoSnapshot();
    const res = G.adjustGapDistance(c, gapId, evalVal, true);
    saveCurrentProject(false);
    renderAll();
    if (res && res.status === 'blocked_by_lock') {
      alert(res.message);
    }
  }

  function deleteSelectedEntity() {
    const c = getActivePlanConcept();
    if (!c || !state.selectedEntity) return;
    pushUndoSnapshot();
    const { kind, id } = state.selectedEntity;
    if (kind === 'WALL') {
      G.deleteWallAndCleanTopology(c, id);
      G.autoOrientWallNormals(c);
      state.activeWallId = c.walls[0] ? c.walls[0].id : null;
    } else if (kind === 'POLLO') {
      c.concreteBases = (c.concreteBases || []).filter((p) => p.id !== id);
    } else if (kind === 'GAP') {
      c.separations = (c.separations || []).filter((s) => s.id !== id);
    }
    state.selectedEntity = state.activeWallId ? { kind: 'WALL', id: state.activeWallId } : null;
    saveCurrentProject(false);
    renderAll();
    showToastNotification(`Elemento eliminado.`);
  }

  function openRenumberPreviewModal() {
    const c = getActivePlanConcept();
    if (!c) return;
    const prev = G.previewRenumberLeftToRight(c);
    const rows = (prev.preview || []).map((p) => `
      <tr style="${p.changed ? 'background:#fef3c7; font-weight:800;' : ''}">
        <td>${escapeHtml(p.oldLabel)} (${escapeHtml(p.oldCode)})</td>
        <td>→</td>
        <td><strong>${escapeHtml(p.newLabel)} (${escapeHtml(p.newCode)})</strong></td>
        <td>X mín = ${p.minX.toFixed(0)} mm (Centro X = ${p.midX.toFixed(0)} mm)</td>
        <td>${p.changed ? '🔄 Se actualizará' : '✔ Sin cambio'}</td>
      </tr>
    `).join('');

    document.getElementById('renumberPreviewBody').innerHTML = `
      <div style="font-weight:700; margin-bottom:10px; color:${prev.needsRenumbering ? '#b45309' : '#047857'};">
        ${escapeHtml(prev.message)}
      </div>
      <table class="nine-grid-table">
        <thead>
          <tr><th>Nombre Actual</th><th></th><th>Nuevo Orden (Izq → Der)</th><th>Posición Horizontal X</th><th>Estado</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    document.getElementById('renumberModal').classList.add('open');
  }

  function closeRenumberModal() {
    document.getElementById('renumberModal').classList.remove('open');
  }

  function confirmRenumberLeftToRight() {
    const c = getActivePlanConcept();
    if (!c) return;
    pushUndoSnapshot();
    G.applyRenumberLeftToRight(c);
    closeRenumberModal();
    saveCurrentProject(false);
    renderAll();
  }

  // ==========================================================================
  // 9. TECLADO NUMÉRICO TÁCTIL FLOTANTE CAD
  // ==========================================================================

  function bindGlobalNumpadFocus() {
    document.addEventListener('focusin', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('numpad-target')) {
        state.activeNumpadInput = e.target;
        state.activeNumpadWallId = null;
        document.getElementById('numpadDisplayInput').value = e.target.value || '';
      }
    });
  }

  function openNumpadForWall(wallId, inputEl) {
    state.activeNumpadWallId = wallId;
    state.activeNumpadInput = inputEl;
    const c = getActivePlanConcept();
    const w = c && (c.walls || []).find((item) => item.id === wallId);
    document.getElementById('numpadTargetLabel').textContent = w ? `Cota Real ${w.label} (mm)` : 'Medida Real (mm)';
    document.getElementById('numpadDisplayInput').value = inputEl.value || '';
    document.getElementById('floatingNumpad').classList.add('open');
  }

  function toggleTouchNumpad() {
    const np = document.getElementById('floatingNumpad');
    np.classList.toggle('open');
  }

  function closeTouchNumpad() {
    document.getElementById('floatingNumpad').classList.remove('open');
  }

  function numpadPress(key) {
    const disp = document.getElementById('numpadDisplayInput');
    if (key === 'BACK') {
      disp.value = disp.value.slice(0, -1);
    } else if (key === '.') {
      if (!disp.value.includes('.')) disp.value += '.';
    } else {
      disp.value += key;
    }
    if (state.activeNumpadInput) {
      state.activeNumpadInput.value = disp.value;
      state.activeNumpadInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function numpadConfirm() {
    const val = document.getElementById('numpadDisplayInput').value;
    if (state.activeNumpadWallId) {
      applyWallRealLengthFromInput(state.activeNumpadWallId, val);
    } else if (state.activeNumpadInput) {
      state.activeNumpadInput.value = val;
      state.activeNumpadInput.dispatchEvent(new Event('change', { bubbles: true }));
      state.activeNumpadInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeTouchNumpad();
  }

  // ==========================================================================
  // 10. AUDITORÍA Y EXPORTACIÓN PDF / DXF (RHINO 8)
  // ==========================================================================

  function openExportModal() {
    if (!state.project) return;
    const audit = G.auditProjectForExport(state.project);
    const conflictsHtml = audit.blockingConflicts.map((m) => `<li style="color:#b91c1c; font-weight:700;">🚨 ${escapeHtml(m)}</li>`).join('');
    const warningsHtml = audit.missingDataWarnings.map((m) => `<li style="color:#b45309; font-weight:600;">⚠️ ${escapeHtml(m)}</li>`).join('');
    const presetsHtml = audit.presetNotices.map((m) => `<li style="color:#1d4ed8;">ℹ️ ${escapeHtml(m)}</li>`).join('');

    document.getElementById('exportAuditModalBody').innerHTML = `
      <div style="padding:12px; border-radius:8px; margin-bottom:12px; font-weight:800; background:${audit.isCleanForFinalExport ? '#d1fae5' : '#fef2f2'}; color:${audit.isCleanForFinalExport ? '#047857' : '#b91c1c'};">
        ${escapeHtml(audit.stampText)}
      </div>
      <div style="font-size:13px; margin-bottom:10px;">
        <strong>Especificación de salida:</strong>
        <ul>
          <li><strong>DXF 2D Editable (Rhino 8):</strong> Formato AC1024 (R2010), <code>$INSUNITS = 4</code> (mm), polilíneas cerradas (<code>70 = 1</code>, ancho <code>43 = 0.0</code>), capas separadas para muros, pollo, vanos, instalaciones, cotas e IDs. Planta y elevaciones desacopladas con 0 traslapes.</li>
          <li><strong>PDF Técnico Vectorial:</strong> Láminas de planta, elevaciones por muro con 4 referencias y puertas con esquema, 9 lecturas originales y mínimos de referencia.</li>
          <li><strong>Protección de Fuente:</strong> Exportar jamás modifica el archivo fuente del proyecto.</li>
        </ul>
      </div>
      ${(conflictsHtml || warningsHtml || presetsHtml)
        ? `<div style="max-height:200px; overflow-y:auto; background:var(--bg-subtle); padding:10px; border-radius:8px;">
             <ul style="margin:0; padding-left:18px; font-size:12.5px;">${conflictsHtml}${warningsHtml}${presetsHtml}</ul>
           </div>`
        : '<div style="color:#047857; font-weight:700;">✔ Todos los muros, elevaciones y puertas están completos y verificados en milímetros.</div>'}
    `;
    document.getElementById('exportModal').classList.add('open');
  }

  function closeExportModal() {
    document.getElementById('exportModal').classList.remove('open');
  }

  async function triggerExportDxf() {
    if (!state.project) return;
    const audit = G.auditProjectForExport(state.project);
    if (audit.requiresPreliminaryConfirmation) {
      const ok = confirm('El proyecto contiene datos pendientes o conflictos. ¿Confirma generar una EXPORTACIÓN PRELIMINAR marcada como INCOMPLETA?');
      if (!ok) return;
    }
    await global.ASBuiltDxfExporter.downloadProjectDxf(state.project, true);
  }

  async function triggerExportPdf() {
    if (!state.project) return;
    const audit = G.auditProjectForExport(state.project);
    if (audit.requiresPreliminaryConfirmation) {
      const ok = confirm('El proyecto contiene datos pendientes o conflictos. ¿Confirma generar el PDF con marca de EXPORTACIÓN PRELIMINAR / INCOMPLETA?');
      if (!ok) return;
    }
    await global.ASBuiltPdfExporter.downloadProjectPdf(state.project, true);
  }

  // ==========================================================================
  // 11. RENDERIZADO GENERAL DE VISTAS Y SELECTORES
  // ==========================================================================

  function renderProjectDashboard() {
    if (!state.project) return;
    const grid = document.getElementById('conceptsGridContainer');
    if (grid) {
      grid.innerHTML = (state.project.concepts || []).map((c) => {
        const isDoor = c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL';
        let detailsHtml = '';
        if (isDoor) {
          const ds = c.doorSurvey || {};
          const ev = G.evaluateDoorNineReadings(ds.widths, ds.heights, ds.thicknesses, ds.ceilingHeightMm, ds.baseOffsetMm);
          const mins = ev.referenceMinimumsMm;
          detailsHtml = mins
            ? `<div>9 lecturas registradas · Mínimos: <strong>${mins.widthMm} × ${mins.heightMm} × ${mins.thicknessMm} mm</strong></div>`
            : `<div style="color:#b45309;">Lecturas pendientes (${ev.missingFields.length}/9)</div>`;
        } else {
          const walls = c.walls || [];
          const fixedCount = walls.filter((w) => w.status === 'fijado').length;
          const elCount = walls.reduce((acc, w) => acc + ((w.elements || []).length), 0);
          detailsHtml = `<div><strong>${walls.length} muros</strong> (${fixedCount} fijados en mm) · <strong>${(c.concreteBases || []).length} pollos/bases</strong> · <strong>${elCount} instalaciones</strong></div>`;
        }

        return `
          <div class="concept-card ${c.id === state.activeConceptId ? 'active-concept' : ''}">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span class="concept-type-tag ${isDoor ? 'door-tag' : ''}">${escapeHtml(c.conceptType)}</span>
                <button class="btn btn-sm" style="min-height:30px; padding:2px 8px;" onclick="App.deleteConcept('${c.id}')" title="Eliminar concepto">🗑️</button>
              </div>
              <div style="font-weight:800; font-size:15px; margin-bottom:4px;">${escapeHtml(c.name)}</div>
              <div style="font-size:12.5px; color:var(--text-muted);">${detailsHtml}</div>
            </div>
            <button class="btn btn-primary btn-sm" style="width:100%;" onclick="App.openConceptInProperView('${c.id}')">
              ${isDoor ? '🚪 Abrir Interfaz Frontal (9 Medidas)' : '✏️ Abrir Boceto en Planta y Elevaciones'}
            </button>
          </div>
        `;
      }).join('');
    }

    const auditBox = document.getElementById('projectAuditSummaryBox');
    if (auditBox) {
      const audit = G.auditProjectForExport(state.project);
      auditBox.innerHTML = `
        <div style="font-weight:800; color:${audit.isCleanForFinalExport ? '#047857' : '#b45309'};">
          Estado actual: ${escapeHtml(audit.stampText)}
        </div>
        <div style="font-size:12.5px; color:var(--text-muted); margin-top:4px;">
          Conflictos bloqueantes: <strong>${audit.blockingConflicts.length}</strong> · Advertencias/pendientes: <strong>${audit.missingDataWarnings.length}</strong> · Presets editables en uso: <strong>${audit.presetNotices.length}</strong>
        </div>
      `;
    }
  }

  function syncDropdownSelectors() {
    if (!state.project) return;
    const planConcepts = (state.project.concepts || []).filter((c) => c.conceptType !== 'PUERTA' && c.mode !== 'DOOR_FRONTAL');
    const doorConcepts = (state.project.concepts || []).filter((c) => c.conceptType === 'PUERTA' || c.mode === 'DOOR_FRONTAL');

    const planSel = document.getElementById('planConceptSelect');
    if (planSel) {
      planSel.innerHTML = planConcepts.map((c) => `<option value="${c.id}" ${c.id === state.activeConceptId ? 'selected' : ''}>${escapeHtml(c.name)} (${c.conceptType})</option>`).join('');
    }

    const pc = getActivePlanConcept();
    const elevWallSel = document.getElementById('elevWallSelect');
    if (elevWallSel && pc) {
      elevWallSel.innerHTML = (pc.walls || []).map((w) => `<option value="${w.id}" ${w.id === state.activeWallId ? 'selected' : ''}>${escapeHtml(w.label)} (${w.code}) - ${w.realLengthMm || '~'} mm</option>`).join('');
    }

    const doorSel = document.getElementById('doorConceptSelect');
    if (doorSel) {
      doorSel.innerHTML = doorConcepts.map((c) => `<option value="${c.id}" ${c.id === state.activeConceptId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    }
  }

  function selectConcept(conceptId) {
    state.activeConceptId = conceptId;
    const pc = getActivePlanConcept();
    if (pc && pc.walls && pc.walls.length > 0) {
      state.activeWallId = pc.walls[0].id;
      state.selectedEntity = { kind: 'WALL', id: pc.walls[0].id };
    } else {
      state.activeWallId = null;
      state.selectedEntity = null;
    }
    fitPlanToScreen();
    renderAll();
  }

  function renderAll() {
    syncDropdownSelectors();
    renderProjectDashboard();
    if (state.mainView === 'PLAN') {
      renderPlanCanvas();
      renderPlanInspector();
    } else if (state.mainView === 'ELEVATION') {
      renderElevationCanvas();
      renderElevationInspector();
    } else if (state.mainView === 'DOOR') {
      syncDoorInputsFromConcept();
      renderDoorCanvas();
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.App = {
    state,
    getActivePlanConcept,
    updateDrawingActionButtons,
    renderAll,
    init,
    switchMainView,
    createNewProjectPrompt,
    loadDemoReferenceProject,
    importProjectFile,
    downloadBackupJson,
    saveCurrentProject,
    refreshRecentProjects,
    openSavedProject,
    updateProjectMeta,
    onConceptTypeChange,
    addConcept,
    deleteConcept,
    openConceptInProperView,
    selectConcept,
    setPlanTool,
    cancelCurrentDrawing,
    finishChainedDrawing,
    finishPolloDrawing,
    deleteSelectedWall,
    clearCurrentRoomPlan,
    openInlineDimensionEditor,
    cancelInlineDimension,
    toggleOrthoMode,
    toggleClosedLoop,
    zoomPlan,
    fitPlanToScreen,
    selectWallFromOverlay,
    applyWallRealLengthFromInput,
    openWallElevation,
    selectElevationWall,
    stepElevationWall,
    updateElevationWallHeight,
    fitElevationToScreen,
    onPaletteDragStart,
    onElevationCanvasDrop,
    insertElevationElement,
    updateElementSingleRef,
    validateDualAxisEntry,
    updateElementProp,
    deleteElevationElement,
    updateWallProp,
    applyWallAngle,
    unlockWall,
    flipWallNormal,
    resolveConflictOpenLoop,
    resolveConflictUnlockOpposite,
    updatePolloField,
    updatePolloRef,
    updatePolloSegmentLength,
    updateGapField,
    onGapDistanceChange,
    deleteSelectedEntity,
    renderPlanInspector,
    snapToExistingVertexPlan,
    showToastNotification,
    openRenumberPreviewModal,
    closeRenumberModal,
    confirmRenumberLeftToRight,
    selectDoorConcept,
    onDoorInputChanged,
    openNumpadForWall,
    toggleTouchNumpad,
    closeTouchNumpad,
    numpadPress,
    numpadConfirm,
    openExportModal,
    closeExportModal,
    triggerExportDxf,
    triggerExportPdf,
    navigateBack,
    zoomElevation,
    navigationHistory,
    undo,
    redo
  };

  window.addEventListener('DOMContentLoaded', init);
})(window);
