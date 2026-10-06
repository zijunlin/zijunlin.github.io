import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { imageDifference } from '../helpers/image-difference.mjs';

test('closing a preview consumes its history entry and forward restores its directory', async ({ page }) => {
  await page.goto('/?world=system&seed=3');
  await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).click();
  const directory = page.getByRole('region', { name: '作品', exact: true });
  await directory.locator('summary').click();
  const opener = directory.getByRole('link', { name: '查看作品预览' });
  await opener.click();
  const preview = page.getByRole('dialog');
  await preview.getByRole('button', { name: '关闭作品预览' }).click();
  await expect(page).toHaveURL(/#work$/);
  await expect(opener).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\?world=system&seed=3$/);
  await expect(preview).toBeHidden();
  await page.goForward();
  await expect(directory).toBeVisible();
  await page.goForward();
  await expect(preview).toBeVisible();
  await expect(directory).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(directory.locator('details')).toHaveAttribute('open', '');
});

test('a shared preview closes inside the site without adding another preview to Back', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/?world=island&seed=4#notes');
  await page.goto('/?world=island&seed=4#work/platform');
  await page.reload();
  await page.getByRole('button', { name: '关闭作品预览' }).click();
  await expect(page).toHaveURL(/\?world=island&seed=4$/);
  await expect(page.getByRole('navigation').getByRole('link', { name: '首页', exact: true })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/#notes$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

for (const [form, seed] of [['island', 0], ['island', 4], ['system', 2], ['system', 3]]) {
  test(`preview preserves the world and selected directory in ${form}/${seed}`, async ({ page }) => {
    test.setTimeout(60000);
    // Keep the world renderer; the background's motion is verified separately.
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl' ? null : getContext.call(this, type, ...args);
      };
    });
    await page.goto(`/?world=${form}&seed=${seed}`);
    const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
    const scene = world.getByRole('img');
    await expect(scene).toBeVisible();
    await scene.screenshot({ animations: 'disabled' });
    await page.mouse.move(100, 700);
    const entrance = world.getByRole('link', { name: '作品集', exact: true });
    await entrance.focus();
    await page.keyboard.press('Enter');
    const directory = page.getByRole('region', { name: '作品', exact: true });
    await directory.locator('summary').click();
    const before = await scene.boundingBox();
    const label = await page.getByLabel('世界形态与空间布局').textContent();
    await directory.getByRole('link', { name: '查看作品预览' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.mouse.move(1200, 100);
    expect(await scene.boundingBox()).toEqual(before);
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(directory.locator('details')).toHaveAttribute('open', '');
    await expect(entrance).toHaveClass(/is-active/);
    expect(await scene.boundingBox()).toEqual(before);
    await expect(page.getByLabel('世界形态与空间布局')).toHaveText(label);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`\\?world=${form}&seed=${seed}$`));
    await expect(directory).toBeHidden();
    expect(await scene.boundingBox()).toEqual(before);
  });
}

test('closing a world preview restores background brightness, motion and the guide station', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
  await page.goto('/?world=system&seed=514018');
  await page.clock.runFor(1000);
  const character = page.getByRole('group', { name: '主角精灵：随行创造者' });
  await expect(character).toBeVisible();
  const station = await character.boundingBox();
  const capture = () => page.screenshot({ clip: { x: 1030, y: 120, width: 200, height: 520 } });
  async function sample() {
    const first = await capture();
    await page.clock.runFor(1500);
    const second = await capture();
    const png = PNG.sync.read(first);
    let total = 0;
    for (let i = 0; i < png.data.length; i += 4) total += png.data[i] + png.data[i + 1] + png.data[i + 2];
    return { brightness: total / (png.width * png.height * 3), motion: imageDifference(first, second) };
  }
  const normal = await sample();
  const entrance = page.getByRole('link', { name: '精选作品 · 智能语音平台' });
  await entrance.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  const dimmed = await sample();
  expect((await character.boundingBox()).x).toBeCloseTo(station.x, 1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(entrance).toBeFocused();
  const restored = await sample();
  expect(restored.brightness).toBeGreaterThan(dimmed.brightness * 1.5);
  expect(restored.brightness / normal.brightness).toBeGreaterThan(0.9);
  expect(restored.brightness / normal.brightness).toBeLessThan(1.1);
  expect(restored.motion).toBeGreaterThan(0.02);
  expect(restored.motion / restored.brightness).toBeGreaterThan(dimmed.motion / dimmed.brightness * 1.5);
  expect((await character.boundingBox()).x).toBeCloseTo(station.x, 1);
  await expect(character.locator('.head')).toHaveCSS('animation-play-state', 'running');
});

test('reloading a preview restores its career context and closes back to the source', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?world=system&seed=3#career');
  const career = page.getByRole('region', { name: '职业历程', exact: true });
  const character = page.getByRole('group', { name: '主角精灵：随行创造者' });
  await expect(character).toBeVisible();
  const before = await character.boundingBox();
  await career.getByRole('link', { name: '查看关联作品：智能语音平台' }).click();
  await page.reload();
  const preview = page.getByRole('dialog');
  await expect(preview).toBeVisible();
  await expect(career).toBeVisible();
  await expect(character).toBeVisible();
  expect((await character.boundingBox()).x).toBeCloseTo(before.x, 1);
  await preview.getByRole('button', { name: '返回浏览', exact: true }).click();
  await expect(page).toHaveURL(/#career$/);
  await expect(career.getByRole('link', { name: '查看关联作品：智能语音平台' })).toBeFocused();
  await page.goForward();
  await expect(preview).toBeVisible();
  await page.goBack();
  await expect(career).toBeVisible();
  await expect(preview).toBeHidden();
});
