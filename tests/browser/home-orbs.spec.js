import { test, expect } from '@playwright/test';
import { discPixels, warmParticlePixels, haloBrightness, orbHorizontalShift } from '../helpers/orb-pixels.js';

test('four visible discs share the background surface and match semantic hit areas', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=0');
  const links = page.locator('.celestial-gate');
  await expect(links).toHaveCount(4);
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  const pixels = await page.locator('#shader-canvas').screenshot({ path: info.outputPath('home-surface.png'), style: '.celestial-stage { visibility: hidden !important; }' });
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    const disc = discPixels(pixels, box, page.viewportSize());
    for (const edge of disc.edges) expect(edge.contrast, 'the visible disc has a clear edge in the shared image').toBeGreaterThan(12);
    expect(disc.radius / box.width).toBeCloseTo(.0675, 2);
    await expect(link).toHaveAttribute('href', /^#(about|career|work|notes)$/);
  }
  await expect(page.locator('.celestial-gate svg, .celestial-gate canvas')).toHaveCount(0);
});

test('hover and keyboard focus enlarge the rendered disc and reveal warm particles', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=4');
  const entrance = page.locator('.celestial-gate').first();
  await expect(entrance).toBeVisible();
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  const box = await entrance.boundingBox();
  const before = discPixels(await page.screenshot(), box, page.viewportSize());
  await entrance.hover();
  await expect(entrance.locator('.orb-caption')).toBeVisible();
  const expanded = await page.screenshot({ path: info.outputPath('hover.png') });
  expect(warmParticlePixels(expanded, await entrance.boundingBox(), page.viewportSize())).toBeGreaterThan(6);
  const after = discPixels(expanded, await entrance.boundingBox(), page.viewportSize());
  expect(after.radius / before.radius).toBeGreaterThan(1.2);
  expect(after.radius / box.width).toBeCloseTo(.088, 2);
  await page.mouse.move(0, 0);
  await entrance.focus();
  await expect(entrance).toBeFocused();
  await expect(entrance).toHaveCSS('outline-style', 'solid');
  const focused = discPixels(await page.screenshot({ path: info.outputPath('focus.png') }), await entrance.boundingBox(), page.viewportSize());
  expect(focused.radius).toBeCloseTo(after.radius, 0);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#about$/);
  await page.keyboard.press('Escape');
  await expect(entrance).toBeFocused();
});

for (const [seed, viewport, deviceScaleFactor] of [
  [0, { width: 1024, height: 768 }, 1],
  [4, { width: 1920, height: 1080 }, 2],
  [0, { width: 390, height: 844 }, 3],
  [4, { width: 844, height: 390 }, 2],
]) {
  test(`visible discs retain their CSS size and density at ${viewport.width}x${viewport.height} DPR ${deviceScaleFactor}`, async ({ browser, baseURL }, info) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor, reducedMotion: 'reduce', hasTouch: viewport.width < 900 });
    try {
      await page.goto(`${baseURL}/?seed=${seed}`);
      await expect(page.locator('.celestial-gate')).toHaveCount(4);
      await page.locator('#world-entry').screenshot({ animations: 'disabled' });
      const pixels = await page.screenshot({ path: info.outputPath('density.png') });
      for (const link of await page.locator('.celestial-gate').all()) {
        const box = await link.boundingBox(), disc = discPixels(pixels, box, viewport);
        expect(disc.radius / box.width).toBeCloseTo(.0675, 2);
        for (const edge of disc.edges) expect(edge.contrast).toBeGreaterThan(10);
      }
      if (viewport.width < 900) {
        await page.locator('.celestial-gate[href="#work"]').tap();
        await expect(page.locator('#work-panel-title')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#work-panel-title')).toBeHidden();
      }
    } finally { await page.close(); }
  });
}

test('animated graphics follow hit areas through parallax, reading and resize', async ({ page }, info) => {
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0');
  const orb = page.locator('.celestial-gate').first();
  await expect(orb).toBeVisible();
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  await page.clock.runFor(200);
  const initial = await orb.boundingBox();
  await page.mouse.move(1200, 700); await page.clock.runFor(16);
  const moved = await orb.boundingBox();
  expect(Math.hypot(moved.x - initial.x, moved.y - initial.y)).toBeGreaterThan(1);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1000, height: 700 }]) {
    await page.setViewportSize(viewport); await page.clock.runFor(32);
    const pixels = await page.screenshot({ path: info.outputPath(`aligned-${viewport.width}.png`) });
    for (const link of await page.locator('.celestial-gate').all()) {
      const box = await link.boundingBox(), disc = discPixels(pixels, box, viewport);
      expect(disc.radius / box.width).toBeCloseTo(.0675, 2);
      for (const edge of disc.edges) expect(edge.contrast).toBeGreaterThan(12);
    }
  }
  await orb.focus(); await page.clock.runFor(800);
  const focused = await orb.boundingBox();
  await page.clock.runFor(800);
  expect(await orb.boundingBox()).toEqual(focused);
  await page.keyboard.press('Enter'); await page.clock.runFor(1000);
  expect(await orb.boundingBox()).toEqual(focused);
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('link', { name: '首页', exact: true }).focus();
  await page.clock.runFor(800);
  expect(Math.hypot((await orb.boundingBox()).x - focused.x, (await orb.boundingBox()).y - focused.y)).toBeGreaterThan(.5);
});


test('halo breathes, press feedback moves only the artwork, and blur freezes the image', async ({ page }, info) => {
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0');
  const orb = page.locator('.celestial-gate').first();
  await expect(orb).toBeVisible();
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  await orb.hover(); await page.clock.runFor(800);
  const box = await orb.boundingBox(), viewport = page.viewportSize();
  const early = haloBrightness(await page.screenshot(), box, viewport);
  await page.clock.runFor(1800);
  const bright = await page.screenshot({ path: info.outputPath('breathing.png') });
  expect(haloBrightness(bright, box, viewport) - early).toBeGreaterThan(2);
  await page.mouse.down(); await page.clock.runFor(48);
  const pressed = await page.screenshot({ path: info.outputPath('pressed.png') });
  // Correlate the whole disc so a bright infalling particle cannot masquerade as its edge.
  expect(Math.abs(orbHorizontalShift(bright, pressed, box, viewport))).toBeGreaterThan(.7);
  expect(await orb.boundingBox()).toEqual(box);
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
  await page.mouse.up(); await page.clock.runFor(250);
  await expect(page).not.toHaveURL(/#about$/);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const frozen = await page.screenshot();
  await page.clock.runFor(800);
  expect(await page.screenshot()).toEqual(frozen);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(300);
  expect(await page.screenshot()).not.toEqual(frozen);
});

test('a background tab gets a visible home image after its entrance settles', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(document, 'hasFocus', { value: () => false }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await expect(page.locator('#world-entry')).toHaveCSS('opacity', '1');
  const pixels = await page.screenshot({ path: info.outputPath('unfocused-home.png') });
  const box = await page.locator('.celestial-gate').first().boundingBox();
  for (const edge of discPixels(pixels, box, page.viewportSize()).edges) expect(edge.contrast).toBeGreaterThan(12);
  await expect(page.locator('#shader-canvas')).toHaveAttribute('data-motion', 'paused');
});

test('resizing a blurred page keeps visible discs aligned without advancing their orbit', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=4');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#shader-canvas')).toHaveAttribute('data-motion', 'paused');
  await page.setViewportSize({ width: 780, height: 960 });
  const pixels = await page.screenshot({ path: info.outputPath('blurred-resize.png') });
  for (const link of await page.locator('.celestial-gate').all()) {
    const box = await link.boundingBox();
    for (const edge of discPixels(pixels, box, page.viewportSize()).edges) expect(edge.contrast).toBeGreaterThan(12);
  }
  await expect(page.locator('#shader-canvas')).toHaveAttribute('data-motion', 'paused');
});
