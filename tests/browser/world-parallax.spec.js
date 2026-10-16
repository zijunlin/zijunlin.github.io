import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

async function position(locator) {
  const box = await locator.boundingBox();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function backgroundShift(first, second) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  let best = { error: Infinity, x: 0, y: 0 }, unshifted;
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    let error = 0;
    for (let row = 4; row < a.height - 4; row += 3) for (let col = 4; col < a.width - 4; col += 3) {
      const i = (row * a.width + col) * 4, j = ((row + y) * b.width + col + x) * 4;
      for (let c = 0; c < 3; c++) error += Math.abs(a.data[i + c] - b.data[j + c]);
    }
    if (!x && !y) unshifted = error;
    if (error < best.error) best = { error, x, y };
  }
  expect(best.error).toBeLessThan(unshifted * .8);
  return Math.hypot(best.x, best.y);
}

test('pointer depth is small, layered and keeps camera framing fixed', async ({ page }) => {
  const start = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start);
  await page.goto('/?seed=3');
  const world = page.locator('.celestial-stage');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  await page.mouse.move(640, 400);
  // Both captures reuse the same cached field; only the composited position changes.
  await page.clock.runFor(64);
  const capture = () => page.screenshot({ clip: { x: 1030, y: 120, width: 200, height: 520 } });
  const beforePixels = await capture();
  const before = await position(world);
  const backdrop = await position(page.locator('#shader-canvas'));
  await page.mouse.move(1260, 780);
  await page.clock.runFor(16);
  await expect.poll(async () => Math.abs((await position(world)).x - before.x)).toBeGreaterThan(1);
  const after = await position(world);
  const backgroundAfter = await position(page.locator('#shader-canvas'));
  const worldTravel = Math.hypot(after.x - before.x, after.y - before.y);
  expect(backgroundAfter).toEqual(backdrop);
  const backgroundTravel = backgroundShift(beforePixels, await capture());
  expect(backgroundTravel).toBeGreaterThan(0.5);
  expect(worldTravel).toBeGreaterThan(backgroundTravel);
  expect(worldTravel + backgroundTravel).toBeLessThanOrEqual(10);
  expect(after.width).toBeCloseTo(before.width, 3);
  expect(after.height).toBeCloseTo(before.height, 3);
  await page.mouse.wheel(0, 300);
  expect((await position(world)).width).toBeCloseTo(before.width, 3);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('reading routes freeze celestial movement while shared surface framing stays fixed', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/?seed=4');
  const world = page.locator('.celestial-stage');
  const background = page.locator('#shader-canvas');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  for (const hash of ['#about', '#career', '#work', '#notes', '#work/platform']) {
    await page.mouse.move(100, 700);
    // Wait for the pointer update before freezing its position for navigation.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const frozen = [await position(world), await position(background)];
    // Public URL contract already used by the entrances; actual panels arrive in 10+.
    await page.evaluate(value => { location.hash = value; }, hash);
    await expect.poll(() => new URL(page.url()).hash).toBe(hash);
    await page.mouse.move(1200, 120);
    expect([await position(world), await position(background)]).toEqual(frozen);
    await page.goBack();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    await page.mouse.move(1100, 150);
    await expect.poll(async () => Math.abs((await position(world)).x - frozen[0].x)).toBeGreaterThan(1);
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

test('reduced motion keeps celestial movement still and shared framing fixed without reload', async ({ page }) => {
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
