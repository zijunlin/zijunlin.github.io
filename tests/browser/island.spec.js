import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

// Software GPU shader compilation may take longer than a normal DOM update.
test.describe.configure({ timeout: 60000 });

for (const [seed, layout] of [[0, '环绕核心'], [4, '成长路径']]) {
  test(`the island presents four regions and direct featured work in ${layout}`, async ({ page }) => {
    await page.goto(`/?world=island&seed=${seed}`);
    const island = page.getByRole('region', { name: `建筑地形小岛 · ${layout}` });
    await expect(island).toBeVisible({ timeout: 15000 });
    const picture = island.getByRole('img', { name: '层叠曲面小岛' });
    await expect(picture).toBeVisible();
    const pixels = PNG.sync.read(await picture.screenshot({ animations: 'disabled' }));
    let stonePixels = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i] > 120 && pixels.data[i + 1] > 120 && pixels.data[i + 2] > 110) stonePixels++;
    }
    // A blank/failed canvas with labels alone cannot satisfy this broad visual
    // signal. Artistic approval comes from inspection, not golden pixels.
    expect(stonePixels / (pixels.width * pixels.height)).toBeGreaterThan(0.01);
    for (const name of ['关于我', '职业历程', '作品集', '随笔']) {
      await expect(island.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const featured = island.getByRole('link', { name: '精选作品 · 智能语音平台' });
    await expect(featured).toHaveAttribute('href', '#work/platform');
    await featured.click();
    await expect(page).toHaveURL(/#work\/platform$/);
  });
}

for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`both layouts fit a ${viewport.width}×${viewport.height} viewport with a reading safe band`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let previous;
    for (const seed of [0, 4]) {
      await page.goto(`/?world=island&seed=${seed}`);
      const image = page.getByRole('img', { name: '层叠曲面小岛' });
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
      const island = page.getByRole('region', { name: /建筑地形小岛/ });
      const boxes = [];
      for (const link of await island.getByRole('link').all()) {
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

test('world capability failure keeps the chosen state and navigation readable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/?world=island&seed=0');
  await expect(page.getByText('当前浏览器暂时无法显示小岛世界。请尝试支持 WebGL 2 的浏览器。')).toBeVisible();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('建筑地形小岛 · 环绕核心');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
});
