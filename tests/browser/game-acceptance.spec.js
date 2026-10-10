import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test.setTimeout(90000);
for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`complete game journey at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const context = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : context.apply(this, args); };
    });
    await page.clock.install();
    await page.goto('/');
    await expect(page.locator('#world-entry')).toBeVisible();
    await page.evaluate(() => {
      const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
      const pending = new Set();
      window.requestAnimationFrame = callback => {
        const id = request.call(window, now => { pending.delete(id); callback(now); });
        pending.add(id); return id;
      };
      window.cancelAnimationFrame = id => { pending.delete(id); cancel.call(window, id); };
      window.pendingFrames = () => pending.size;
    });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    const baselineFrames = await page.evaluate(() => window.pendingFrames());
    const header = await page.locator('.site-header').boundingBox();
    await page.clock.runFor(10100);
    await expect(page.getByText('正在集结')).toBeVisible();
    await page.clock.runFor(3200);
    await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
    expect(await page.locator('.site-header').boundingBox()).toEqual(header);
    const gameFrames = await page.evaluate(() => window.pendingFrames());
    expect(gameFrames).toBeGreaterThan(baselineFrames);
    for (let run = 0; run < (viewport.width === 1280 ? 10 : 1); run++) {
      await page.keyboard.down('ArrowRight'); await page.clock.runFor(160); await page.keyboard.press('p');
      await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
      const frozen = await page.locator('.game-score').textContent();
      await page.clock.runFor(1000); await expect(page.locator('.game-score')).toHaveText(frozen);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: '本局结束' })).toBeVisible();
      await page.getByRole('button', { name: '再来一局', exact: true }).click();
      await expect(page.locator('.game-score')).toHaveText('分数: 0 · 存活: 0.0s');
      const resetPosition = await page.locator('.game-ship').boundingBox();
      await page.clock.runFor(320);
      expect((await page.locator('.game-ship').boundingBox()).x).toBe(resetPosition.x);
      await page.keyboard.up('ArrowRight');
      expect(await page.evaluate(() => window.pendingFrames())).toBe(gameFrames);
      const visibleShots = await page.locator('.game-effects').evaluate(canvas => {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const seen = new Uint8Array(canvas.width * canvas.height);
        let count = 0;
        for (let pixel = 0; pixel < seen.length; pixel++) {
          if (seen[pixel] || data[pixel * 4 + 3] < 20) continue;
          count++;
          const queue = [pixel]; seen[pixel] = 1;
          while (queue.length) {
            const current = queue.pop();
            for (const next of [current - 1, current + 1, current - canvas.width, current + canvas.width]) {
              if (next < 0 || next >= seen.length || seen[next] || data[next * 4 + 3] < 20) continue;
              seen[next] = 1; queue.push(next);
            }
          }
        }
        return count;
      });
      // Two volleys: dual forward shots plus three visible radial shots. Downward shots have left the arena.
      expect(visibleShots).toBe(10);
      await expect(page.locator('.game-score')).toContainText('存活: 0.3s');
      await expect(page.locator('.game-effects')).toHaveCount(1);
      await expect(page.locator('.game-satellite')).toHaveCount(4);
    }
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
    await expect(page.locator('.space-game')).toHaveCount(0);
    expect(await page.evaluate(() => window.pendingFrames())).toBe(baselineFrames);
    await page.locator('nav a[href="#work"]').click();
    await expect(page.locator('#work-panel-title')).toBeFocused();
  });
}
