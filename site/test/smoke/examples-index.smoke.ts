import { expect, test } from '@playwright/test';
import { examples } from '../../src/examples/index';
import { countWebgl, expectChartDrawn, liveWebgl, peakWebgl, watch } from './charts';

const cards = '.cards a';

test.beforeEach(({ page }) => countWebgl(page));

test('/examples marks Examples in the top bar, and every card draws its chart in a data colour', async ({
  page,
}) => {
  const errors = watch(page);

  await page.goto('/examples');
  await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveText(['Examples']);
  await expect(page.locator(cards)).toHaveCount(examples.size);
  for (const chart of await page.locator(`${cards} .chart`).all()) await expectChartDrawn(page, chart);
  expect(await peakWebgl(page)).toBeGreaterThanOrEqual(1);
  expect(await peakWebgl(page)).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});

test('a card chart is only created once it comes near the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/examples');
  const scatter = page.locator('.chart[data-id="scatter-large"]');
  await expect(page.locator('#line .chart canvas').first()).toBeAttached();
  await page.waitForTimeout(300);
  await expect(scatter.locator('canvas')).toHaveCount(0);
  expect(await liveWebgl(page)).toBe(0);
  await expectChartDrawn(page, scatter);
  expect(await liveWebgl(page)).toBe(1);
});

test('a card chart is destroyed once it leaves the viewport, and drawn again when it comes back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/examples');
  const scatter = page.locator('.chart[data-id="scatter-large"]');
  await expectChartDrawn(page, scatter);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(scatter.locator('canvas')).toHaveCount(0);
  expect(await liveWebgl(page)).toBe(0);
  await expectChartDrawn(page, scatter);
  expect(await liveWebgl(page)).toBe(1);
});

test('a filter hides the cards without its tag and the groups left empty', async ({ page }) => {
  await page.goto('/examples');
  await page.getByRole('button', { name: 'Large data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Large data', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator(`${cards}:visible b`)).toHaveText(['Scatter of 40,000 points']);
  await expect(page.locator('.group:visible h2')).toHaveText(['Scatter']);
  await expect(page.locator('.side a[href^="#"]:visible')).toHaveText(['Scatter']);

  await page.getByRole('button', { name: 'Stacked', exact: true }).click();
  await expect(page.locator(`${cards}:visible b`)).toHaveText(['Stacked areas', 'Grouped and stacked bars']);
  await expect(page.locator('.group:visible h2')).toHaveText(['Area', 'Bar']);

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator(`${cards}:visible`)).toHaveCount(examples.size);
  await expect(page.getByRole('button', { name: 'Stacked', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('every card links to its example page, which loads with no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples');
  const links = await page.locator(cards).evaluateAll(as => as.map(a => a.getAttribute('href')!));
  expect(links).toHaveLength(examples.size);
  for (const href of links) {
    expect(href).toMatch(/^\/examples\/[a-z-]+$/);
    expect((await page.goto(href))?.status(), href).toBe(200);
    await expect(page.locator('[data-example] .chart canvas').first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});
