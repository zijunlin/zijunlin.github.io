import { test, expect } from '@playwright/test';

const regions = [
  ['关于我', 'about', '了解我的工程实践与关注方向。', -24],
  ['职业历程', 'career', '沿着项目经历，看看一路的选择。', -24],
  ['作品集', 'work', '从智能语音平台，了解我的工程实践。', 24],
  ['随笔', 'notes', '这里留给思考与记录，目前暂无正文。', 24],
];
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const [form, seed] of [['island', 0], ['island', 4], ['system', 2], ['system', 3]]) {
  test(`the guide responds without covering entrances or panels in ${form}/${seed}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Geometry checks do not need continuous background frames on the software GPU.
    await page.clock.install({ time: new Date('2026-10-04T10:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-04T10:00:01Z'));
    await page.goto(`/?world=${form}&seed=${seed}`);
    await page.clock.runFor(1000);
    const world = page.getByRole('region', { name: /建筑地形小岛|抽象系统空间/ });
    const character = world.getByRole('group', { name: '主角精灵：随行创造者' });
    await expect(character).toBeVisible();
    await character.screenshot({ animations: 'disabled' });
    const initial = await character.boundingBox();
    const frame = await world.getByRole('img').boundingBox();
    for (const [name, route, description, offset] of regions) {
      const link = world.getByRole('link', { name, exact: true });
      const annotation = world.getByText(description, { exact: true });
      await expect(annotation).toBeHidden();
      await link.hover();
      await expect(annotation).toBeVisible();
      expect((await character.boundingBox()).x).toBeCloseTo(initial.x, 1);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${route}$`));
      await page.mouse.move(5, 5);
      await expect(annotation).toBeVisible();
      await expect.poll(async () => ((await character.boundingBox()).x - initial.x) / frame.width * 640).toBeCloseTo(offset, 0);
      const panel = page.getByRole('region', { name: route === 'work' ? '作品' : name, exact: true });
      const body = await character.boundingBox();
      const note = await annotation.boundingBox();
      await expect(annotation).toBeInViewport();
      expect(note.y + note.height).toBeLessThanOrEqual(768);
      expect(overlaps(body, note)).toBe(false);
      expect(overlaps(note, await panel.boundingBox())).toBe(false);
      for (const target of await world.getByRole('link').all()) {
        expect(overlaps(body, await target.boundingBox())).toBe(false);
        expect(overlaps(note, await target.boundingBox())).toBe(false);
      }
      await page.getByRole('navigation').getByRole('link', { name: '首页', exact: true }).click();
      await expect(annotation).toBeHidden();
      await expect.poll(async () => (await character.boundingBox()).x).toBeCloseTo(initial.x, 1);
    }
  });
}

test('navigation, direct links and preview return preserve the guide context', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?world=system&seed=3#career');
  await page.reload();
  const world = page.getByRole('region', { name: '抽象系统空间 · 成长路径' });
  const character = world.getByRole('group', { name: '主角精灵：随行创造者' });
  await expect(character).toBeVisible();
  await character.screenshot({ animations: 'disabled' });
  const frame = await world.getByRole('img').boundingBox();
  const station = async () => {
    const box = await character.boundingBox();
    return (box.x + box.width / 2 - frame.x) / frame.width * 640;
  };
  await expect.poll(station).toBeCloseTo(278, 0);
  const note = world.getByText('沿着项目经历，看看一路的选择。', { exact: true });
  await expect(note).toBeVisible();
  await page.getByRole('region', { name: '职业历程', exact: true }).getByRole('link', { name: '查看关联作品：智能语音平台' }).click();
  await expect(page).toHaveURL(/#work\/platform$/);
  await expect(note).toBeHidden();
  await expect.poll(station).toBeCloseTo(278, 0);
  await page.goBack();
  await expect(note).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).click();
  await expect.poll(station).toBeCloseTo(326, 0);
  await expect(world.getByText('从智能语音平台，了解我的工程实践。', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(station).toBeCloseTo(302, 0);
});
