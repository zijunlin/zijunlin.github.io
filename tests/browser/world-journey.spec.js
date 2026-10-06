import { test, expect } from '@playwright/test';

const combinations = [
  ['island', 0, '建筑地形小岛 · 环绕核心'],
  ['island', 4, '建筑地形小岛 · 成长路径'],
  ['system', 2, '抽象系统空间 · 环绕核心'],
  ['system', 3, '抽象系统空间 · 成长路径'],
];

for (const [form, seed, caption] of combinations) {
  test(`the complete visitor journey preserves every layer in ${form}/${seed}`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      let hidden = false;
      Object.defineProperty(document, 'hidden', { get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
      window.setPageHidden = value => {
        hidden = value;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    });
    // Control time, not rendering: both GPU layers and the guide remain enabled.
    await page.clock.install({ time: new Date('2026-10-06T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-06T10:00:01Z'));
    await page.goto(`/?world=${form}&seed=${seed}`);
    await page.clock.runFor(1000);
    const selection = page.getByLabel('世界形态与空间布局');
    const world = page.getByRole('region', { name: caption, exact: true });
    const image = world.getByRole('img');
    const guide = world.getByRole('group', { name: '主角精灵：随行创造者' });
    const background = page.locator('canvas[aria-hidden="true"]');
    const navigation = page.getByRole('navigation', { name: '主目录' });
    const directory = page.getByRole('region', { name: '作品', exact: true });
    const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
    await expect(selection).toHaveText(caption);
    await expect(image).toBeVisible();
    await expect(guide).toBeVisible();
    await expect(background).toBeVisible();
    await expect(background).toHaveAttribute('data-motion', 'running');
    await expect(page.getByRole('status')).toBeHidden();

    await world.getByRole('link', { name: '作品集', exact: true }).click();
    await expect(page).toHaveURL(/#work$/);
    await directory.locator('summary').click();
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(100);
      const panelBox = await directory.boundingBox();
      for (const target of [image, guide, ...await world.getByRole('link').all()]) {
        await expect(target).toBeInViewport({ ratio: 1 });
        const box = await target.boundingBox();
        expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x);
      }
      await expect(directory.getByRole('link', { name: '查看作品预览' })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`directory-${viewport.width}.png`), animations: 'disabled' });
      const frame = await image.boundingBox();
      await directory.getByRole('link', { name: '查看作品预览' }).click();
      await expect(preview).toBeVisible();
      await expect(preview).toBeInViewport({ ratio: 1 });
      expect(await preview.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
      await preview.getByRole('link', { name: '查看作品详情' }).click({ trial: true });
      expect(await image.boundingBox()).toEqual(frame);
      await page.screenshot({ path: testInfo.outputPath(`preview-${viewport.width}.png`), animations: 'disabled' });
      await page.goBack();
      await expect(page).toHaveURL(/#work$/);
      await expect(preview).toBeHidden();
      await expect(directory.locator('details')).toHaveAttribute('open', '');
      expect(await image.boundingBox()).toEqual(frame);
    }

    await directory.getByRole('link', { name: '查看作品预览' }).click();
    const frame = await image.boundingBox();
    await page.evaluate(() => window.setPageHidden(true));
    await expect(background).toHaveAttribute('data-motion', 'paused');
    await page.clock.runFor(1000);
    await page.evaluate(() => window.setPageHidden(false));
    await expect(background).toHaveAttribute('data-motion', 'running');
    await expect(preview).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    expect(await image.boundingBox()).toEqual(frame);
    await expect(selection).toHaveText(caption);
    const [detail] = await Promise.all([
      page.waitForEvent('popup'),
      preview.getByRole('link', { name: '查看作品详情' }).click(),
    ]);
    try {
      await detail.waitForLoadState();
      await expect(detail).toHaveURL(/\/platform\.html$/);
      await expect(detail.getByRole('heading', { level: 1 })).toHaveText('智能语音平台：对话沟通引擎的架构升级');
      await detail.getByRole('navigation', { name: '相关链接' }).scrollIntoViewIfNeeded();
      await expect(detail.getByRole('link', { name: '职业历程', exact: true })).toBeInViewport();
      await expect(detail.locator('canvas, script')).toHaveCount(0);
      await expect(page).toHaveURL(/#work\/platform$/);
      expect(await image.boundingBox()).toEqual(frame);
    } finally { await detail.close(); }
    await page.bringToFront();
    await page.goBack();
    await expect(directory).toBeVisible();
    await expect(preview).toBeHidden();
    await page.goBack();
    await expect(directory).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
    await page.goForward();
    await expect(directory).toBeVisible();
    await page.goForward();
    await expect(preview).toBeVisible();
    await preview.getByRole('button', { name: '返回浏览', exact: true }).click();
    await expect(page).toHaveURL(/#work$/);
    await navigation.getByRole('link', { name: '首页', exact: true }).click();
    await expect(directory).toBeHidden();
    await expect(selection).toHaveText(caption);
    await page.reload();
    await page.clock.runFor(1000);
    await expect(selection).toHaveText(caption);
    await expect(image).toBeVisible();
    await expect(guide).toBeVisible();
    await expect(background).toBeVisible();
    expect(errors).toEqual([]);
  });
}
