const path = require('path');
const fs = require('fs');
const tempDir = process.env.TEMP || process.env.TMP || 'C:\\Users\\Luis\\AppData\\Local\\Temp';
const puppeteer = require(path.join(tempDir, 'node_modules', 'puppeteer-core'));

async function main() {
  console.log('Iniciando prueba automatizada con Chrome en localhost:3120...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 1 });

  page.on('console', (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  await page.goto('http://localhost:3120', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => typeof window.run15MandatoryTests === 'function');

  console.log('Ejecutando suite de 15 pruebas obligatorias...');
  const testOutput = await page.evaluate(async () => {
    return await window.run15MandatoryTests();
  });

  console.log('\n--- REPORTE DE RESULTADOS ---');
  if (testOutput.results) {
    for (const r of testOutput.results) {
      console.log(`[PRUEBA ${r.testNum}] ${r.name}: ${r.passed ? 'PASS' : 'FAIL'} (${r.detail})`);
    }
  }
  console.log(`\nTODAS LAS PRUEBAS PASARON: ${testOutput.allPassed ? 'SÍ (15/15)' : 'NO'}`);

  // Capturar evidencias visuales
  const screenshotsDir = path.join(__dirname, 'evidence_screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Screenshot en vista PC Desktop
  await page.evaluate(() => {
    App.switchMainView('PLAN');
    App.fitPlanToScreen();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotsDir, 'evidencia_01_desktop_planta_cotas_cad.png'), fullPage: true });

  // 2. Screenshot en vista Tablet iPad (820x1180)
  await page.setViewport({ width: 820, height: 1180, isMobile: true, hasTouch: true });
  await page.evaluate(() => {
    App.setPlanTool('CHAINED');
    App.state.chainedPoints = [
      { x: 0, y: 0 }, { x: 1800, y: 0 }, { x: 1800, y: 1500 }
    ];
    App.updateDrawingActionButtons();
    App.renderAll();
    App.fitPlanToScreen();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotsDir, 'evidencia_02_tablet_ipad_chained_actions.png'), fullPage: true });

  // 3. Screenshot con editor inline activo sobre cota
  await page.evaluate(() => {
    App.loadDemoReferenceProject();
    App.switchMainView('PLAN');
    App.openInlineDimensionEditor(App.state.project.concepts[0].walls[0].id, 450, 320);
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotsDir, 'evidencia_03_editor_inline_cota.png'), fullPage: true });

  await browser.close();
  console.log('Pruebas concluidas y capturas generadas.');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
