import { expect } from '@playwright/test';
import { productionGameBundle, observeProductionBattle } from './game-performance.js';

// Observe real production state; each caller supplies only its random inputs.
export async function startCombat(page, { random, advance = 3300 } = {}) {
  await page.route(productionGameBundle, async route => {
    const response = await route.fetch();
    let body = observeProductionBattle(await response.text());
    if (random) body = body.replace('...options, random', `...options, random: ${random}`);
    await route.fulfill({ response, body });
  });
  const time = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0'); await expect(page.locator('#world-entry')).toBeVisible();
  await page.keyboard.press('Shift+G'); await expect(page.locator('.space-game')).toBeVisible();
  await page.clock.runFor(advance);
}
