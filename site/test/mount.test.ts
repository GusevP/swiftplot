import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { EasyExample } from '../src/examples/define';

const chart = { update: vi.fn(), destroy: vi.fn() };
const plot = vi.fn(() => chart);
const made = vi.fn();
vi.mock('swiftplot/charts', async original => {
  const charts = await original<typeof import('swiftplot/charts')>();
  const makes = Object.keys(charts).flatMap(name =>
    name.endsWith('Chart') ? [[name, (el: unknown, props: unknown) => (made(name, el, props), chart)]] : [],
  );
  return { ...charts, ...Object.fromEntries(makes) };
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

test('an example of any easy chart mounts that chart', async () => {
  const { load, mountExample } = await import('../src/charts/mount');
  const { chartNames } = await import('../src/examples/define');
  const definition = (await load('area-stacked')) as EasyExample;
  for (const name of chartNames) {
    mountExample({} as HTMLElement, { ...definition, chart: name }, {});
    expect(made).toHaveBeenLastCalledWith(name, {}, expect.anything());
  }
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

const propsMade = () => made.mock.lastCall![2] as Record<string, unknown>;
const propsSent = () => chart.update.mock.lastCall![0] as Record<string, unknown>;

test('an easy example gives the chart its nodes evaluated, and the site colours it names in the theme', async () => {
  const { mountExample } = await import('../src/charts/mount');
  const { easyLine } = await import('./plot-definitions');
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#123456' }));
  root.dataset.theme = 'dark';
  mountExample({} as HTMLElement, easyLine, {});
  expect(propsMade()).toMatchObject({
    theme: 'dark',
    colors: ['#123456', '#123456', '#123456'],
    rules: [{ y: 2, color: '#123456', text: '#9333ea' }],
    fill: { from: '#123456', to: 0, toward: 'down' },
  });
  expect((propsMade().yAxis as { format(v: number): string }).format(1)).toBe('low 1');
  root.dataset.theme = 'light';
});

test('a theme toggle re-themes the colours in the props of the current state, and keeps the data', async () => {
  const { mountExample } = await import('../src/charts/mount');
  const { easyLine, easyTree } = await import('./plot-definitions');
  mountExample({} as HTMLElement, easyLine, { fill: 'none' });
  const { data } = propsMade();
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#123456' }));
  theme('dark');
  expect(propsSent()).toMatchObject({ theme: 'dark', rules: [{ color: '#123456' }] });
  expect(propsSent().fill).toBeUndefined();
  expect(propsSent().data).toBe(data);

  mountExample({} as HTMLElement, easyTree, { colors: 'site' });
  expect(propsMade().colors).toEqual(['#123456', '#123456', '#123456', '#d97706']);
  root.dataset.theme = 'light';
});

test('a palette example is given no colours of the site, and a prop a state leaves out is reset', async () => {
  const { mountExample } = await import('../src/charts/mount');
  const { easyTree } = await import('./plot-definitions');
  const mounted = mountExample({} as HTMLElement, easyTree, {});
  expect(propsMade()).not.toHaveProperty('colors');

  mounted.update({ colors: 'site' });
  expect(propsSent().colors).toHaveLength(4);
  mounted.update({});
  expect(Object.hasOwn(propsSent(), 'colors') && propsSent().colors === undefined).toBe(true);
});

test('a data switch replaces the rows of an easy example, as a data prop does from the start', async () => {
  const { mountExample } = await import('../src/charts/mount');
  const { example } = await import('../src/examples/define');
  const { easyLine } = await import('./plot-definitions');
  const [start, replacement] = [[{ day: '2026-01-01', v: 1 }], [{ day: '2026-01-02', v: 2 }]];
  const definition = example({
    ...easyLine,
    id: 'test-data-switch',
    switches: [
      {
        prop: 'data',
        label: 'Rows',
        kind: 'choice',
        values: ['start', 'other'],
        value: 'start',
        puts: { start, other: replacement },
      },
    ],
  });
  const mounted = mountExample(
    {} as HTMLElement,
    { ...definition, props: { data: start }, switches: [] },
    {},
  );
  expect(propsMade().data).toBe(start);
  mounted.destroy();

  const switched = mountExample({} as HTMLElement, definition, {});
  expect(propsMade().data).toBe(start);
  switched.update({ data: 'other' });
  expect(propsSent().data).toBe(replacement);
  theme('light');
  expect(propsSent().data).toBe(replacement);
});

test('a colors switch overrides the site colours, which come back when it leaves colors out', async () => {
  const { mountExample } = await import('../src/charts/mount');
  const { easyLine, easyTree } = await import('./plot-definitions');
  const { switches } = easyTree;
  const mounted = mountExample({} as HTMLElement, { ...easyLine, switches }, { colors: 'site' });
  expect(propsMade().colors).toEqual(['#000000', '#000000', '#000000', '#d97706']);
  mounted.update({ colors: 'palette' });
  expect(propsSent().colors).toEqual(['#000000', '#000000', '#000000']);
  mounted.destroy();
});

test('a live easy example steps its rows, which a switch change and the theme keep, until destroy', async () => {
  vi.useFakeTimers();
  const { mountExample } = await import('../src/charts/mount');
  const { easyLive } = await import('./plot-definitions');
  const mounted = mountExample({} as HTMLElement, easyLive, {});
  const [a, b, c] = propsMade().data as unknown[];
  vi.advanceTimersByTime(1000);
  expect(propsSent()).toEqual({ data: [b, c, a] });

  mounted.update({ animate: false });
  expect(propsSent()).toMatchObject({ animate: false, data: [b, c, a] });
  theme('light');
  expect(propsSent()).toMatchObject({ animate: false, data: [b, c, a] });
  vi.advanceTimersByTime(1000);
  expect(propsSent()).toEqual({ data: [c, a, b] });

  expect(vi.getTimerCount()).toBe(1);
  mounted.destroy();
  expect(vi.getTimerCount()).toBe(0);
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
  const { mountExample } = await import('../src/charts/mount');
  const { lineDots } = await import('./plot-definitions');
  const used = () => (plot.mock.lastCall as unknown as [unknown, { use: unknown[] }])[1].use;

  mountExample({} as HTMLElement, lineDots, {});
  expect(used()).toHaveLength(1);
  mountExample({} as HTMLElement, lineDots, { legend: true }, { legend: false });
  expect(used()).toHaveLength(0);
});
