import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

// Compare average channel intensity, allowing rasterization noise rather than
// requiring exact pixels or a golden screenshot of the artwork.
function imageDifference(first, second) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  let difference = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      difference += Math.abs(a.data[i + channel] - b.data[i + channel]);
    }
  }
  return difference / (a.width * a.height * 3);
}

test('the built homepage displays a moving decorative background', async ({ page }) => {
  await page.goto('/?seed=514018');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const first = await canvas.screenshot();
  await page.waitForTimeout(1500);
  expect(imageDifference(first, await canvas.screenshot())).toBeGreaterThan(0.02);
  await expect(page.getByRole('navigation', { name: '主目录' })).toBeVisible();
  expect(await canvas.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none');
});

for (const failure of ['unavailable', 'throws', 'compile', 'link']) {
  test(`the homepage stays readable with a static gradient when WebGL ${failure}`, async ({ page }) => {
    await page.addInitScript(mode => {
      if (mode === 'compile') {
        WebGLRenderingContext.prototype.getShaderParameter = () => false;
      } else if (mode === 'link') {
        WebGLRenderingContext.prototype.getProgramParameter = () => false;
      } else {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          if (type === 'webgl') {
            if (mode === 'throws') throw new Error('Unavailable');
            return null;
          }
          return original.call(this, type, ...args);
        };
      }
    }, failure);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('canvas')).toBeHidden();
    await expect(page.getByRole('navigation', { name: '主目录' })).toBeVisible();
    expect(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundImage)).toContain('radial-gradient');
    const first = await page.screenshot({ animations: 'disabled' });
    await page.waitForTimeout(300);
    expect(imageDifference(first, await page.screenshot({ animations: 'disabled' }))).toBeLessThan(0.05);
    expect(errors).toEqual([]);
  });
}

test('fixed entry seeds reproduce the visible field and different seeds vary it', async ({ browser }) => {
  async function capture(seed) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
    await page.goto(`http://127.0.0.1:4173/?seed=${seed}`);
    await page.clock.runFor(100);
    await expect(page.locator('canvas')).toBeVisible();
    const result = await page.locator('canvas').screenshot({ animations: 'disabled' });
    await page.close();
    return result;
  }
  const first = await capture(514018);
  expect(imageDifference(first, await capture(514018))).toBeLessThan(0.05);
  expect(imageDifference(first, await capture(123456))).toBeGreaterThan(1);
});

async function controlVisibility(page) {
  await page.addInitScript(() => {
    let hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
    window.setPageHidden = value => {
      hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
}

test('hidden pages pause and resume the existing background without another entrance', async ({ page }) => {
  await controlVisibility(page);
  await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
  await page.goto('/?seed=514018');
  await page.clock.runFor(1000);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-motion', 'running');
  const before = await canvas.screenshot({ animations: 'disabled' });
  await page.evaluate(() => window.setPageHidden(true));
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
  await page.clock.runFor(60000);
  expect(imageDifference(before, await canvas.screenshot({ animations: 'disabled' }))).toBeLessThan(0.05);
  const heading = page.getByRole('heading', { name: '在构建中，保持好奇。' });
  const position = await heading.boundingBox();
  await page.evaluate(() => window.setPageHidden(false));
  await expect(canvas).toHaveAttribute('data-motion', 'running');
  await page.clock.runFor(50);
  expect((await heading.boundingBox()).y).toBeCloseTo(position.y, 1);
  expect(imageDifference(before, await canvas.screenshot({ animations: 'disabled' }))).toBeLessThan(0.05);
  await page.clock.runFor(2000);
  expect(imageDifference(before, await canvas.screenshot({ animations: 'disabled' }))).toBeGreaterThan(0.02);
  expect((await heading.boundingBox()).y).toBeCloseTo(position.y, 1);
  await expect(page.getByRole('status')).toBeHidden();
});

test('reload retains the entry variation even when the local clock changes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
  await page.goto('/');
  await page.clock.runFor(100);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const original = await canvas.screenshot({ animations: 'disabled' });
  await page.clock.setFixedTime(new Date('2026-10-05T18:00:00Z'));
  await page.reload();
  await page.clock.runFor(100);
  await expect(canvas).toBeVisible();
  expect(imageDifference(original, await canvas.screenshot({ animations: 'disabled' }))).toBeLessThan(0.05);
});

test('a static fallback remains static through repeated visibility changes', async ({ page }) => {
  await controlVisibility(page);
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const hidden of [true, false, true, false]) {
    await page.evaluate(value => window.setPageHidden(value), hidden);
  }
  await expect(page.locator('canvas')).toBeHidden();
  await expect(page.locator('canvas')).toHaveAttribute('data-motion', 'static');
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('entry and visibility changes stay silent', async ({ page }) => {
  await controlVisibility(page);
  await page.addInitScript(() => {
    window.audioStarts = 0;
    for (const name of ['AudioContext', 'webkitAudioContext', 'Audio']) {
      if (!window[name]) continue;
      window[name] = new Proxy(window[name], {
        construct(target, args) {
          window.audioStarts++;
          return Reflect.construct(target, args);
        },
      });
    }
  });
  const mediaRequests = [];
  page.on('request', request => {
    if (request.resourceType() === 'media') mediaRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
  await page.evaluate(() => window.setPageHidden(true));
  await page.evaluate(() => window.setPageHidden(false));
  await page.waitForTimeout(500);
  await expect(page.locator('audio, video')).toHaveCount(0);
  expect(await page.evaluate(() => window.audioStarts)).toBe(0);
  expect(mediaRequests).toEqual([]);
});
