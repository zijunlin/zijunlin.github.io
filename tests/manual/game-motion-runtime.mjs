// Native-clock production measurement. See the local tests/manual/README.md.
import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { hardwareProblems, productionGameBundle } from '../helpers/game-performance.js';
import { observeMotionBattle, observeMotionDrawing, collectMotion, summarizeMotion, summarizePresentation } from '../helpers/game-motion.js';

const preflight = process.argv.includes('--preflight-only');
const durationMs = preflight ? 1000 : 10000, rounds = preflight ? 1 : 3;
const root = resolve(process.env.GAME_EVIDENCE_DIR || '/tmp/game-motion-evidence');
await mkdir(root, { recursive: true });
const output = await mkdtemp(join(root, 'run-'));
const refreshHz = Number(process.env.MOTION_REFRESH_HZ || 60);
if (!(refreshHz > 0)) throw new Error('MOTION_REFRESH_HZ must be positive');
const report = { startedAt: new Date().toISOString(), output, preflight, valid: false,
  url: process.env.GAME_PERF_URL || 'http://127.0.0.1:4186/?seed=0', durationMs, rounds,
  viewport: { width: 1280, height: 720 }, dpr: 1, reducedMotion: 'no-preference', background: true,
  refreshHz, refreshBudgetSource: process.env.MOTION_REFRESH_HZ ? 'explicit environment setting' : 'configured 60 Hz reference, not a detected display capability',
  input: 'Trusted arrow key events, direction reversals every 600 ms; new run for each sample; all raw frames retained, including no displacement',
  random: { type: .9, side: 0, position: 0, heading: .5, speed: 0, fast: .5 },
  scope: 'Ordinary initial-growth battle with controlled upper-left spawns. Does not replace full-growth workload or user dynamic clarity evaluation.',
  device: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, cores: cpus().length, memoryBytes: totalmem() }, samples: [] };
let browser, page, client, tracing = false;
report.tooling = Object.fromEntries(await Promise.all([
  new URL(import.meta.url), new URL('../helpers/game-motion.js', import.meta.url), new URL('../helpers/game-performance.js', import.meta.url),
].map(async url => [url.pathname, createHash('sha256').update(await readFile(url)).digest('hex')])));
const checkpoint = () => writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
async function stopTrace(path) {
  const completed = new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.end'); tracing = false;
  const { stream } = await completed;
  let content = '', eof = false;
  while (!eof) { const chunk = await client.send('IO.read', { handle: stream }); content += chunk.data; eof = chunk.eof; }
  await client.send('IO.close', { handle: stream });
  await writeFile(path, content);
  const events = JSON.parse(content).traceEvents, counts = {};
  for (const event of events) if (/Frame|Present|Pipeline/.test(event.name)) counts[event.name] = (counts[event.name] || 0) + 1;
  return { path, counts, presentation: summarizePresentation(events) };
}
async function releaseKeys() { for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.up(key); }
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=50,50'] });
  report.browser = browser.version();
  report.gpu = (await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu;
  const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: report.reducedMotion });
  page = await context.newPage(); client = await context.newCDPSession(page);
  await client.send('Performance.enable');
  let observerError;
  await page.route(productionGameBundle, async route => {
    try {
      const response = await route.fetch(), source = await response.text();
      report.bundle = { url: route.request().url(), sha256: createHash('sha256').update(source).digest('hex') };
      await route.fulfill({ response, body: observeMotionBattle(source) });
    } catch (error) { observerError = String(error); await route.abort(); }
  });
  await page.addInitScript(observeMotionDrawing);
  await page.goto(report.url); await page.bringToFront();
  await page.locator('.celestial-gate').first().waitFor();
  report.environment = await page.evaluate(() => {
    const gl = document.querySelector('#shader-canvas')?.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
      dpr: devicePixelRatio, userAgent: navigator.userAgent, screen: [screen.width, screen.height], viewport: [innerWidth, innerHeight], focused: document.hasFocus() };
  });
  const problems = hardwareProblems(report.environment.renderer, report.gpu);
  if (problems.length) throw new Error(problems.join('; '));
  await page.keyboard.press('Shift+G');
  await page.waitForFunction(() => window.motionState, null, { timeout: 15000 }).catch(error => { throw new Error(observerError || String(error)); });
  for (let round = 1; round <= rounds; round++) for (const mode of ['stationary', 'horizontal', 'vertical', 'diagonal']) {
    const id = `${round}-${mode}`;
    console.log(JSON.stringify({ phase: 'sampling', id, output }));
    if (report.samples.length) {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '再来一局', exact: true }).click();
      await page.waitForFunction(() => window.motionState && window.motionState.seconds < 1 && !window.motionState.ended && !window.motionState.paused);
    }
    await releaseKeys();
    const beforeMetrics = await client.send('Performance.getMetrics');
    await client.send('Tracing.start', { categories: 'benchmark,disabled-by-default-devtools.timeline.frame,blink.user_timing', transferMode: 'ReturnAsStream' }); tracing = true;
    const measurement = page.evaluate(collectMotion, { durationMs });
    // Attach rejection handling immediately while keyboard input runs.
    const measured = measurement.then(value => ({ value }), error => ({ error: String(error) }));
    const start = performance.now();
    let direction = 1;
    while (performance.now() - start < durationMs) {
      await releaseKeys();
      if (mode === 'horizontal' || mode === 'diagonal') await page.keyboard.down(direction > 0 ? 'ArrowLeft' : 'ArrowRight');
      if (mode === 'vertical' || mode === 'diagonal') await page.keyboard.down(direction > 0 ? 'ArrowUp' : 'ArrowDown');
      await new Promise(resolve => setTimeout(resolve, Math.min(600, Math.max(0, durationMs - (performance.now() - start)))));
      direction *= -1;
    }
    await releaseKeys();
    let timeout;
    const result = await Promise.race([measured, new Promise(resolve => {
      timeout = setTimeout(() => resolve({ error: 'Native frame sampling did not finish within the visibility/focus deadline' }), 15000);
    })]);
    clearTimeout(timeout);
    if (result.error) throw new Error(result.error);
    const data = result.value;
    const trace = await stopTrace(join(output, `${id}-trace.json`));
    const afterMetrics = await client.send('Performance.getMetrics');
    await writeFile(join(output, `${id}-frames.json`), JSON.stringify(data));
    const metrics = summarizeMotion(data.frames, 1000 / refreshHz);
    const selected = mode === 'stationary' ? metrics.stationary : metrics.moving;
    const sampleProblems = [];
    if (data.error) sampleProblems.push(data.error);
    if (!trace.presentation.available) sampleProblems.push('browser presentation sample markers absent');
    if (data.ended) sampleProblems.push('battle ended');
    if (selected.seconds < durationMs / 1000 * .95) sampleProblems.push('less than 95% of intended active sampling duration');
    if (data.frames.some(f => f.speed !== 390)) sampleProblems.push('ship speed changed from initial 390');
    if (metrics.classifications.paused || metrics.classifications.unfocused || metrics.classifications.hidden) sampleProblems.push('sample interrupted by pause/focus/visibility');
    const durationMetrics = Object.fromEntries(afterMetrics.metrics.filter(m => /Duration$/.test(m.name)).map(m => [m.name, m.value - (beforeMetrics.metrics.find(n => n.name === m.name)?.value || 0)]));
    report.samples.push({ id, mode, round, metrics, trace, cpuSeconds: durationMetrics,
      gpuDuration: null, gpuDurationReason: 'No reliable per-process GPU duration is exposed by this runner; not zero.',
      memory: afterMetrics.metrics.filter(m => /JSHeap|Nodes|Documents|JSEventListeners/.test(m.name)),
      samplerCostMs: data.frames.reduce((sum, f) => sum + f.sampleCostMs, 0),
      initialSpeed: data.initialSpeed, finalSpeed: data.finalSpeed, problems: sampleProblems, valid: sampleProblems.length === 0 });
    await checkpoint();
    if (sampleProblems.length) throw new Error(`${id}: ${sampleProblems.join('; ')}`);
  }
  report.preflightPassed = preflight;
  report.valid = !preflight && report.samples.length === 12 && report.samples.every(s => s.valid);
  await page.keyboard.press('p');
  await page.screenshot({ path: join(output, 'end-paused.png') });
} catch (error) {
  report.error = String(error); process.exitCode = 1;
  if (page) {
    await releaseKeys().catch(() => {});
    report.lastState = await page.evaluate(() => window.motionState).catch(() => null);
    await page.screenshot({ path: join(output, 'diagnostic.png') }).catch(() => {});
  }
} finally {
  if (tracing) report.incompleteTrace = await stopTrace(join(output, 'incomplete-trace.json')).catch(error => ({ error: String(error) }));
  report.finishedAt = new Date().toISOString();
  await checkpoint();
  await browser?.close();
  console.log(JSON.stringify({ output, valid: report.valid, preflightPassed: report.preflightPassed, error: report.error }));
}
