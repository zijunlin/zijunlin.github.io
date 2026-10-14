// Run against a production preview with other tests idle; see tests/manual/README.md.
import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hardwareProblems, observeProductionBattle, productionGameBundle, readObservation, startObservation, workloadProblems } from '../helpers/game-performance.js';

const root = process.env.GAME_EVIDENCE_DIR || '/tmp/game-growth-evidence';
await mkdir(root, { recursive: true });
const output = await mkdtemp(join(root, 'run-'));
const report = { startedAt: new Date().toISOString(), output, phase: 'launch', valid: false, passed: false };
let browser, page;
const checkpoint = async () => writeFile(join(output, 'hardware-performance.json'), JSON.stringify(report, null, 2));
async function phase(name) {
  report.phase = name;
  console.log(JSON.stringify({ phase: name, output }));
  await checkpoint();
}
async function demonstrateMovement() {
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    await page.keyboard.down(key);
    try { await page.waitForTimeout(200); } finally { await page.keyboard.up(key); }
  }
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=50,50'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN', reducedMotion: 'no-preference' });
  page = await context.newPage();
  const system = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
  Object.assign(report, { browser: browser.version(), viewport: '1280x720', gpu: system.gpu,
    method: 'Production page; read-only battle observer; purpose-based spawn random source; real keyboard pickups; accelerated setup; native RAF preflight and measurement.' });
  await phase('handshake');
  let observerError;
  await page.route(productionGameBundle, async route => {
    try {
      const response = await route.fetch();
      const body = observeProductionBattle(await response.text());
      report.productionBundle = route.request().url();
      await route.fulfill({ response, body });
    } catch (error) { observerError = String(error); await route.abort(); }
  });
  await page.addInitScript(() => {
    window.nativeRAF = requestAnimationFrame.bind(window);
    window.setup = true;
    window.measureMode = false;
    window.backgroundDraws = 0;
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.id === 'shader-canvas') window.backgroundDraws++;
      return draw.apply(this, args);
    };
    let origin;
    window.requestAnimationFrame = callback => window.nativeRAF(now => {
      origin ??= now;
      callback(window.setup ? origin + (now - origin) * 6 : now);
    });
    window.pickupHistory = [];
    let lastCount = 2, held = new Set();
    window.driveKeys = (x, y) => {
      const desired = new Set();
      if (x < 0) desired.add('ArrowLeft');
      if (x > 0) desired.add('ArrowRight');
      if (y < 0) desired.add('ArrowUp');
      if (y > 0) desired.add('ArrowDown');
      for (const key of held) if (!desired.has(key)) window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      for (const key of desired) if (!held.has(key)) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      held = desired;
    };
    const control = () => {
      const s = window.measureMode ? null : window.battleSnapshot;
      if (s) {
        if (s.trajectoryCount !== lastCount) {
          window.pickupHistory.push({ seconds: s.seconds, count: s.trajectoryCount });
          lastCount = s.trajectoryCount;
        }
        const drop = window.settle ? null : s.resources[0];
        const target = drop ? { x: drop.x, y: drop.y + 65 } : { x: 640, y: innerHeight - 85 };
        const sign = n => Math.abs(n) < 15 ? 0 : Math.sign(n);
        window.driveKeys(sign(target.x - s.ship.x), sign(target.y - s.ship.y));
      }
      window.nativeRAF(control);
    };
    window.nativeRAF(control);
  });
  report.url = process.env.GAME_PERF_URL || 'http://127.0.0.1:4184/?seed=0';
  await page.goto(report.url);
  await page.bringToFront();
  try { await page.waitForFunction(() => window.battleSnapshot, null, { timeout: 45000 }); }
  catch (error) { throw new Error(observerError || `Production observer handshake failed: ${error}`); }
  report.renderer = await page.evaluate(() => {
    const gl = document.querySelector('#shader-canvas')?.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
  const hardware = hardwareProblems(report.renderer, system.gpu);
  if (hardware.length) throw new Error(hardware.join('; '));

  await phase('setup');
  await page.waitForFunction(() => window.battleSnapshot.ended || (
    window.battleSnapshot.trajectoryCount === 24 && window.battleSnapshot.fireInterval === .11 &&
    window.battleSnapshot.piercing && window.battleSnapshot.ship.movementSpeed === 690
  ), null, { timeout: 180000, polling: 500 });
  report.setup = await page.evaluate(() => ({ state: window.battleSnapshot, pickups: window.pickupHistory }));
  if (report.setup.state.ended) throw new Error('Legitimate pickup setup ended before maximum growth');

  await phase('native-clock');
  await page.evaluate(() => window.settle = true);
  await page.waitForFunction(() => Math.abs(window.battleSnapshot.ship.x - 640) < 15 && Math.abs(window.battleSnapshot.ship.y - (innerHeight - 85)) < 15, null, { timeout: 10000 });
  await page.keyboard.press('p');
  await page.evaluate(() => {
    window.driveKeys(0, 0); window.setup = false; window.measureMode = true;
    window.requestAnimationFrame = window.nativeRAF;
    // Use the existing visibility lifecycle to reset clocks after accelerated setup.
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.bringToFront();

  await phase('preflight');
  await page.evaluate(startObservation, 12000);
  await demonstrateMovement();
  await page.waitForFunction(() => window.measurement.done || window.measurement.interrupted || window.measurement.ended, null, { timeout: 15000 });
  report.preflight = await page.evaluate(readObservation);
  const preflightProblems = workloadProblems(report.preflight);
  if (preflightProblems.length) throw new Error(`Preflight failed: ${preflightProblems.join('; ')}`);
  report.preflightPassed = true;
  await checkpoint();
  if (process.argv.includes('--preflight-only')) {
    // Deliberately not a performance pass.
    await phase('preflight-complete');
  } else {
    await phase('measurement');
    await page.evaluate(startObservation, 180000);
    await demonstrateMovement();
    await page.waitForFunction(() => window.measurement.done || window.measurement.interrupted || window.measurement.ended, null, { timeout: 185000, polling: 1000 });
    report.measurement = await page.evaluate(readObservation);
    const problems = workloadProblems(report.measurement, { final: true });
    report.valid = problems.length === 0;
    report.passed = report.valid && report.measurement.within25ms >= .95;
    if (!report.passed) throw new Error(problems.join('; ') || 'Less than 95% of frames within 25 ms');
    await phase('complete');
  }
  await page.screenshot({ path: join(output, 'max-growth.png') });
} catch (error) {
  report.error = String(error); report.passed = false; process.exitCode = 1;
  if (page) {
    report.lastState = await page.evaluate(() => window.battleSnapshot).catch(() => null);
    await page.screenshot({ path: join(output, 'diagnostic.png') }).catch(() => {});
  }
} finally {
  await checkpoint();
  console.log(JSON.stringify({ output, phase: report.phase, valid: report.valid, passed: report.passed, preflightPassed: report.preflightPassed, error: report.error }));
  await browser?.close();
}
