import { observeGameDrawing, drawnShipBox } from '../helpers/game-drawing.js';
import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(observeGameDrawing);
  await page.addInitScript(() => {
    Math.random = () => .5;
  });
  await page.clock.install({ time: new Date('2026-10-14T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-14T00:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
});
test('movement, pause, results and replay preserve the site and reset the run', async ({ page }) => {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const before = await drawnShipBox(page);
  await page.keyboard.down('ArrowLeft'); await page.clock.runFor(500); await page.keyboard.up('ArrowLeft');
  const after = await drawnShipBox(page);
  // The current base speed is 390 CSS px/s: half a second covers 195 px,
  // allowing one rendered simulation frame at each input boundary.
  expect(Math.abs((before.x - after.x) - 195)).toBeLessThan(15);
  await page.keyboard.press('p');
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  const frozen = await page.locator('.game-score').textContent();
  await page.clock.runFor(5000);
  await expect(page.locator('.game-score')).toHaveText(frozen);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '本局结束' })).toBeVisible();
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await expect(page.getByText('正在集结')).toHaveCount(0);
  await expect(page.locator('.game-score')).toContainText('分数: 0');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByText('Space survival', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return home', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('#about-panel-title')).toBeFocused();
});
test('small windows can resume, and gameplay navigation releases all visuals', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.locator('nav a[href="#work"]').click();
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('#work-panel-title')).toBeFocused();
});

test('switching language preserves a nonzero combat score', async ({ page }) => {
  await page.clock.runFor(5000);
  const score = Number((await page.locator('.game-score').textContent()).match(/分数: (\d+)/)[1]);
  expect(score).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  const translated = Number((await page.locator('.game-score').textContent()).match(/Score: (\d+)/)[1]);
  expect(translated).toBeGreaterThanOrEqual(score);
  await page.screenshot({ path: '.scratch/home-space-game-build/combat.png' });
});

test('ship reaches the navigation and viewport edges and travels beneath the HUD', async ({ page }) => {
  // This route renders 15 seconds of software-GPU combat through the public clock.
  test.setTimeout(150000);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const move = async (key, duration) => {
    await page.keyboard.down(key); await page.clock.runFor(duration); await page.keyboard.up(key);
  };
  await move('ArrowLeft', 3000);
  let ship = await drawnShipBox(page);
  expect(ship.x).toBeCloseTo(0, 1);
  await move('ArrowUp', 3000);
  ship = await drawnShipBox(page);
  const header = await page.locator('.site-header').boundingBox();
  expect(ship.y).toBeCloseTo(header.y + header.height, 1);
  await move('ArrowRight', 250);
  ship = await drawnShipBox(page);
  const hud = await page.locator('.game-hud').boundingBox();
  expect(ship.x).toBeGreaterThan(hud.x);
  expect(ship.y + ship.height).toBeGreaterThan(hud.y);
  expect(ship.y).toBeLessThan(hud.y + hud.height);
  await expect(page.locator('.game-hud')).toHaveCSS('pointer-events', 'none');
  // Hit-test the overlapping paint layers with pointer events temporarily enabled.
  const aboveShip = await page.evaluate(({ x, y }) => {
    const nodes = [...document.querySelectorAll('.game-hud, #shader-canvas')];
    const old = nodes.map(node => node.style.pointerEvents);
    nodes.forEach(node => { node.style.pointerEvents = 'auto'; });
    const top = document.elementFromPoint(x, y);
    const result = Boolean(top?.closest('.game-hud'));
    nodes.forEach((node, i) => { node.style.pointerEvents = old[i]; });
    return result;
  }, { x: ship.x + ship.width / 2, y: hud.y + 5 });
  expect(aboveShip).toBe(true);
  await page.screenshot({ path: '.scratch/game-entry-and-boundaries/hud-overlap.png' });
  await move('ArrowRight', 5000);
  ship = await drawnShipBox(page);
  const displayTolerance = .5 / await page.evaluate(() => devicePixelRatio) + 1e-6;
  expect(Math.abs(ship.x + ship.width - page.viewportSize().width)).toBeLessThanOrEqual(displayTolerance);
  await move('ArrowDown', 4000);
  ship = await drawnShipBox(page);
  expect(Math.abs(ship.y + ship.height - page.viewportSize().height)).toBeLessThanOrEqual(displayTolerance);
});

test('Space releases once, pause discards input, and replay restores the reserve', async ({ page }) => {
  await expect(page.locator('.game-shockwave')).toHaveText('冲击波: 1 / 3 · 空格释放 · 橙色圆环补充');
  await page.keyboard.press('p');
  await page.keyboard.down('Space');
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(100);
  await page.keyboard.down('Space');
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
  await page.keyboard.down('Space');
  await page.clock.runFor(600);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.game-shockwave')).toHaveText('Shockwave: 0 / 3 · Space to release · Orange rings refill');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(page.locator('.game-shockwave')).toContainText('1 / 3');
  await page.keyboard.press('Space'); await page.clock.runFor(100);
  await expect(page.locator('.game-shockwave')).toContainText('0 / 3');
});
