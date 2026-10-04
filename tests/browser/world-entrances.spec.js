import { test, expect } from '@playwright/test';
import { imageDifference } from '../helpers/image-difference.mjs';

const descriptions = [
  ['关于我', '了解我的工程实践与关注方向。'],
  ['职业历程', '沿着项目经历，看看一路的选择。'],
  ['作品集', '从智能语音平台，了解我的工程实践。'],
  ['随笔', '这里留给思考与记录，目前暂无正文。'],
];

test('world labels reveal short descriptions on hover and keyboard focus', async ({ page }) => {
  await page.goto('/?world=island&seed=0');
  const world = page.getByRole('region', { name: '建筑地形小岛 · 环绕核心' });
  for (const [name, description] of descriptions) {
    const link = world.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    await expect(world.getByText(description, { exact: true })).toBeHidden();
    await link.hover();
    await expect(world.getByText(description, { exact: true })).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(world.getByText(description, { exact: true })).toBeHidden();
    await link.focus();
    await expect(link).toHaveAccessibleDescription(description);
    await expect(world.getByText(description, { exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(world.getByText(description, { exact: true })).toBeHidden();
    await world.getByRole('link', { name: '精选作品 · 智能语音平台' }).focus();
  }
  const about = world.getByRole('link', { name: '关于我', exact: true });
  await about.hover();
  await about.focus();
  await page.keyboard.press('Tab');
  await expect(world.getByText(descriptions[1][1], { exact: true })).toBeVisible();
  await expect(world.getByText(descriptions[0][1], { exact: true })).toBeHidden();
});

// Points selected from the approved A/B renders in the 640×440 scene frame.
// They target visible objects and one empty margin, without reading scene internals.
const objectPoints = {
  A: [[284, 146], [169, 258], [322, 235], [474, 226]],
  B: [[184, 171], [259, 227], [367, 235], [439, 284]],
};
for (const form of ['island', 'system']) {
  for (const [seed, layout] of [[0, 'A'], [4, 'B']]) {
    test(`${form} ${layout} objects and forgiving margins share label destinations`, async ({ page }) => {
      test.setTimeout(60000);
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          return type === 'webgl' ? null : original.call(this, type, ...args);
        };
      });
      await page.goto(`/?world=${form}&seed=${seed}`);
      const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
      const image = world.getByRole('img');
      await expect(image).toBeVisible();
      await image.screenshot({ animations: 'disabled' });
      let frame = await image.boundingBox();
      const point = ([x, y]) => ({ x: frame.x + x / 640 * frame.width, y: frame.y + y / 440 * frame.height });
      for (let i = 0; i < descriptions.length; i++) {
        const [name, description] = descriptions[i];
        const link = world.getByRole('link', { name, exact: true });
        const destination = await link.getAttribute('href');
        const object = point(objectPoints[layout][i]);
        const clip = { x: object.x - 24, y: object.y - 24, width: 48, height: 48 };
        const before = i === 2 ? await page.screenshot({ clip }) : null;
        await page.mouse.move(object.x, object.y);
        await expect(world.getByText(description, { exact: true })).toBeVisible();
        if (before) expect(imageDifference(before, await page.screenshot({ clip }))).toBeGreaterThan(0.2);
        await page.mouse.click(object.x, object.y);
        await expect.poll(() => new URL(page.url()).hash).toBe(destination);
        await link.click();
        await expect.poll(() => new URL(page.url()).hash).toBe(destination);
      }
      const margin = point(layout === 'A' ? [284, 99] : [184, 125]);
      await page.mouse.move(margin.x, margin.y);
      await expect(world.getByText(descriptions[0][1], { exact: true })).toBeVisible();
      await page.mouse.click(margin.x, margin.y);
      await expect(page).toHaveURL(/#about$/);
      await world.getByRole('link', { name: '精选作品 · 智能语音平台' }).click();
      await expect(page).toHaveURL(/#work\/platform$/);
      await page.setViewportSize({ width: 1024, height: 768 });
      await image.screenshot({ animations: 'disabled' });
      frame = await image.boundingBox();
      const resized = point(objectPoints[layout][1]);
      await page.mouse.click(resized.x, resized.y);
      await expect(page).toHaveURL(/#career$/);
    });
  }
}
