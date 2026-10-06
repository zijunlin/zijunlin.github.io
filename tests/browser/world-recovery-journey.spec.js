import { test, expect } from '@playwright/test';

test('content opened during loading survives background failure and later world loss', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Fail only the decorative WebGL 1 shader; keep the real WebGL 2 world.
  await page.addInitScript(() => {
    WebGLRenderingContext.prototype.getShaderParameter = () => false;
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/world-scene-*.js', async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/?world=system&seed=3', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status')).toHaveText('正在构建世界');
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.locator('canvas[aria-hidden="true"]')).toBeHidden();
  await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).click();
  const directory = page.getByRole('region', { name: '作品', exact: true });
  await directory.locator('summary').click();
  await directory.getByRole('link', { name: '查看作品预览' }).click();
  const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
  await expect(preview).toBeVisible();
  release();
  const image = page.getByRole('img', { name: '层叠曲面系统空间' });
  await expect(image).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
  await expect(preview).toBeVisible();
  await expect(page).toHaveURL(/#work\/platform$/);
  await page.goBack();
  await expect(directory).toBeVisible();
  await expect(preview).toBeHidden();
  await expect(page.getByRole('group', { name: '主角精灵：随行创造者' })).toBeVisible();
  await directory.getByRole('link', { name: '查看作品预览' }).click();
  // Simulate GPU loss through the browser API, without inspecting renderer state.
  await image.evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(image).toHaveCount(0);
  await expect(preview).toBeVisible();
  const [detail] = await Promise.all([
    page.waitForEvent('popup'),
    preview.getByRole('link', { name: '查看作品详情' }).click(),
  ]);
  try {
    await detail.waitForLoadState();
    await expect(detail.getByRole('heading', { level: 1 })).toHaveText('智能语音平台：对话沟通引擎的架构升级');
  } finally { await detail.close(); }
  await page.goBack();
  await expect(directory).toBeVisible();
  await expect(directory.locator('details')).toHaveAttribute('open', '');
  await page.goBack();
  await expect(directory).toBeHidden();
  expect(new URL(page.url()).hash).toBe('');
  const fallback = page.getByRole('region', { name: '继续浏览内容' });
  await expect(fallback).toBeVisible();
  await fallback.getByRole('link', { name: '心得', exact: true }).click();
  await expect(page.getByRole('region', { name: '随笔', exact: true })).toBeVisible();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  await expect(page.locator('body')).not.toContainText(/Shader Error|WebGL|Error:|stack trace/i);
  expect(errors).toEqual([]);
});
