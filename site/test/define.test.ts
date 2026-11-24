import { describe, expect, test } from 'vitest';
import {
  checkedStates,
  example,
  referencePath,
  registry,
  resolve,
  type EasyExample,
  type Example,
} from '../src/examples/define';
import { live } from './plot-definitions';

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

  test('rejects a chart that is not one of the four easy charts', () => {
    expect(() => example({ ...base, chart: 'pieChart' as EasyExample['chart'] })).toThrow(
      /line-test.*"pieChart"/,
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

test('checkedStates() gives every combination of up to four switches, else each flipped alone and all flipped', () => {
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
});

test('referencePath() gives the kebab-case reference URL', () => {
  expect(referencePath('lineChart')).toBe('/reference/line-chart');
  expect(referencePath('scatterChart')).toBe('/reference/scatter-chart');
});
