import { test, expect } from '@playwright/test';

async function position(locator) {
  const box = await locator.boundingBox();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

test('pointer depth is small, layered and keeps camera framing fixed', async ({ page }) => {
  await page.goto('/?seed=3');
  const world = page.locator('.celestial-stage');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  await page.mouse.move(640, 400);
  const before = await position(world);
  const backdrop = await position(page.locator('#shader-canvas'));
  await page.mouse.move(1260, 780);
  await expect.poll(async () => Math.abs((await position(world)).x - before.x)).toBeGreaterThan(1);
  const after = await position(world);
  const backgroundAfter = await position(page.locator('#shader-canvas'));
  const worldTravel = Math.hypot(after.x - before.x, after.y - before.y);
  const backgroundTravel = Math.hypot(backgroundAfter.x - backdrop.x, backgroundAfter.y - backdrop.y);
  expect(backgroundTravel).toBeGreaterThan(0.5);
  expect(worldTravel).toBeGreaterThan(backgroundTravel);
  expect(worldTravel + backgroundTravel).toBeLessThanOrEqual(10);
  expect(after.width).toBeCloseTo(before.width, 3);
  expect(after.height).toBeCloseTo(before.height, 3);
  await page.mouse.wheel(0, 300);
  expect((await position(world)).width).toBeCloseTo(before.width, 3);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('reading routes freeze both layers until returning to the world', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/?seed=4');
  const world = page.locator('.celestial-stage');
  const background = page.locator('#shader-canvas');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  for (const hash of ['#about', '#career', '#work', '#notes', '#work/platform']) {
    await page.mouse.move(100, 700);
    const frozen = [await position(world), await position(background)];
    // Public URL contract already used by the entrances; actual panels arrive in 10+.
    await page.evaluate(value => { location.hash = value; }, hash);
    await expect.poll(() => new URL(page.url()).hash).toBe(hash);
    await page.mouse.move(1200, 120);
    expect([await position(world), await position(background)]).toEqual(frozen);
    await page.goBack();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    await page.mouse.move(1100, 150);
    expect(Math.abs((await position(world)).x - frozen[0].x)).toBeGreaterThan(1);
  }
});

test('focus and page lifecycle freeze parallax for the entire celestial layer', async ({ page }) => {
  await page.goto('/?seed=0');
  const world = page.locator('.celestial-stage');
  const background = page.locator('#shader-canvas');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  await page.mouse.move(100, 700);
  for (const [stop, resume] of [['blur', 'focus'], ['pagehide', 'pageshow']]) {
    const frozen = [await position(world), await position(background)];
    await page.evaluate(type => window.dispatchEvent(new Event(type)), stop);
    await page.mouse.move(1200, 120);
    expect([await position(world), await position(background)]).toEqual(frozen);
    await page.evaluate(type => window.dispatchEvent(new Event(type)), resume);
    await page.mouse.move(1100, 150);
    expect(Math.abs((await position(world)).x - frozen[0].x)).toBeGreaterThan(1);
    await page.mouse.move(100, 700);
  }
});

test('reduced motion keeps both layers still and can be changed without reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=2');
  const world = page.locator('.celestial-stage');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  const initial = [await position(world), await position(page.locator('#shader-canvas'))];
  await page.mouse.move(1200, 700);
  expect([await position(world), await position(page.locator('#shader-canvas'))]).toEqual(initial);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(100, 120);
  expect(Math.abs((await position(world)).x - initial[0].x)).toBeGreaterThan(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await position(world)).x).toBeCloseTo(initial[0].x, 3);
});
