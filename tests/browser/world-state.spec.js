import { test, expect } from '@playwright/test';

// World selection does not depend on GPU capability.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
});

test('a fixed seed selects a celestial layout before the scene is shown', async ({ page }) => {
  await page.goto('/?seed=514018');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
});

for (const [seed, combination] of [
  [0, '星辰圆点 · 环绕核心 · Shift + G'],
  [2, '星辰圆点 · 环绕核心 · Shift + G'],
  [3, '星辰圆点 · 成长路径 · Shift + G'],
  [4, '星辰圆点 · 成长路径 · Shift + G'],
]) {
  test(`seed ${seed} reproduces ${combination}`, async ({ page }) => {
    await page.goto(`/?seed=${seed}`);
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText(combination);
  });
}

test('the entry timestamp is retained across reload, visibility, and content URL changes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
  await page.goto('/');
  const combination = page.getByLabel('世界形态与空间布局');
  await expect(combination).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  await page.clock.setFixedTime(new Date('2026-10-05T18:00:00Z'));
  await page.reload();
  await expect(combination).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    location.hash = '#work';
  });
  await expect(combination).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  await page.goBack();
  await expect(combination).toHaveText('星辰圆点 · 成长路径 · Shift + G');
});

test('a new tab without session state uses its own entry time', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
  await page.goto('/');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  const other = await context.newPage();
  await other.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await other.clock.setFixedTime(new Date('2026-10-05T18:00:00Z'));
  await other.goto('/');
  await expect(other.getByLabel('世界形态与空间布局')).toHaveText('星辰圆点 · 环绕核心 · Shift + G');
});

test('slow mounting never displays a default combination before the chosen one', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/world-scene-*.js', async route => {
    await gate;
    await route.continue();
  });
  await page.addInitScript(() => {
    window.visibleCombinations = [];
    function record() {
      const combination = document.querySelector('[aria-label="世界形态与空间布局"]');
      if (combination?.checkVisibility()) window.visibleCombinations.push(combination.textContent);
      requestAnimationFrame(record);
    }
    requestAnimationFrame(record);
  });
  await page.goto('/?seed=3', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByLabel('世界形态与空间布局')).toHaveCount(0);
  release();
  await expect(page.getByLabel('世界形态与空间布局')).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...new Set(window.visibleCombinations)]))
    .toEqual(['星辰圆点 · 成长路径 · Shift + G']);
});

for (const stored of ['not-a-number', '-1', 'Infinity', '1.5']) {
  test(`invalid stored seed ${stored} recovers to the entry timestamp`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
    await page.addInitScript(value => sessionStorage.setItem('world-entry-seed', value), stored);
    await page.goto('/');
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  });
}

test('blocked storage still gives background and scene a usable entry', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('星辰圆点 · 成长路径 · Shift + G');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('retired world parameters do not change the celestial view or layout', async ({ page }) => {
  for (const value of ['island', 'system', 'unknown']) {
    await page.goto(`/?seed=3&world=${value}`);
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText('星辰圆点 · 成长路径 · Shift + G');
    await expect(page.locator('.celestial-gate')).toHaveCount(4);
    await expect(page.locator('.world-stage canvas, .world-protagonist-slot')).toHaveCount(0);
  }
});
