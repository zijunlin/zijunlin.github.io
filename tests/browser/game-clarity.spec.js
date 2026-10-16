import { observeGameDrawing, drawnShipBox } from '../helpers/game-drawing.js';
test.beforeEach(async ({ page }) => { await page.addInitScript(observeGameDrawing); });
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

function cockpitPixels(buffer) {
  const { data } = PNG.sync.read(buffer);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 220 && data[i + 1] > 248 && data[i + 2] > 248) count++;
  }
  return count;
}

for (const [width, height, deviceScaleFactor] of [[1280, 800, 1], [1280, 800, 2], [1280, 800, 3], [390, 844, 3]]) {
  test.describe(`${width}x${height} DPR ${deviceScaleFactor}`, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor });
    test('moving cockpit retains detail at multiple pixel positions', async ({ page }, info) => {
      test.setTimeout(90000);
      await page.addInitScript(() => {
        Math.random = () => .5;
      });
      const time = new Date('2026-10-14T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      await page.goto('/?seed=0');
      await expect(page.locator('#world-entry')).toBeVisible();
      await page.keyboard.press('Shift+G');
      await expect(page.locator('.space-game')).toBeVisible();
      await page.clock.runFor(3300);
      const scale = width >= 800 && height >= 600 ? 1 : .5;
      // Independent reference: only physical pixels fully inside the approved
      // 2.2 × 4.95 cockpit rectangle must retain its bright interior. Fractional
      // edge coverage is not the same thing as geometric area, especially mobile.
      let actual = 0, reference = 0, softened = 0;
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp']) {
        await page.keyboard.down(key);
        await page.clock.runFor(240);
        for (let phase = 0; phase < 3; phase++) {
          await page.clock.runFor(16);
          const box = await drawnShipBox(page);
          const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width) + 1, height: Math.ceil(box.height) + 1 };
          const rendered = await page.screenshot({ clip });
          actual += cockpitPixels(rendered);
          const left = (box.x + 12.1 * scale) * deviceScaleFactor;
          const top = (box.y + 13.2 * scale) * deviceScaleFactor;
          const interior = (Math.floor(left + 2.2 * scale * deviceScaleFactor) - Math.ceil(left))
            * (Math.floor(top + 4.95 * scale * deviceScaleFactor) - Math.ceil(top));
          reference += interior;
          // Negative control: a visible one-CSS-pixel blur must fail this same
          // detail criterion. This does not alter the production renderer.
          const blurred = await page.addStyleTag({ content: '#shader-canvas { filter: blur(1px); }' });
          softened += cockpitPixels(await page.screenshot({ clip }));
          await blurred.evaluate(node => node.remove());
          expect(box.x * deviceScaleFactor).toBeCloseTo(Math.round(box.x * deviceScaleFactor), 5);
          expect(box.y * deviceScaleFactor).toBeCloseTo(Math.round(box.y * deviceScaleFactor), 5);
          if (phase === 0) await info.attach(key, { body: rendered, contentType: 'image/png' });
        }
        await page.keyboard.up(key);
      }
      expect(reference).toBeGreaterThan(0);
      expect(actual / reference, 'bright pixels fully inside the approved cockpit rectangle').toBeGreaterThanOrEqual(.9);
      expect(softened / reference, 'negative control detects visibly softened cockpit detail').toBeLessThan(.9);
    });
  });
}
