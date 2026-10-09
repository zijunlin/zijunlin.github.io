import { test, expect } from '@playwright/test';

for (const seed of [0, 4]) {
  test(`celestial entrances support keyboard navigation and pause while reading, seed ${seed}`, async ({ page }) => {
    await page.goto(`/?seed=${seed}`);
    const stage = page.locator('.celestial-stage');
    await expect(stage).toBeVisible();
    for (const [name, hash, title] of [['关于我', 'about', '关于我'], ['职业历程', 'career', '职业历程'], ['作品集', 'work', '作品'], ['随笔', 'notes', '随笔']]) {
      const entrance = stage.getByRole('link', { name, exact: true });
      await entrance.focus();
      await expect(entrance.locator('.orb-caption')).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`#${hash}$`));
      await expect(page.getByRole('region', { name: title, exact: true })).toBeVisible();
      await expect(stage).toHaveClass(/celestial-paused/);
      await page.keyboard.press('Escape');
      await expect(entrance).toBeFocused();
      await expect(stage).not.toHaveClass(/celestial-paused/);
    }
  });
}
