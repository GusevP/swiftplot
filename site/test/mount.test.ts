import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const chart = { update: vi.fn(), destroy: vi.fn() };
const plot = vi.fn(() => chart);
vi.mock('swiftplot/charts', async original => {
  const make = () => chart;
  return { ...(await original()), lineChart: make, areaChart: make, barChart: make, scatterChart: make };
});
vi.mock('swiftplot', async original => ({ ...(await original()), plot }));

let observers: { callback: () => void; connected: boolean }[];
const root = { dataset: { theme: 'light' } };
const theme = (value: string) => {
  root.dataset.theme = value;
  for (const o of observers) if (o.connected) o.callback();
};

beforeEach(() => {
  observers = [];
  chart.update.mockClear();
  chart.destroy.mockClear();
  plot.mockClear();
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#000000' }));
  vi.stubGlobal(
    'MutationObserver',
    class {
      entry: { callback: () => void; connected: boolean };
      constructor(callback: () => void) {
        this.entry = { callback, connected: false };
        observers.push(this.entry);
      }
      observe() {
        this.entry.connected = true;
      }
      disconnect() {
        this.entry.connected = false;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('a mounted example follows the theme until destroy, which releases the chart', async () => {
  const { load, mountExample } = await import('../src/charts/mount');
  const mounted = mountExample({} as HTMLElement, await load('area-stacked'), {});

  theme('dark');
  expect(chart.update).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }));

  mounted.destroy();
  expect(chart.destroy).toHaveBeenCalledOnce();
  chart.update.mockClear();
  theme('light');
  expect(chart.update).not.toHaveBeenCalled();
});

test('a plot example remounts for a change to use, and updates for any other change', async () => {
  const { mountExample } = await import('../src/charts/mount');
  const { lineDots } = await import('./plot-definitions');
  const mounted = mountExample({} as HTMLElement, lineDots, {});
  expect(plot).toHaveBeenCalledOnce();

  mounted.update({ width: '6' });
  expect(plot).toHaveBeenCalledOnce();
  expect(chart.update).toHaveBeenLastCalledWith(expect.not.objectContaining({ use: expect.anything() }));

  mounted.update({ width: '6', legend: false });
  expect(chart.destroy).toHaveBeenCalledOnce();
  expect(plot).toHaveBeenCalledTimes(2);
  expect(plot).toHaveBeenLastCalledWith({}, expect.objectContaining({ use: [] }));
});

test('an option a state leaves out is reset, and the theme swaps the site colours and the palette', async () => {
  const { paletteDark } = await vi.importActual<typeof import('swiftplot')>('swiftplot');
  const { mountExample } = await import('../src/charts/mount');
  const { lineDots, overTree } = await import('./plot-definitions');
  const mounted = mountExample({} as HTMLElement, lineDots, { range: '0-10' });
  mounted.update({ range: 'auto' });
  const partial = chart.update.mock.lastCall![0] as Record<string, unknown>;
  expect(Object.hasOwn(partial, 'y') && partial.y === undefined).toBe(true);

  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#123456' }));
  theme('dark');
  const { marks } = chart.update.mock.lastCall![0] as { marks: { options: { color: string } }[] };
  expect(marks.map(m => m.options.color)).toEqual(['#123456', '#123456']);
  mounted.destroy();

  mountExample({} as HTMLElement, overTree, {});
  const [, options] = plot.mock.lastCall! as unknown as [
    unknown,
    { marks: { options: { colors: unknown } }[] },
  ];
  expect(options.marks[0]!.options.colors).toBe(paletteDark);
});

test('a live example steps its rows on a timer that stops on destroy', async () => {
  vi.useFakeTimers();
  const { mountExample } = await import('../src/charts/mount');
  const { live } = await import('./plot-definitions');
  const mounted = mountExample({} as HTMLElement, live, {});
  vi.advanceTimersByTime(1000);
  expect(chart.update).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(1);
  mounted.destroy();
  expect(vi.getTimerCount()).toBe(0);
});

test('the theme swaps a site colour only where core takes a colour, never in a field name or a label', async () => {
  const { siteColors } = await import('../src/codegen/index');
  const { example } = await import('../src/examples/define');
  const { col, mark } = await import('../src/examples/tree');
  const { mountExample } = await import('../src/charts/mount');
  const named = siteColors[0]!;
  const definition = example({
    id: 'test-colour-named',
    title: 'Test',
    summary: 'A test.',
    group: 'Test',
    tags: [],
    notes: [],
    kind: 'plot',
    tree: { marks: [mark('v', 'line', { x: col('t'), y: col(named), color: named, label: named })] },
    data: { kind: 'rows', file: 'test-colour-named.json', rows: [{ t: 1, [named]: 2 }] },
    switches: [],
  });
  mountExample({} as HTMLElement, definition, {});

  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#123456' }));
  theme('dark');
  const { marks } = chart.update.mock.lastCall![0] as { marks: { options: Record<string, unknown> }[] };
  expect(marks[0]!.options).toMatchObject({ color: '#123456', label: named, y: Float64Array.of(2) });
});

test('a switch on a feature that is off updates the chart, and turning that feature on remounts', async () => {
  const { example } = await import('../src/examples/define');
  const { col, feature, fn, mark } = await import('../src/examples/tree');
  const { mountExample } = await import('../src/charts/mount');
  const text = (s: string) => fn(`l => '${s}'`, () => s);
  const definition = example({
    id: 'test-off-feature',
    title: 'Test',
    summary: 'A test.',
    group: 'Test',
    tags: [],
    notes: [],
    kind: 'plot',
    tree: {
      marks: [mark('v', 'line', { x: col('t'), y: col('v'), color: '#000000' })],
      use: [feature('zoom', 'zoom'), feature('tip', 'tooltip', { mode: 'nearest', text: text('a') }, false)],
    },
    data: { kind: 'rows', file: 'test-off-feature.json', rows: [{ t: 1, v: 2 }] },
    switches: [
      { id: 'tip', label: 'Tooltip', target: 'tip.on', kind: 'boolean', value: false },
      {
        id: 'text',
        label: 'Text',
        target: 'tip.text',
        kind: 'choice',
        values: ['a', 'b'],
        value: 'a',
        puts: { a: text('a'), b: text('b') },
      },
    ],
  });
  const mounted = mountExample({} as HTMLElement, definition, {});

  mounted.update({ text: 'b' });
  expect(chart.destroy).not.toHaveBeenCalled();
  expect(plot).toHaveBeenCalledOnce();

  mounted.update({ text: 'b', tip: true });
  expect(chart.destroy).toHaveBeenCalledOnce();
  expect(plot).toHaveBeenCalledTimes(2);
});

test('a plot example mounted without its legend installs no legend, whatever its switch says', async () => {
  const { load, mountExample } = await import('../src/charts/mount');
  const radar = await load('radar');
  const used = () => (plot.mock.lastCall as unknown as [unknown, { use: unknown[] }])[1].use;

  mountExample({} as HTMLElement, radar, {});
  expect(used()).toHaveLength(1);
  mountExample({} as HTMLElement, radar, { legend: true }, { legend: false });
  expect(used()).toHaveLength(0);
});
