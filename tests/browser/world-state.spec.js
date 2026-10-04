import { test, expect } from '@playwright/test';

// World selection does not depend on GPU capability.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
});

test('a fixed seed selects a world form and layout before the scene is shown', async ({ page }) => {
  await page.goto('/?seed=514018');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
});

for (const [seed, combination] of [
  [0, '建筑地形小岛 · 环绕核心'],
  [2, '抽象系统空间 · 环绕核心'],
  [3, '抽象系统空间 · 成长路径'],
  [4, '建筑地形小岛 · 成长路径'],
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
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
  await page.clock.setFixedTime(new Date('2026-10-05T18:00:00Z'));
  await page.reload();
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    location.hash = '#work';
  });
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
  await page.goBack();
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
});

test('a new tab without session state uses its own entry time', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
  await page.goto('/');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  const other = await context.newPage();
  await other.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await other.clock.setFixedTime(new Date('2026-10-05T18:00:00Z'));
  await other.goto('/');
  await expect(other.getByLabel('世界形态与空间布局')).toHaveText('建筑地形小岛 · 环绕核心');
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
    .toEqual(['抽象系统空间 · 成长路径']);
});

for (const stored of ['not-a-number', '-1', 'Infinity', '1.5']) {
  test(`invalid stored seed ${stored} recovers to the entry timestamp`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
    await page.addInitScript(value => sessionStorage.setItem('world-entry-seed', value), stored);
    await page.goto('/');
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  });
}

test('blocked storage still gives background and scene a usable entry', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.getByLabel('世界形态与空间布局')).toHaveText('抽象系统空间 · 成长路径');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('the world URL overrides form while preserving the seeded layout', async ({ page }) => {
  for (const [seed, layout] of [[2, '环绕核心'], [3, '成长路径']]) {
    await page.goto(`/?seed=${seed}&world=island`);
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText(`建筑地形小岛 · ${layout}`);
  }
  for (const [seed, layout] of [[0, '环绕核心'], [4, '成长路径']]) {
    await page.goto(`/?seed=${seed}&world=system`);
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText(`抽象系统空间 · ${layout}`);
  }
});

test('missing and invalid world values retain automatic selection', async ({ page }) => {
  for (const value of [null, '', 'ocean', 'ISLAND', ' system ', '%']) {
    for (const [seed, expected] of [[2, '抽象系统空间 · 环绕核心'], [4, '建筑地形小岛 · 成长路径']]) {
      const query = new URLSearchParams({ seed: String(seed) });
      if (value !== null) query.set('world', value);
      await page.goto(`/?${query}`);
      await expect(page.getByLabel('世界形态与空间布局')).toHaveText(expected);
      await expect(page.getByRole('alert')).toBeHidden();
    }
  }
});

test('explicit links survive reload without replacing the automatic session choice', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00Z'));
  await page.goto('/?world=island');
  const combination = page.getByLabel('世界形态与空间布局');
  await expect(combination).toHaveText('建筑地形小岛 · 成长路径');
  await page.clock.setFixedTime(new Date('2026-10-05T18:00:00Z'));
  await page.reload();
  await expect(combination).toHaveText('建筑地形小岛 · 成长路径');
  await page.goto('/?world=system');
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
  await page.reload();
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
  await page.goto('/');
  await expect(combination).toHaveText('抽象系统空间 · 成长路径');
});

test('public pages have no world or layout switching controls', async ({ page }) => {
  await page.goto('/?world=island');
  await expect(page.getByLabel('世界形态与空间布局')).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /世界|布局|小岛|系统空间|环绕核心|成长路径/ })).toHaveCount(0);
  await expect(page.locator('a[href*="world="]')).toHaveCount(0);
});
