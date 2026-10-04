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
