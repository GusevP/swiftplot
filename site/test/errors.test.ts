import * as charts from 'swiftplot/charts';
import { describe, expect, test } from 'vitest';
import guide from '../../llms-full.txt?raw';
import { assign, type Family, type FieldProps } from '../../packages/core/src/charts/fields';
import { source, type Data } from '../../packages/core/src/charts/source';
import { chartNames, type ChartName } from '../src/examples/define';
import { byChart, errorsFor, table, xyOnly } from '../src/reference/errors';

type Trigger = { data: Data<never>; props?: FieldProps<never>; family?: Family; name: string };

const triggers: Record<string, Trigger> = {
  'there is no field of numbers for y': { data: [{ a: 'p' }] as never, name: 'a' },
  '"<name>" is text, so the rows look like long data': {
    data: [{ d: 'p', s: 'q', v: 1 }] as never,
    name: 's',
  },
  'there is no field "<name>"': { data: [{ v: 1 }] as never, props: { y: 'w' }, name: 'w' },
  '"<name>" is text, not numbers': { data: [{ v: 1, t: 'a' }] as never, props: { y: 't' }, name: 't' },
  'a scatter chart needs two fields of numbers or dates': {
    data: [{ v: 1 }] as never,
    family: 'scatter',
    name: '',
  },
  'a scatter chart has one y': {
    data: [{ a: 1, b: 2, c: 3 }] as never,
    props: { y: ['b', 'c'] },
    family: 'scatter',
    name: '',
  },
  'with series there is one y': {
    data: [{ x: 1, s: 'a', b: 1, c: 2 }] as never,
    props: { x: 'x', series: 's', y: ['b', 'c'] },
    name: '',
  },
  'Row N is not an [x, y] pair': { data: [[1, 2], [3]] as never, name: '' },
  'Columns differ in length': { data: { a: [1, 2], b: [1] } as never, name: '' },
  'Accessors work on row objects only': { data: { a: [1] } as never, props: { y: () => 1 }, name: '' },
};

const thrown = ({ data, props = {}, family = 'xy' }: Trigger) => {
  try {
    assign(source(data), props, family, 'chart');
  } catch (e) {
    return (e as Error).message;
  }
  return 'nothing thrown';
};

describe('the errors table of llms-full.txt', () => {
  const messages = table.flatMap(row => row.messages);

  test('has every row it is read for', () => {
    expect(messages.sort()).toEqual(Object.keys(triggers).sort());
    for (const m of xyOnly) expect(messages).toContain(m);
  });

  test.each(Object.entries(triggers))('core throws %s', (message, trigger) => {
    expect(thrown(trigger)).toContain(message.replace('<name>', trigger.name).replace('Row N', 'Row 1'));
  });

  test('keeps the scatter rows off the other pages and the long-data rows off the scatter page', () => {
    const of = (chart: Parameters<typeof errorsFor>[0]) => errorsFor(chart).flatMap(r => r.messages);
    expect(of('lineChart').some(m => m.includes('scatter chart'))).toBe(false);
    expect(of('scatterChart')).not.toContain('with series there is one y');
    expect(of('scatterChart')).toContain('a scatter chart has one y');
  });
});

type Given = Record<string, unknown>;

const row = {
  day: '2026-11-01',
  t: 'a',
  s: 'b',
  v: 1,
  open: 1,
  high: 2,
  low: 0,
  close: 1,
};
const part = { label: 't', value: 'v' };
const grid = { x: 't', y: 's', value: 'v' };
const link = { source: 't', target: 's', value: 'v' };
const price = { x: 'day', open: 'open', high: 'high', low: 'low', close: 'close' };
const root = { name: 'all', children: [{ name: 'a', value: 1 }] };
const own: { name: string; children: unknown[] } = { name: 'own', children: [] };
own.children.push(own);

const fine: Record<ChartName, { props: Given; numbers: string }> = {
  lineChart: { props: { x: 't', y: 'v', series: 's' }, numbers: 'y' },
  areaChart: { props: { x: 't', y: 'v', series: 's' }, numbers: 'y' },
  barChart: { props: { x: 't', y: 'v', series: 's' }, numbers: 'y' },
  scatterChart: { props: { x: 'v', y: 'open' }, numbers: 'y' },
  pieChart: { props: part, numbers: 'value' },
  funnelChart: { props: part, numbers: 'value' },
  radialBarChart: { props: part, numbers: 'value' },
  radarChart: { props: { x: 't', y: 'v' }, numbers: 'y' },
  heatmapChart: { props: grid, numbers: 'value' },
  histogramChart: { props: { x: 'v' }, numbers: 'x' },
  boxPlotChart: { props: { x: 't', y: 'v' }, numbers: 'y' },
  candlestickChart: { props: price, numbers: 'close' },
  sankeyChart: { props: link, numbers: 'value' },
  treemapChart: { props: {}, numbers: '' },
  sunburstChart: { props: {}, numbers: '' },
  comboChart: { props: { x: 't', lines: 'v' }, numbers: 'lines' },
};

const columns = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, [v]]));
const flow = (...ends: string[]) => ({
  data: ends.map(e => ({ source: e[0], target: e[1], value: 1 })),
});

const spread = { low: 'low', high: 'high' };

const faults: Record<string, (chart: ChartName) => Given> = {
  'series and y2 do not go together': () => ({ series: 's', y2: 'open' }),
  'errorBars and y2 do not go together': () => ({ series: undefined, y2: 'close', errorBars: spread }),
  'with errorBars there is one y': () => ({
    data: [{ t: 'a', v: 1, low: 0, high: 2, close: 1 }],
    y: ['v', 'close'],
    series: undefined,
    errorBars: spread,
  }),
  'is named in both y and y2': () => ({ y: 'v', y2: 'v', series: undefined }),
  'is named twice in y2': () => ({ y2: ['close', 'close'], series: undefined }),
  'errorBars do not apply to stacked bars': () => ({
    data: [row, { ...row, s: 'c' }],
    stack: true,
    errorBars: spread,
  }),
  "scale 'log' does not apply, as": () => ({ yAxis: { scale: 'log' } }),
  'errorBars along y do not apply to a text y': () => ({ y: 't', errorBars: { ...spread, axis: 'y' } }),
  'errorBars along x need an x of numbers': () => ({ x: 't', errorBars: { ...spread, axis: 'x' } }),
  'errorBars.axis applies to scatterChart only': () => ({
    errorBars: { ...spread, axis: 'y' },
  }),
  "yAxis.scale 'log' does not apply to a text y": () => ({ y: 't', yAxis: { scale: 'log' } }),
  "does not apply to shape 'tick'": () => ({ shape: 'tick', ring: 1 }),
  'takes x or y': () => ({ rules: [{}] }),
  'there is no field of numbers for value': () => ({ data: [{ t: 'a', s: 'b' }], value: undefined }),
  'there is no field of numbers for x': () => ({ data: [{ t: 'a' }], x: undefined }),
  'there is no field of numbers for y': () => ({ data: [{ t: 'a' }], y: undefined }),
  'are all fields of numbers, so value cannot be guessed': () => ({ value: undefined }),
  'are all fields of numbers, so x cannot be guessed': () => ({ x: undefined }),
  'are all fields of numbers, so y cannot be guessed': () => ({ y: undefined }),
  'there is no field "<name>"': c => ({ [fine[c].numbers]: 'lost' }),
  '"<name>" is text, not numbers': c => ({ [fine[c].numbers]: 'lost', data: [{ ...row, lost: 'q' }] }),
  'Row N is not an [x, y] pair': () => ({ data: [['a', 1], ['b']] }),
  'Columns differ in length': () => ({ data: { ...columns, v: [1, 2] } }),
  'Accessors work on row objects only': c => ({ data: columns, [fine[c].numbers]: () => 1 }),
  'use label and value, not x and y': () => ({ x: 't' }),
  'use x and y, not label and value': () => ({ label: 't' }),
  'use x, y and value, not label and value': () => ({ label: 't' }),
  'use x for the values counted, not <name>': () => ({ value: 'v' }),
  'use x, open, high, low and close, not <name>': () => ({ value: 'v' }),
  'use source, target and value, not <name>': () => ({ label: 't' }),
  'use lines, bars, y2Lines and y2Bars, not <name>': () => ({ y: 'v' }),
  '<name> does not apply, as data is a tree': () => ({ value: 'v' }),
  '<name> does not apply, as there are no axes': () => ({ zoom: true }),
  'zoom does not apply to a grid of cells': () => ({ zoom: true }),
  'zoom does not apply to boxes': () => ({ zoom: true }),
  'a list of numbers or pairs has no cells': () => ({ data: [1, 2] }),
  'a list of numbers or pairs has no candles': () => ({ data: [1, 2] }),
  'a list of numbers or pairs has no links': () => ({ data: [1, 2] }),
  'a list of numbers or pairs has no fields to name': () => ({ data: [1, 2] }),
  'a list of pairs has no one list of values': () => ({ data: [[1, 2]] }),
  'bins are over the limit of 1,000,000': () => ({ bins: 1_000_001 }),
  'there is no field of text or dates left for <name>': () => ({
    data: [{ t: 'a', v: 1 }],
    x: 't',
    y: undefined,
  }),
  'is over the limit of 10,000,000 cells': () => ({
    data: Array.from({ length: 3163 }, (_, i) => ({ t: `${i}t`, s: `${i}s`, v: i })),
  }),
  'are all fields of text, so x cannot be guessed': () => ({ data: [row], x: undefined }),
  'no value of "<name>" repeats, so every box would hold one row': () => ({
    data: [{ t: 'a', v: 1 }],
    x: undefined,
  }),
  'there is no field called <name>': () => ({
    data: [{ day: row.day, open: 1, high: 2, low: 0, shut: 1 }],
    close: undefined,
  }),
  'are all called <name>, so it cannot be guessed': () => ({
    data: [{ ...row, Close: 1 }],
    close: undefined,
  }),
  'there is no field of dates or text for x': () => ({
    data: [{ open: 1, high: 1, low: 1, close: 1 }],
    x: undefined,
  }),
  'there is no field of text left for <name>': () => ({ data: [{ t: 'a', v: 1 }], target: undefined }),
  'links to itself': () => ({ ...flow('aa'), source: 'source', target: 'target', value: 'value' }),
  'the links go round in a circle through': () => ({
    ...flow('ab', 'ba'),
    source: 'source',
    target: 'target',
    value: 'value',
  }),
  'data must be a root { name, value, children } or a list of roots': () => ({ data: [{ t: 'a' }] }),
  'is among its own children': () => ({ data: own }),
  'none of lines, bars, y2Lines and y2Bars is given': () => ({ lines: undefined }),
  'is named twice in <name>': () => ({ lines: ['v', 'v'] }),
  'is named in both': () => ({ bars: 'v' }),
  'stack does not apply to bars on both y and y2': c =>
    c === 'barChart'
      ? { series: undefined, y2: 'open', stack: true }
      : { bars: 'open', y2Bars: 'high', stack: true },
  "scale 'log' does not apply, as bars start at zero": () => ({ bars: 'open', yAxis: { scale: 'log' } }),
  'step does not apply to a log scale': () => ({ yAxis: { scale: 'log', step: 1 } }),
  'domain must be above zero and finite on a log scale': () => ({ yAxis: { scale: 'log', domain: [0, 1] } }),
};

const names: Record<string, string> = {
  'no value of "<name>" repeats, so every box would hold one row': 't',
  'there is no field "<name>"': 'lost',
  '"<name>" is text, not numbers': 'lost',
  'use source, target and value, not <name>': 'label',
  'use lines, bars, y2Lines and y2Bars, not <name>': 'y',
  '<name> does not apply, as there are no axes': 'zoom',
  'there is no field of text or dates left for <name>': 'y',
  'there is no field called <name>': 'close',
  'are all called <name>, so it cannot be guessed': 'close',
  'there is no field of text left for <name>': 'target',
  'is named twice in <name>': 'lines',
};

const first: readonly ChartName[] = ['lineChart', 'areaChart', 'barChart', 'scatterChart'];

describe('the errors of each chart', () => {
  const added = chartNames.filter(c => !first.includes(c));

  test('every chart has errors', () => {
    for (const chart of chartNames) expect(errorsFor(chart).length, chart).toBeGreaterThan(0);
  });

  test('every row of both tables of llms-full.txt reaches the page of a chart', () => {
    const sections = guide.split('### Errors and their fixes')[1]!.split('An update that throws')[0]!;
    const lines = sections.split('\n').filter(l => /^\|.*`.*\|$/.test(l));
    expect(table.length + byChart.length).toBe(lines.length);
    const rows = chartNames.flatMap(c => errorsFor(c).flatMap(r => r.messages.map(m => ({ ...r, m }))));
    for (const { messages, cause, fix } of [...table, ...byChart]) {
      expect(messages.length).toBeGreaterThan(0);
      for (const m of messages) expect(rows).toContainEqual(expect.objectContaining({ m, cause, fix }));
    }
  });

  test('a row of a chart reads on its own', () => {
    for (const { cause, fix } of [...table, ...byChart])
      for (const cell of [cause, fix]) expect(cell).not.toMatch(/^$|the same$|as on/);
  });

  test('a chart with fields of its own lists none of the errors of x, y and series', () => {
    const of = (chart: ChartName) => errorsFor(chart).flatMap(r => r.messages);
    for (const chart of added)
      for (const m of ['rows look like long data', 'with series', 'a scatter chart'])
        expect(
          of(chart).filter(x => x.includes(m)),
          chart,
        ).toEqual([]);
  });

  test.each(
    chartNames.flatMap(c =>
      (first.includes(c) ? byChart.filter(r => r.on.includes(c)) : errorsFor(c)).flatMap(r =>
        r.messages.map(m => [c, m] as const),
      ),
    ),
  )('%s throws %s', (chart, message) => {
    const data = ['treemapChart', 'sunburstChart'].includes(chart) ? root : [row];
    const props = { data, ...fine[chart].props, ...faults[message]!(chart) };
    const { spec } = charts[chart] as unknown as { spec: (p: Given) => unknown };
    expect(() => spec(props as Given)).toThrow(
      message.replace('<name>', names[message] ?? 'value').replace('Row N', 'Row 1'),
    );
    expect(() => spec({ data, ...fine[chart].props })).not.toThrow();
  });
});
