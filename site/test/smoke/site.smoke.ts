import { expect, test } from '@playwright/test';
import { pages } from './built';
import { mountCharts, watch } from './charts';

test('an unknown URL answers 404 with the 404 page', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response!.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await page.locator('main').getByRole('link', { name: 'examples' }).click();
  await expect(page).toHaveURL('/examples');
});

for (const path of pages.keys())
  test(`${path} loads with no error, no request to another origin and no text run into a link`, async ({
    page,
  }) => {
    const errors = watch(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await mountCharts(page);
    expect(errors).toEqual([]);
    const runIn = await page.locator('main a').evaluateAll(links =>
      links.flatMap(a => {
        const before = a.previousSibling?.nodeType === Node.TEXT_NODE ? a.previousSibling.textContent! : '';
        return /[\p{L}\p{N}.,;:]$/u.test(before) ? [`${before.slice(-20)}${a.textContent}`] : [];
      }),
    );
    expect(runIn).toEqual([]);
  });
