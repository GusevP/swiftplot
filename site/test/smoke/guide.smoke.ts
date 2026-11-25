import { expect, test, type Page } from '@playwright/test';
import { chartOf, codeOf, drawing, expectChartDrawn, watch } from './charts';

const visible = (page: Page, selector: string) =>
  page
    .locator(`.doc ${selector}`)
    .evaluateAll(els =>
      els
        .filter(el => el.checkVisibility())
        .map(el => ({ for: el.closest('[data-for]')?.getAttribute('data-for'), text: el.textContent })),
    );

test('/guides/getting-started draws both charts, the second with the one field it names', async ({
  page,
}) => {
  const errors = watch(page);

  await page.goto('/guides/getting-started');
  await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveText(['Guides']);
  const charts = page.locator('.doc [data-example] .chart');
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all()) await expectChartDrawn(page, chart);
  await expect(charts.nth(0).locator('[aria-pressed]')).toHaveText(['api', 'web', 'jobs']);
  await expect(charts.nth(1).locator('[aria-pressed]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the framework select changes every code block and every framework-specific sentence', async ({
  page,
}) => {
  await page.goto('/guides/getting-started');
  await expect(page.locator('.doc pre.astro-code span[style*="--code-key"]').first()).toBeAttached();
  const select = page.getByLabel('Framework');
  let before: { code: (string | null)[]; prose: (string | null)[] } | undefined;
  for (const fw of ['js', 'react', 'vue', 'js']) {
    await select.selectOption(fw);
    const code = await visible(page, 'pre code');
    const prose = await visible(page, 'div[data-for] > p');
    expect(code).toHaveLength(4);
    expect(prose).toHaveLength(3);
    for (const shown of [...code, ...prose]) expect(shown.for).toBe(fw);
    const now = { code: code.map(c => c.text), prose: prose.map(p => p.text) };
    if (before)
      for (const kind of ['code', 'prose'] as const)
        now[kind].forEach((text, i) => expect(text).not.toEqual(before![kind][i]));
    before = now;
  }
});

const guides = [
  'getting-started',
  'marks-and-plot',
  'interaction',
  'updates-and-animation',
  'themes-and-colours',
  'react-and-vue',
  'large-data',
];

for (const id of guides.slice(1))
  test(`/guides/${id} loads and draws every embedded chart`, async ({ page }) => {
    const errors = watch(page);
    await page.goto(`/guides/${id}`);
    const charts = page.locator('.doc [data-example] .chart');
    expect(await charts.count()).toBeGreaterThan(0);
    for (const chart of await charts.all()) await expectChartDrawn(page, chart);
    expect(errors).toEqual([]);
  });

test('the sidebar lists every guide in order, and previous / next follow it', async ({ page }) => {
  for (const [i, id] of guides.entries()) {
    await page.goto(`/guides/${id}`);
    const sidebar = await page
      .locator('.side div:first-child a')
      .evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(sidebar).toEqual(guides.map(g => `/guides/${g}`));
    const pager = page.locator('nav.pager');
    const neighbour = (rel: string) => pager.locator(`a:has(span:text-is("${rel}"))`);
    if (i > 0) await expect(neighbour('Previous')).toHaveAttribute('href', `/guides/${guides[i - 1]}`);
    else await expect(neighbour('Previous')).toHaveCount(0);
    if (i < guides.length - 1)
      await expect(neighbour('Next')).toHaveAttribute('href', `/guides/${guides[i + 1]}`);
    else await expect(neighbour('Next')).toHaveCount(0);
  }
});

test("on marks-and-plot, a switch on one example leaves the other's chart and code alone", async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/guides/marks-and-plot');
  const [axes, annotated] = await page.locator('.doc [data-scope]').all();
  for (const scope of [axes!, annotated!]) await expectChartDrawn(page, chartOf(scope));
  const before = { code: await codeOf(annotated!), chart: await drawing(chartOf(annotated!)) };
  const axesCode = await codeOf(axes!);

  await axes!.getByLabel('Second axis').uncheck();
  await expect.poll(() => codeOf(axes!)).not.toEqual(axesCode);
  expect(await codeOf(annotated!)).toEqual(before.code);
  expect(await drawing(chartOf(annotated!))).toEqual(before.chart);

  const axesNow = await codeOf(axes!);
  await annotated!.getByLabel('Gradient fill').uncheck();
  await expect.poll(() => codeOf(annotated!)).not.toEqual(before.code);
  expect(await codeOf(axes!)).toEqual(axesNow);
  expect(errors).toEqual([]);
});

test('every chart on marks-and-plot is a Plot in its React and Vue code, showing what the guide describes', async ({
  page,
}) => {
  await page.goto('/guides/marks-and-plot');
  const scopes = await page.locator('.doc [data-scope]').all();
  expect(scopes).toHaveLength(4);
  for (const fw of ['react', 'vue']) {
    await page.getByLabel('Framework').selectOption(fw);
    for (const scope of scopes) await expect.poll(() => codeOf(scope)).toContain('<Plot');
  }
  const code = await Promise.all(scopes.map(codeOf));
  for (const [i, shown] of [["yAxis: 'y2'"], ['rule({', 'zone({'], ['y.col('], ['ticks({']].entries())
    for (const part of shown) expect(code[i]).toContain(part);
});

test("on react-and-vue, each wrapper's code is generated: a chart from data, and a Plot keyed by its features", async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/guides/react-and-vue');
  const [bars, radar] = await page.locator('.doc [data-scope]').all();
  const select = page.getByLabel('Framework');
  for (const [fw, wrapper] of [
    ['react', '@swiftplot/react'],
    ['vue', '@swiftplot/vue'],
  ] as const) {
    await select.selectOption(fw);
    await expect.poll(() => codeOf(bars!)).toContain(`import { BarChart } from '${wrapper}'`);
    const plot = await codeOf(radar!);
    expect(plot).toContain(`from '${wrapper}'`);
    expect(plot).toMatch(/<Plot\s+key="legend-on"/);
  }
  await radar!.getByLabel('Legend').uncheck();
  await expect.poll(() => codeOf(radar!)).toMatch(/<Plot\s+key="legend-off"/);
  expect(errors).toEqual([]);
});
