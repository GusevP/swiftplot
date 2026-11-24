import { expect, test, type Page } from '@playwright/test';
import { countWebgl, expectChartDrawn, liveWebgl, peakWebgl, watch } from './charts';

const frames = (page: Page) =>
  page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));

async function scroll(page: Page, to: 'bottom' | 'top') {
  const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 1; i <= 20; i++) {
    const y = Math.round((end * i) / 20);
    await page.evaluate(y => scrollTo(0, y), to === 'bottom' ? y : end - y);
    await frames(page);
  }
}

test('nine 40,000-point cards scrolled fast both ways never hold more than eight WebGL contexts', async ({
  page,
}) => {
  const errors = watch(page);
  await countWebgl(page);
  await page.route('**/src/examples/scatter-large.ts*', async route => {
    await new Promise(done => setTimeout(done, 1500));
    await route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/test/cards');
  const charts = page.locator('.cards .chart');
  await expect(charts).toHaveCount(9);

  const onScreen = () =>
    charts.evaluateAll(els => {
      const below = document.querySelector('header.bar')!.getBoundingClientRect().bottom;
      return els.flatMap((el, i) => {
        const r = el.getBoundingClientRect();
        return r.bottom > below && r.top < innerHeight ? [i] : [];
      });
    });

  await scroll(page, 'bottom');
  const atBottom = await onScreen();
  expect(atBottom).toContain(8);
  for (const i of atBottom) await expectChartDrawn(page, charts.nth(i), { scroll: false });

  await scroll(page, 'top');
  const atTop = await onScreen();
  expect(atTop).toContain(0);
  for (const i of atTop) await expectChartDrawn(page, charts.nth(i), { scroll: false });

  const holding = await charts.evaluateAll(els => els.filter(el => el.querySelector('canvas')).length);
  expect(holding).toBeLessThan(9);
  expect(await liveWebgl(page)).toBe(holding);
  expect(await peakWebgl(page)).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});
