import { test, expect } from '@playwright/test';
import { productionGameBundle, observeProductionBattle } from '../helpers/game-performance.js';
import { sharedImage } from '../helpers/game-canvas.js';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
test('small combat particles remain visible without losing native graphics at phone DPR1', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.route(productionGameBundle, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: observeProductionBattle(await response.text()) });
  });
  const time = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0'); await expect(page.locator('#world-entry')).toBeVisible();
  await page.keyboard.press('Shift+G'); await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(3200);
  let visible = false;
  for (let n = 0; n < 120 && !visible; n++) {
    await page.clock.runFor(100);
    await expect(page.locator('.space-game')).toBeVisible();
    const state = await page.evaluate(() => window.battleSnapshot);
    if (!state?.particles.length) continue;
    const image = await sharedImage(page);
    for (const particle of state.particles) {
      const x = Math.floor(particle.x * .5), y = Math.floor(particle.y * .5);
      if (x < 0 || x >= image.width || y < 90 || y >= image.height || particle.life < .3) continue;
      const at = (y * image.width + x) * 4;
      if (image.data[at] > 90 && image.data[at] > image.data[at + 2] * 1.25) visible = true;
    }
  }
  expect(visible, 'a real explosion includes visible warm particles at half world scale').toBe(true);
  await page.screenshot({ path: info.outputPath('phone-particles.png') });
});
