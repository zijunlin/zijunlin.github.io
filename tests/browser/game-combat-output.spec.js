import { test, expect } from '@playwright/test';
import { startCombat } from '../helpers/combat-scenario.js';
import { sharedImage, colorPixels } from '../helpers/game-canvas.js';
import { writeFileSync } from 'node:fs';

test.use({ reducedMotion: 'reduce' });
test('shared combat output preserves warning, translucent fill, edge clipping and visible explosion', async ({ page }, info) => {
  test.setTimeout(120000);
  await startCombat(page, { random: "purpose => purpose === 'position' ? (window.combatPosition ?? .3) : .5", advance: 3200 });
  const header = await page.locator('.site-header').boundingBox(), top = header.y + header.height;
  const background = await sharedImage(page);
  await page.clock.runFor(1100);
  const warning = await sharedImage(page);
  expect(colorPixels(warning, [244,200,128], { x: 359, y: top, width: 50, height: 30 })).toBeGreaterThan(15);
  await page.screenshot({ path: info.outputPath('edge-warning.png') });
  await page.clock.runFor(800);
  const edge = await sharedImage(page);
  writeFileSync(info.outputPath('edge-state.json'), JSON.stringify({top,state:await page.evaluate(() => window.battleSnapshot)},null,2));
  await page.screenshot({ path: info.outputPath('clipped-obstacle.png') });
  expect(colorPixels(edge, [223,167,150], { x: 354, y: top, width: 60, height: 35 })).toBeGreaterThan(5);
  expect(colorPixels(edge, [223,167,150], { x: 354, y: top - 30, width: 60, height: 30 })).toBe(0);
  await page.clock.runFor(600);
  const image = await sharedImage(page), state = await page.evaluate(() => window.battleSnapshot);
  const obstacle = state.obstacles.find(value => value.warning === 0);
  expect(obstacle).toBeTruthy();
  let translucent = 0;
  for (let y = Math.ceil(obstacle.y - 7); y < obstacle.y + 7; y++) for (let x = Math.ceil(obstacle.x - 7); x < obstacle.x + 7; x++) {
    const i = (y * image.width + x) * 4;
    if ([118,93,89].every((v,c) => Math.abs(image.data[i+c] - (v * 170/255 + background.data[i+c] * 85/255)) < 8)) translucent++;
  }
  expect(translucent, 'obstacle interior blends with the displayed background').toBeGreaterThan(20);
  await page.screenshot({ path: info.outputPath('translucent-obstacle.png') });
  await page.keyboard.down('ArrowUp'); await page.clock.runFor(1000); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowLeft'); await page.clock.runFor(650); await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Space');
  let particles = 0;
  for (let n = 0; n < 35 && particles < 3; n++) {
    await page.clock.runFor(100);
    const snapshot = await page.evaluate(() => window.battleSnapshot);
    if (!snapshot.particles.length) continue;
    const explosion = await sharedImage(page);
    const positions = new Set();
    particles = 0;
    for (const particle of snapshot.particles) {
      const x = Math.floor(particle.x), y = Math.floor(particle.y), i = (y * explosion.width + x) * 4;
      if (y < top || x < 0 || x >= explosion.width || y >= explosion.height) continue;
      const alpha = Math.min(1, particle.life / .45);
      if (alpha < .5 || positions.has(`${x},${y}`) || explosion.data[i] - background.data[i] < 30) continue;
      positions.add(`${x},${y}`);
      if ([255,211,155].every((v,c) => Math.abs(explosion.data[i+c] - (v * alpha + background.data[i+c] * (1-alpha))) < 22)) particles++;
    }
    if (particles >= 3) await page.screenshot({ path: info.outputPath('explosion-particles.png') });
  }
  expect(particles, 'at least three distinct particle pixels survive final composition').toBeGreaterThanOrEqual(3);
  const visible = await sharedImage(page);
  expect(colorPixels(visible, [201,245,250])).toBeGreaterThan(10);
  const hidden = await page.addStyleTag({ content: '#shader-canvas { opacity: 0 !important; }' });
  expect(colorPixels(await sharedImage(page), [201,245,250]), 'negative control: a hidden final surface cannot pass with source pixels').toBe(0);
  await hidden.evaluate(element => element.remove());
});
