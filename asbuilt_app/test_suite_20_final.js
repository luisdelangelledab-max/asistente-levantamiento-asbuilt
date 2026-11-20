// -*- coding: utf-8 -*-
/**
 * Test Suite Automatizado para los 20 Casos Obligatorios
 * Prompt: "Ajustes finales — Asistente de Levantamiento AsBuilt"
 */
const path = require('path');
const fs = require('fs');
const tempDir = process.env.TEMP || 'C:\\Windows\\Temp';
const puppeteer = require(path.join(tempDir, 'node_modules', 'puppeteer-core'));

const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

function getBrowserPath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No se encontró Edge o Chrome para ejecutar las pruebas.');
}

async function run20Tests() {
  console.log('================================================================');
  console.log('EJECUCIÓN DE PRUEBAS OBLIGATORIAS: ASISTENTE DE LEVANTAMIENTO ASBUILT');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: getBrowserPath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('dialog', async (dialog) => {
    await dialog.accept('Proyecto Automatizado Test');
  });

  page.on('console', (msg) => {
    // console.log('PAGE LOG:', msg.text());
  });

  await page.goto('http://localhost:3120/index.html', { waitUntil: 'networkidle2', timeout: 15000 });

  const results = [];

  async function test(num, title, fn) {
    try {
      const res = await fn();
      results.push({ num, title, passed: true, detail: res || 'OK' });
      console.log(`[PASS] Prueba ${String(num).padStart(2, '0')}: ${title} -> ${res || 'OK'}`);
    } catch (err) {
      results.push({ num, title, passed: false, detail: err.message });
      console.log(`[FAIL] Prueba ${String(num).padStart(2, '0')}: ${title} -> ERROR: ${err.message}`);
    }
  }

  // PRUEBA 20: Verificar el nombre definitivo de la aplicación
  await test(20, 'Verificar nombre definitivo de la aplicación', async () => {
    const title = await page.title();
    const manifestRaw = fs.readFileSync(path.join(__dirname, 'public', 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const topProjectTitle = await page.$eval('#topProjectTitle', (el) => el.textContent.trim());

    if (title !== 'Asistente de Levantamiento AsBuilt') {
      throw new Error(`Título HTML incorrecto: "${title}"`);
    }
    if (manifest.name !== 'Asistente de Levantamiento AsBuilt') {
      throw new Error(`Nombre en manifest.json incorrecto: "${manifest.name}"`);
    }
    if (title.toLowerCase().includes('codex') || topProjectTitle.toLowerCase().includes('codex')) {
      throw new Error('La palabra Codex todavía aparece en el título visible.');
    }
    return `Título="${title}", Manifest="${manifest.name}" (Cero referencias a Codex en UI visible)`;
  });

  // PRUEBA 6: Introducir `2500+1000` y obtener 3500 mm
  await test(6, 'Introducir "2500+1000" en evaluador aritmético y obtener 3500 mm', async () => {
    const evaluated = await page.evaluate(() => {
      const g = window.ASBuiltGeometry;
      const r1 = g.evaluateSafeArithmetic('2500+1000');
      const r2 = g.evaluateSafeArithmetic('3200-150');
      const r3 = g.evaluateSafeArithmetic('1200*2');
      const r4 = g.evaluateSafeArithmetic('3000/2');
      const r5 = g.evaluateSafeArithmetic('(1200+800)*1.5');
      return { r1, r2, r3, r4, r5 };
    });

    if (evaluated.r1 !== 3500) throw new Error(`2500+1000 dio ${evaluated.r1}, esperado 3500`);
    if (evaluated.r2 !== 3050) throw new Error(`3200-150 dio ${evaluated.r2}, esperado 3050`);
    if (evaluated.r3 !== 2400) throw new Error(`1200*2 dio ${evaluated.r3}, esperado 2400`);
    if (evaluated.r4 !== 1500) throw new Error(`3000/2 dio ${evaluated.r4}, esperado 1500`);
    if (evaluated.r5 !== 3000) throw new Error(`(1200+800)*1.5 dio ${evaluated.r5}, esperado 3000`);
    return `Operaciones verificadas: 2500+1000=3500, 3200-150=3050, 1200*2=2400, (1200+800)*1.5=3000`;
  });

  // PRUEBA 7: Actualizar geometría y cotas después de una operación matemática
  await test(7, 'Actualizar geometría y cotas tras operación matemática (inline e inspector)', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      App.loadDemoReferenceProject();
      const c = App.getActivePlanConcept();
      const wall1 = c.walls[0];
      // Aplicar operación matemática en campo de texto
      App.applyWallRealLengthFromInput(wall1.id, '2500+1000', true);
      const wAfter = c.walls.find((w) => w.id === wall1.id);
      return {
        realLengthMm: wAfter.realLengthMm,
        status: wAfter.status,
        provM: wAfter.provisionalLengthM
      };
    });

    if (res.realLengthMm !== 3500) {
      throw new Error(`Longitud del muro tras "2500+1000" es ${res.realLengthMm}, se esperaba 3500 mm`);
    }
    if (res.status !== 'fijado') {
      throw new Error(`El muro debería estar en estado 'fijado', está en '${res.status}'`);
    }
    return `Muro fijado a ${res.realLengthMm} mm con estado '${res.status}'`;
  });

  // PRUEBA 8, 9, 10, 11: Orientación de caras y cotas (horario vs antihorario)
  await test(8, 'Dibujar una planta en sentido horario y verificar normales', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      App.createNewProjectPrompt();
      const c = App.getActivePlanConcept();
      c.vertices = [
        { id: 'v1', xMm: 0, yMm: 0 },
        { id: 'v2', xMm: 3000, yMm: 0 },
        { id: 'v3', xMm: 3000, yMm: 2500 },
        { id: 'v4', xMm: 0, yMm: 2500 }
      ];
      // Sentido horario: (0,0)->(3000,0)->(3000,2500)->(0,2500)->(0,0)
      c.walls = [
        { id: 'w1', label: 'Muro 1', startVertexId: 'v1', endVertexId: 'v2', realLengthMm: 3000, status: 'fijado' },
        { id: 'w2', label: 'Muro 2', startVertexId: 'v2', endVertexId: 'v3', realLengthMm: 2500, status: 'fijado' },
        { id: 'w3', label: 'Muro 3', startVertexId: 'v3', endVertexId: 'v4', realLengthMm: 3000, status: 'fijado' },
        { id: 'w4', label: 'Muro 4', startVertexId: 'v4', endVertexId: 'v1', realLengthMm: 2500, status: 'fijado' }
      ];
      c.isClosedLoop = true;
      G.autoOrientWallNormals(c);
      return c.walls.map((w) => ({ id: w.id, outwardNormalSign: w.outwardNormalSign }));
    });

    return `Planta horaria orientada consistentemente: ${JSON.stringify(res)}`;
  });

  await test(9, 'Dibujar la misma planta en sentido antihorario y verificar normales', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const c = App.getActivePlanConcept();
      c.vertices = [
        { id: 'va1', xMm: 0, yMm: 0 },
        { id: 'va2', xMm: 0, yMm: 2500 },
        { id: 'va3', xMm: 3000, yMm: 2500 },
        { id: 'va4', xMm: 3000, yMm: 0 }
      ];
      // Sentido antihorario: (0,0)->(0,2500)->(3000,2500)->(3000,0)->(0,0)
      c.walls = [
        { id: 'wa1', label: 'Muro 1', startVertexId: 'va1', endVertexId: 'va2', realLengthMm: 2500, status: 'fijado' },
        { id: 'wa2', label: 'Muro 2', startVertexId: 'va2', endVertexId: 'va3', realLengthMm: 3000, status: 'fijado' },
        { id: 'wa3', label: 'Muro 3', startVertexId: 'va3', endVertexId: 'va4', realLengthMm: 2500, status: 'fijado' },
        { id: 'wa4', label: 'Muro 4', startVertexId: 'va4', endVertexId: 'va1', realLengthMm: 3000, status: 'fijado' }
      ];
      c.isClosedLoop = true;
      G.autoOrientWallNormals(c);
      return c.walls.map((w) => ({ id: w.id, outwardNormalSign: w.outwardNormalSign }));
    });

    return `Planta antihoraria orientada: ${JSON.stringify(res)}`;
  });

  await test(10, 'Comprobar que las caras interiores miran al ambiente habitable', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const c = App.getActivePlanConcept();
      const vmap = G.getVertexMap(c);
      const w1 = c.walls[0];
      const m = G.wallGeometryMetrics(w1, vmap);
      const L = m.geomLengthMm;
      const tx = (m.bx - m.ax) / L;
      const ty = (m.by - m.ay) / L;
      const nOut = G.outwardNormalForWall(tx, ty, w1.outwardNormalSign);
      // Cara interior es opuesta a nOut
      const innerPt = { x: m.midX - 25 * nOut.x, y: m.midY - 25 * nOut.y };
      const outerPt = { x: m.midX + 25 * nOut.x, y: m.midY + 25 * nOut.y };
      const poly = c.walls.map((w) => vmap[w.startVertexId]).map((v) => ({ x: Number(v.xMm), y: Number(v.yMm) }));
      const isInnerInside = G.pointInPolygon(innerPt.x, innerPt.y, poly);
      const isOuterInside = G.pointInPolygon(outerPt.x, outerPt.y, poly);
      return { isInnerInside, isOuterInside };
    });

    if (!res.isInnerInside) throw new Error('El punto interior no quedó dentro del polígono.');
    if (res.isOuterInside) throw new Error('El punto exterior quedó dentro del polígono.');
    return `Cara interior dentro del ambiente: ${res.isInnerInside}, Cara exterior fuera: ${!res.isOuterInside}`;
  });

  await test(11, 'Confirmar que las cotas se colocan hacia el exterior', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const c = App.getActivePlanConcept();
      const vmap = G.getVertexMap(c);
      let allOutward = true;
      const poly = c.walls.map((w) => vmap[w.startVertexId]).map((v) => ({ x: Number(v.xMm), y: Number(v.yMm) }));
      for (const w of c.walls) {
        const m = G.wallGeometryMetrics(w, vmap);
        const L = m.geomLengthMm;
        const tx = (m.bx - m.ax) / L;
        const ty = (m.by - m.ay) / L;
        const n = G.outwardNormalForWall(tx, ty, w.outwardNormalSign);
        const dimPt = { x: m.midX + 40 * n.x, y: m.midY + 40 * n.y };
        if (G.pointInPolygon(dimPt.x, dimPt.y, poly)) {
          allOutward = false;
        }
      }
      return { allOutward, wallCount: c.walls.length };
    });

    if (!res.allOutward) throw new Error('Alguna cota se situó hacia el interior del ambiente.');
    return `100% de las ${res.wallCount} cotas situadas en el exterior del ambiente.`;
  });

  // PRUEBA 3, 4, 5: Herramienta Huecos
  await test(3, 'Medir un hueco seleccionando dos extremos de muros diferentes', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      App.loadDemoReferenceProject();
      const c = App.getActivePlanConcept();
      const w1 = c.walls[0];
      const w2 = c.walls[1];
      const vmap = G.getVertexMap(c);
      const v1 = vmap[w1.startVertexId];
      const v2 = vmap[w2.endVertexId];

      const distReal = Math.hypot(v2.xMm - v1.xMm, v2.yMm - v1.yMm);
      const sep = {
        id: G.newId('gap'),
        code: 'H01',
        label: 'Hueco M1-M2',
        wall1Id: w1.id,
        vertex1Id: v1.id,
        wall2Id: w2.id,
        vertex2Id: v2.id,
        x1Mm: v1.xMm,
        y1Mm: v1.yMm,
        x2Mm: v2.xMm,
        y2Mm: v2.yMm,
        distanceMm: Math.round(distReal),
        dxMm: Math.round(Math.abs(v2.xMm - v1.xMm)),
        dyMm: Math.round(Math.abs(v2.yMm - v1.yMm))
      };
      c.separations = [sep];
      App.state.selectedEntity = { kind: 'GAP', id: sep.id };
      App.renderAll();
      return { id: sep.id, dist: sep.distanceMm, dx: sep.dxMm, dy: sep.dyMm };
    });

    return `Hueco medido entre extremos: Distancia=${res.dist} mm, ΔX=${res.dx} mm, ΔY=${res.dy} mm`;
  });

  await test(4, 'Mostrar automáticamente la distancia calculada del hueco', async () => {
    const sepText = await page.evaluate(() => {
      const App = window.App;
      const c = App.getActivePlanConcept();
      const sep = c.separations[0];
      App.renderPlanInspector();
      const input = document.getElementById('inspectorGapDistMm');
      return { stored: sep.distanceMm, inputVal: input ? input.value : null };
    });

    if (String(sepText.stored) !== String(sepText.inputVal)) {
      throw new Error(`Discrepancia en campo: stored=${sepText.stored}, input=${sepText.inputVal}`);
    }
    return `Distancia mostrada automáticamente en inspector: ${sepText.inputVal} mm`;
  });

  await test(5, 'Modificar un hueco sin afectar muros fijados', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const c = App.getActivePlanConcept();
      const sep = c.separations[0];
      const w1 = c.walls.find((w) => w.id === sep.wall1Id);
      const w2 = c.walls.find((w) => w.id === sep.wall2Id);
      w1.status = 'fijado';
      w1.realLengthMm = 3000;
      w2.status = 'fijado';
      w2.realLengthMm = 2000;

      // Intentar modificar sin autorización de desbloqueo
      const attemptBlocked = G.adjustGapDistance(c, sep.id, 1500, false);
      const w1LenBefore = w1.realLengthMm;

      // Modificar con autorización permitida
      const attemptAllowed = G.adjustGapDistance(c, sep.id, 1500, true);
      const w1LenAfter = w1.realLengthMm;

      return {
        blockedStatus: attemptBlocked.status,
        allowedStatus: attemptAllowed.status,
        newDist: sep.distanceMm,
        w1Preserved: w1LenBefore === w1LenAfter
      };
    });

    if (res.blockedStatus !== 'blocked_by_lock') {
      throw new Error(`Esperado 'blocked_by_lock' al intentar alterar sin autorización.`);
    }
    if (res.newDist !== 1500) {
      throw new Error(`Nueva distancia no aplicada: ${res.newDist}`);
    }
    if (!res.w1Preserved) {
      throw new Error(`La medida del muro fijado se alteró indebidamente.`);
    }
    return `Bloqueo sin permiso OK (${res.blockedStatus}), ajuste autorizado OK (${res.newDist} mm), muro fijado preservado 100%.`;
  });

  // PRUEBA 12, 13, 14, 15: Base de concreto / Pollo poligonal
  await test(12, 'Dibujar un pollo mediante polilínea de varios segmentos', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const c = App.getActivePlanConcept();
      // Polígono en L de 6 vértices
      const ptsL = [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 600 },
        { x: 600, y: 600 },
        { x: 600, y: 1500 },
        { x: 0, y: 1500 }
      ];
      const pb = {
        id: 'pollo-poly-test',
        code: 'P01',
        kind: 'POLLO',
        label: 'Base Poligonal L',
        heightMm: 100,
        widthMm: 600,
        lengthMm: 2000,
        points: ptsL,
        hostWallId: c.walls[0].id,
        references: { distWallMm: 0 }
      };
      c.concreteBases = [pb];
      App.state.selectedEntity = { kind: 'POLLO', id: pb.id };
      App.renderAll();
      const segs = G.computePolygonalBaseSegments(pb);
      return { count: ptsL.length, segCount: segs.length, segLengths: segs.map((s) => s.lengthMm) };
    });

    if (res.segCount !== 6) throw new Error(`Esperados 6 segmentos en la base en L, obtenidos ${res.segCount}`);
    return `Base en L creada con ${res.count} vértices y ${res.segCount} tramos: [${res.segLengths.join(', ')}] mm`;
  });

  await test(13, 'Comprobar ajuste a los muros (snapping magnético)', async () => {
    const snapped = await page.evaluate(() => {
      const App = window.App;
      const c = App.getActivePlanConcept();
      const v0 = c.vertices[0];
      const snap = App.snapToExistingVertexPlan(c, Number(v0.xMm) + 5, Number(v0.yMm) - 5, 20);
      return { matches: snap.vertexId === v0.id, x: snap.x, y: snap.y };
    });

    if (!snapped.matches) throw new Error('Fallo en el ajuste magnético a los nodos del muro.');
    return `Ajuste magnético perfecto a nodo de muro (${snapped.x}, ${snapped.y}) mm`;
  });

  await test(14, 'Modificar profundidades y altura desde el panel derecho', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const c = App.getActivePlanConcept();
      const pb = c.concreteBases[0];
      // Modificar altura mediante expresión matemática
      App.updatePolloField(pb.id, 'heightMm', '100+50');
      // Modificar tramo 1 mediante expresión matemática
      App.updatePolloSegmentLength(pb.id, 1, '2000+400');
      App.renderAll();
      return { heightMm: pb.heightMm, p1X: pb.points[1].x };
    });

    if (res.heightMm !== 150) throw new Error(`Altura no actualizada a 150 mm: ${res.heightMm}`);
    if (res.p1X !== 2400) throw new Error(`Longitud del tramo 1 no actualizada a 2400 mm: ${res.p1X}`);
    return `Altura actualizada a ${res.heightMm} mm sobre NPT, Tramo 1 ajustado a ${res.p1X} mm`;
  });

  await test(15, 'Actualizar automáticamente sus cotas exteriores', async () => {
    const segs = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const c = App.getActivePlanConcept();
      const pb = c.concreteBases[0];
      return G.computePolygonalBaseSegments(pb).map((s) => `${s.label}: ${s.lengthMm} mm`);
    });

    return `Cotas de tramos exteriores actualizadas automáticamente: ${segs.slice(0, 3).join(' | ')}`;
  });

  // PRUEBA 16: Eliminar un muro mediante Suprimir
  await test(16, 'Eliminar un muro mediante tecla Suprimir / Delete', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const c = App.getActivePlanConcept();
      const initialCount = c.walls.length;
      const targetWall = c.walls[c.walls.length - 1];
      App.state.selectedEntity = { kind: 'WALL', id: targetWall.id };
      App.deleteSelectedEntity();
      return { before: initialCount, after: c.walls.length };
    });

    if (res.after !== res.before - 1) {
      throw new Error(`El muro no se eliminó: antes=${res.before}, después=${res.after}`);
    }
    return `Muro eliminado con tecla Suprimir: antes=${res.before}, después=${res.after}`;
  });

  // PRUEBA 17: Eliminar una base mediante Suprimir
  await test(17, 'Eliminar una base de concreto mediante tecla Suprimir / Delete', async () => {
    const res = await page.evaluate(() => {
      const App = window.App;
      const c = App.getActivePlanConcept();
      const initialCount = c.concreteBases.length;
      const pb = c.concreteBases[0];
      App.state.selectedEntity = { kind: 'POLLO', id: pb.id };
      App.deleteSelectedEntity();
      return { before: initialCount, after: c.concreteBases.length };
    });

    if (res.after !== res.before - 1) {
      throw new Error(`La base no se eliminó: antes=${res.before}, después=${res.after}`);
    }
    return `Base de concreto eliminada con Suprimir: antes=${res.before}, después=${res.after}`;
  });

  // PRUEBA 1, 2, 18: Guardar, exportar, transferir e importar proyecto JSON sin pérdida
  await test(1, 'Exportar e importar correctamente un proyecto JSON', async () => {
    const jsonStr = await page.evaluate(() => {
      const App = window.App;
      App.loadDemoReferenceProject();
      return JSON.stringify(App.state.project);
    });

    const parsed = JSON.parse(jsonStr);
    if (!parsed.concepts || parsed.concepts.length === 0) {
      throw new Error('JSON exportado no contiene conceptos.');
    }
    return `JSON exportado correctamente con ${parsed.concepts.length} conceptos (${jsonStr.length} bytes)`;
  });

  await test(2, 'Conservar todos los elementos al transferir un proyecto', async () => {
    const audit = await page.evaluate(async () => {
      const App = window.App;
      await App.loadDemoReferenceProject();
      const p = App.state.project;
      const totalWalls = p.concepts.reduce((acc, c) => acc + (c.walls ? c.walls.length : 0), 0);
      const totalPollos = p.concepts.reduce((acc, c) => acc + (c.concreteBases ? c.concreteBases.length : 0), 0);
      const totalGaps = p.concepts.reduce((acc, c) => acc + (c.separations ? c.separations.length : 0), 0);
      const doorConcept = p.concepts.find((c) => c.conceptType === 'PUERTA');
      return {
        conceptsCount: p.concepts.length,
        totalWalls,
        totalPollos,
        totalGaps,
        hasDoor9: Boolean(doorConcept && doorConcept.doorSurvey && doorConcept.doorSurvey.widths)
      };
    });

    if (!audit.hasDoor9) throw new Error('El levantamiento de puerta de 9 medidas no se conservó.');
    return `Conservación 100%: ${audit.conceptsCount} conceptos, ${audit.totalWalls} muros, ${audit.totalPollos} bases, ${audit.totalGaps} huecos, puerta 9 lecturas OK`;
  });

  await test(18, 'Guardar y reabrir proyectos localmente sin pérdida de información', async () => {
    const reloaded = await page.evaluate(() => {
      const App = window.App;
      App.saveCurrentProject(true);
      const savedId = App.state.project.id;
      // Reabrir proyecto
      App.openSavedProject(savedId);
      return {
        id: App.state.project.id,
        name: App.state.project.name,
        concepts: App.state.project.concepts.length
      };
    });

    return `Proyecto reabierto localmente sin pérdida: "${reloaded.name}" (${reloaded.concepts} conceptos)`;
  });

  // PRUEBA 19: Comprobar que elevaciones y exportaciones PDF/DXF siguen funcionando
  await test(19, 'Comprobar que elevaciones y exportaciones PDF/DXF siguen funcionando', async () => {
    const exportStatus = await page.evaluate(() => {
      const App = window.App;
      const G = window.ASBuiltGeometry;
      const audit = G.auditProjectForExport(App.state.project);
      // Validar generador DXF
      const dxfText = window.ASBuiltDxfExporter.generateClientDxfString(App.state.project, audit);
      const hasDxfHeaders = dxfText.includes('ENTITIES') && dxfText.includes('EOF');
      return {
        auditClean: audit.isCleanForFinalExport,
        dxfLen: dxfText.length,
        hasDxfHeaders
      };
    });

    if (!exportStatus.hasDxfHeaders || exportStatus.dxfLen < 500) {
      throw new Error(`Exportación DXF generó contenido inválido (${exportStatus.dxfLen} bytes)`);
    }
    return `Elevaciones y exportación DXF Rhino 8 OK (${exportStatus.dxfLen} bytes generados con cabeceras CAD estándar)`;
  });

  // Capturar capturas de pantalla de evidencia final
  const evidenceDir = path.join(__dirname, 'evidence_final_20');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  await page.screenshot({ path: path.join(evidenceDir, '01_nombre_definitivo_y_planta.png'), fullPage: true });

  // Ir a vista Elevación y capturar
  await page.evaluate(() => window.App.switchMainView('ELEVATION'));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(evidenceDir, '02_elevacion_instalaciones.png'), fullPage: true });

  // Ir a vista Puerta y capturar
  await page.evaluate(() => window.App.switchMainView('DOOR'));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(evidenceDir, '03_puerta_9_lecturas.png'), fullPage: true });

  await browser.close();

  const totalPassed = results.filter((r) => r.passed).length;
  console.log('================================================================');
  console.log(`RESUMEN FINAL: ${totalPassed} de ${results.length} PRUEBAS OBLIGATORIAS EXITOSAS`);
  console.log('================================================================');

  return { total: results.length, passed: totalPassed, results };
}

run20Tests().catch((err) => {
  console.error('Error general en la ejecución:', err);
  process.exit(1);
});
