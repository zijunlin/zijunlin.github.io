import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 120000 });

for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`all four combinations fit a ${viewport.width}×${viewport.height} viewport with a reading safe band`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Geometry and layout checks use the real WebGL 2 renderer with a static backdrop.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl' ? null : original.call(this, type, ...args);
      };
    });
    let previous;
    for (const [form, seed] of [['island', 0], ['island', 4], ['system', 2], ['system', 3]]) {
      await page.goto(`/?world=${form}&seed=${seed}`);
      const image = page.getByRole('img', { name: form === 'island' ? '层叠曲面小岛' : '层叠曲面系统空间' });
      await expect(image).toBeVisible({ timeout: 15000 });
      // End the approved entrance before comparing stable layout bounds.
      await image.screenshot({ animations: 'disabled' });
      const frame = await image.boundingBox();
      const content = await page.getByRole('main').boundingBox();
      const safeWidth = viewport.width <= 1050 ? 280 : 310;
      expect(frame.x + frame.width).toBeLessThanOrEqual(content.x + content.width - safeWidth - 28 + 1);
      expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height);
      if (previous) {
        expect(frame.width).toBeCloseTo(previous.width, 0);
        expect(frame.height).toBeCloseTo(previous.height, 0);
      }
      previous = frame;
      const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
      const boxes = [];
      for (const link of await world.getByRole('link').all()) {
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThan(76);
        expect(box.x + box.width).toBeLessThan(content.x + content.width - safeWidth);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        for (const other of boxes) {
          const overlaps = box.x < other.x + other.width && box.x + box.width > other.x && box.y < other.y + other.height && box.y + box.height > other.y;
          expect(overlaps).toBe(false);
        }
        boxes.push(box);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

