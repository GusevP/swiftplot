import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { examples } from '../../src/examples/index';
import { days, hover, seriesPixels, tooltipOf, watch, xTicks, zoomIn } from './charts';

const chart = '[data-example] .chart';
const plot = (page: Page) => page.locator(chart);

const shownCode = (page: Page) => page.locator('code[data-live]:visible').textContent();

test('each switch on /examples/line-zoom changes what it should, and the code with it', async ({ page }) => {
  const errors = watch(page);

  await page.goto('/examples/line-zoom');
  const code = await shownCode(page);
  expect(code).toContain('zoom: true');

  await expect.poll(() => xTicks(plot(page)).then(t => t.length)).toBeGreaterThan(1);
  const whole = days(await xTicks(plot(page)));
  await zoomIn(page, plot(page));
  await expect.poll(() => xTicks(plot(page)).then(days)).toBeLessThan(whole);
  await page.reload();
  await page.getByLabel('Zoom').uncheck();
  expect(await shownCode(page)).not.toContain('zoom');
  await expect.poll(() => xTicks(plot(page)).then(t => t.length)).toBeGreaterThan(1);
  const before = await xTicks(plot(page));
  await zoomIn(page, plot(page));
  await page.waitForTimeout(300);
  expect(await xTicks(plot(page))).toEqual(before);

  const tip = tooltipOf(plot(page));
  await hover(page, plot(page));
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('api');
  await page.mouse.move(0, 0);
  const withTooltip = await shownCode(page);
  await page.getByLabel('Tooltip').uncheck();
  expect(await shownCode(page)).not.toEqual(withTooltip);
  expect(await shownCode(page)).toContain('tooltip: false');
  await hover(page, plot(page));
  await page.waitForTimeout(300);
  await expect(tip).toBeHidden();

  const entries = page.locator(`${chart} [aria-pressed]`);
  await expect(entries).toHaveText(['api', 'web', 'jobs']);
  await page.getByLabel('Legend').uncheck();
  await expect(entries).toHaveCount(0);
  expect(await shownCode(page)).toContain('legend: false');

  await page.mouse.move(0, 0);
  await expect.poll(() => seriesPixels(plot(page)).then(p => p.length)).toBeGreaterThan(0);
  const straight = await seriesPixels(plot(page));
  const linear = await shownCode(page);
  await page.getByLabel('Curve').selectOption('step');
  await expect.poll(() => seriesPixels(plot(page))).not.toEqual(straight);
  expect(linear).not.toContain('curve');
  expect(await shownCode(page)).toContain("curve: 'step'");

  expect(errors).toEqual([]);
});

test('switch values in the URL set those switches and the code; unknown keys and values are ignored', async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/examples/bar-grouped?stack=true&legend=maybe&bogus=1');
  await expect(page.getByLabel('Stack')).toBeChecked();
  await expect(page.getByLabel('Legend')).toBeChecked();
  await expect.poll(() => shownCode(page)).toContain('stack: true');
  expect(await shownCode(page)).not.toContain('legend');

  await page.goto('/examples/line-zoom?curve=step');
  await expect(page.getByLabel('Curve')).toHaveValue('step');
  await expect.poll(() => shownCode(page)).toContain("curve: 'step'");

  await page.goto('/examples/line-zoom?curve=bogus');
  await expect.poll(() => seriesPixels(plot(page)).then(p => p.length)).toBeGreaterThan(0);
  await expect(page.getByLabel('Curve')).toHaveValue('linear');
  expect(await shownCode(page)).not.toContain('curve');
  expect(errors).toEqual([]);
});

test('the framework select swaps the file name, the code and the install line; Copy copies what is shown', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/examples/line-zoom');
  const visible = page.locator('.snip:visible');
  const select = page.getByLabel('Framework');

  for (const [fw, file, install, marker] of [
    ['js', 'chart.js', 'npm i swiftplot', 'lineChart(el, {'],
    ['react', 'Chart.tsx', 'npm i swiftplot @swiftplot/react', '<LineChart data={rows}'],
    ['vue', 'Chart.vue', 'npm i swiftplot @swiftplot/vue', '<LineChart :data="rows"'],
  ] as const) {
    await select.selectOption(fw);
    await expect(visible.locator('header span')).toHaveText(['Install', file]);
    await expect(visible.first().locator('code')).toHaveText(install);
    const shown = visible.nth(1).locator('code');
    await expect(shown).toContainText(marker);
    await visible.nth(1).getByRole('button', { name: 'Copy' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await shown.textContent());
  }

  await page.getByLabel('Curve').selectOption('smooth');
  await expect(visible.nth(1).locator('code')).toContainText('curve="smooth"');
});

for (const [id, component] of [
  ['pie-donut', 'PieChart'],
  ['funnel', 'FunnelChart'],
  ['radial-bars', 'RadialBarChart'],
  ['radar', 'RadarChart'],
  ['heatmap', 'HeatmapChart'],
  ['histogram', 'HistogramChart'],
  ['box-plot', 'BoxPlotChart'],
  ['candlesticks', 'CandlestickChart'],
  ['sankey', 'SankeyChart'],
  ['treemap', 'TreemapChart'],
  ['sunburst', 'SunburstChart'],
  ['error-bars', 'ScatterChart'],
  ['bubbles', 'ScatterChart'],
  ['two-y-axes', 'ComboChart'],
  ['line-log', 'LineChart'],
  ['line-annotated', 'LineChart'],
  ['line-brush', 'LineChart'],
  ['line-live', 'LineChart'],
  ['strip-plot', 'ScatterChart'],
] as const)
  test(`the React and Vue code on /examples/${id} is a ${component}`, async ({ page }) => {
    await page.goto(`/examples/${id}`);
    for (const fw of ['react', 'vue']) {
      await page.getByLabel('Framework').selectOption(fw);
      const code = page.locator('code[data-live]:visible');
      await expect(code).toContainText(`<${component}`);
      await expect(code).not.toContainText('<Plot');
    }
  });

test('the data downloads as valid JSON with 30 rows', async ({ page }) => {
  await page.goto('/examples/line-zoom');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download requests.json' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('requests.json');
  const rows = JSON.parse(await readFile((await download.path())!, 'utf8')) as unknown[];
  expect(rows).toHaveLength(30);
});

for (const e of examples.values()) {
  if (e.data.kind !== 'json') continue;
  const { file, value } = e.data;
  test(`/examples/${e.id} serves ${file} as the JSON it draws, and its code imports that file`, async ({
    page,
    request,
  }) => {
    await page.goto(`/examples/${e.id}`);
    const link = page.getByRole('link', { name: `Download ${file}` });
    expect(await (await request.get((await link.getAttribute('href'))!)).json()).toEqual(value);
    expect(await shownCode(page)).toContain(`import data from './${file}';`);
  });
}

test('the sidebar marks the current example, and only it', async ({ page }) => {
  await page.goto('/examples/line-zoom');
  await expect(page.locator('.side [aria-current="page"]')).toHaveText(['Line chart with zoom']);
});

test('the docs layout is one column on a phone, with no sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/examples/line-zoom');
  await expect(page.locator('.side')).toBeHidden();
  await expect(page.locator('.toc')).toBeHidden();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});

test('the code carries the light theme colours the chart is drawn in', async ({ page }) => {
  await page.goto('/examples/line-zoom');
  const colors = await page.evaluate(() =>
    ['--c1', '--c2', '--c3'].map(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()),
  );
  expect(await shownCode(page)).toContain(`colors: [${colors.map(c => `'${c}'`).join(', ')}]`);
});

test('the theme switch repaints the chart in the dark chart colour', async ({ page }) => {
  await page.goto('/examples/line-zoom');
  await expect.poll(() => seriesPixels(plot(page)).then(p => p.length)).toBeGreaterThan(0);
  const light = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--c1'),
  );
  await page.getByRole('button', { name: 'Dark' }).click();
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c1')),
  ).not.toBe(light);
  await expect.poll(() => seriesPixels(plot(page)).then(p => p.length)).toBeGreaterThan(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the page already shows the starting code for JavaScript', async ({ page }) => {
    await page.goto('/examples/line-zoom');
    const visible = page.locator('.snip:visible');
    await expect(visible.locator('header span')).toHaveText(['Install', 'chart.js']);
    await expect(visible.nth(1).locator('code')).toContainText('zoom: true');
  });
});

test('line-from-rows draws its lines with no error and links to the next example', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/examples/line-from-rows');
  await expect.poll(() => seriesPixels(plot(page)).then(p => p.length)).toBeGreaterThan(0);
  await page.getByRole('link', { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/examples\/line-zoom\/?$/);
  expect(errors).toEqual([]);
});

test('re-rendered code shows quotes, backslashes, <, > and & literally', async ({ page }) => {
  await page.goto('/examples/line-zoom');
  await page.getByLabel('Curve').evaluate((select: HTMLSelectElement) => {
    select.options[0]!.value = 'a\'b"c\\d<e>f&g';
    select.selectedIndex = 0;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('code[data-live="js"]')).toContainText(`curve: 'a\\'b"c\\\\d<e>f&g',`);
  await expect(page.locator('code[data-live="vue"]')).toContainText(`curve="a'b&quot;c\\d&lt;e&gt;f&amp;g"`);
  await expect(page.locator('code[data-live="js"] span', { hasText: '<e>' })).toHaveCount(1);
});
