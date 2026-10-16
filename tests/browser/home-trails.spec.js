import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { discPixels } from '../helpers/orb-pixels.js';
import { imageDifference } from '../helpers/image-difference.mjs';
import { entranceCenters, trailContrast, trajectorySample, remapTrajectory, discTrailSamples, discTrailContrast, trailStrength, trailWidth } from '../helpers/trail-pixels.js';

test.setTimeout(120000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 17;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  });
});
async function changeMotion(page, reduced) {
  // WebKit dispatches preference changes asynchronously. Await the browser
  // event before advancing the functional clock or sampling the frozen phase.
  await page.evaluate(value => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    window.motionChanged = query.matches === value ? Promise.resolve()
      : new Promise(resolve => query.addEventListener('change', () => resolve(), { once: true }));
  }, reduced);
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.evaluate(() => window.motionChanged);
}

for (const seed of [0, 4]) {
  test(`layout ${seed} draws fading tracks on the shared surface along the travelled orbit`, async ({ page }, info) => {
    const time = new Date('2026-10-14T00:00:00Z');
    await page.clock.install({ time }); await page.clock.pauseAt(time);
    await page.goto(`/?seed=${seed}`);
    await expect(page.locator('.celestial-gate')).toHaveCount(4);
    await page.locator('#world-entry').screenshot({ animations: 'disabled' });
    // Cancel a game request while a pointer postpones its start. The public
    // cancel action consumes automatic entry, so normal hover remains testable.
    await page.mouse.move(5, 760); await page.mouse.down();
    await page.keyboard.press('Shift+G'); await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.getByRole('navigation').getByRole('link', { name: '首页', exact: true }).focus();
    await page.clock.runFor(16);
    await expect(page.locator('.space-game')).toHaveCount(0);
    const initialStage = await page.locator('.celestial-stage').boundingBox();
    const history = [await entranceCenters(page)];
    for (let i = 0; i < 12; i++) {
      await page.clock.runFor(2000); history.push(await entranceCenters(page));
    }
    const pixels = await page.locator('#shader-canvas').screenshot({
      path: info.outputPath(`trails-${seed}.png`), style: '.celestial-stage { visibility: hidden !important; }',
    });
    for (let orb = 0; orb < 4; orb++) {
      const { point, tangent } = trajectorySample(history, orb === 0 ? 10 : 6, orb);
      expect(trailContrast(pixels, point, tangent, page.viewportSize()), `track ${orb} is visible at its earlier screen position`).toBeGreaterThan(3);
    }
    const fullPage = await page.screenshot({ path: info.outputPath(`composed-${seed}.png`) });
    const centers = await entranceCenters(page);
    await writeFile(info.outputPath('disc-occlusion-samples.json'), JSON.stringify(centers.map((center, orb) =>
      discTrailSamples(fullPage, center, history, orb, center.size * .0675, page.viewportSize())), null, 2));
    for (let orb = 0; orb < 4; orb++) {
      expect(discTrailContrast(fullPage, centers[orb], history, orb, centers[orb].size * .0675, page.viewportSize()),
        `the composed disc ${orb} occludes its track`).toBeLessThan(3);
    }
    const outer = index => {
      const { point, tangent } = trajectorySample(history, index, 3);
      return trailStrength(fullPage, point, tangent, page.viewportSize());
    };
    expect(outer(6), 'the travelled track fades toward its tail').toBeGreaterThan(outer(2) + 1);
    await expect(page.locator('.celestial-stage svg, .celestial-stage canvas')).toHaveCount(0);

    // Hover changes both the visible disc and its numerical cutout. Keep the
    // actual full page in these checks, including all halos and particles.
    const first = page.locator('.celestial-gate').first();
    await first.hover(); await page.clock.runFor(800);
    for (const viewport of [{ width: 1280, height: 800 }, { width: 1000, height: 700 }]) {
      await page.setViewportSize(viewport); await page.clock.runFor(32);
      await first.hover(); await page.clock.runFor(32);
      const movedStage = await page.locator('.celestial-stage').boundingBox();
      const adjusted = remapTrajectory(history, initialStage, movedStage);
      const image = await page.screenshot({ path: info.outputPath(`occlusion-${seed}-${viewport.width}.png`) });
      const box = await first.boundingBox(), center = (await entranceCenters(page))[0];
      const disc = discPixels(image, box, viewport);
      // Use the established visual radius for the narrow newly enlarged ring;
      // the independently measured edge can quantize by a pixel at DPR1.
      const probeRadius = box.width * .088;
      await writeFile(info.outputPath(`hover-occlusion-samples-${viewport.width}.json`), JSON.stringify({ center, radius: disc.radius, probeRadius,
        samples: discTrailSamples(image, center, adjusted, 0, probeRadius, viewport, [.86, .88, .9]) }, null, 2));
      expect(disc.radius / box.width).toBeCloseTo(.088, 2);
      expect.soft(discTrailContrast(image, center, adjusted, 0, probeRadius, viewport, [.86, .88, .9]), 'hovered disc occludes its newly enlarged ring after parallax and resize').toBeLessThan(3);
      const probe = trajectorySample(adjusted, 10, 0);
      expect(trailContrast(image, probe.point, probe.tangent, viewport), 'track stays aligned while its disc and viewport change').toBeGreaterThan(3);
    }
  });
}

test('reading, blur, hidden pages and reduced motion retain the trail phase, then normal motion resumes', async ({ page }, info) => {
  const time = new Date('2026-10-14T00:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-gate')).toHaveCount(4);
  await page.locator('#world-entry').screenshot({ animations: 'disabled' });
  await page.clock.runFor(5000);
  const initialStage = await page.locator('.celestial-stage').boundingBox();
  const history = [await entranceCenters(page)];
  for (let i = 0; i < 2; i++) { await page.clock.runFor(1000); history.push(await entranceCenters(page)); }
  await page.clock.runFor(1500);
  const probeNow = async () => trajectorySample(remapTrajectory(history, initialStage, await page.locator('.celestial-stage').boundingBox()), 1, 0);
  await page.locator('nav a[href="#about"]').click(); await page.clock.runFor(500);
  const paused = await entranceCenters(page);
  await page.clock.runFor(4000);
  expect(await entranceCenters(page)).toEqual(paused);
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('link', { name: '首页', exact: true }).focus();
  await page.clock.runFor(500); // Allow the reading panel's CSS exit to settle.
  let probe = await probeNow();
  const returned = await page.screenshot({ path: info.outputPath('reading-return.png') });
  expect(trailContrast(returned, probe.point, probe.tangent, page.viewportSize())).toBeGreaterThan(3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    window.dispatchEvent(new Event('blur'));
  });
  const blurred = await page.screenshot();
  await page.clock.runFor(3000);
  expect(imageDifference(blurred, await page.screenshot()), 'blur freezes the composed image').toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hasFocus;
    window.dispatchEvent(new Event('focus'));
  });
  await page.clock.runFor(1000);
  expect(imageDifference(blurred, await page.screenshot()), 'hidden pages remain frozen even after a focus event').toBe(0);
  // Hold a pointer again before advancing eligible time beyond automatic entry.
  await page.mouse.down();
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await changeMotion(page, true); await page.clock.runFor(100);
  const reduced = await entranceCenters(page);
  await page.clock.runFor(2000);
  expect(await entranceCenters(page)).toEqual(reduced);
  probe = await probeNow();
  expect(trailContrast(await page.screenshot({ path: info.outputPath('reduced-trail.png') }), probe.point, probe.tangent, page.viewportSize())).toBeGreaterThan(3);
  await changeMotion(page, false); await page.clock.runFor(700);
  expect((await entranceCenters(page))[0].x).toBeGreaterThan(reduced[0].x + 2);
});


for (const [viewport, deviceScaleFactor] of [[{ width: 1024, height: 768 }, 2], [{ width: 390, height: 844 }, 3]]) {
  test(`trail stroke stays thin through responsive scaling at ${viewport.width} DPR ${deviceScaleFactor}`, async ({ browser, baseURL }, info) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    try {
      const time = new Date('2026-10-14T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      await page.goto(`${baseURL}/?seed=0`);
      await expect(page.locator('.celestial-gate')).toHaveCount(4);
      await page.locator('#world-entry').screenshot({ animations: 'disabled' });
      await page.clock.runFor(3000);
      const stage = await page.locator('.celestial-stage').boundingBox();
      const history = [await entranceCenters(page)];
      for (let i = 0; i < 2; i++) { await page.clock.runFor(1000); history.push(await entranceCenters(page)); }
      await page.clock.runFor(4000);
      await changeMotion(page, true);
      for (const size of [viewport, { width: 844, height: 390 }]) {
        await page.setViewportSize(size); await page.clock.runFor(32);
        const adjusted = remapTrajectory(history, stage, await page.locator('.celestial-stage').boundingBox());
        const probe = trajectorySample(adjusted, 1, 0);
        const pixels = await page.screenshot({ path: info.outputPath(`stroke-${size.width}-${deviceScaleFactor}.png`) });
        expect(trailContrast(pixels, probe.point, probe.tangent, size), 'the thin line remains visible at native density').toBeGreaterThan(3);
        const width = trailWidth(pixels, probe.point, probe.tangent, size);
        expect(width).toBeGreaterThan(.3);
        expect(width, 'stroke width is in CSS pixels, independent of stage scale').toBeLessThan(1.6);
      }
    } finally { await page.close(); }
  });
}
