import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { imageDifference } from '../helpers/image-difference.mjs';

test('featured entrance and directory open the same focused work preview', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/?world=system&seed=3');
  const world = page.getByRole('region', { name: '抽象系统空间 · 成长路径' });
  await world.getByRole('link', { name: '精选作品 · 智能语音平台' }).click();
  const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
  await expect(preview).toBeVisible();
  await expect(page).toHaveURL(/#work\/platform$/);
  await expect(preview.getByRole('img', { name: '对话沟通引擎结构示意' })).toBeVisible();
  await expect(preview.getByText('个人职责：主导平台整体架构、核心系统设计与关键研发。', { exact: true })).toBeVisible();
  await expect(preview.getByRole('list', { name: '作品标签' }).getByRole('listitem')).toHaveText(['架构设计', '对话编排', '渐进迁移']);
  const detail = preview.getByRole('link', { name: '查看作品详情' });
  await expect(detail).toHaveAttribute('href', '/platform.html');
  await expect(detail).toHaveAttribute('target', '_blank');
  await preview.getByRole('button', { name: '关闭作品预览' }).click();
  await expect(preview).toBeHidden();
  await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).click();
  const directory = page.getByRole('region', { name: '作品', exact: true });
  await directory.locator('summary').click();
  await directory.getByRole('link', { name: '查看作品预览' }).click();
  await expect(preview).toBeVisible();
  await expect(directory).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(directory).toBeVisible();
});

for (const [width, height] of [[1024, 768], [1280, 720], [1920, 1080]]) {
  test(`preview content and actions fit without scrolling at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?world=island&seed=0#work/platform');
    const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('button', { name: '关闭作品预览' })).toBeInViewport();
    await expect(preview.getByRole('link', { name: '查看作品详情' })).toBeInViewport();
    expect(await preview.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
    const box = await preview.boundingBox();
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThan(2);
    await expect(page.getByRole('group', { name: '主角精灵：随行创造者' })).toBeVisible();
    await page.keyboard.press('Tab');
    expect(await preview.evaluate(element => element.contains(document.activeElement))).toBe(true);
  });
}

test('the preview remains readable when world rendering is unavailable', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?world=system&seed=3#work/platform');
  const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('link', { name: '查看作品详情' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(page.getByRole('navigation')).toBeVisible();
});

test('preview dims the visible background and reduces its motion', async ({ browser }) => {
  test.setTimeout(60000);
  const samples = [];
  for (const hash of ['', '#work/platform']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
      await page.goto(`http://127.0.0.1:4173/?seed=514018${hash}`);
      await page.clock.runFor(100);
      await expect(page.locator('#shader-canvas')).toBeVisible();
      // The empty right band stays outside both the world and central dialog.
      const capture = () => page.screenshot({ clip: { x: 1030, y: 120, width: 200, height: 520 } });
      const first = await capture();
      await page.clock.runFor(1500);
      const second = await capture();
      const png = PNG.sync.read(first);
      let total = 0;
      for (let i = 0; i < png.data.length; i += 4) total += png.data[i] + png.data[i + 1] + png.data[i + 2];
      samples.push({ brightness: total / (png.width * png.height * 3), motion: imageDifference(first, second) });
    } finally { await page.close(); }
  }
  const [normal, preview] = samples;
  expect(normal.motion).toBeGreaterThan(0.02);
  expect(preview.brightness).toBeLessThan(normal.brightness * 0.8);
  expect(preview.brightness).toBeGreaterThan(normal.brightness * 0.2);
  // Normalize dimming away so opacity alone cannot satisfy reduced motion.
  expect(preview.motion / preview.brightness).toBeLessThan(normal.motion / normal.brightness * 0.8);
});
