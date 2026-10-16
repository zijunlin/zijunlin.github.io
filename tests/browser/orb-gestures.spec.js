import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/?seed=0');
  await expect(page.locator('.celestial-stage')).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
});

test('touch drag does not open content or leave an orb hovered and its orbit continues', async ({ page, context }) => {
  const orb = page.locator('.celestial-gate[href="#about"]');
  const box = await orb.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 20, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page).not.toHaveURL(/#about$/);
  await expect(orb.locator('.orb-caption')).not.toBeVisible();
  const before = await orb.boundingBox();
  await page.clock.runFor(1000);
  const after = await orb.boundingBox();
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(.1);
  await orb.tap();
  await expect(page.locator('#about-panel-title')).toBeVisible();
});


test('touch cancellation leaves navigation closed and releases the orbit', async ({ page, context }) => {
  const orb = page.locator('.celestial-gate[href="#notes"]');
  const box = await orb.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page).not.toHaveURL(/#notes$/);
  const before = await orb.boundingBox();
  await page.clock.runFor(1000);
  const after = await orb.boundingBox();
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(.1);
  await orb.tap();
  await expect(page.locator('#notes-panel-title')).toBeVisible();
});
