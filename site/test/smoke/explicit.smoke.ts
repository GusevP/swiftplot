import { expect, test, type Locator, type Page } from '@playwright/test';
import { checkedStates, exampleHref } from '../../src/examples/define';
import { examples } from '../../src/examples/index';
import { days, expectChartDrawn, settled, span, tooltipOf, watch, xTicks, yTicks } from './charts';

const chart = '[data-example] .chart';
const code = '[data-scope] code[data-live]:visible';
// The brushed axes show only once a drag is made, which the brush tests below do.
// A live chart never settles; its own test below checks that it moves.
const still = new Set(['line-brush:axes']);

for (const e of examples.values()) {
  if (e.kind !== 'plot') continue;

  test(`/examples/${e.id} draws in both themes with no error`, async ({ page }) => {
    const errors = watch(page);
    await page.goto(`/examples/${e.id}`);
    await expectChartDrawn(page, page.locator(chart));
    const light = e.tree.live ? undefined : await settled(page.locator(chart));
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    if (light) await expect.poll(async () => (await settled(page.locator(chart))).equals(light)).toBe(false);
    await expectChartDrawn(page, page.locator(chart));
    expect(errors).toEqual([]);
  });

  test(`each switch on /examples/${e.id} changes the chart and the code`, async ({ page }) => {
    const errors = watch(page);
    await page.goto(`/examples/${e.id}`);
    await expectChartDrawn(page, page.locator(chart));
    for (const s of e.switches) {
      const before = {
        chart: e.tree.live ? undefined : await settled(page.locator(chart)),
        code: await page.locator(code).textContent(),
      };
      const control = page.locator(`[data-scope] form [name="${s.id}"]`);
      if (s.kind === 'boolean') await control.setChecked(!s.value);
      else await control.selectOption(s.values.find(v => v !== s.value)!);
      await expect.poll(() => page.locator(code).textContent(), s.label).not.toEqual(before.code);
      if (before.chart && !still.has(`${e.id}:${s.id}`))
        expect((await settled(page.locator(chart))).equals(before.chart), s.label).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  test(`every checked switch state of /examples/${e.id} mounts with no error`, async ({ page }) => {
    const errors = watch(page);
    for (const state of checkedStates(e.switches)) {
      await page.goto(exampleHref(e.id, state));
      await expectChartDrawn(page, page.locator(chart));
    }
    expect(errors).toEqual([]);
  });
}

test('the candlesticks tooltip shows the text its function gives', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/examples/candlesticks');
  await expectChartDrawn(page, page.locator(chart));
  const tip = tooltipOf(page.locator(chart));
  const box = (await page.locator(chart).boundingBox())!;
  search: for (let x = box.x + box.width * 0.4; x < box.x + box.width * 0.6; x += 4)
    for (let y = box.y + box.height * 0.1; y < box.y + box.height * 0.9; y += 8) {
      await page.mouse.move(x, y);
      if (await tip.isVisible()) break search;
    }
  await expect(tip).toHaveText(/^2026-10-\d\d: closed at \d+\.\d\d$/);
  expect(errors).toEqual([]);
});

async function drag(page: Page, plot: Locator, from: [number, number], to: [number, number]) {
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
  await page.mouse.up();
}

test('a drag across /examples/line-brush zooms the axes it brushes and leaves the others, and a double-click shows them whole', async ({
  page,
}) => {
  const errors = watch(page);
  const plot = page.locator(chart);
  const open = async (url: string) => {
    await page.goto(url);
    await expectChartDrawn(page, plot);
    await expect.poll(() => xTicks(plot).then(t => t.length)).toBeGreaterThan(1);
    await expect.poll(() => yTicks(plot).then(t => t.length)).toBeGreaterThan(1);
    return { x: await xTicks(plot), y: await yTicks(plot) };
  };

  const narrower = async (ticks: () => Promise<(string | null)[]>, extent: typeof span, whole: number) => {
    await expect
      .poll(async () => {
        const t = await ticks();
        return new Set(t).size > 1 && extent(t) > 0 ? extent(t) : NaN;
      })
      .toBeLessThan(whole / 2);
  };
  const reset = async (before: { x: (string | null)[]; y: (string | null)[] }) => {
    const box = (await plot.boundingBox())!;
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => xTicks(plot)).toEqual(before.x);
    await expect.poll(() => yTicks(plot)).toEqual(before.y);
  };

  let before = await open('/examples/line-brush');
  await drag(page, plot, [0.4, 0.5], [0.6, 0.5]);
  await narrower(() => xTicks(plot), days, days(before.x));
  expect(await yTicks(plot)).toEqual(before.y);
  await reset(before);

  before = await open('/examples/line-brush?axes=y');
  await drag(page, plot, [0.5, 0.3], [0.5, 0.6]);
  await narrower(() => yTicks(plot), span, span(before.y));
  expect(await xTicks(plot)).toEqual(before.x);
  await reset(before);

  before = await open('/examples/line-brush?axes=xy');
  await drag(page, plot, [0.4, 0.3], [0.6, 0.6]);
  await narrower(() => xTicks(plot), days, days(before.x));
  await narrower(() => yTicks(plot), span, span(before.y));
  await reset(before);
  expect(errors).toEqual([]);
});

const countIntervals = (page: Page) =>
  page.addInitScript(() => {
    const active = new Set<unknown>();
    const { setInterval: set, clearInterval: clear } = globalThis;
    globalThis.setInterval = ((...args: Parameters<typeof set>) => {
      const id = set(...args);
      active.add(id);
      return id;
    }) as typeof set;
    globalThis.clearInterval = (id => {
      active.delete(id);
      clear(id);
    }) as typeof clear;
    Object.assign(window, { intervals: () => [...active].map(String) });
  });
const timers = (page: Page) =>
  page.evaluate(() => (window as unknown as { intervals(): string[] }).intervals());
const intervals = async (page: Page) => (await timers(page)).length;

test('/examples/line-live changes after a tick, and keeps one timer through a remount', async ({ page }) => {
  const errors = watch(page);
  await countIntervals(page);
  await page.goto('/examples/line-live');
  const plot = page.locator(chart);
  await expectChartDrawn(page, plot);
  const [first] = await timers(page);
  expect(await timers(page)).toEqual([first]);
  const before = await plot.screenshot();
  await expect.poll(async () => (await plot.screenshot()).equals(before), { timeout: 5000 }).toBe(false);

  await page.locator('[data-scope] form [name="animate"]').setChecked(false);
  await expect.poll(() => page.locator(code).textContent()).not.toContain('animate()');
  await expectChartDrawn(page, plot);
  const now = await timers(page);
  expect(now).toHaveLength(1);
  expect(now).not.toContain(first);
  const after = await plot.screenshot();
  await expect.poll(async () => (await plot.screenshot()).equals(after), { timeout: 5000 }).toBe(false);
  expect(errors).toEqual([]);
});

test('the live card on /examples stops its timer once it leaves the viewport, and runs one when it comes back', async ({
  page,
}) => {
  const errors = watch(page);
  await countIntervals(page);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/examples');
  const card = page.locator('.chart[data-id="line-live"]');
  await expectChartDrawn(page, card);
  await expect.poll(() => intervals(page)).toBe(1);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(card.locator('canvas')).toHaveCount(0);
  expect(await intervals(page)).toBe(0);
  await expectChartDrawn(page, card);
  await expect.poll(() => intervals(page)).toBe(1);
  expect(errors).toEqual([]);
});
