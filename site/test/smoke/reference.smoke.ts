import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { chartNames, referencePath } from '../../src/examples/define';
import { examples } from '../../src/examples/index';
import { featureNames, markNames } from '../../src/examples/tree';
import { extract, extractApi } from '../../src/reference/extract';
import { mountCharts, watch } from './charts';

const core = new URL('../../../packages/core/src/', import.meta.url);
const reference = extract(readFileSync(new URL('charts/types.ts', core), 'utf8'));
const files = Object.fromEntries(
  ['', 'marks/', 'features/', 'scales/'].flatMap(dir =>
    readdirSync(new URL(dir, core))
      .filter(f => f.endsWith('.ts'))
      .map(f => [dir + f, readFileSync(new URL(dir + f, core), 'utf8')]),
  ),
);
const api = extractApi(files, ['arcs', 'tooltip']);

test('/reference/line-chart has a row, with its anchor and default, for every prop the extraction returns', async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/reference/line-chart');
  await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveText(['Reference']);
  const rows = page.locator('table.props tbody tr');
  expect(await rows.evaluateAll(trs => trs.map(tr => tr.id))).toEqual(reference.lineChart.map(e => e.name));
  for (const e of reference.lineChart) {
    const row = page.locator(`[id="${e.name}"]`);
    await expect(row.locator('td').first()).toHaveText(e.name);
    await expect(row.locator('td').nth(2)).toHaveText(e.default ?? '—');
    for (const line of e.lines) await expect(row.locator('td').nth(1)).toContainText(line.type);
  }
  expect(errors).toEqual([]);
});

test('every reference page loads with no error and draws the examples that use its chart', async ({
  page,
}) => {
  test.slow();
  const errors = watch(page);
  for (const chart of chartNames) {
    await page.goto(referencePath(chart));
    await expect(page.locator('h1')).toHaveText(chart);
    const cards = page.locator('.cards a');
    const using = [...examples.values()]
      .filter(e => e.kind !== 'plot' && e.chart === chart)
      .map(e => `/examples/${e.id}`);
    expect(await cards.evaluateAll(as => as.map(a => a.getAttribute('href')))).toEqual(using);
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('.chart canvas').first()).toBeAttached();
    }
  }
  await page.goto('/reference');
  for (const name of [...chartNames, 'plot', 'scales', ...markNames, ...featureNames]) {
    await expect(page.locator(`main a[href="${referencePath(name)}"]`)).toHaveText(name);
    await page.goto(referencePath(name));
    await expect(page.locator('h1')).toHaveText(name === 'scales' ? 'Scales and helpers' : name);
    await mountCharts(page);
    await page.goto('/reference');
  }
  expect(errors).toEqual([]);
});

for (const [name, group] of [
  ['arcs', 'Explicit API'],
  ['tooltip', 'Features'],
] as const)
  test(`/reference/${name} has a row, with its anchor and default, for every option the extraction returns`, async ({
    page,
  }) => {
    const errors = watch(page);
    await page.goto(`/reference/${name}`);
    await expect(page.locator('h1')).toHaveText(name);
    await expect(page.locator('.intro')).toHaveText(api[name]!.intro.replaceAll('`', ''));
    const side = page.locator('aside.side');
    await expect(side.locator('b')).toHaveText(['Charts from data', 'Explicit API', 'Features']);
    await expect(
      side.locator('div', { has: page.locator('b', { hasText: group }) }).locator('[aria-current="page"]'),
    ).toHaveText(name);
    const rows = page.locator('table.props tbody tr');
    expect(await rows.evaluateAll(trs => trs.map(tr => tr.id))).toEqual(api[name]!.entries.map(e => e.name));
    for (const e of api[name]!.entries) {
      const row = page.locator(`[id="${e.name}"]`);
      await expect(row.locator('td').nth(2)).toHaveText(e.default ?? '—');
      for (const line of e.lines) {
        await expect(row.locator('td').nth(1)).toContainText(line.type);
        if (line.mode) await expect(row.locator('td').nth(1)).toContainText(line.mode);
      }
    }
    expect(errors).toEqual([]);
  });

test('/reference/plot renders the code in its intro', async ({ page }) => {
  await page.goto('/reference/plot');
  const intro = page.locator('.intro');
  await expect(intro.locator('code').first()).toHaveText('el');
  await expect(intro).not.toContainText('`');
});

test('/reference/pie-chart lists pie and donut among the examples that use it, the card opens it, and /reference/arcs has no such section', async ({
  page,
}) => {
  await page.goto('/reference/arcs');
  await expect(page.locator('h1')).toHaveText('arcs');
  await expect(page.locator('#examples')).toHaveCount(0);
  await page.goto('/reference/pie-chart');
  const card = page.locator('.cards a[href="/examples/pie-donut"]');
  await expect(card).toContainText('Pie and donut');
  await card.click();
  await expect(page).toHaveURL(/\/examples\/pie-donut\/?$/);
  await expect(page.locator('[data-example] .chart canvas').first()).toBeAttached();
});

for (const page of [
  'line',
  'bar',
  'ticks',
  'rule',
  'zone',
  'dots',
  'errorBars',
  'box',
  'candlestick',
  'heatmap',
  'radar',
  'radialBars',
  'funnel',
  'sankey',
  'treemap',
  'sunburst',
  'brush',
  'zoom',
  'animate',
])
  test(`${referencePath(page)}, which no example uses, has no section of examples`, async ({ page: tab }) => {
    await tab.goto(referencePath(page));
    await expect(tab.locator('h1')).toHaveText(page);
    await expect(tab.locator('#examples, .cards')).toHaveCount(0);
  });

test('the framework select swaps the signature, what the chart returns and what a failed update leaves', async ({
  page,
}) => {
  await page.goto('/reference/bar-chart');
  const select = page.getByLabel('Framework');
  for (const [fw, label, call, returned, errorsTo, shown] of [
    [
      'react',
      '@swiftplot/react',
      '<BarChart data={rows} {...props} />',
      'there is no ref',
      'renders its fallback',
      2,
    ],
    [
      'vue',
      '@swiftplot/vue',
      '<BarChart :data="rows" v-bind="props" />',
      '@click and @error',
      'leaves the previous chart',
      3,
    ],
    [
      'js',
      'swiftplot/charts',
      'const chart = barChart(el, props);',
      'destroy()',
      'leaves the previous chart',
      2,
    ],
  ] as const) {
    await select.selectOption(fw);
    const snip = page.locator('.snip:visible');
    await expect(snip).toHaveCount(1);
    await expect(snip.locator('header span')).toHaveText(label);
    await expect(snip.locator('code')).toContainText(call);
    const paragraphs = page.locator('p[data-for]:visible');
    await expect(paragraphs).toHaveCount(shown);
    await expect(paragraphs.filter({ hasText: returned })).toHaveCount(1);
    await expect(paragraphs.filter({ hasText: errorsTo })).toHaveCount(1);
  }
});

test('the Vue event summaries name @brush on the charts that take onBrush', async ({ page }) => {
  expect(reference.comboChart.some(e => e.name === 'onBrush')).toBe(true);
  for (const chart of chartNames) {
    const brushes = reference[chart].some(e => e.name === 'onBrush');
    await page.goto(referencePath(chart));
    const summaries = page.locator('p[data-for="vue"]', { hasText: 'v-model:pointer' });
    await expect(summaries, chart).toHaveCount(2);
    await expect(summaries.filter({ hasText: '@brush' }), chart).toHaveCount(brushes ? 2 : 0);
  }
});

test('an option link on an example page lands on its row in the reference', async ({ page }) => {
  await page.goto('/examples/line-zoom');
  await page.locator('#options ~ table a', { hasText: /^curve$/ }).click();
  await expect(page).toHaveURL(/\/reference\/line-chart#curve$/);
  const row = page.locator('[id="curve"]');
  await expect(row).toBeInViewport();
  expect(await row.evaluate(tr => tr.matches(':target'))).toBe(true);

  for (const e of examples.values()) {
    await page.goto(`/examples/${e.id}`);
    const links = await page
      .locator('#options ~ table a')
      .evaluateAll(as => as.map(a => a.getAttribute('href')!));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      const [path, id] = href.split('#');
      if (e.kind !== 'plot') expect(path).toBe(referencePath(e.chart));
      await page.goto(href);
      await expect(page.locator(`[id="${id}"]`), href).toBeInViewport();
    }
  }
});

test('type and error message cells wrap only between whole words, and no table is wider than the page, at 1440, 768 and 390', async ({
  page,
}) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const chart of chartNames) {
      await page.goto(referencePath(chart));
      const at = `${chart} at ${width}`;
      for (const cells of ['table.props td:nth-child(2) code', '#errors ~ table td:first-child code']) {
        const measured = await page.locator(cells).evaluateAll(codes => {
          const words = codes.flatMap(code => {
            const texts = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
            const found: { word: string; lines: number }[] = [];
            for (let t = texts.nextNode(); t; t = texts.nextNode())
              for (const m of t.textContent!.matchAll(/[^ ]+/g)) {
                const range = document.createRange();
                range.setStart(t, m.index);
                range.setEnd(t, m.index + m[0].length);
                const tops = new Set([...range.getClientRects()].map(r => Math.round(r.top)));
                found.push({ word: m[0], lines: tops.size });
              }
            return found;
          });
          return { count: words.length, split: words.filter(w => w.lines > 1).map(w => w.word) };
        });
        expect(measured.split, `${cells} on ${at}`).toEqual([]);
        expect(measured.count, `${cells} on ${at}`).toBeGreaterThan(0);
      }
      const wide = await page
        .locator('main table')
        .evaluateAll(tables => tables.filter(t => t.scrollWidth > t.parentElement!.clientWidth).length);
      expect(wide, at).toBe(0);
    }
  }
});
