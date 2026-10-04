import { test, expect } from '@playwright/test';
import { imageDifference } from '../helpers/image-difference.mjs';

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('the selected protagonist keeps a clear foreground station in all four worlds', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [form, seed, x] of [['island', 0, 320], ['island', 4, 302], ['system', 2, 320], ['system', 3, 302]]) {
    await page.goto(`/?world=${form}&seed=${seed}`);
    const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
    const character = world.getByRole('group', { name: '主角精灵：随行创造者', exact: true });
    await expect(character).toBeVisible();
    await character.screenshot({ animations: 'disabled' });
    const frame = await world.getByRole('img').boundingBox();
    const body = await character.boundingBox();
    expect((body.x + body.width / 2 - frame.x) / frame.width * 640).toBeCloseTo(x, 0);
    expect(body.height / frame.height).toBeLessThan(0.22);
    for (const link of await world.getByRole('link').all()) {
      expect(overlaps(body, await link.boundingBox())).toBe(false);
    }
    await page.getByRole('navigation').getByRole('link', { name: '关于', exact: true }).click();
    const panel = page.getByRole('region', { name: '关于我', exact: true });
    await expect(panel).toBeVisible();
    expect(overlaps(body, await panel.boundingBox())).toBe(false);
    await expect(character).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(() => character.boundingBox()).toEqual(body);
  }
});

test('protagonist idle is subtle and pauses with focus and reduced motion', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/?world=system&seed=2');
  const character = page.getByRole('group', { name: '主角精灵：随行创造者', exact: true });
  await expect(character).toBeVisible();
  const first = await character.screenshot();
  let maximum = 0;
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    maximum = Math.max(maximum, imageDifference(first, await character.screenshot()));
  }
  expect(maximum).toBeGreaterThan(0.05);
  expect(maximum).toBeLessThan(5);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const paused = await character.screenshot();
  await page.waitForTimeout(1600);
  expect(imageDifference(paused, await character.screenshot())).toBeLessThan(0.05);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = await character.screenshot();
  await page.waitForTimeout(1600);
  expect(imageDifference(still, await character.screenshot())).toBeLessThan(0.05);
});
