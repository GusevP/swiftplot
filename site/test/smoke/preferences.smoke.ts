import { expect, test } from '@playwright/test';

test('the theme and the framework survive a reload, and ?fw= overrides without saving', async ({ page }) => {
  const failed: string[] = [];
  page.on('requestfailed', request => failed.push(request.url()));
  page.on('response', response => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  const root = page.locator('html');
  const select = page.getByLabel('Framework');

  await page.goto('/');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await select.selectOption('vue');
  await expect(root).toHaveAttribute('data-fw', 'vue');

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
  await expect(root).toHaveAttribute('data-fw', 'vue');
  await expect(select).toHaveValue('vue');

  await page.goto('/?fw=react');
  await expect(root).toHaveAttribute('data-fw', 'react');
  await expect(select).toHaveValue('react');
  expect(await page.evaluate(() => localStorage.getItem('fw'))).toBe('vue');

  await page.goto('/');
  await expect(select).toHaveValue('vue');
  expect(failed).toEqual([]);
});

for (const width of [360, 490]) {
  test(`the top bar wraps to two rows at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.locator('header.bar').evaluate(bar => {
      const boxes = [...bar.children]
        .filter(child => child instanceof HTMLElement && child.offsetParent !== null)
        .map(child => child.getBoundingClientRect())
        .sort((a, b) => a.top - b.top);
      let count = 0;
      let bottom = -Infinity;
      for (const box of boxes) {
        if (box.top >= bottom) count++;
        bottom = Math.max(bottom, box.bottom);
      }
      return count;
    });
    expect(rows).toBe(2);
  });
}
