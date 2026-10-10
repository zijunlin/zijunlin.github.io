// Real-clock, headed Chrome measurements. Run after the normal test suite is idle.
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const mode = process.argv[2] || 'performance';
const output = '.scratch/home-space-game-build';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=50,50'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' });
const page = await context.newPage();
try {
  const system = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
  const gpu = { devices: system.gpu.devices.map(({ deviceString, vendorString }) => ({ deviceString, vendorString })), features: system.gpu.featureStatus };
  console.log(JSON.stringify({ browser: browser.version(), gpu }));
  if (mode === 'load') {
    const samples = [];
    for (let round = 0; round < 6; round++) for (const [name, port] of [['before', 4174], ['after', 4175]]) {
      const cdp = await context.newCDPSession(page); await cdp.send('Network.clearBrowserCache'); await cdp.detach();
      await page.goto(`http://127.0.0.1:${port}/?seed=0`);
      await page.locator('#world-entry').waitFor({ state: 'visible' });
      const sample = await page.evaluate(() => ({ readyMs: performance.now(), domMs: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd, resources: performance.getEntriesByType('resource').map(({ name, encodedBodySize }) => ({ name: new URL(name).pathname, bytes: encodedBodySize })) }));
      samples.push({ name, round, ...sample });
    }
    await writeFile(`${output}/load-comparison.json`, JSON.stringify({ browser: browser.version(), viewport: '1280x720', gpu, samples }, null, 2));
    console.log('load comparison saved');
  } else {
    if (JSON.stringify(gpu).match(/swiftshader|llvmpipe/i) || gpu.features.gpu_compositing !== 'enabled') throw new Error('Hardware acceleration unavailable: measurement is not valid');
    // Deterministic medium obstacles from the top keep the three-minute run uninterrupted.
    // Combat rules, collisions, shooting, difficulty, background and trails are unchanged.
    await page.addInitScript(() => {
      Math.random = () => .5;
      window.backgroundDraws = 0;
      const draw = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas.id === 'shader-canvas') window.backgroundDraws++;
        return draw.apply(this, args);
      };
    });
    await page.goto('http://127.0.0.1:4175/?seed=0'); await page.bringToFront();
    await page.getByText('正在集结', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByText('星际生存', { exact: true }).waitFor();
    await page.evaluate(() => {
      window.measurement = { intervals: [], interrupted: false, start: performance.now(), backgroundStart: window.backgroundDraws };
      let previous;
      function measure(now) {
        if (previous) window.measurement.intervals.push(now - previous);
        previous = now;
        if (document.hidden || !document.hasFocus() || document.querySelector('.game-modal[open]')) window.measurement.interrupted = true;
        if (now - window.measurement.start < 180000) requestAnimationFrame(measure);
        else window.measurement.done = true;
      }
      requestAnimationFrame(measure);
    });
    for (let part = 0; part < 6; part++) {
      await page.waitForTimeout(30000);
      console.log(JSON.stringify(await page.evaluate(() => ({ seconds: (performance.now() - window.measurement.start) / 1000, frames: window.measurement.intervals.length, interrupted: window.measurement.interrupted, score: document.querySelector('.game-score')?.textContent }))));
    }
    const result = await page.evaluate(() => {
      const { intervals, interrupted, done } = window.measurement;
      const sorted = [...intervals].sort((a, b) => a - b);
      return { frames: intervals.length, seconds: intervals.reduce((a, b) => a + b, 0) / 1000, fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length), within25ms: intervals.filter(n => n <= 25).length / intervals.length, p95ms: sorted[Math.floor(sorted.length * .95)], interrupted, done, score: document.querySelector('.game-score')?.textContent, backgroundVisible: !document.querySelector('#shader-canvas').hidden, backgroundDraws: window.backgroundDraws - window.measurement.backgroundStart, webglRenderer: (() => { const gl = document.querySelector('#shader-canvas').getContext('webgl'); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null; })(), screen: { width: screen.width, height: screen.height, windowX: window.screenX, windowY: window.screenY, devicePixelRatio }, visibility: document.visibilityState };
    });
    result.valid = Boolean(result.done && !result.interrupted && result.seconds >= 179.5 && result.backgroundDraws >= 1000 && result.webglRenderer && !/swiftshader|llvmpipe|software/i.test(result.webglRenderer));
    result.passed = result.valid && result.within25ms >= .95;
    await page.screenshot({ path: `${output}/hardware-combat.png` });
    await writeFile(`${output}/hardware-performance.json`, JSON.stringify({ browser: browser.version(), viewport: '1280x720', gpu, workload: 'Constant random 0.5, medium obstacles from top, default shooting/collision/difficulty; no invulnerability; background and trails enabled.', ...result }, null, 2));
    console.log(JSON.stringify(result));
    if (!result.done || result.interrupted || result.seconds < 179.5 || result.backgroundDraws < 1000) throw new Error('Invalid or interrupted hardware measurement; see diagnostic report');
    if (result.within25ms < .95) throw new Error('Hardware frame interval target not met; see report');
  }
} finally { await browser.close(); }
