import { test, expect } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .5;
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) { return this.id === 'shader-canvas' ? null : context.apply(this, args); };
  });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
});
test('movement, pause, results and replay preserve the site and reset the run', async ({ page }) => {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const before = await page.locator('.game-ship').boundingBox();
  await page.keyboard.down('ArrowLeft'); await page.clock.runFor(500); await page.keyboard.up('ArrowLeft');
  const after = await page.locator('.game-ship').boundingBox();
  expect(before.x - after.x).toBeGreaterThan(130);
  expect(before.x - after.x).toBeLessThan(170);
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
test('small windows cannot resume, and gameplay navigation releases all visuals', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 500 });
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const move = async (key, duration) => {
    await page.keyboard.down(key); await page.clock.runFor(duration); await page.keyboard.up(key);
  };
  await move('ArrowLeft', 3000);
  let ship = await page.locator('.game-ship').boundingBox();
  expect(ship.x).toBeCloseTo(0, 1);
  await move('ArrowUp', 3000);
  ship = await page.locator('.game-ship').boundingBox();
  const header = await page.locator('.site-header').boundingBox();
  expect(ship.y).toBeCloseTo(header.y + header.height, 1);
  await move('ArrowRight', 250);
  ship = await page.locator('.game-ship').boundingBox();
  const hud = await page.locator('.game-hud').boundingBox();
  expect(ship.x).toBeGreaterThan(hud.x);
  expect(ship.y + ship.height).toBeGreaterThan(hud.y);
  expect(ship.y).toBeLessThan(hud.y + hud.height);
  await expect(page.locator('.game-hud')).toHaveCSS('pointer-events', 'none');
  // Hit-test the overlapping paint layers with pointer events temporarily enabled.
  const aboveShip = await page.evaluate(({ x, y }) => {
    const nodes = [...document.querySelectorAll('.game-hud, .game-ship, .game-effects, .game-satellite')];
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
  ship = await page.locator('.game-ship').boundingBox();
  expect(ship.x + ship.width).toBeCloseTo(page.viewportSize().width, 1);
  await move('ArrowDown', 4000);
  ship = await page.locator('.game-ship').boundingBox();
  expect(ship.y + ship.height).toBeCloseTo(page.viewportSize().height, 1);
});
