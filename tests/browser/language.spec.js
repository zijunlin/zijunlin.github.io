import { test, expect } from '@playwright/test';

// Full navigation journeys share the software GPU with the animated background.
test.describe.configure({ timeout: 60000 });

for (const locale of ['en-US', 'zh-CN', 'zh-TW', 'fr-FR']) {
  test.describe(locale, () => {
    test.use({ locale });
    const chinese = locale.startsWith('zh');
    test('localizes navigation, all panels, preview', async ({ page }) => {
      await page.goto('/#about');
      await expect(page.locator('html')).toHaveAttribute('lang', chinese ? 'zh-CN' : 'en');
      await expect(page.locator('nav a[href="#"]')).toHaveText(chinese ? '首页' : 'Home');
      await expect(page.locator('#about-panel-title')).toHaveText(chinese ? '关于我' : 'About me');
      await expect(page.locator('.about-role')).toHaveText(chinese ? '曾任阿里巴巴 P7 技术专家' : 'Former Technical Expert (P7) at Alibaba');
      await page.locator('.about-role + p a').click();
      await expect(page.locator('#career-panel-title')).toBeVisible();
      await expect(page.locator('.career-timeline')).toContainText(chinese ? '来往' : 'Laiwang');
      await page.locator('nav a[href="#notes"]').click();
      await expect(page.locator('#notes-panel-title')).toHaveText(chinese ? '随笔' : 'Notes');
      await page.locator('nav a[href="#work"]').click();
      await page.locator('.work-item summary').click();
      await page.locator('.work-preview-link').click();
      await expect(page.locator('dialog')).toBeVisible();
      await expect(page.locator('#work-preview-title')).toHaveText(chinese ? '智能语音平台' : 'Intelligent Voice Platform');
      if (!chinese) {
        // Hidden panels are included to catch untranslated copy throughout the site.
        await expect(page.locator('main')).not.toContainText(/[\p{Script=Han}]/u);
        const labels = await page.locator('[aria-label]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')).join(' '));
        expect(labels).not.toMatch(/[\p{Script=Han}]/u);
      }
      await page.locator('.preview-return').click();
      await expect(page.locator('#work-panel-title')).toBeVisible();
    });
  });
}

test('uses the first supported browser preference', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'zh-TW', 'en-US'] }));
  await page.goto('/#work');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('English remains available when the world fails to load', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['en-GB', 'zh-CN'] }));
  await page.route('**/assets/world-scene-*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#world-error')).toBeVisible();
  await expect(page.locator('.world-fallback')).toContainText('Keep exploring');
  await expect(page.locator('#world-error')).not.toContainText(/[\p{Script=Han}]/u);
});

test('English pages fit a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['en'] }));
  for (const path of ['/#work/platform']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    if (path.startsWith('/#')) {
      await expect(page.locator('dialog')).toBeVisible();
      for (const link of await page.locator('.site-header nav a').all()) {
        const bounds = await link.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      }
      expect(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    }
  }
});


test('manual language choice preserves the open panel and persists across reloads', async ({ page }) => {
  await page.goto('/#work');
  await page.locator('.work-item summary').click();
  const english = page.getByRole('button', { name: 'English', exact: true });
  const chinese = page.getByRole('button', { name: '中文', exact: true });
  await english.click();
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#work-panel-title')).toHaveText('Work');
  await expect(page.locator('.work-item')).toHaveAttribute('open', '');
  await expect(page).toHaveURL(/#work$/);
  await chinese.click();
  await expect(chinese).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#work-panel-title')).toHaveText('作品');
  await english.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#work');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#work-panel-title')).toHaveText('Work');
});

test('language switching works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.goto('/#about');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('#about-panel-title')).toHaveText('About me');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.locator('#about-panel-title')).toHaveText('关于我');
});
