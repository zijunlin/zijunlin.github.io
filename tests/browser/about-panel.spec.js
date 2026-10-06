import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 60000 });

test('navigation and world entrance open the same about panel and browser back returns to the world', async ({ page }) => {
  await page.goto('/?world=island&seed=0');
  const nav = page.getByRole('navigation', { name: '主目录' });
  const panel = page.getByRole('region', { name: '关于我', exact: true });
  await nav.getByRole('link', { name: '关于', exact: true }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: '林子钧', exact: true })).toBeVisible();
  await expect(panel.getByText('曾任阿里巴巴 P7 技术专家', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: '邮箱' })).toHaveAttribute('href', 'mailto:linzijun.programmer@gmail.com');
  await page.goBack();
  await expect(panel).toBeHidden();
  const world = page.getByRole('region', { name: '建筑地形小岛 · 环绕核心' });
  await world.getByRole('link', { name: '关于我', exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(page.getByRole('region', { name: '关于我', exact: true })).toHaveCount(1);
  await panel.getByRole('link', { name: '关闭关于我' }).click();
  await expect(panel).toBeHidden();
  await expect(world.getByRole('link', { name: '关于我', exact: true })).toBeFocused();
});

test('direct about links survive reload and home clears content state without replacing the world', async ({ page }) => {
  await page.goto('/?world=system&seed=3#about');
  const panel = page.getByRole('region', { name: '关于我', exact: true });
  const nav = page.getByRole('navigation');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: '关于我', exact: true })).toBeFocused();
  await expect(nav.getByRole('link', { name: '关于', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(nav.getByRole('link', { name: '关于', exact: true })).toBeFocused();
  await page.goBack();
  await expect(panel).toBeVisible();
  await nav.getByRole('link', { name: '首页', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(nav.getByRole('link', { name: '首页', exact: true })).toBeFocused();
  await expect(nav.getByRole('link', { name: '首页', exact: true })).toHaveAttribute('aria-current', 'page');
  // The modal preview must be closed before using the underlying navigation.
  await page.evaluate(() => { location.hash = '#work/platform'; });
  await page.getByRole('dialog', { name: '智能语音平台', exact: true }).getByRole('button', { name: '关闭作品预览' }).click();
  await nav.getByRole('link', { name: '首页', exact: true }).click();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  expect(new URL(page.url()).search).toBe('?world=system&seed=3');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
});

for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`about stays in the reading band with internal scrolling at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl' ? null : original.call(this, type, ...args);
      };
    });
    for (const [form, seed] of [['island', 0], ['island', 4], ['system', 2], ['system', 3]]) {
      await page.goto(`/?world=${form}&seed=${seed}`);
      const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
      const image = world.getByRole('img');
      await expect(image).toBeVisible();
      await image.screenshot({ animations: 'disabled' });
      const before = await image.boundingBox();
      await page.getByRole('navigation').getByRole('link', { name: '关于', exact: true }).focus();
      await page.keyboard.press('Enter');
      const panel = page.getByRole('region', { name: '关于我', exact: true });
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(before.x + before.width + 27.9);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(76);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      const after = await image.boundingBox();
      for (const axis of ['x', 'y', 'width', 'height']) expect(after[axis]).toBeCloseTo(before[axis], 2);
      for (const link of await world.getByRole('link').all()) {
        const entrance = await link.boundingBox();
        expect(entrance.x + entrance.width).toBeLessThan(box.x);
      }
      const character = await page.locator('.world-protagonist-slot').boundingBox();
      expect(character.x + character.width).toBeLessThan(box.x);
      const contact = panel.getByRole('link', { name: 'LinkedIn' });
      await contact.scrollIntoViewIfNeeded();
      await expect(contact).toBeInViewport();
      await expect(panel.getByRole('link', { name: '关闭关于我' })).toBeInViewport();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    }
  });
}

test('about remains readable when world rendering is unavailable', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?world=island&seed=0');
  await expect(page.getByText('当前浏览器暂时无法展示完整世界，你仍可浏览全部内容。')).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: '关于', exact: true }).click();
  await expect(page.getByRole('region', { name: '关于我', exact: true }).getByRole('heading', { name: '林子钧' })).toBeVisible();
});
