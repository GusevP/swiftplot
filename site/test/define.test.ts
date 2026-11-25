import { describe, expect, test } from 'vitest';
import {
  chartNames,
  checkedStates,
  example,
  fromQuery,
  referencePath,
  registry,
  resolve,
  switchKey,
  type EasyExample,
  type Example,
  type Switch,
} from '../src/examples/define';
import { call, col, contents, fn, omit } from '../src/examples/tree';
import { easyCombo, easyLine, easyLive, easyTree, live } from './plot-definitions';

const rows = [
  { day: '2026-11-01', a: 1, b: 2 },
  { day: '2026-11-02', a: 3, b: 4 },
];

const base: Example = {
  id: 'line-test',
  title: 'Line test',
  summary: 'A test.',
  group: 'Line',
  tags: [],
  chart: 'lineChart',
  data: { file: 'test.json', rows },
  props: { x: 'day' },
  switches: [
    { prop: 'zoom', label: 'Zoom', kind: 'boolean', value: true },
    { prop: 'curve', label: 'Curve', kind: 'choice', values: ['linear', 'smooth'], value: 'linear' },
  ],
  notes: [],
};

describe('example()', () => {
  test('accepts a valid definition', () => {
    expect(example(base)).toEqual(base);
  });

  test('rejects a duplicate switch prop', () => {
    const zoom = base.switches[0]!;
    expect(() => example({ ...base, switches: [zoom, { ...zoom, label: 'Again' }] })).toThrow(
      /line-test.*duplicate switch "zoom"/,
    );
  });

  test('rejects a switch whose default is not among its values', () => {
    expect(() =>
      example({
        ...base,
        switches: [
          { prop: 'curve', label: 'Curve', kind: 'choice', values: ['linear', 'smooth'], value: 'step' },
        ],
      }),
    ).toThrow(/line-test.*"curve".*"step"/);
  });

  test.each(['Line-Test', 'line test', 'line--test', '-line', 'line/test', ''])(
    'rejects the id %j, which is not a URL slug',
    id => {
      expect(() => example({ ...base, id })).toThrow(/not a URL slug/);
    },
  );

  test('rejects a tag that is not a URL slug, as the index filters by space-separated tags', () => {
    expect(() => example({ ...base, tags: ['over time'] })).toThrow(/tag "over time" is not a URL slug/);
  });

  test('rejects a tag with no filter label', () => {
    expect(() => example({ ...base, tags: ['unlabelled'] })).toThrow(/tag "unlabelled" has no label/);
  });

  test('rejects a live block over JSON data', () => {
    expect(() =>
      example({
        ...live,
        tree: { marks: [], live: live.tree.live },
        data: { kind: 'json', file: 'live.json', value: [] },
        switches: [],
      }),
    ).toThrow(/live block steps rows/);
  });

  test('rejects an easy live block over JSON data, and JSON data JSON cannot carry', () => {
    expect(() => example({ ...easyLive, data: easyTree.data, switches: [] })).toThrow(
      /live block steps rows/,
    );
    expect(() =>
      example({ ...easyTree, data: { kind: 'json', file: 'bad.json', value: [Number.NaN] } }),
    ).toThrow(/value JSON cannot carry/);
  });

  test('checks the puts of an easy switch as it does those of a plot switch', () => {
    const [fill] = easyLine.switches;
    const put = (over: object) => example({ ...easyLine, switches: [{ ...fill, ...over } as Switch] });
    expect(() => put({ puts: { none: omit } })).toThrow(/switch "fill" puts nothing for its value "faded"/);
    expect(() => put({ puts: { none: omit, faded: 1, other: 2 } })).toThrow(/puts a value for "other"/);
    expect(() => put({ sets: { none: [], faded: [] } })).toThrow(/switch "fill" has both a prop and sets/);
  });

  test.each(['target', 'prop'])('an explicit %s: undefined beside sets is the sets form', one => {
    const [sets] = easyCombo.switches;
    expect(() =>
      example({ ...easyCombo, switches: [{ ...sets, [one]: undefined } as Switch] }),
    ).not.toThrow();
  });

  test('an easy put into a value that is not an object fails, naming the state', () => {
    expect(() =>
      example({
        ...base,
        props: { xAxis: 'day' },
        switches: [{ prop: 'xAxis.utc', label: 'UTC', kind: 'boolean', value: true }],
      }),
    ).toThrow(/line-test.*in {"xAxis.utc":true}, "xAxis.utc" goes into a value that is not an object/);
  });

  test.each([col('a'), [{ y: col('a') }], call('bin', [col('a')]), omit])(
    'an easy prop takes only fn, call and ref nodes',
    node => {
      expect(() => example({ ...base, props: { y: node } })).toThrow(/line-test.*node cannot stand/);
    },
  );

  test('rejects a chart that is not one of the sixteen easy charts', () => {
    expect(chartNames).toHaveLength(16);
    expect(example({ ...base, chart: 'pieChart' }).chart).toBe('pieChart');
    expect(() => example({ ...base, chart: 'gaugeChart' as EasyExample['chart'] })).toThrow(
      /line-test.*"gaugeChart"/,
    );
  });
});

describe('resolve()', () => {
  const definition = example(base);

  test('gives the chart the data, the fixed props and each switch at its default', () => {
    expect(resolve(definition, {})).toEqual({ data: rows, x: 'day', zoom: true, curve: 'linear' });
  });

  test('a state value replaces its switch default', () => {
    expect(resolve(definition, { zoom: false, curve: 'smooth' })).toEqual({
      data: rows,
      x: 'day',
      zoom: false,
      curve: 'smooth',
    });
  });

  test('an unknown key in the state is ignored', () => {
    expect(resolve(definition, { zoom: false, colors: ['red'], 'xAxis.label': 'Day' })).toEqual({
      data: rows,
      x: 'day',
      zoom: false,
      curve: 'linear',
    });
  });

  test('a nested switch prop sets the field inside the fixed object', () => {
    const nested = example({
      ...base,
      props: { xAxis: { utc: true } },
      switches: [
        { prop: 'xAxis.label', label: 'Label', kind: 'choice', values: ['Day', 'Date'], value: 'Day' },
      ],
    });
    expect(resolve(nested, { 'xAxis.label': 'Date' })).toEqual({
      data: rows,
      xAxis: { utc: true, label: 'Date' },
    });
    expect(nested.props).toEqual({ xAxis: { utc: true } });
  });

  test('an easy switch gives the prop what its puts name for the UI value, and omit leaves the prop out', () => {
    expect(resolve(easyLine, {}).fill).toEqual(call('gradient', ['#2563eb', 0]));
    expect(resolve(easyLine, { fill: 'none' })).not.toHaveProperty('fill');
    const on = example({
      ...base,
      switches: [
        { prop: 'xAxis.label', label: 'L', kind: 'boolean', value: true, puts: { on: 'Day', off: omit } },
      ],
    });
    expect(resolve(on, {})).toEqual({ data: rows, x: 'day', xAxis: { label: 'Day' } });
    expect(resolve(on, { 'xAxis.label': false })).toEqual({ data: rows, x: 'day' });
  });

  test('one easy switch with sets changes two props and leaves a third out', () => {
    expect(switchKey(easyCombo.switches[0]!)).toBe('y2');
    expect(resolve(easyCombo, {})).toMatchObject({ y2Bars: 'n', yAxis: { label: 'v' } });
    const { data: _, ...off } = resolve(easyCombo, { y2: false });
    expect(off).toEqual({ lines: 'v', bars: 'n', yAxis: { label: 'v and n' } });
    expect(fromQuery(easyCombo, new URLSearchParams('y2=false'))).toEqual({ y2: false });
  });

  test('an easy example with JSON data gives the chart that value, and fn nodes stay nodes', () => {
    expect(resolve(easyTree, {})).toEqual({ data: contents(easyTree.data) });
    const format = fn('v => v', (v: number) => v);
    expect(resolve(example({ ...base, props: { yAxis: { format } }, switches: [] }), {})).toMatchObject({
      yAxis: { format },
    });
  });
});

describe('registry()', () => {
  test('maps each example by its id', () => {
    const a = example(base);
    const b = example({ ...base, id: 'line-other' });
    expect([...registry([a, b]).keys()]).toEqual(['line-test', 'line-other']);
  });

  test('fails on a duplicate id and names it', () => {
    const a = example(base);
    expect(() => registry([a, example({ ...base, title: 'Copy' })])).toThrow(
      /duplicate example id "line-test"/,
    );
  });
});

test('checkedStates() gives every combination of up to four switches, else each other value alone and all flipped', () => {
  expect(checkedStates(base.switches)).toEqual([
    { zoom: true, curve: 'linear' },
    { zoom: true, curve: 'smooth' },
    { zoom: false, curve: 'linear' },
    { zoom: false, curve: 'smooth' },
  ]);
  const five = ['a', 'b', 'c', 'd', 'e'].map(
    prop => ({ prop, label: prop, kind: 'boolean', value: false }) as const,
  );
  expect(checkedStates(five)).toEqual([
    {},
    { a: true },
    { b: true },
    { c: true },
    { d: true },
    { e: true },
    { a: true, b: true, c: true, d: true, e: true },
  ]);
  const choice = { prop: 'a', label: 'a', kind: 'choice', values: ['x', 'y', 'z'], value: 'y' } as const;
  expect(checkedStates([choice, ...five.slice(1)])).toEqual([
    {},
    { a: 'x' },
    { a: 'z' },
    { b: true },
    { c: true },
    { d: true },
    { e: true },
    { a: 'x', b: true, c: true, d: true, e: true },
  ]);
});

test('referencePath() gives the kebab-case reference URL', () => {
  expect(referencePath('lineChart')).toBe('/reference/line-chart');
  expect(referencePath('scatterChart')).toBe('/reference/scatter-chart');
});
