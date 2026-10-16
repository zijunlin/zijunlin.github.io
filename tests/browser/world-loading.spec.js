import { test, expect } from '@playwright/test';

// These two loading-timing checks deliberately use the static fallback. Real
// WebGL startup and moving graphics have their own rendering checks.
async function useStaticBackground(page) {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
}

// Hold the real production scene chunk at the network boundary, never a
// production delay switch or an internal readiness flag.
async function holdScene(page) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/world-scene-*.js', async route => {
    await gate;
    await route.continue();
  });
  return release;
}

test('slow initialization shows celestial points then reveals the page', async ({ page }) => {
  const release = await holdScene(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveText('正在构建世界');
  await expect(loading.locator('svg')).toBeVisible();
  await expect(loading.locator('svg circle')).toHaveCount(4);
  await expect(loading.locator('svg ellipse, svg path')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toHaveCount(0);
  await expect(page.getByRole('navigation')).toBeVisible();
  release();
  await expect(loading).toBeHidden();
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
});

async function observeLoading(page) {
  await page.addInitScript(() => {
    window.loadingObservations = [];
    window.entrancePositions = [];
    function observe() {
      const heading = document.querySelector('h1');
      if (heading?.checkVisibility()) window.entrancePositions.push(heading.getBoundingClientRect().y);
      const status = document.querySelector('[role="status"]');
      if (status) {
        const style = getComputedStyle(status);
        window.loadingObservations.push({
          at: performance.now(),
          visible: style.display !== 'none' && style.visibility === 'visible',
        });
      }
      requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  });
}

test('the fallback loading outline stays hidden for about 400ms while scripts download', async ({ page }) => {
  await useStaticBackground(page);
  await observeLoading(page);
  const release = await holdScene(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status')).toBeVisible();
  const observations = await page.evaluate(() => window.loadingObservations);
  const first = observations[0];
  const revealed = observations.find(sample => sample.visible);
  expect(first.visible).toBe(false);
  expect(revealed.at - first.at).toBeGreaterThan(330);
  expect(revealed.at - first.at).toBeLessThan(1000);
  release();
  await expect(page.getByRole('status')).toBeHidden();
});

test('fast static homepage initialization skips the loading message and plays a brief entrance once', async ({ page }) => {
  await useStaticBackground(page);
  // Dynamic rendering is covered separately.
  await observeLoading(page);
  await page.goto('/');
  const heading = page.getByRole('heading', { name: '在构建中，保持好奇。' });
  await expect(heading).toBeVisible();
  await page.waitForTimeout(950);
  const atRest = await heading.boundingBox();
  const observations = await page.evaluate(() => window.loadingObservations);
  expect(observations.some(sample => sample.visible)).toBe(false);
  const positions = await page.evaluate(() => window.entrancePositions);
  const displacement = Math.max(...positions) - Math.min(...positions);
  expect(displacement).toBeGreaterThan(0.5);
  // The approved entrance moves only seven pixels and ends within 900ms.
  expect(displacement).toBeLessThanOrEqual(7);
  await page.waitForTimeout(300);
  expect((await heading.boundingBox()).y).toBeCloseTo(atRest.y, 1);
});

test('a rejected world resource stops loading and shows a concise failure message', async ({ page }) => {
  await page.route('**/assets/world-scene-*.js', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('世界暂时无法显示');
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText(/Error|stack|import/);
  await page.waitForTimeout(600);
  await expect(page.getByRole('status')).toBeHidden();
});

test('background initialization failure does not block world initialization', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '在构建中，保持好奇。' })).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.locator('#shader-canvas')).toBeHidden();
});
