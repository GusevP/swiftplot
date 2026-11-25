import { expect, test } from '@playwright/test';
import { checkedStates, exampleHref, switchKey } from '../../src/examples/define';
import { examples } from '../../src/examples/index';
import { countIntervals, expectChartDrawn, settled, timers, watch } from './charts';

const chart = '[data-example] .chart';
const code = '[data-scope] code[data-live]:visible';
// The brushed axes show only once a drag is made, which the brush tests in plot.smoke.ts do.
// A live chart never settles; its own test in plot.smoke.ts checks that it moves.
// A tooltip shows only on hover.
const still = (id: string, key: string) => key === 'tooltip' || (id === 'line-brush' && key === 'axes');

for (const e of examples.values()) {
  const live = e.kind === 'plot' ? e.tree.live : e.live;

  test(`/examples/${e.id} draws in both themes with no error`, async ({ page }) => {
    const errors = watch(page);
    await page.goto(`/examples/${e.id}`);
    await expectChartDrawn(page, page.locator(chart));
    const light = live ? undefined : await settled(page.locator(chart));
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
        chart: live ? undefined : await settled(page.locator(chart)),
        code: await page.locator(code).textContent(),
      };
      const control = page.locator(`[data-scope] form [name="${switchKey(s)}"]`);
      if (s.kind === 'boolean') await control.setChecked(!s.value);
      else await control.selectOption(s.values.find(v => v !== s.value)!);
      await expect.poll(() => page.locator(code).textContent(), s.label).not.toEqual(before.code);
      if (before.chart && !still(e.id, switchKey(s)))
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

test('the live card on /examples stops its timer once it leaves the viewport, and runs one when it comes back', async ({
  page,
}) => {
  const errors = watch(page);
  await countIntervals(page);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/examples');
  const card = page.locator('.chart[data-id="line-live"]');
  await expectChartDrawn(page, card);
  await expect.poll(() => timers(page)).toHaveLength(1);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(card.locator('canvas')).toHaveCount(0);
  expect(await timers(page)).toEqual([]);
  await expectChartDrawn(page, card);
  await expect.poll(() => timers(page)).toHaveLength(1);
  expect(errors).toEqual([]);
});
