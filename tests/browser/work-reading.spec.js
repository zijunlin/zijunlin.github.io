import { test, expect } from '@playwright/test';

for (const width of [360, 1280]) {
  test(`the complete case is directly readable without JavaScript or world resources at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 720 } });
    const page = await context.newPage();
    const resources = [];
    page.on('request', request => resources.push({ url: request.url(), type: request.resourceType() }));
    try {
      const response = await page.goto('http://127.0.0.1:4173/platform.html');
      expect(response.status()).toBe(200);
      await expect(page).toHaveTitle('智能语音平台：对话沟通引擎的架构升级 · 林子钧');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('智能语音平台：对话沟通引擎的架构升级');
      await expect(page.getByRole('heading', { name: '平台背景', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: '从定制逻辑走向可编排能力', exact: true })).toBeVisible();
      await expect(page.getByText(/同一对话过程中不切换引擎/)).toBeVisible();
      const related = page.getByRole('navigation', { name: '相关链接' });
      await related.scrollIntoViewIfNeeded();
      await expect(related).toBeInViewport();
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(related.getByRole('link', { name: '职业历程' })).toHaveAttribute('href', '/#career');
      await expect(related.getByRole('link', { name: '浏览作品' })).toHaveAttribute('href', '/#work');
      await expect(page.getByRole('link', { name: '进入世界主页' })).toHaveAttribute('href', '/');
      await expect(page.locator('canvas, script, iframe')).toHaveCount(0);
      expect(resources.filter(resource => !['document', 'stylesheet'].includes(resource.type))).toEqual([]);
      await page.reload();
      await expect(page.getByRole('article')).toBeVisible();
    } finally { await context.close(); }
  });
}

for (const source of ['', '#work', '#career']) {
  test(`reading in a new tab preserves the original ${source || 'world'} context`, async ({ page }) => {
    test.setTimeout(60000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
    await page.goto(`/?world=system&seed=3${source}`);
    await page.clock.runFor(1000);
    const scene = page.getByRole('img', { name: '层叠曲面系统空间' });
    await expect(scene).toBeVisible();
    await scene.screenshot({ animations: 'disabled' });
    const panel = source && page.getByRole('region', { name: source === '#work' ? '作品' : '职业历程', exact: true });
    if (source === '#work') await panel.locator('summary').click();
    const opener = source ? panel.getByRole('link', { name: source === '#work' ? '查看作品预览' : '查看关联作品：智能语音平台' })
      : page.getByRole('link', { name: '精选作品 · 智能语音平台' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
    await expect(preview).toBeVisible();
    const before = await scene.boundingBox();
    const [detail] = await Promise.all([
      page.waitForEvent('popup'),
      preview.getByRole('link', { name: '查看作品详情' }).click(),
    ]);
    try {
      await detail.waitForLoadState();
      await detail.bringToFront();
      await expect(detail).toHaveURL(/\/platform\.html$/);
      await expect(detail.getByRole('heading', { level: 1 })).toHaveText('智能语音平台：对话沟通引擎的架构升级');
      expect(await detail.evaluate(() => window.opener === null)).toBe(true);
      await expect(detail.locator('script, canvas')).toHaveCount(0);
      await detail.getByRole('navigation', { name: '相关链接' }).scrollIntoViewIfNeeded();
      await expect(page).toHaveURL(/\?world=system&seed=3#work\/platform$/);
      await expect(preview).toBeVisible();
      if (panel) await expect(panel).toBeVisible();
      expect(await scene.boundingBox()).toEqual(before);
    } finally { await detail.close(); }
    await page.bringToFront();
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    expect(new URL(page.url()).hash).toBe(source);
    await expect(opener).toBeFocused();
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
    expect(await scene.boundingBox()).toEqual(before);
    if (source === '#work') await expect(panel.locator('details')).toHaveAttribute('open', '');
  });
}
