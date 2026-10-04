import { test, expect } from '@playwright/test';

async function position(locator) {
  const box = await locator.boundingBox();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

test('pointer depth is small, layered and keeps camera framing fixed', async ({ page }) => {
  await page.goto('/?world=system&seed=3');
  const world = page.getByRole('img', { name: '层叠曲面系统空间' });
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
  await page.goto('/?world=island&seed=4');
  const world = page.getByRole('img', { name: '层叠曲面小岛' });
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

test('focus and page lifecycle freeze parallax without moving the character slot separately', async ({ page }) => {
  await page.goto('/?world=island&seed=0');
  const world = page.getByRole('img', { name: '层叠曲面小岛' });
  const background = page.locator('#shader-canvas');
  const character = page.locator('.world-protagonist-slot');
  await expect(world).toBeVisible();
  await world.screenshot({ animations: 'disabled' });
  await page.mouse.move(100, 700);
  const initial = await position(world);
  const characterInitial = await position(character);
  for (const [stop, resume] of [['blur', 'focus'], ['pagehide', 'pageshow']]) {
    const frozen = [await position(world), await position(background), await position(character)];
    await page.evaluate(type => window.dispatchEvent(new Event(type)), stop);
    await page.mouse.move(1200, 120);
    expect([await position(world), await position(background), await position(character)]).toEqual(frozen);
    await page.evaluate(type => window.dispatchEvent(new Event(type)), resume);
    await page.mouse.move(1100, 150);
    expect(Math.abs((await position(world)).x - frozen[0].x)).toBeGreaterThan(1);
    await page.mouse.move(100, 700);
  }
  await page.mouse.move(1200, 120);
  const after = await position(world);
  const characterAfter = await position(character);
  expect(characterAfter.x - characterInitial.x).toBeCloseTo(after.x - initial.x, 3);
  expect(characterAfter.y - characterInitial.y).toBeCloseTo(after.y - initial.y, 3);
});

test('reduced motion keeps both layers still and can be changed without reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?world=system&seed=2');
  const world = page.getByRole('img', { name: '层叠曲面系统空间' });
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

test('all combinations retain the reading band and clickable objects at maximum displacement', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  for (const [form, seed] of [['island', 0], ['island', 4], ['system', 2], ['system', 3]]) {
    await page.goto(`/?world=${form}&seed=${seed}`);
    const area = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
    const world = area.getByRole('img');
    await expect(world).toBeVisible();
    await world.screenshot({ animations: 'disabled' });
    await page.mouse.move(1023, 384);
    const frame = await world.boundingBox();
    const content = await page.getByRole('main').boundingBox();
    expect(frame.x + frame.width).toBeLessThanOrEqual(content.x + content.width - 280 - 28 + 0.01);
    await page.mouse.move(1, 384);
    expect((await world.boundingBox()).x).toBeGreaterThanOrEqual(content.x - 0.01);
    // The visible work object remains a usable target after the layer moves.
    const workPoint = seed === 0 || seed === 2 ? [322, 235] : [367, 235];
    let box = await world.boundingBox();
    await page.mouse.move(box.x + workPoint[0] / 640 * box.width, box.y + workPoint[1] / 440 * box.height);
    box = await world.boundingBox();
    await page.mouse.click(box.x + workPoint[0] / 640 * box.width, box.y + workPoint[1] / 440 * box.height);
    await expect(page).toHaveURL(/#work$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
