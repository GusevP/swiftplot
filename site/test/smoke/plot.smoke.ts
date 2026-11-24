import { expect, test, type Locator, type Page } from '@playwright/test';
import { chartOf, codeOf, drawing, expectChartDrawn, seriesPixels, settled, watch } from './charts';

const legendOf = (scope: Locator) => chartOf(scope).locator('[aria-pressed]');

async function open(page: Page, query = '') {
  await page.goto(`/examples/test-line-dots${query}`);
  const scope = page.locator('[data-scope]');
  await expect(legendOf(scope).first()).toBeAttached({ timeout: 30_000 });
  return scope;
}

const stamp = (chart: Locator) =>
  chart
    .locator('canvas')
    .first()
    .evaluate(c => (c.dataset.stamp = 'kept'));
const stamped = (chart: Locator) => chart.locator('canvas[data-stamp]').count();

test('the fixture draws in the data colour in both themes', async ({ page }) => {
  const errors = watch(page);
  const scope = await open(page);
  await expect.poll(() => seriesPixels(chartOf(scope)).then(p => p.length)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => seriesPixels(chartOf(scope)).then(p => p.length)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('each switch changes the chart and the code', async ({ page }) => {
  const errors = watch(page);
  const scope = await open(page);
  for (const [label, act] of [
    ['Legend', (l: Locator) => l.uncheck()],
    ['Line width', (l: Locator) => l.selectOption('6')],
    ['Y range', (l: Locator) => l.selectOption('0-10')],
  ] as const) {
    const before = { chart: await settled(chartOf(scope)), code: await codeOf(scope) };
    await act(page.getByLabel(label));
    await expect.poll(() => codeOf(scope)).not.toEqual(before.code);
    expect((await settled(chartOf(scope))).equals(before.chart), label).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('the legend turned off and on again shows its legend', async ({ page }) => {
  const scope = await open(page);
  await expect(legendOf(scope)).toHaveText(['Line', 'Dots']);
  await page.getByLabel('Legend').uncheck();
  await expect(legendOf(scope)).toHaveCount(0);
  await page.getByLabel('Legend').check();
  await expect(legendOf(scope)).toHaveText(['Line', 'Dots']);
});

test('an option left out after being set draws as a fresh mount without it', async ({ page }) => {
  const scope = await open(page);
  const fresh = await settled(chartOf(scope));
  await page.getByLabel('Y range').selectOption('0-10');
  await expect.poll(async () => (await settled(chartOf(scope))).equals(fresh)).toBe(false);
  await stamp(chartOf(scope));
  await page.getByLabel('Y range').selectOption('auto');
  await expect.poll(async () => (await settled(chartOf(scope))).equals(fresh)).toBe(true);
  expect(await stamped(chartOf(scope))).toBe(1);
});

test('a change to a mark alone keeps the chart, a change to use replaces it', async ({ page }) => {
  const scope = await open(page);
  await stamp(chartOf(scope));
  await page.getByLabel('Line width').selectOption('6');
  await expect.poll(() => codeOf(scope)).toContain('width: 6');
  expect(await stamped(chartOf(scope))).toBe(1);
  await page.getByLabel('Legend').uncheck();
  await expect(legendOf(scope)).toHaveCount(0);
  expect(await stamped(chartOf(scope))).toBe(0);
});

test('every checked switch state mounts with no console error', async ({ page }) => {
  const errors = watch(page);
  const scope = await open(page);
  const settings = await scope
    .locator('form')
    .evaluate((form: HTMLFormElement) =>
      [...form.elements].map(el =>
        el instanceof HTMLSelectElement
          ? [el.name, [...el.options].map(o => o.value)]
          : [(el as HTMLInputElement).name, ['true', 'false']],
      ),
    );
  const states = (settings as [string, string[]][]).reduce<string[][][]>(
    (all, [name, values]) => all.flatMap(state => values.map(v => [...state, [name, v]])),
    [[]],
  );
  expect(states).toHaveLength(8);
  for (const state of states) {
    const query = `?${new URLSearchParams(state)}`;
    await page.goto(`/examples/test-line-dots${query}`);
    await expectChartDrawn(page, chartOf(page.locator('[data-scope]')));
    expect(await codeOf(page.locator('[data-scope]')), query).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test('the page shows the JSON data of a plot definition, and serves it', async ({ page, request }) => {
  await page.goto('/examples/test-over-tree');
  await expect(page.locator('.doc .snip:not([data-for]) code').last()).toContainText('"children": [');
  const link = page.getByRole('link', { name: 'Download test-tree.json' });
  const served = await request.get((await link.getAttribute('href'))!);
  expect(((await served.json()) as { name: string }).name).toBe('all');
});

test('two interactive examples on one page do not affect each other', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/test/guide');
  const [first, second] = await page.locator('[data-scope]').all();
  await expect(legendOf(first!).first()).toBeAttached({ timeout: 30_000 });
  await expectChartDrawn(page, chartOf(second!));
  const before = {
    first: await codeOf(first!),
    second: { code: await codeOf(second!), chart: await drawing(chartOf(second!)) },
  };

  await first!.getByLabel('Legend').uncheck();
  await expect.poll(() => codeOf(first!)).not.toEqual(before.first);
  await expect(legendOf(first!)).toHaveCount(0);
  expect(await codeOf(second!)).toEqual(before.second.code);
  expect(await drawing(chartOf(second!))).toEqual(before.second.chart);

  const firstNow = await codeOf(first!);
  await second!.getByLabel('Fill').uncheck();
  await expect.poll(() => codeOf(second!)).not.toEqual(before.second.code);
  expect(await codeOf(first!)).toEqual(firstNow);
  expect(errors).toEqual([]);
});

test('a generated live snippet ticks, leaves no timer when unmounted, and runs one when mounted again', async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/test/live');
  await page.waitForFunction(() => 'host' in window, undefined, { timeout: 30_000 });
  type Host = { mount(fw: string): void; unmount(fw: string): void; timers(): number };
  const frameworks = { js: '#chart', react: '#react', vue: '#vue' };
  const run = (action: 'mount' | 'unmount', fw: string) =>
    page.evaluate(([action, fw]) => (window as unknown as { host: Host }).host[action](fw!), [
      action,
      fw,
    ] as const);
  const timers = () => page.evaluate(() => (window as unknown as { host: Host }).host.timers());

  for (const fw of Object.keys(frameworks)) await run('mount', fw);
  for (const selector of Object.values(frameworks)) {
    const chart = page.locator(selector);
    await expect(chart.locator('canvas').first()).toBeAttached();
    // Past the entrance animation two frames match, so a later change can only come from a tick.
    let before = await chart.screenshot();
    await expect
      .poll(
        async () => {
          const now = await chart.screenshot();
          const same = now.equals(before);
          before = now;
          return same;
        },
        { intervals: [150], timeout: 5000 },
      )
      .toBe(true);
    await expect.poll(async () => (await chart.screenshot()).equals(before), { timeout: 5000 }).toBe(false);
  }
  expect(await timers()).toBe(3);

  for (const fw of Object.keys(frameworks)) await run('unmount', fw);
  await expect.poll(timers).toBe(0);

  for (const [fw, selector] of Object.entries(frameworks)) {
    await run('mount', fw);
    await expect(page.locator(selector).locator('canvas').first()).toBeAttached();
    await expect.poll(timers).toBe(1);
    await run('unmount', fw);
    await expect.poll(timers).toBe(0);
  }
  expect(errors).toEqual([]);
});
