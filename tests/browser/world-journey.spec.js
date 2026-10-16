import { test, expect } from '@playwright/test';

const combinations = [
  [0, '星辰圆点 · 环绕核心', '软件工程 · 持续探索'],
  [4, '星辰圆点 · 成长路径', '软件工程 · 成长路径'],
];

for (const [seed, worldName, caption] of combinations) {
  test(`the complete visitor journey preserves every layer in layout seed ${seed}`, async ({ page }, testInfo) => {
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
    // Control time, not rendering: the background and celestial view remain enabled.
    await page.clock.install({ time: new Date('2026-10-06T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-06T10:00:01Z'));
    await page.goto(`/?seed=${seed}`);
    await page.clock.runFor(1000);
    const selection = page.getByLabel('世界形态与空间布局');
    const world = page.getByRole('region', { name: worldName, exact: true });
    const image = world.locator('.celestial-stage');
    const background = page.locator('canvas[aria-hidden="true"]');
    const navigation = page.getByRole('navigation', { name: '主目录' });
    const directory = page.getByRole('region', { name: '作品', exact: true });
    const preview = page.getByRole('dialog', { name: '智能语音平台', exact: true });
    await expect(selection).toHaveText(caption);
    await expect(image).toBeVisible();
    await expect(background).toBeVisible();
    await expect(background).toHaveAttribute('data-motion', 'running');
    await expect(page.getByRole('status')).toBeHidden();

    await world.getByRole('link', { name: '作品集', exact: true }).click();
    await expect(page).toHaveURL(/#work$/);
    await directory.locator('summary').press('Enter');
    await expect(directory.locator('details')).toHaveAttribute('open', '');
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(100);
      for (const target of [image]) {
        // IntersectionObserver rounds the ratio below 1 for fractional bounds.
        await expect(target).toBeInViewport({ ratio: .999999 });
        const box = await target.boundingBox();
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      await expect(directory.getByRole('link', { name: '查看作品预览' })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`directory-${viewport.width}.png`), animations: 'disabled' });
      const frame = await image.boundingBox();
      await directory.getByRole('link', { name: '查看作品预览' }).click();
      await expect(preview).toBeVisible();
      await expect(preview).toBeInViewport({ ratio: 1 });
      expect(await preview.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
      await preview.getByRole('button', { name: '返回浏览', exact: true }).click({ trial: true });
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
    await expect(background).toBeVisible();
    expect(errors).toEqual([]);
  });
}
