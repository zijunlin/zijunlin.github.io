import { test, expect } from '@playwright/test';
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.clock.install();
});
async function enter(page) {
  await page.goto('/');
  await expect(page.locator('#world-entry')).toBeVisible();
  await page.clock.runFor(10100);
  await expect(page.getByText('正在集结')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toHaveCount(0);
  await expect(page.locator('.space-game')).toBeFocused();
}
test('opening retains the world and navigation, then restores original entrances', async ({ page }) => {
  await enter(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const original = await page.locator('.celestial-gate').first().elementHandle();
  await page.clock.runFor(3100);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await expect(page.locator('.game-satellite')).toHaveCount(4);
  await page.screenshot({ path: '.scratch/home-space-game-build/opening-ready.png' });
  const trailPaths = await page.locator('.celestial-trails path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await expect(page.locator('.space-game')).toHaveCount(1);
  await expect(page.locator('.celestial-trails')).toBeHidden();
  expect(await page.locator('.celestial-trails path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(trailPaths);
  expect(Number(await page.locator('.game-ship').evaluate(ship => getComputedStyle(ship).opacity))).toBeLessThan(.8);
  await page.clock.runFor(1400);
  await expect(page.locator('.celestial-trails')).toBeVisible();
  // Returning restores the orbit, then it continues instead of being frozen
  // indefinitely by the programmatically restored entrance focus.
  const resumed = await page.locator('.celestial-trails path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  await page.clock.runFor(250);
  expect(await page.locator('.celestial-trails path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).not.toEqual(resumed);
  expect(await original.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('#about-panel-title')).toBeFocused();
});
test('resize pauses opening and only a manual resume advances it', async ({ page }) => {
  await enter(page);
  await page.clock.runFor(500);
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.clock.runFor(5000);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(2600);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
});
test('top navigation exits an active opening without stealing content focus', async ({ page }) => {
  await enter(page);
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('#about-panel-title')).toBeFocused();
  await expect(page).toHaveURL(/#about$/);
});
test('hidden opening stays paused until confirmation', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(6000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.clock.runFor(3100);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
});
test('reduced motion still reaches the same playable formation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await page.clock.runFor(3100);
  await expect(page.getByText('星际生存', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.scratch/home-space-game-build/opening-reduced.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});

test('navigation interrupts a return without a late focus change', async ({ page }) => {
  await enter(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(3100);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await expect(page.locator('.game-satellite')).toHaveCount(4);
  await page.locator('nav a[href="#about"]').click();
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('#about-panel-title')).toBeFocused();
  await page.clock.runFor(3000);
  await expect(page).toHaveURL(/#about$/);
  await expect(page.locator('#about-panel-title')).toBeFocused();
  await expect(page.locator('.game-satellite, .game-ship')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.celestial-trails')).toBeVisible();
  await expect(page.locator('.celestial-gate').first()).toBeVisible();
});

test('resizing during return keeps the final orb positions and sizes continuous', async ({ page }) => {
  await enter(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(3100);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(350);
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toHaveCount(0);
  await page.evaluate(() => {
    const boxes = selector => [...document.querySelectorAll(selector)].map(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height };
    });
    let last;
    window.returnGeometry = new Promise(resolve => {
      function sample() {
        const current = boxes('.game-satellite .orb-disc');
        if (current.length) { last = current; requestAnimationFrame(sample); }
        else resolve({ last, restored: boxes('.celestial-gate .orb-disc') });
      }
      requestAnimationFrame(sample);
    });
  });
  await page.clock.runFor(1400);
  await expect(page.locator('.space-game')).toHaveCount(0);
  await expect(page.locator('.celestial-trails')).toBeVisible();
  const { last, restored } = await page.evaluate(() => window.returnGeometry);
  expect(last).toHaveLength(4);
  expect(restored).toHaveLength(4);
  for (let i = 0; i < 4; i++) {
    for (const dimension of ['x', 'y', 'width', 'height']) {
      expect(Math.abs(last[i][dimension] - restored[i][dimension])).toBeLessThan(1);
    }
  }
});

test('opening pause retains its return action and resumes focus on the game', async ({ page }) => {
  await enter(page);
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(page.locator('.space-game')).toBeFocused();
  await expect(page.getByRole('button', { name: '返回首页', exact: true })).toHaveCount(0);
  await page.keyboard.press('p');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.clock.runFor(1700);
  await expect(page.locator('.space-game')).toHaveCount(0);
});
