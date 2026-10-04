import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { imageDifference } from '../helpers/image-difference.mjs';

test.describe.configure({ timeout: 60000 });

for (const [seed, layout] of [[2, '环绕核心'], [3, '成长路径']]) {
  test(`system space renders four content regions in ${layout}`, async ({ page }) => {
    await page.goto(`/?world=system&seed=${seed}`);
    const world = page.getByRole('region', { name: `抽象系统空间 · ${layout}` });
    await expect(world).toBeVisible();
    const image = world.getByRole('img', { name: '层叠曲面系统空间' });
    await expect(image).toBeVisible();
    await expect(image).toHaveAccessibleDescription('身份节点、环形时间总线、同轴核心模块与空闲实验区。');
    const pixels = PNG.sync.read(await image.screenshot({ animations: 'disabled' }));
    let ceramicPixels = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i] > 120 && pixels.data[i + 1] > 120 && pixels.data[i + 2] > 110) ceramicPixels++;
    }
    expect(ceramicPixels / (pixels.width * pixels.height)).toBeGreaterThan(0.005);
    for (const name of ['关于我', '职业历程', '作品集', '随笔']) {
      await expect(world.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(world.getByRole('link', { name: '精选作品 · 智能语音平台' })).toHaveAttribute('href', '#work/platform');
  });
}

for (const seed of [0, 4]) {
  test(`world forms have distinct visible geometry and matching entrances for seed ${seed}`, async ({ page }) => {
    // Keep the backdrop static to compare the foreground forms only.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl' ? null : original.call(this, type, ...args);
      };
    });
    const captures = [];
    const positions = [];
    for (const form of ['island', 'system']) {
      await page.goto(`/?world=${form}&seed=${seed}`);
      const picture = page.getByRole('img', { name: form === 'island' ? '层叠曲面小岛' : '层叠曲面系统空间' });
      await expect(picture).toBeVisible();
      captures.push(await picture.screenshot({ animations: 'disabled' }));
      const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
      const boxes = [];
      for (const name of ['关于我', '职业历程', '作品集', '随笔', '精选作品 · 智能语音平台']) {
        boxes.push(await world.getByRole('link', { name, exact: true }).boundingBox());
      }
      positions.push(boxes);
    }
    expect(imageDifference(...captures)).toBeGreaterThan(1);
    for (let i = 0; i < positions[0].length; i++) {
      for (const axis of ['x', 'y', 'width', 'height']) {
        expect(positions[0][i][axis]).toBeCloseTo(positions[1][i][axis], 0);
      }
    }
  });
}

test('system capability failure preserves navigation and the chosen combination', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/?world=system&seed=3');
  await expect(page.getByText('当前浏览器暂时无法显示系统空间。请尝试支持 WebGL 2 的浏览器。')).toBeVisible();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
});
