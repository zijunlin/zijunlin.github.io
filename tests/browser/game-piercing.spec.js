import { productionGameBundle, observeProductionBattle } from '../helpers/game-performance.js';
import { observeGameDrawing, drawnShipBox } from '../helpers/game-drawing.js';
test.beforeEach(async ({ page }) => { await page.addInitScript(observeGameDrawing); });
import { observePickupMarkers, canvasColorPixels } from '../helpers/game-canvas.js';
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { advanceUntil } from '../helpers/game-scenario.js';
const evidence = process.env.GAME_EVIDENCE_DIR;
if (evidence) mkdirSync(evidence, { recursive: true });
for (const motion of ['reduce', 'no-preference']) {
test.describe(motion, () => {
test.use({ reducedMotion: motion });
test.setTimeout(420000);
test('five carried pickup markers remain visible in an unobscured spawn route', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .5; window.combatSpawns = 0; });
  await page.route(productionGameBundle, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: observeProductionBattle(await response.text()).replace('...options, random', "...options, random: purpose => purpose === 'position' ? [.46, .5, .54][++window.combatSpawns % 3] : .5") });
  });
  const sampled = observePickupMarkers(page);
  const time = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0'); await expect(page.locator('#world-entry')).toBeVisible();
  await page.keyboard.press('Shift+G'); await expect(page.locator('.space-game')).toBeVisible();
  // Begin sampling before battle starts; no assumed async opening offset.
  const kinds = ['trajectory', 'fireRate', 'shockwave', 'movement', 'piercing'];
  for (let step = 0; step < 450 && !kinds.every(kind => sampled.history[`carrier:${kind}`]); step++) {
    await sampled.runFor(100);
  }
  for (const kind of kinds) expect(sampled.history[`carrier:${kind}`], `visible carried ${kind} marker`).toBe(true);
});
test('five independent pickup identities draw effects and transient feedback, preserve pause and clear on replay', async ({ page }, info) => {
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    Math.random = () => .5;
    window.combatSpawns = 0;
  });
  // Satellite fire can leave orange drops over later warning icons. Move
  // successive spawns sideways within the same pickup route to expose them.
  await page.route(productionGameBundle, async route => { const response = await route.fetch(); await route.fulfill({ response, body: motion === 'reduce' ? observeProductionBattle(await response.text()) : observeProductionBattle(await response.text()).replace('...options, random', "...options, random: purpose => purpose === 'position' ? [.46, .5, .54][++window.combatSpawns % 3] : .5") }); });
  const sampled = observePickupMarkers(page);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.bringToFront();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await expect(page.locator('.game-pickup')).toHaveText('');
  await page.evaluate(() => {
    window.pickupHistory = [];
    new MutationObserver(() => {
      const value = document.querySelector('.game-pickup').textContent;
      if (value) window.pickupHistory.push(value);
    }).observe(document.querySelector('.game-pickup'), { childList: true, subtree: true });
  });
  // With the arena extended to the navigation, approach the first drop before the second arrives.
  await sampled.runFor(5000);
  if (evidence) await page.screenshot({ path: `${evidence}/${motion}-resources.png` });
  await page.keyboard.down('ArrowUp'); await sampled.runFor(2200); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-pickup')).toContainText('飞船弹道数');
  await page.keyboard.down('ArrowDown'); await sampled.runFor(700); await page.keyboard.up('ArrowDown');
  await sampled.runFor(180);
  await sampled.runFor(2500);
  await page.keyboard.down('ArrowUp'); await sampled.runFor(800); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-pickup')).toContainText('飞船射速提升');
  await page.keyboard.down('ArrowDown'); await sampled.runFor(1000); await page.keyboard.up('ArrowDown');
  await sampled.runFor(4000);
  await page.keyboard.down('ArrowUp'); await sampled.runFor(900); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.game-shockwave')).toContainText('2 / 3');
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await page.evaluate(() => window.pickupHistory.some(value => value.includes('穿透能力提升')))) break;
    await page.keyboard.down('ArrowDown'); await sampled.runFor(700); await page.keyboard.up('ArrowDown');
    await sampled.runFor(2000);
    await page.keyboard.down('ArrowUp'); await sampled.runFor(900); await page.keyboard.up('ArrowUp');
  }
  // The orange drop can cover the later movement warning in this pickup route.
  // Carrier visibility is asserted in the unobscured scenario below.
  const markers = sampled.history;
  for (const kind of ['trajectory', 'fireRate', 'shockwave', 'movement', 'piercing']) {
    expect(markers[`drop:${kind}`], `visible dropped ${kind} marker`).toBe(true);
  }
  const history = await page.evaluate(() => window.pickupHistory.join(' | '));
  expect(history).toContain('飞船弹道数'); expect(history).toContain('飞船射速提升');
  expect(history).toContain('冲击波 +1'); expect(history).toContain('飞船移动速度提升');
  expect(history).toContain('穿透能力提升');
  await expect(page.locator('.game-pickup')).toContainText('穿透能力提升');
  await page.keyboard.press('p');
  const feedback = await page.locator('.game-pickup').textContent();
  await sampled.runFor(3000);
  await expect(page.locator('.game-pickup')).toHaveText(feedback);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.game-pickup')).toContainText('Piercing increased');
  await page.keyboard.down('ArrowDown'); await sampled.runFor(300); await page.keyboard.up('ArrowDown');
  await page.screenshot({ path: info.outputPath('piercing-before-cohort.png') });
  await info.attach('piercing-before-cohort', { body: JSON.stringify(await page.evaluate(() => window.battleSnapshot)), contentType: 'application/json' });
  // The first upgraded volley may already have crossed the top boundary.
  // Wait for a real visible cohort, rather than assuming one fixed fire phase.
  await advanceUntil(page, async () => {
    const state = await page.evaluate(() => window.battleSnapshot);
    for (const bullet of state.bullets.filter(value => value.piercing && value.y > 110 && value.y < 760)) {
      if (await canvasColorPixels(page, [210, 167, 255], { x:bullet.x-10, y:bullet.y-10, width:20, height:20 }) > 10) return true;
    }
    return false;
  }, { timeout:800, step:16, description:'visible upgraded piercing cohort' });
  const piercingPixels = await canvasColorPixels(page, [210, 167, 255]);
  expect(piercingPixels).toBeGreaterThan(10);
  if (evidence) await page.screenshot({ path: `${evidence}/${motion}-piercing.png` });
  await sampled.runFor(1400);
  await expect(page.locator('.game-pickup')).toHaveText('');
  await expect(page.locator('.game-weapon')).toHaveCount(0);
  await expect(page.locator('.game-hud')).not.toContainText(/Weapon level|Ship trajectories|Piercing increased|movement speed/);
  await page.setViewportSize({ width: 700, height: 500 });
  await expect(page.getByRole('dialog', { name: 'Game paused' })).toBeVisible();
  const reserve = await page.locator('.game-shockwave').textContent();
  await page.keyboard.down('Space');
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole('button', { name: 'Resume game', exact: true }).click();
  await sampled.runFor(100);
  await expect(page.locator('.game-shockwave')).toHaveText(reserve);
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await sampled.runFor(100);
  const wavePixels = await canvasColorPixels(page, [155, 232, 255]);
  expect(wavePixels).toBeGreaterThan(10);
  const hud = await page.locator('.game-hud').boundingBox();
  const ship = await drawnShipBox(page);
  expect(hud.x).toBeGreaterThanOrEqual(0);
  expect(hud.x + hud.width).toBeLessThanOrEqual(800);
  // HUD now overlays the arena; the ship may pass underneath it.
  const header = await page.locator('.site-header').boundingBox();
  expect(ship.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(ship.y + ship.height).toBeLessThanOrEqual(600);
  if (evidence) await page.screenshot({ path: `${evidence}/${motion}-wave-800x600.png` });
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(page.locator('.game-pickup')).toHaveText('');
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return home', exact: true }).click();
  await sampled.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await page.locator('nav a[href="#work"]').click();
  await expect(page.locator('#work-panel-title')).toBeFocused();
});
});
}
