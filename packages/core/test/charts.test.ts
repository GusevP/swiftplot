import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';

import { easyChart } from '../src/charts/build.js';
import { create, type Build, type ControllerProps, type EasyChart } from '../src/charts/controller.js';
import {
  areaChart,
  barChart,
  equal,
  lineChart,
  mount,
  scatterChart,
  type AreaChartProps,
  type BarChartProps,
  type EasyChart as PublicChart,
  type LineChartProps,
  type ScatterChartProps,
} from '../src/charts/index.js';
import { sankeyChart, sunburstChart, treemapChart } from '../src/charts/flow.js';
import { funnelChart, pieChart, radialBarChart } from '../src/charts/parts.js';
import { candlestickChart } from '../src/charts/candlestick.js';
import { boxPlotChart, histogramChart } from '../src/charts/distribution.js';
import { fits, heatmapChart } from '../src/charts/heatmap.js';
import { comboChart } from '../src/charts/combo.js';
import { radarChart } from '../src/charts/radar.js';
import { xy } from '../src/charts/xy.js';
import { bandTitle, colorsFor, formatNumber, themeOf, timeTitle } from '../src/charts/defaults.js';
import { assign, type Assigned, type Family, type FieldProps } from '../src/charts/fields.js';
import { source, type Data } from '../src/charts/source.js';
import type {
  AreaProps,
  Axes,
  ComboProps,
  Base,
  HeatmapProps,
  Input,
  PieProps,
  RadarProps,
  ScatterProps,
} from '../src/charts/types.js';
import {
  bin,
  dots,
  fiveNumbers,
  gradient,
  legend,
  line,
  plot,
  sequential,
  time,
  tooltip,
  type Nested,
  zoom,
} from '../src/index.js';
import type { BandAxis } from '../src/scales/band.js';
import type { ColorScale } from '../src/scales/color.js';
import type { Col, Feature, Internals, Mark, Options } from '../src/types.js';
import { palette, paletteDark } from '../src/paint.js';
import { dark, light, type Theme } from '../src/theme.js';
import {
  click,
  doubleClick,
  drag,
  entriesOf,
  host,
  hover,
  middleOf,
  nextFrame,
  pixel,
  tap,
  tipOf,
  wheel,
} from './helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const values = (s: ReturnType<typeof source>, f: string) => Array.from(s.column(f).values);

test('rows give their length, fields and columns', () => {
  const s = source([
    { a: 1, b: 'x' },
    { a: 2, b: 'y' },
  ]);
  expect(s.length).toBe(2);
  expect(s.fields()).toEqual(['a', 'b']);
  expect(s.column('a').kind).toBe('number');
  expect(values(s, 'a')).toEqual([1, 2]);
  expect(s.column('b')).toMatchObject({ kind: 'text', categories: ['x', 'y'] });
  expect(values(s, 'b')).toEqual([0, 1]);
});

test('rows: fields are the keys of the first 100 rows in order of first appearance', () => {
  const rows: Record<string, number>[] = Array.from({ length: 101 }, () => ({ b: 1 }));
  rows[3] = { a: 1, b: 1 };
  rows[99] = { b: 1, late: 1 };
  rows[100] = { b: 1, never: 1 };
  expect(source(rows).fields()).toEqual(['b', 'a', 'late']);
});

test('columns give the same interface and borrow numeric typed arrays', () => {
  const t = new Float64Array([1, 2, 3]);
  const w = new Float32Array([4, 5, 6]);
  const s = source({ t, v: [1, 2, 3], w });
  expect(s.length).toBe(3);
  expect(s.fields()).toEqual(['t', 'v', 'w']);
  expect(s.column('t')).toEqual({ kind: 'number', values: t });
  expect(s.column('t').values).toBe(t);
  expect(s.column('w').values).toBe(w);
  expect(s.column('v').kind).toBe('number');
  expect(values(s, 'v')).toEqual([1, 2, 3]);
});

test('columns of unequal length throw naming both fields and lengths', () => {
  expect(() => source({ t: new Float64Array(3), v: [1, 2] }).column('v')).toThrow(/"t" has 3.*"v" has 2/);
});

test('every plotted column is checked against the length, not only the first', () => {
  const data = { a: [1, 2], b: [3, 4] };
  expect(source(data).length).toBe(2);
  data.a.push(5);
  data.b.push(6);
  expect(source(data).length).toBe(3);
  data.b.push(7);
  expect(() => source(data).column('b')).toThrow(/"a" has 3.*"b" has 4/);
});

test('a number array has the single field value', () => {
  const s = source([3, 5, 2]);
  expect(s.fields()).toEqual(['value']);
  expect(values(s, 'value')).toEqual([3, 5, 2]);
  const f = new Float32Array([1, 2]);
  const typed = source(f);
  expect(typed.fields()).toEqual(['value']);
  expect(typed.column('value').values).toBe(f);
  expect(() => typed.column('nope')).toThrow(/No field "nope"/);
  expect(() => typed.kind('nope')).toThrow(/No field "nope"/);
});

test('an array-like of numbers has the single field value; a column named length is still a column', () => {
  const s = source({ 0: 3, 1: 5, length: 2 });
  expect(s.length).toBe(2);
  expect(s.fields()).toEqual(['value']);
  expect(values(s, 'value')).toEqual([3, 5]);
  const c = source({ length: [1, 2], x: [3, 4] });
  expect(c.fields()).toEqual(['length', 'x']);
  expect(values(c, 'length')).toEqual([1, 2]);
});

test('fields are read only from own properties', () => {
  const rows: Record<string, unknown>[] = [{}, { toString: 7 }];
  const s = source(rows);
  expect(s.fields()).toEqual(['toString']);
  expect(values(s, 'toString')).toEqual([Number.NaN, 7]);
  const cols = Object.assign(Object.create({ t: new Float64Array([1]) }), { a: [1] });
  expect(() => source(cols).column('t')).toThrow(/No field "t"/);
});

test('pairs have the fields x and y', () => {
  const s = source([
    [0, 1],
    [1, 4],
  ]);
  expect(s.fields()).toEqual(['x', 'y']);
  expect(values(s, 'x')).toEqual([0, 1]);
  expect(values(s, 'y')).toEqual([1, 4]);
});

test('a pair of another arity, or a row that is neither an object nor a pair, throws naming the index', () => {
  expect(() =>
    source([
      [0, 1],
      [1, 2, 3],
    ]).column('x'),
  ).toThrow(/Row 1/);
  expect(() => source([{ a: 1 }, 5]).fields()).toThrow(/Row 1/);
  expect(() => source(['a', 'b']).fields()).toThrow(/Row 0/);
  expect(() => pick(['a', 'b'])).toThrow(/^lineChart: Row 0 is neither/);
  expect(() => pick([null, { a: 1, b: 2 }])).toThrow(/^lineChart: Row 0 is neither/);
});

test('an infinite value in a borrowed typed column is missing, as in a plain array', () => {
  expect(values(source({ y: new Float64Array([1, Infinity, -Infinity]) }), 'y')).toEqual([1, NaN, NaN]);
});

test('no data gives length 0 and no fields', () => {
  for (const data of [undefined, null, []]) {
    const s = source(data);
    expect(s.length).toBe(0);
    expect(s.fields()).toEqual([]);
    expect(s.column('x').values.length).toBe(0);
  }
});

test('a typed column holding only NaN has no kind but is still borrowed', () => {
  const t = new Float64Array([Number.NaN, Number.NaN]);
  const s = source({ t });
  expect(s.kind('t')).toBeUndefined();
  expect(s.column('t').values).toBe(t);
});

test('missing values become NaN and do not decide the kind', () => {
  const s = source([
    { n: null, t: undefined, m: '' },
    { n: 1, t: 'a', m: Number.NaN },
    { n: Number.NaN, t: 2, m: 3 },
    { n: '', t: null, m: 'later text' },
  ]);
  expect(s.column('n').kind).toBe('number');
  expect(values(s, 'n')).toEqual([Number.NaN, 1, Number.NaN, Number.NaN]);
  expect(s.column('t')).toMatchObject({ kind: 'text', categories: ['a'] });
  expect(values(s, 't')).toEqual([Number.NaN, 0, Number.NaN, Number.NaN]);
  expect(values(s, 'm')).toEqual([Number.NaN, Number.NaN, 3, Number.NaN]);
});

test('unplottable fields have no kind and throw when read; all-missing fields are NaN numbers', () => {
  const s = source([
    { flag: true, obj: { a: 1 }, empty: null },
    { flag: false, obj: { a: 2 }, empty: '' },
  ]);
  expect(s.kind('flag')).toBeUndefined();
  expect(s.kind('obj')).toBeUndefined();
  expect(() => s.column('flag')).toThrow(/"flag"/);
  expect(() => s.column('obj')).toThrow(/"obj"/);
  expect(s.kind('empty')).toBeUndefined();
  expect(s.column('empty').kind).toBe('number');
  expect(values(s, 'empty')).toEqual([Number.NaN, Number.NaN]);
});

test('Date values are time in milliseconds; an invalid Date is missing', () => {
  const s = source([{ d: new Date(Number.NaN) }, { d: new Date(86_400_000) }]);
  expect(s.kind('d')).toBe('time');
  expect(values(s, 'd')).toEqual([Number.NaN, 86_400_000]);
});

const times = (strings: unknown[], utc?: boolean) =>
  Array.from(source({ t: strings }).column('t', utc === undefined ? undefined : { utc }).values);

test('Dates and ISO strings with a zone are exact whatever the zone setting', () => {
  const d = [new Date(Date.UTC(2026, 10, 22, 10)), '2026-11-22T10:00:00Z', '2026-11-22T10:00+02:00'];
  const want = [Date.UTC(2026, 10, 22, 10), Date.UTC(2026, 10, 22, 10), Date.UTC(2026, 10, 22, 8)];
  expect(source({ t: d }).kind('t')).toBe('time');
  expect(times(d, true)).toEqual(want);
  expect(times(d, false)).toEqual(want);
  expect(times(['2026-11-22T10:00:01.25-05:30'])).toEqual([Date.UTC(2026, 10, 22, 15, 30, 1, 250)]);
});

test('ISO strings without a zone are UTC by default', () => {
  const s = ['2026-11-22', '2026-11-22T10:00', '2026-11-22 10:00'];
  const want = [Date.UTC(2026, 10, 22), Date.UTC(2026, 10, 22, 10), Date.UTC(2026, 10, 22, 10)];
  expect(times(s)).toEqual(want);
  expect(times(s, true)).toEqual(want);
  expect(Date.parse(s[1]!)).not.toBe(want[1]);
  expect(Date.parse(s[2]!)).not.toBe(want[2]);
});

test('with utc false ISO strings without a zone are local time, date-only ones included', () => {
  const local = times(['2026-11-22', '2026-11-22T10:00', '2026-11-22 10:00'], false);
  expect(local).toEqual([
    new Date(2026, 10, 22).getTime(),
    new Date(2026, 10, 22, 10).getTime(),
    new Date(2026, 10, 22, 10).getTime(),
  ]);
  expect(local[0]).not.toBe(Date.UTC(2026, 10, 22));
});

test('ISO years 0000 to 0099 are not read as 1900 to 1999', () => {
  expect(times(['0050-06-01'])).toEqual([new Date(0).setUTCFullYear(50, 5, 1)]);
  expect(times(['0050-06-01T10:00'], false)).toEqual([new Date(50, 5, 1, 10).setFullYear(50)]);
});

test('other date-like strings are text; impossible dates are missing', () => {
  for (const v of ['22/11/2026', 'Nov 22', '2026', '12.5', '2026-11-22T10', '2026-11-22Z'])
    expect(source({ t: [v] }).kind('t')).toBe('text');
  expect(source({ t: ['2026-13-40'] }).kind('t')).toBeUndefined();
  expect(
    times([
      '2026-13-40',
      '2026-02-29',
      '2026-11-22T24:00',
      '2026-11-22T10:60',
      '2026-11-22T10:00+99:99',
      '2026-11-22T10:00+05:60',
      '2024-02-29',
      'text',
      new Date(Number.NaN),
    ]),
  ).toEqual([
    Number.NaN,
    Number.NaN,
    Number.NaN,
    Number.NaN,
    Number.NaN,
    Number.NaN,
    Date.UTC(2024, 1, 29),
    Number.NaN,
    Number.NaN,
  ]);
  expect(source({ t: ['a', '2026-11-22'] }).column('t')).toMatchObject({ kind: 'text', categories: ['a'] });
});

test('the column cache is per field and zone', () => {
  const s = source({ t: ['2026-11-22'], n: [1] });
  expect(s.column('t').values).toBe(s.column('t', { utc: true }).values);
  expect(s.column('t', { utc: false }).values).toBe(s.column('t', { utc: false }).values);
  expect(s.column('t', { utc: false }).values).not.toBe(s.column('t').values);
  expect(s.column('n', { utc: false }).values).toBe(s.column('n').values);
});

test('columns are read lazily and cached', () => {
  const row = {
    a: 1,
    get boom(): number {
      throw new Error('read');
    },
  };
  const s = source([row, { a: 2, boom: 0 }]);
  expect(s.fields()).toEqual(['a', 'boom']);
  expect(s.column('a').values).toBe(s.column('a').values);
});

test('an accessor on rows gives a computed column that is not cached', () => {
  const s = source([{ a: 1 }, { a: 2 }]);
  const twice = (d: { a: number }) => d.a * 2;
  expect(Array.from(s.column(twice).values)).toEqual([2, 4]);
  expect(s.column(twice).values).not.toBe(s.column(twice).values);
});

test('an accessor on columns, a number array or pairs throws', () => {
  const f = () => 1;
  expect(() => source({ a: [1] }).column(f)).toThrow(/row objects/);
  expect(() => source([1, 2]).column(f)).toThrow(/row objects/);
  expect(() => source([[0, 1]]).column(f)).toThrow(/row objects/);
});

const sample = {
  time: ['2026-11-01', '2026-11-02', '2026-11-03'],
  number: [1, 2, 3],
  text: ['a', 'b', 'a'],
  boolean: [true, false, true],
  missing: [null, null, null],
  numtext: ['12.5', '3', '4'],
} as const;
type Sample = keyof typeof sample;

const fieldsOf = (spec: string) => spec.split(' ').map(s => s.split(':') as [string, Sample]);
const rowsOf = (spec: string) =>
  sample.time.map((_, i) => Object.fromEntries(fieldsOf(spec).map(([f, k]) => [f, sample[k][i]])));
const columnsOf = (spec: string) =>
  Object.fromEntries(fieldsOf(spec).map(([f, k]) => [f, [...sample[k]] as unknown[]]));

const pick = (data: Data | null | undefined, props: FieldProps<any> = {}, family: Family = 'xy') =>
  assign(source(data), props, family, 'lineChart');
const chosen = (a: Assigned) => ({
  x: a.x.kind === 'index' ? '#' : a.x.label,
  y: a.ys.map(s => s.name),
});
const numbers = (c: ArrayLike<number> | undefined) => Array.from(c ?? []);

const table: [spec: string, props: FieldProps<any>, result: { x: string; y: string[] } | RegExp][] = [
  ['date:time api:number web:number jobs:number', {}, { x: 'date', y: ['api', 'web', 'jobs'] }],
  ['date:time value:number', {}, { x: 'date', y: ['value'] }],
  ['id:number date:time value:number', {}, { x: 'date', y: ['id', 'value'] }],
  ['name:text value:number', {}, { x: 'name', y: ['value'] }],
  ['t:number v:number', {}, { x: 't', y: ['v'] }],
  ['a:number b:number c:number', {}, { x: 'a', y: ['b', 'c'] }],
  ['value:number', {}, { x: '#', y: ['value'] }],
  ['a:number b:number', { y: 'b' }, { x: 'a', y: ['b'] }],
  ['a:number b:number', { y: ['a', 'b'] }, { x: '#', y: ['a', 'b'] }],
  ['a:number b:number', { x: 'b' }, { x: 'b', y: ['a'] }],
  ['start:time end:time value:number', {}, { x: 'start', y: ['value'] }],
  ['flag:boolean date:time value:number', {}, { x: 'date', y: ['value'] }],
  ['date:time empty:missing value:number', {}, { x: 'date', y: ['value'] }],
  ['date:time empty:missing', { y: 'empty' }, { x: 'date', y: ['empty'] }],
  ['date:time service:text value:number', {}, /long data.*Pass series: 'service'\.$/],
  ['name:text group:text value:number', {}, /long data.*Pass series: 'group'\.$/],
  ['date:time service:text value:number', { series: 'service' }, { x: 'date', y: ['a', 'b'] }],
  ['group:text name:text value:number', { series: 'group' }, { x: 'name', y: ['a', 'b'] }],
  ['date:time service:text region:text value:number', { series: 'service' }, { x: 'date', y: ['a', 'b'] }],
  ['date:time note:text', {}, /no field of numbers for y\. /],
  ['date:time amount:numtext', {}, /no field of numbers for y; "amount" holds numbers as text/],
];

test.each(table)('fields %s with %o', (spec, props, result) => {
  for (const data of [rowsOf(spec), columnsOf(spec)]) {
    if (result instanceof RegExp) expect(() => pick(data, props)).toThrow(result);
    else expect(chosen(pick(data, props))).toEqual(result);
  }
});

test('a named empty y is an empty series; with series, y is labelled by its field', () => {
  const empty = pick(rowsOf('date:time empty:missing'), { y: 'empty' });
  expect(numbers(empty.ys[0]?.y)).toEqual([Number.NaN, Number.NaN, Number.NaN]);
  expect(empty.y.label).toBe('empty');
  const long = pick(rowsOf('date:time service:text value:number'), { series: 'service' });
  expect(long.y.label).toBe('value');
  expect(long.x).toEqual({ label: 'date', kind: 'time' });
});

test('no data chooses nothing and throws nothing, whatever is named', () => {
  for (const data of [undefined, null, []]) {
    expect(pick(data, { x: 'date', y: 'nope' })).toEqual({
      x: { label: '', kind: 'index' },
      y: { label: '' },
      ys: [],
    });
    expect(pick(data, { y: ['a', 'b'] }, 'scatter').ys).toEqual([]);
  }
});

test('positional shapes do not guess: a number array is y over its index, pairs are x and y', () => {
  const n = pick([3, 5, 2], {}, 'scatter');
  expect(chosen(n)).toEqual({ x: '#', y: ['value'] });
  expect(numbers(n.ys[0]?.x)).toEqual([0, 1, 2]);
  expect(chosen(pick(new Float32Array([1, 2])))).toEqual({ x: '#', y: ['value'] });
  expect(
    chosen(
      pick([
        [0, 1],
        [1, 4],
      ]),
    ),
  ).toEqual({ x: 'x', y: ['y'] });
  expect(
    pick([
      ['a', 1],
      ['b', 2],
    ]).x,
  ).toEqual({ label: 'x', kind: 'text', categories: ['a', 'b'] });
  expect(
    pick([
      [null, 1],
      [null, 2],
    ]).ys[0]?.x.length,
  ).toBe(0);
  expect(() => pick([[0, 'a']])).toThrow(/y "y" is text/);
});

test('scatter: x is the first time or number field, y the first number field that is not x', () => {
  expect(chosen(pick(rowsOf('id:number date:time value:number'), {}, 'scatter'))).toEqual({
    x: 'date',
    y: ['id'],
  });
  expect(chosen(pick(rowsOf('a:number b:number c:number'), {}, 'scatter'))).toEqual({ x: 'a', y: ['b'] });
  expect(chosen(pick(rowsOf('name:text a:number b:number'), {}, 'scatter'))).toEqual({ x: 'a', y: ['b'] });
  expect(() => pick(rowsOf('name:text value:number'), {}, 'scatter')).toThrow(/needs two fields/);
  expect(() => pick(rowsOf('date:time'), {}, 'scatter')).toThrow(/needs two fields/);
  expect(() => pick(rowsOf('a:number b:number c:number'), { y: ['b', 'c'] }, 'scatter')).toThrow(/one y/);
});

test('scatter: a named r is taken out of the pool, and each series gets the r of its own rows', () => {
  const rows = [
    { size: 1, height: 10, weight: 100, g: 'a' },
    { size: 2, height: 20, weight: 200, g: 'b' },
    { size: 3, height: 30, weight: 300, g: 'a' },
    { size: 4, height: 40, weight: 400, g: 'b' },
  ];
  const plain = pick(rows, { r: 'size' }, 'scatter');
  expect(chosen(plain)).toEqual({ x: 'height', y: ['weight'] });
  expect(numbers(plain.ys[0]?.r)).toEqual([1, 2, 3, 4]);
  expect(pick(rows, { r: 4 }, 'scatter').ys[0]?.r).toBeUndefined();
  const grouped = pick(rows, { r: 'size', series: 'g' }, 'scatter');
  expect(grouped.ys.map(s => [s.name, numbers(s.x), numbers(s.r)])).toEqual([
    ['a', [10, 30], [1, 3]],
    ['b', [20, 40], [2, 4]],
  ]);
  expect(() => pick(rows, { r: 'g' }, 'scatter')).toThrow(/r "g" is text/);
  const holed = pick([...rows, { size: null, height: 50, weight: 500, g: 'a' }], { r: 'size' }, 'scatter');
  expect(numbers(holed.ys[0]?.x)).toEqual([10, 20, 30, 40]);
});

test('a row with a missing x is dropped with its y values; a missing y keeps its row', () => {
  const a = pick([
    { t: null, v: 1 },
    { t: 1, v: 2 },
    { t: undefined, v: 3 },
    { t: 3, v: null },
  ]);
  expect(numbers(a.ys[0]?.x)).toEqual([1, 3]);
  expect(numbers(a.ys[0]?.y)).toEqual([2, Number.NaN]);
  expect(
    pick(
      [
        { t: null, v: 1 },
        { t: 2, v: 2 },
      ],
      { x: 't', y: 'v' },
    ).ys[0]?.x.length,
  ).toBe(1);
  const none = pick([{ t: null, u: 1, v: 1 }], { x: 't', y: 'v' });
  expect(none.ys.map(s => s.x.length)).toEqual([0]);
});

test('with every x present the source columns are handed on as they are', () => {
  const t = new Float64Array([1, 2]);
  const v = new Float64Array([3, 4]);
  const a = pick({ t, v });
  expect(a.ys[0]?.x).toBe(t);
  expect(a.ys[0]?.y).toBe(v);
});

test('an accessor takes no field out of the pool', () => {
  const rows = [{ date: '2026-11-01', api: 1, web: 2 }];
  const a = pick(rows, { x: (d: (typeof rows)[number]) => d.date });
  expect(chosen(a)).toEqual({ x: '', y: ['api', 'web'] });
  expect(a.x.kind).toBe('time');
});

test('named fields: unknown, of the wrong kind or unplottable throw; a y list keeps its order', () => {
  const rows = [{ date: '2026-11-01', api: 1, web: 2, note: 'n', flag: true }];
  expect(() => pick(rows, { y: 'nope' })).toThrow(
    /no field "nope"\. The fields are date \(time\), api \(number\)/,
  );
  expect(() => pick(rows, { x: 'nope' })).toThrow(/no field "nope"/);
  expect(() => pick(rows, { y: 'note' })).toThrow(/y "note" is text, not numbers/);
  expect(() => pick(rows, { y: 'date' })).toThrow(/y "date" is time, not numbers/);
  expect(() => pick(rows, { x: 'flag', y: 'api' })).toThrow(/"flag" holds values that are not numbers/);
  expect(() => pick(rows, { x: 'flag', y: 'api' })).toThrow(/Pass x as another field\.$/);
  expect(() => pick(rows, { x: 'nope' })).toThrow(/Pass x as one of these fields\.$/);
  expect(() => pick(rows, { r: 'nope' }, 'scatter')).toThrow(/Pass r as one of these fields\.$/);
  expect(() => pick(rows, { r: 'flag' }, 'scatter')).toThrow(/Pass r as another field\.$/);
  expect(() => pick(rows, { r: 'note' }, 'scatter')).toThrow(
    /r "note" is text, not numbers\. .*Pass r as a field of numbers\.$/,
  );
  const long = [{ date: '2026-11-01', note: 'n', label: 'l', value: 1 }];
  expect(() => pick(long, { y: 'note' })).toThrow(/y "note" is text, not numbers/);
  expect(chosen(pick([{ date: '2026-11-01', api: 1, web: 2 }], { y: ['web', 'api'] }))).toEqual({
    x: 'date',
    y: ['web', 'api'],
  });
});

test('a named field first present after the scanned rows is read, earlier rows as missing', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({
    t: i,
    ...(i >= 120 && { errors: i, group: 'g', size: 2 }),
  }));
  const a = pick(rows, { x: 't', y: 'errors', series: 'group' });
  expect(a.ys.map(s => s.name)).toEqual(['g']);
  expect(numbers(a.ys[0]!.y)).toEqual(rows.slice(120).map(r => r.t));
  const line = pick(rows, { x: 't', y: 'errors' });
  expect(numbers(line.ys[0]!.y).slice(118, 121)).toEqual([Number.NaN, Number.NaN, 120]);
  expect(numbers(pick(rows, { x: 't', y: 'errors', r: 'size' }, 'scatter').ys[0]!.r)).toHaveLength(30);
  expect(() => pick(rows, { y: 'nope' })).toThrow(/no field "nope"/);
});

test('accessors as x, in a y list and as series', () => {
  type Row = { t: number; a: number; b: number; g: string };
  const rows: Row[] = [
    { t: 1, a: 10, b: 20, g: 'p' },
    { t: 2, a: 30, b: 40, g: 'q' },
  ];
  const wide = [
    { t: 1, a: 10, b: 20 },
    { t: 2, a: 30, b: 40 },
  ];
  type Wide = (typeof wide)[number];
  const a = pick(wide, { x: (d: Wide) => d.t * 10, y: [(d: Wide) => d.a + 1, 'b', (d: Wide) => -d.b] });
  expect(a.x).toEqual({ label: '', kind: 'number' });
  expect(a.ys.map(s => [s.name, numbers(s.x), numbers(s.y)])).toEqual([
    ['y1', [10, 20], [11, 31]],
    ['b', [10, 20], [20, 40]],
    ['y3', [10, 20], [-20, -40]],
  ]);
  expect(a.y.label).toBe('');
  const s = pick(rows, { x: 't', y: 'a', series: (d: Row) => d.g.toUpperCase() });
  expect(s.ys.map(v => v.name)).toEqual(['P', 'Q']);
  expect(() => pick(rows, { x: 't', y: (d: Row) => d.g, series: 'g' })).toThrow(
    /the accessor y1 is text, not numbers/,
  );
  const flags = rows.map(r => ({ ...r, note: 'n' }));
  for (const [role, p] of [
    ['y', { x: 't', y: (d: Row) => d.a > 10, series: 'g' }],
    ['x', { x: (d: Row) => d.a > 10, y: 'a', series: 'g' }],
    ['series', { x: 't', y: 'a', series: (d: Row) => d.a > 10 }],
  ] as const) {
    let e: Error | undefined;
    try {
      pick(flags, p);
    } catch (caught) {
      e = caught as Error;
    }
    expect(e?.message).toMatch(
      new RegExp(
        `^lineChart: the accessor ${role}1? cannot be read: .+\\. The fields are t \\(number\\), .+, note \\(text\\)\\. Pass ${role} as another field\\.$`,
      ),
    );
    expect(e?.cause).toBeInstanceOf(Error);
  }
});

test('series splits long rows by first appearance, with one y, and skips a missing series value', () => {
  const rows = [
    { date: '2026-11-01', service: 'web', value: 1 },
    { date: '2026-11-01', service: 'api', value: 2 },
    { date: '2026-11-02', service: null, value: 3 },
    { date: '2026-11-02', service: 'web', value: 4 },
    { date: '2026-11-03', service: 'api', value: 5 },
  ];
  const day = (d: number) => Date.UTC(2026, 10, d);
  const a = pick(rows, { series: 'service' });
  expect(a.ys.map(s => [s.name, numbers(s.x), numbers(s.y)])).toEqual([
    ['web', [day(1), day(2)], [1, 4]],
    ['api', [day(1), day(3)], [2, 5]],
  ]);
  const two = rows.map(r => ({ ...r, other: r.value }));
  expect(() => pick(two, { series: 'service' })).toThrow(
    /with series there is one y\. .*Pass y as one field\.$/,
  );
  expect(() => pick(two, { series: 'service', y: ['value', 'other'] })).toThrow(/with series there is one y/);
  expect(pick(two, { series: 'service', y: 'other' }).ys.length).toBe(2);
  expect(
    pick(
      [
        { x: 1, n: 7, v: 1 },
        { x: 2, n: 7, v: 2 },
      ],
      { x: 'x', y: 'v', series: 'n' },
    ).ys[0]?.name,
  ).toBe('7');
});

test('every error names the chart, lists the fields with their kinds and ends with the props to pass', () => {
  const rows = [{ date: '2026-11-01', note: 'n', flag: true, empty: null }];
  const errors = [
    () => pick(rows),
    () => pick(rows, { y: 'nope' }),
    () => pick(rows, { y: 'flag' }),
    () => pick([...rows, { date: '2026-11-02', note: 'm', flag: false, empty: null, v: 1 }]),
    () => pick(rows, { y: 'note' }),
    () => pick(rows, {}, 'scatter'),
  ];
  for (const fail of errors) {
    let e: unknown;
    try {
      fail();
    } catch (caught) {
      e = caught;
    }
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toMatch(
      /^lineChart: .+\. The fields are date \(time\), note \(text\), flag \(not plottable\), empty \(no values\)(, v \(number\))?\. Pass .+\.$/,
    );
  }
  expect(() => pick({ a: [1, 2], b: [1] }, { y: 'b' })).toThrow(/^lineChart: Columns differ in length/);
  expect(() => pick({ t: [], v: [1] }, { x: 't', y: 'v' })).toThrow(/^lineChart: Columns differ in length/);
  expect(pick({ t: [], v: [] }, { x: 't', y: 'v' }).ys).toEqual([]);
});

test('types: nullable or omitted data, a mixed y list, inferred pairs, a positional r, exact column keys, later updates', () => {
  type Row = { date: string; api: number; lag: number | null; note: string };
  const rows: Row[] = [];
  lineChart.spec({ data: rows, x: 'date' });
  lineChart.spec({ data: rows, y: [d => d.api, 'lag'] });
  lineChart.spec({ data: null as Row[] | null, x: 'date' });
  lineChart.spec({ x: 'date', y: 'nope' });
  const columns = { t: new Float64Array(), v: [] as number[] };
  expectTypeOf<NonNullable<LineChartProps<typeof columns>['x']>>().toEqualTypeOf<'t' | 'v'>();
  lineChart.spec({ data: columns, series: 'v' });
  // @ts-expect-error an accessor works on rows only
  lineChart.spec({ data: columns, series: () => 1 });
  // @ts-expect-error a number array has no fields to name
  lineChart.spec({ data: new Float32Array(), y: 'value' });
  const declared: number[][] = [];
  // @ts-expect-error pairs have no fields to name, even when not inferred as tuples
  lineChart.spec({ data: declared, y: 'length' });
  scatterChart.spec({ data: [] as number[], r: 3 });
  // @ts-expect-error a number array has no field for r
  scatterChart.spec({ data: [] as number[], r: 'value' });
  const known = lineChart(host(), { data: rows });
  // @ts-expect-error not a field of the rows
  known.update({ x: 'nope' });
  const later = lineChart(host(), {});
  later.update({ data: rows, x: 'date', y: 'api' });
  // @ts-expect-error not a field of the rows
  later.update({ data: rows, x: 'nope' });
  const empty = lineChart(host(), { data: [] });
  empty.update({ data: rows, x: 'date', y: 'api' });
  // @ts-expect-error not a field of the rows
  empty.update({ data: rows, x: 'nope' });
  const declaredRows = lineChart(host(), { data: [] as Row[] });
  // @ts-expect-error not a field of the rows
  declaredRows.update({ x: 'nope' });
});

test('types: the public functions check fields as the props types do, spec gives Options', () => {
  type Row = { date: string; api: number; lag: number | null; note: string };
  const rows: Row[] = [];
  const columns = { t: new Float64Array(), v: [] as number[] };
  lineChart.spec({ data: rows, x: 'date', y: 'api' });
  lineChart.spec({ data: rows, y: 'lag' });
  lineChart.spec({ data: rows, y: ['api', 'lag'] });
  // @ts-expect-error not a field of the rows
  lineChart.spec({ data: rows, x: 'nope', y: 'api' });
  // @ts-expect-error a text field is not a y
  lineChart.spec({ data: rows, x: 'date', y: 'note' });
  lineChart.spec({
    data: rows,
    x: d => {
      expectTypeOf(d).toEqualTypeOf<Row>();
      return d.date;
    },
    series: d => d.note,
  });
  lineChart.spec({ data: columns, x: 't', y: 'v' });
  // @ts-expect-error not a column
  lineChart.spec({ data: columns, x: 'w', y: 'v' });
  // @ts-expect-error an accessor works on rows only
  lineChart.spec({ data: columns, x: () => 1, y: 'v' });
  lineChart.spec({ data: [] as number[], tooltip: true });
  // @ts-expect-error a number array has no fields to name
  lineChart.spec({ data: [] as number[], x: 'value' });
  // @ts-expect-error a number array has no fields to name
  lineChart.spec({ data: [] as number[], y: 'value' });
  lineChart.spec({ data: [] as [number, number][], tooltip: true });
  // @ts-expect-error pairs have no fields to name
  lineChart.spec({ data: [] as [number, number][], series: 'x' });
  // @ts-expect-error pairs have no fields to name
  lineChart.spec({ data: [] as [number, number][], x: 'x', y: 'y' });
  areaChart.spec({ data: rows, x: 'date', y: 'api' });
  areaChart.spec({ data: rows, y: 'lag' });
  areaChart.spec({ data: rows, y: ['api', 'lag'] });
  // @ts-expect-error not a field of the rows
  areaChart.spec({ data: rows, x: 'nope', y: 'api' });
  // @ts-expect-error a text field is not a y
  areaChart.spec({ data: rows, x: 'date', y: 'note' });
  areaChart.spec({
    data: rows,
    x: d => {
      expectTypeOf(d).toEqualTypeOf<Row>();
      return d.date;
    },
    series: d => d.note,
  });
  areaChart.spec({ data: columns, x: 't', y: 'v' });
  // @ts-expect-error not a column
  areaChart.spec({ data: columns, x: 'w', y: 'v' });
  // @ts-expect-error an accessor works on rows only
  areaChart.spec({ data: columns, x: () => 1, y: 'v' });
  areaChart.spec({ data: [] as number[], tooltip: true });
  // @ts-expect-error a number array has no fields to name
  areaChart.spec({ data: [] as number[], x: 'value' });
  // @ts-expect-error a number array has no fields to name
  areaChart.spec({ data: [] as number[], y: 'value' });
  areaChart.spec({ data: [] as [number, number][], tooltip: true });
  // @ts-expect-error pairs have no fields to name
  areaChart.spec({ data: [] as [number, number][], series: 'x' });
  // @ts-expect-error pairs have no fields to name
  areaChart.spec({ data: [] as [number, number][], x: 'x', y: 'y' });
  barChart.spec({ data: rows, x: 'date', y: 'api' });
  barChart.spec({ data: rows, y: 'lag' });
  barChart.spec({ data: rows, y: ['api', 'lag'] });
  // @ts-expect-error not a field of the rows
  barChart.spec({ data: rows, x: 'nope', y: 'api' });
  // @ts-expect-error a text field is not a y
  barChart.spec({ data: rows, x: 'date', y: 'note' });
  barChart.spec({
    data: rows,
    x: d => {
      expectTypeOf(d).toEqualTypeOf<Row>();
      return d.date;
    },
    series: d => d.note,
  });
  barChart.spec({ data: columns, x: 't', y: 'v' });
  // @ts-expect-error not a column
  barChart.spec({ data: columns, x: 'w', y: 'v' });
  // @ts-expect-error an accessor works on rows only
  barChart.spec({ data: columns, x: () => 1, y: 'v' });
  barChart.spec({ data: [] as number[], tooltip: true });
  // @ts-expect-error a number array has no fields to name
  barChart.spec({ data: [] as number[], x: 'value' });
  // @ts-expect-error a number array has no fields to name
  barChart.spec({ data: [] as number[], y: 'value' });
  barChart.spec({ data: [] as [number, number][], tooltip: true });
  // @ts-expect-error pairs have no fields to name
  barChart.spec({ data: [] as [number, number][], series: 'x' });
  // @ts-expect-error pairs have no fields to name
  barChart.spec({ data: [] as [number, number][], x: 'x', y: 'y' });
  scatterChart.spec({ data: rows, x: 'date', y: 'api' });
  scatterChart.spec({ data: rows, y: 'lag' });
  // @ts-expect-error one y per scatter chart
  scatterChart.spec({ data: rows, y: ['api', 'lag'] });
  // @ts-expect-error not a field of the rows
  scatterChart.spec({ data: rows, x: 'nope', y: 'api' });
  scatterChart.spec({ data: rows, x: 'date', y: 'note' });
  const mixed = [] as { n: number; text: string | null; gap?: number | null; flag: boolean; at: Date }[];
  scatterChart.spec({ data: mixed, x: 'n', y: 'text' });
  scatterChart.spec({ data: mixed, x: 'n', y: 'gap' });
  scatterChart.spec({ data: mixed, x: 'n', y: d => d.text });
  // @ts-expect-error a boolean field is not a y
  scatterChart.spec({ data: mixed, x: 'n', y: 'flag' });
  // @ts-expect-error a date field is not a y
  scatterChart.spec({ data: mixed, x: 'n', y: 'at' });
  const mixedColumns = { n: [] as number[], text: [] as (string | null)[], flag: [] as boolean[] };
  scatterChart.spec({ data: mixedColumns, x: 'n', y: 'text' });
  // @ts-expect-error a boolean column is not a y
  scatterChart.spec({ data: mixedColumns, x: 'n', y: 'flag' });
  // @ts-expect-error not a field of the rows
  scatterChart.spec({ data: rows, x: 'date', y: 'nope' });
  scatterChart.spec({ data: rows, x: 'date', y: d => d.note, shape: 'tick', r: 10 });
  // @ts-expect-error not a shape
  scatterChart.spec({ data: rows, shape: 'cross' });
  // @ts-expect-error a line has no shape
  lineChart.spec({ data: rows, shape: 'tick' });
  scatterChart.spec({
    data: rows,
    x: d => {
      expectTypeOf(d).toEqualTypeOf<Row>();
      return d.date;
    },
    series: d => d.note,
  });
  scatterChart.spec({ data: columns, x: 't', y: 'v' });
  // @ts-expect-error not a column
  scatterChart.spec({ data: columns, x: 'w', y: 'v' });
  // @ts-expect-error an accessor works on rows only
  scatterChart.spec({ data: columns, x: () => 1, y: 'v' });
  scatterChart.spec({ data: [] as number[], tooltip: true });
  // @ts-expect-error a number array has no fields to name
  scatterChart.spec({ data: [] as number[], x: 'value' });
  // @ts-expect-error a number array has no fields to name
  scatterChart.spec({ data: [] as number[], y: 'value' });
  scatterChart.spec({ data: [] as [number, number][], tooltip: true });
  // @ts-expect-error pairs have no fields to name
  scatterChart.spec({ data: [] as [number, number][], series: 'x' });
  // @ts-expect-error pairs have no fields to name
  scatterChart.spec({ data: [] as [number, number][], x: 'x', y: 'y' });
  scatterChart.spec({ data: rows, r: 'api' });
  // @ts-expect-error not a field of the rows
  scatterChart.spec({ data: rows, r: 'nope' });
  // @ts-expect-error a text field is not an r
  scatterChart.spec({ data: rows, r: 'note' });
  lineChart.spec({ data: [1, null, 3] });
  // @ts-expect-error a number array with gaps has no fields to name
  lineChart.spec({ data: [1, null, 3], y: v => v });
  expectTypeOf(lineChart.spec({ data: rows })).toEqualTypeOf<Options>();
  const known = lineChart(host(), { data: rows });
  expectTypeOf(known).toEqualTypeOf<PublicChart<LineChartProps<Row[]>>>();
  expectTypeOf<Parameters<typeof known.update>[0]>().toEqualTypeOf<Partial<LineChartProps<Row[]>>>();
  expectTypeOf(areaChart(host(), { data: rows })).toEqualTypeOf<PublicChart<AreaChartProps<Row[]>>>();
  expectTypeOf(barChart(host(), { data: rows })).toEqualTypeOf<PublicChart<BarChartProps<Row[]>>>();
  expectTypeOf(scatterChart(host(), { data: rows })).toEqualTypeOf<PublicChart<ScatterChartProps<Row[]>>>();
});

test('the number format groups thousands and keeps at most two decimals', () => {
  expect(formatNumber(1234.5)).toBe('1,234.5');
  expect(formatNumber(1 / 3)).toBe('0.33');
  expect(formatNumber(12)).toBe('12');
});

test('the time title is a date when every x is at midnight in the zone, else a date and time', () => {
  const utcDay = Date.UTC(2026, 10, 22);
  const utcTen = Date.UTC(2026, 10, 22, 10);
  expect(timeTitle([[utcDay, NaN, utcDay + 864e5]], true)(utcDay)).toBe('2026-11-22');
  expect(timeTitle([[utcDay, utcTen]], true)(utcTen)).toBe('2026-11-22 10:00');
  expect(timeTitle([[utcDay]], false)(utcDay)).toBe('2026-11-21 19:00');
  expect(timeTitle([[utcDay], [utcTen]], true)(utcTen)).toBe('2026-11-22 10:00');
  const localDay = new Date(2026, 10, 22).getTime();
  const localTen = new Date(2026, 10, 22, 10).getTime();
  expect(timeTitle([[localDay]], false)(localDay)).toBe('2026-11-22');
  expect(timeTitle([[localDay, localTen]], false)(localTen)).toBe('2026-11-22 10:00');
  expect(timeTitle([[localDay]], true)(localDay)).toBe('2026-11-22 05:00');
  const lmtDay = new Date(1850, 0, 1).getTime();
  expect(timeTitle([[lmtDay]], false)(lmtDay)).toBe('1850-01-01');
  const farDay = new Date(10000, 0, 1).getTime();
  expect(timeTitle([[farDay]], false)(farDay)).toBe('10000-01-01');
  const fold = [Date.UTC(2026, 10, 1, 5, 30), Date.UTC(2026, 10, 1, 6, 30)];
  const titles = (ts: number[], utc: boolean) => ts.map(timeTitle([ts], utc, true));
  expect(titles(fold, false)).toEqual(['2026-11-01 01:30 UTC-04:00', '2026-11-01 01:30 UTC-05:00']);
  expect(titles(fold, true)).toEqual(['2026-11-01 05:30', '2026-11-01 06:30']);
  expect(titles([fold[0]!, fold[1]! + 6e4], false)).toEqual(['2026-11-01 01:30', '2026-11-01 01:31']);
  expect(titles([fold[0]!, fold[0]! + 1e3, fold[1]!], false)).toEqual([
    '2026-11-01 01:30:00 UTC-04:00',
    '2026-11-01 01:30:01 UTC-04:00',
    '2026-11-01 01:30:00 UTC-05:00',
  ]);
});

test('the band title rounds to the nearest category and clamps to the ends', () => {
  const c = ['a', 'b', 'c'];
  expect([-0.4, 0.4, -0.6, -5].map(x => bandTitle(c, x))).toEqual(['a', 'a', 'a', 'a']);
  expect([c.length - 0.6, c.length - 0.4, 9].map(x => bandTitle(c, x))).toEqual(['c', 'c', 'c']);
  expect(bandTitle(c, 1.2)).toBe('b');
});

const schemed = (scheme: string) => {
  const el = document.createElement('div');
  el.style.colorScheme = scheme;
  document.body.append(el);
  return el;
};

const mockMedia = (matches: boolean) => {
  const media = { matches, listeners: new Set<() => void>() };
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        get matches() {
          return media.matches;
        },
        addEventListener: (_: string, f: () => void) => media.listeners.add(f),
        removeEventListener: (_: string, f: () => void) => media.listeners.delete(f),
      }) as never,
  );
  const flip = (to: boolean) => {
    media.matches = to;
    for (const f of media.listeners) f();
  };
  return { spy, flip, media };
};

test("theme 'auto' follows the element's computed color-scheme", () => {
  const { spy } = mockMedia(true);
  for (const [scheme, theme] of [
    ['dark', dark],
    ['only dark', dark],
    ['normal', light],
    ['light', light],
  ] as const) {
    const el = schemed(scheme);
    expect(themeOf(el, 'auto', () => {}).theme).toBe(theme);
    expect(themeOf(el, undefined, () => {}).theme).toBe(theme);
    el.remove();
  }
  expect(spy).not.toHaveBeenCalled();
});

test("theme 'auto' on 'light dark' follows prefers-color-scheme and calls back when it changes", () => {
  const { spy, flip } = mockMedia(false);
  const el = schemed('light dark');
  const seen: Theme[] = [];
  expect(themeOf(el, 'auto', t => seen.push(t)).theme).toBe(light);
  expect(spy).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  flip(true);
  flip(false);
  expect(seen).toEqual([dark, light]);
  expect(seen[0]).toBe(dark);
  el.remove();
});

test("a media change on a page switched from 'light dark' to 'light' reports light", () => {
  const { flip } = mockMedia(false);
  const el = schemed('light dark');
  const seen: Theme[] = [];
  themeOf(el, 'auto', t => seen.push(t));
  el.style.colorScheme = 'light';
  flip(true);
  expect(seen).toEqual([light]);
  el.remove();
});

test('the media listener is removed on dispose', () => {
  const { flip, media } = mockMedia(true);
  const el = schemed('light dark');
  let calls = 0;
  const t = themeOf(el, 'auto', () => calls++);
  expect(t.theme).toBe(dark);
  expect(media.listeners.size).toBe(1);
  t.dispose();
  expect(media.listeners.size).toBe(0);
  flip(false);
  expect(calls).toBe(0);
  el.remove();
});

test("'light' and 'dark' give the singletons and a Theme object is passed through", () => {
  const el = schemed('dark');
  expect(themeOf(el, 'light', () => {}).theme).toBe(light);
  expect(themeOf(el, 'dark', () => {}).theme).toBe(dark);
  const own: Theme = { ...dark };
  expect(themeOf(el, own, () => {}).theme).toBe(own);
  el.remove();
});

test('the palette is the dark one exactly on the dark theme, colors override it, and colours wrap', () => {
  expect(colorsFor(dark, undefined, 8)).toEqual(paletteDark);
  expect(colorsFor(light, undefined, 8)).toEqual(palette);
  expect(colorsFor({ ...dark }, undefined, 8)).toEqual(palette);
  expect(colorsFor(undefined, undefined, 2)).toEqual(palette.slice(0, 2));
  expect(colorsFor(dark, ['red', 'blue'], 3)).toEqual(['red', 'blue', 'red']);
  expect(colorsFor(dark, [], 1)).toEqual([paletteDark[0]]);
  expect(colorsFor(light, undefined, 9)[8]).toBe(palette[0]);
});

type TestProps = Axes &
  Base & { data?: unknown } & Pick<FieldProps<Record<string, number>>, 'x' | 'y' | 'series'>;

const RED = '#ff0000';
const BLUE = '#0000ff';
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
let prepares = 0;
let paints = 0;
let builds = 0;
let grabbed!: Internals;
let built!: Mark[];

const testBuild: Build<TestProps> = (p, { source: s, theme, memo }) => {
  builds++;
  const a = memo('fields', [s, p.x, ...[p.y ?? []].flat(), p.series], () => assign(s, p, 'xy', 'testChart'));
  const colors = colorsFor(theme, p.colors, a.ys.length);
  const lines = a.ys.map((y, i) =>
    line({ key: y.name, label: y.name, x: y.x, y: y.y, color: colors[i]!, width: 4 }),
  );
  const first = a.ys[0];
  const counted: Mark[] = first
    ? [
        {
          type: 'counted',
          key: 'counted',
          color: RED,
          options: { x: first.x, y: first.y },
          points: 0,
          channels: { x: [], y: [] },
          prepare: () => (prepares++, { paint: () => paints++ }),
        },
      ]
    : [];
  built = [...lines, ...counted];
  return {
    options: {
      width: 100,
      height: 100,
      margin: ZERO,
      theme,
      y: { domain: 'nice', label: '', ...p.yAxis },
      marks: built,
    },
    features: { tooltip: p.tooltip, legend: p.legend, zoom: p.zoom },
    use: () => [
      ...(p.tooltip ? [tooltip({ mode: 'x', title: String, value: String })] : []),
      ...(p.legend ? [legend(p.legend === true ? {} : p.legend)] : []),
      ...(p.zoom ? [zoom(p.zoom === true ? {} : p.zoom)] : []),
      c => ((grabbed = c), { destroy() {} }),
    ],
  };
};

const easy = (props: TestProps, el = host()) => ({ el, c: create(el, props, testBuild) });
const ramp = (n: number, f: (i: number) => number = i => i / (n - 1)) =>
  Array.from({ length: n }, (_, i) => ({ x: i, a: f(i) }));
const pair = (n = 11) => Array.from({ length: n }, (_, i) => ({ x: i, a: i, b: 10 - i }));
const keysOf = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([o]) => Object.keys(o as object).sort());
const zoomIn = async (el: HTMLElement) => {
  wheel(el, 50, 50, -300, { ctrlKey: true });
  await nextFrame();
};
const hideFirst = (el: HTMLElement) => {
  const entry = entriesOf(el)[0]!;
  entry.dispatchEvent(new MouseEvent('click', middleOf(entry)));
};
const narrower = (s: number[], than: number[]) => expect(s[1]! - s[0]!).toBeLessThan(than[1]! - than[0]!);

test('a builder passed through easyChart mounts, updates, and gives its options from spec()', () => {
  const toyChart = easyChart<'line'>((p: TestProps, context) => {
    const b = testBuild(p, context);
    return { ...b, options: { ...b.options, description: context.theme.text } };
  });
  const el = host();
  const props = { data: ramp(2, () => 0.5), colors: [RED], yAxis: { domain: [0, 1] as [number, number] } };
  const c = toyChart(el, props);
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  c.update({ colors: [BLUE] });
  expect(pixel(el, 50, 50)).toEqual([0, 0, 255, 255]);
  for (const theme of [undefined, 'auto'] as const) {
    const plain = toyChart.spec({ ...props, theme });
    expect(plain.description).toBe(light.text);
    expect(plain).not.toHaveProperty('theme');
  }
  const darkChart = easyChart<'line'>((p: TestProps, context) => {
    const b = testBuild(p, context);
    return { ...b, options: { ...b.options, theme: dark } };
  });
  for (const theme of [undefined, 'auto'] as const)
    expect(darkChart.spec({ ...props, theme }).theme).toBe(dark);
  const spec = toyChart.spec({ ...props, theme: 'dark', tooltip: true, hidden: ['b'] });
  expect(spec).toMatchObject({ width: 100, height: 100, y: { domain: [0, 1] }, theme: dark, hidden: ['b'] });
  expect(spec.marks.map(m => m.key)).toEqual(['a', 'counted']);
  expect(spec.use).toHaveLength(2);
  c.destroy();
  expect(el.childElementCount).toBe(0);
});

test('types: easyChart takes a builder only of props its kind supplies', () => {
  // @ts-expect-error no line chart gives a suffix
  easyChart<'line'>((p: TestProps & { suffix: string }, context) => testBuild(p, context));
  // @ts-expect-error the rows may be of any type
  easyChart<'line'>((p: TestProps & { data?: readonly string[] | null }, context) => testBuild(p, context));
});

test('nested data, an object or a list of roots, mounts and gives a new source only for new data, a new dataVersion or a changed length', () => {
  const root = (value: number) => ({ name: 'root', children: [{ name: 'a', value, children: [] }] });
  for (const tree of [root, (v: number) => [root(v), root(1)]]) {
    const sources: unknown[] = [];
    const data = tree(1);
    const el = host();
    const c = create<ControllerProps>(el, { data }, (p, { source: s, theme }) => {
      sources.push(s);
      return {
        options: { ...BOX, theme, description: p.description, marks: [] },
        features: null,
        use: () => [],
      };
    });
    expect(el.querySelector('canvas')).not.toBeNull();
    const update = (p: Partial<ControllerProps>) => {
      c.update(p);
      return sources.at(-1);
    };
    const first = sources[0];
    expect(update({ description: 'again', data })).toBe(first);
    expect(sources).toHaveLength(2);
    (Array.isArray(data) ? data[0]! : data).children[0]!.value = 2;
    expect(update({ data, description: 'mutated' })).toBe(first);
    const bumped = update({ dataVersion: 1 });
    expect(bumped).not.toBe(first);
    expect(update({ data: tree(2) })).not.toBe(bumped);
    expect(sources).toHaveLength(5);
    const grown = tree(3);
    const before = update({ data: grown });
    if (Array.isArray(grown)) grown.push(root(4));
    else grown.children.push({ name: 'b', value: 4, children: [] });
    const longer = update({ data: grown });
    expect(longer).not.toBe(before);
    expect(update({ data: grown, description: 'same length' })).toBe(longer);
    expect(sources).toHaveLength(8);
    c.destroy();
  }
});

test('the controller draws, merges partial props, draws new data and is gone after destroy', () => {
  const { el, c } = easy({ data: ramp(2, () => 0.5), colors: [RED], yAxis: { domain: [0, 1] } });
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  c.update({ data: ramp(2, () => 0.25) });
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 50)).not.toEqual([255, 0, 0, 255]);
  c.update({ zoom: true });
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
  c.destroy();
  expect(el.childElementCount).toBe(0);
  c.update({ data: ramp(2) });
  expect(el.childElementCount).toBe(0);
});

test('an update that changes nothing sends nothing, and one of colors sends only the marks', () => {
  const props: TestProps = { data: pair(), y: ['a', 'b'], yAxis: { label: 'v' } };
  const { c } = easy(props);
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props);
  c.update({ ...props, y: ['a', 'b'], yAxis: { label: 'v' } });
  expect(spy).not.toHaveBeenCalled();
  c.update({ colors: [RED, BLUE] });
  expect(keysOf(spy)).toEqual([['marks']]);
});

test('a tooltip held by a tap stays through an update with an equal copy of the props', () => {
  const props: TestProps = { data: ramp(11), tooltip: true };
  const { el, c } = easy(props);
  tap(el, 50, 50);
  const shown = tipOf(el);
  expect(shown()).toBe(true);
  c.update({ ...props });
  expect(shown()).toBe(true);
  c.update({ colors: [RED] });
  expect(shown()).toBe(false);
});

test('unchanged data and fields keep the very same column arrays and prepare no mark again', () => {
  const props: TestProps = { data: pair(), y: ['a', 'b'] };
  const { c } = easy(props);
  const before = built.map(m => m.options as { x: unknown; y: unknown });
  const count = prepares;
  c.update({ ...props, y: ['a', 'b'] });
  c.update({ colors: [RED, BLUE] });
  built.forEach((m, i) => {
    expect((m.options as { x: unknown }).x).toBe(before[i]!.x);
    expect((m.options as { y: unknown }).y).toBe(before[i]!.y);
  });
  expect(prepares).toBe(count);

  const index = easy({ data: [3, 1, 2] }).c;
  const x = (built[0]!.options as { x: unknown }).x;
  index.update({ colors: [RED] });
  expect((built[0]!.options as { x: unknown }).x).toBe(x);
});

test('a pointer-only or onClick-only update builds nothing, reads no column and sends only that key', () => {
  let reads = 0;
  const v = (d: Record<string, number>) => (reads++, d.a);
  const { c } = easy({ data: ramp(11), x: 'x', y: [v] });
  const [r, b] = [reads, builds];
  expect(r).toBeGreaterThan(0);
  const spy = vi.spyOn(c.chart, 'update');
  c.update({ pointer: { x: 5 } });
  c.update({ onClick: () => {} });
  expect([reads, builds]).toEqual([r, b]);
  expect(keysOf(spy)).toEqual([['pointer'], ['onClick']]);
});

test('uncontrolled, a zoomed window and a hidden series stay through updates that send no state', async () => {
  const { el, c } = easy({ data: pair(), y: ['a', 'b'], zoom: true, legend: true });
  const spy = vi.spyOn(c.chart, 'update');
  await zoomIn(el);
  const zoomed = grabbed.view().x;
  narrower(zoomed, grabbed.domain().x);
  c.update({ colors: [RED, BLUE] });
  expect(grabbed.view().x).toEqual(zoomed);
  hideFirst(el);
  expect(grabbed.hidden()).toEqual(['a']);
  c.update({ colors: [BLUE, RED] });
  expect(grabbed.hidden()).toEqual(['a']);
  expect(grabbed.view().x).toEqual(zoomed);
  expect(spy).toHaveBeenCalledTimes(2);
  for (const [o] of spy.mock.calls)
    for (const k of ['view', 'hidden', 'selected', 'pointer']) expect(o).not.toHaveProperty(k);
});

test('controlled, view, hidden, selected and pointer reach the core and the callbacks are called', async () => {
  const [onViewChange, onHiddenChange, onPointerChange, onClick] = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  const { el, c } = easy({
    data: pair(),
    y: ['a', 'b'],
    zoom: true,
    legend: true,
    view: { x: [2, 6] },
    hidden: ['b'],
    pointer: { x: 5 },
    onViewChange,
    onHiddenChange,
    onPointerChange,
    onClick,
  });
  expect(grabbed.view().x).toEqual([2, 6]);
  expect(grabbed.hidden()).toEqual(['b']);
  expect(grabbed.pointer()).not.toBeNull();
  const spy = vi.spyOn(c.chart, 'update');
  c.update({ view: { x: [3, 7] }, selected: [{ id: 'a', rows: [1] }] });
  expect(grabbed.view().x).toEqual([3, 7]);
  expect(keysOf(spy)).toEqual([['selected', 'view']]);
  c.update({ view: { x: [3, 7] }, selected: [{ id: 'a', rows: [1] }] });
  expect(spy).toHaveBeenCalledTimes(1);

  await zoomIn(el);
  expect(onViewChange).toHaveBeenCalled();
  hideFirst(el);
  expect(onHiddenChange).toHaveBeenCalled();
  hover(el, 50, 60);
  expect(onPointerChange).toHaveBeenCalled();
  click(el, 50, 60);
  expect(onClick).toHaveBeenCalled();

  const [p, q] = [prepares, paints];
  c.update({ onViewChange: vi.fn(), onHiddenChange: vi.fn(), onPointerChange: vi.fn(), onClick: vi.fn() });
  expect([prepares, paints]).toEqual([p, q]);
});

test('a feature change recreates the chart, keeps the window and the hidden series, and destroys first', async () => {
  const { el, c } = easy({ data: pair(), y: ['a', 'b'], zoom: true, legend: true });
  await zoomIn(el);
  const zoomed = grabbed.view().x;
  hideFirst(el);
  const [canvas, old] = [el.querySelector('canvas'), c.chart];
  const destroy = old.destroy.bind(old);
  let roots = -1;
  old.destroy = () => ((roots = el.childElementCount), destroy());
  c.update({ legend: { rows: 1 } });
  expect(roots).toBe(1);
  expect(c.chart).not.toBe(old);
  expect(el.childElementCount).toBe(1);
  expect(el.querySelector('canvas')).not.toBe(canvas);
  expect(grabbed.view().x).toEqual(zoomed);
  expect(grabbed.hidden()).toEqual(['a']);
  const now = c.chart;
  c.update({ legend: { rows: 1 } });
  expect(c.chart).toBe(now);
});

test('a builder error on a feature change leaves the old chart on screen and rethrows', () => {
  const el = host();
  const c = create<TestProps>(el, { data: pair(), y: ['a', 'b'] }, (p, ctx) => {
    if (p.colors) throw new Error('boom');
    return testBuild(p, ctx);
  });
  const [canvas, old] = [el.querySelector('canvas'), c.chart];
  const destroy = vi.spyOn(old, 'destroy');
  expect(() => c.update({ zoom: true, colors: [RED] })).toThrow('boom');
  expect(destroy).not.toHaveBeenCalled();
  expect(c.chart).toBe(old);
  expect(el.querySelector('canvas')).toBe(canvas);
  c.update({ zoom: true });
  expect(c.chart).not.toBe(old);
});

test('state given again after a release is sent even when it equals the last value sent', async () => {
  const { el, c } = easy({
    data: pair(),
    y: ['a', 'b'],
    zoom: true,
    legend: true,
    hidden: ['a'],
    view: { x: [2, 6] },
  });
  c.update({ hidden: undefined, view: undefined });
  hideFirst(el);
  await zoomIn(el);
  expect(grabbed.hidden()).toEqual([]);
  c.update({ hidden: ['a'], view: { x: [2, 6] } });
  expect(grabbed.hidden()).toEqual(['a']);
  expect(grabbed.view().x).toEqual([2, 6]);

  c.update({ hidden: undefined });
  c.update({ legend: { rows: 1 } });
  expect(grabbed.hidden()).toEqual(['a']);
  hideFirst(el);
  c.update({ hidden: ['a'] });
  expect(grabbed.hidden()).toEqual(['a']);
});

test('a plot error on a feature change restores the old chart, and the same features retried recreate', () => {
  const el = host();
  const c = lineChart(el, { data: [1, 2, 3] });
  const old = c.chart;
  const boom = () => {
    throw new Error('boom');
  };
  expect(() => c.update({ zoom: true, yAxis: { format: boom } })).toThrow('boom');
  expect(el.children).toHaveLength(1);
  const restored = c.chart;
  expect(restored).not.toBe(old);
  c.update({ zoom: true, yAxis: {} });
  expect(c.chart).not.toBe(restored);
  expect(el.children).toHaveLength(1);
});

test('a plot error on a feature change restores the old tooltip formatters', () => {
  const el = host();
  const c = lineChart(el, { data: [1, 2, 3], pointer: { x: 1 }, ...BOX });
  const boom = () => {
    throw new Error('boom');
  };
  expect(() => c.update({ zoom: true, yAxis: { format: boom } })).toThrow('boom');
  expect(el.children).toHaveLength(1);
  expect(tipRows(el)).toEqual(['1', 'value: 2']);
});

test('a failed restore after a plot error leaves no root behind and rethrows the plot error', () => {
  const el = host();
  let calls = 0;
  const c = create<TestProps>(el, { data: pair(), y: ['a', 'b'] }, (p, ctx) => {
    const b = testBuild(p, ctx);
    return {
      ...b,
      use: () => {
        if (!p.zoom && !calls++) return b.use();
        return [
          () => {
            throw new Error(p.zoom ? 'boom' : 'again');
          },
        ];
      },
    };
  });
  expect(() => c.update({ zoom: true })).toThrow('boom');
  expect(el.children).toHaveLength(0);
});

test('a feature factory that throws leaves the old chart on screen, and the same props retried recreate', () => {
  const el = host();
  let fail = true;
  const c = create<TestProps>(el, { data: pair(), y: ['a', 'b'] }, (p, ctx) => {
    const b = testBuild(p, ctx);
    return {
      ...b,
      use: () => {
        if (p.zoom && fail) throw new Error('boom');
        return b.use();
      },
    };
  });
  const [canvas, old] = [el.querySelector('canvas'), c.chart];
  const destroy = vi.spyOn(old, 'destroy');
  expect(() => c.update({ zoom: true })).toThrow('boom');
  expect(destroy).not.toHaveBeenCalled();
  expect(el.querySelector('canvas')).toBe(canvas);
  fail = false;
  c.update({ zoom: true });
  expect(c.chart).not.toBe(old);
});

test("a create that throws stops listening to the page's color scheme", () => {
  const { media } = mockMedia(false);
  expect(() => easy({ data: pair(), y: 'nope' }, schemed('light dark'))).toThrow(/no field "nope"/);
  expect(media.listeners.size).toBe(0);
});

test('after an x-only zoom and a recreate an automatic y still grows, and after a y-only zoom x does', async () => {
  const x = easy({ data: ramp(11), zoom: true });
  await zoomIn(x.el);
  x.c.update({ legend: true });
  x.c.update({ data: ramp(11, i => (i === 5 ? 10 : i / 10)) });
  expect(grabbed.view().y[1]).toBeGreaterThanOrEqual(10);

  const y = easy({ data: ramp(11), zoom: { axes: 'y' } });
  await zoomIn(y.el);
  narrower(grabbed.view().y, grabbed.domain().y);
  y.c.update({ legend: true });
  y.c.update({ data: ramp(21, i => i / 20) });
  expect(grabbed.view().x[1]).toBeGreaterThanOrEqual(20);
});

test('after a recreate a y fitted to the window refits to new data', async () => {
  const { el, c } = easy({ data: ramp(11, i => i), zoom: true, yAxis: { fit: 'window' } });
  await zoomIn(el);
  const xs = grabbed.view().x;
  c.update({ legend: true });
  const fitted = grabbed.view().y;
  c.update({ data: ramp(11, i => 2 * i) });
  expect(grabbed.view().x).toEqual(xs);
  expect(grabbed.view().y).not.toEqual(fitted);
  expect(grabbed.view().y[1]).toBeGreaterThanOrEqual(2 * Math.floor(xs[1]));
});

test('a recreate uses a view and hidden given in the same update over the carried ones', async () => {
  const { el, c } = easy({ data: pair(), y: ['a', 'b'], zoom: true, legend: true });
  await zoomIn(el);
  hideFirst(el);
  c.update({ zoom: false, view: { x: [1, 3] }, hidden: ['b'] });
  expect(grabbed.view().x).toEqual([1, 3]);
  expect(grabbed.hidden()).toEqual(['b']);
});

test('after a zoom reset a recreate carries no window', async () => {
  const { el, c } = easy({ data: ramp(11), zoom: true });
  await zoomIn(el);
  doubleClick(el, 50, 50);
  await nextFrame();
  expect(grabbed.view().x).toEqual(grabbed.domain().x);
  c.update({ legend: true });
  c.update({ data: ramp(21) });
  expect(grabbed.view().x).toEqual(grabbed.domain().x);
  expect(grabbed.view().x[1]).toBeGreaterThanOrEqual(20);
});

test('data is read again for a new array, a new length or a new dataVersion, and keeps the window', async () => {
  let reads = 0;
  const v = (d: Record<string, number>) => (reads++, d.a);
  const data = ramp(11);
  const { el, c } = easy({ data, x: 'x', y: [v], zoom: true });
  let seen = reads;
  const more = () => reads > seen && ((seen = reads), true);
  c.update({ data: [...data] });
  expect(more()).toBe(true);
  data.push({ x: 11, a: 1 });
  c.update({ data });
  expect(more()).toBe(true);
  data[0]!.a = 5;
  c.update({ data });
  expect(more()).toBe(false);
  c.update({ data, dataVersion: 1 });
  expect(more()).toBe(true);

  await zoomIn(el);
  const zoomed = grabbed.view().x;
  c.update({ data: ramp(11) });
  expect(grabbed.view().x).toEqual(zoomed);
});

test('a dataVersion bump redraws borrowed columns written in place', () => {
  const data = { x: new Float64Array([0, 5, 10]), y: new Float64Array([0, 1, 0]) };
  const { el, c } = easy({ data, colors: [RED] });
  data.y.set([0, 1, 4]);
  const spy = vi.spyOn(c.chart, 'update');
  c.update({ data });
  expect(spy).not.toHaveBeenCalled();
  c.update({ data, dataVersion: 1 });
  expect(grabbed.domain().y[1]).toBeGreaterThanOrEqual(4);
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
});

test('a length change of length-tracking typed columns redraws them', () => {
  type Resizable = ArrayBuffer & { resize(bytes: number): void };
  const Buffer = ArrayBuffer as unknown as new (bytes: number, o: { maxByteLength: number }) => Resizable;
  const grow = (v: number[]) => {
    const a = new Float64Array(new Buffer(v.length * 8, { maxByteLength: 64 }));
    a.set(v);
    return a;
  };
  const data = { x: grow([0, 5, 10]), y: grow([0, 1, 0]) };
  const { c } = easy({ data });
  (data.x.buffer as Resizable).resize(32);
  (data.y.buffer as Resizable).resize(32);
  data.x[3] = 15;
  data.y[3] = 4;
  c.update({ data });
  expect(grabbed.domain().x[1]).toBeGreaterThanOrEqual(15);
});

test('a dataVersion bump redraws borrowed columns passed in a new wrapper object', () => {
  const [x, y] = [new Float64Array([0, 5, 10]), new Float64Array([0, 1, 0])];
  const { el, c } = easy({ data: { x, y }, colors: [RED] });
  y.set([0, 1, 4]);
  c.update({ data: { x, y }, dataVersion: 1 });
  expect(grabbed.domain().y[1]).toBeGreaterThanOrEqual(4);
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
});

test('a view given as a prop and then dropped is carried by a recreate', () => {
  const { c } = easy({ data: ramp(11), zoom: true, view: { x: [2, 6] } });
  c.update({ view: undefined });
  c.update({ legend: true });
  expect(grabbed.view().x).toEqual([2, 6]);
  c.update({ view: { x: [3, 7] } });
  c.update({ view: undefined });
  c.update({ legend: { rows: 1 } });
  expect(grabbed.view().x).toEqual([3, 7]);
});

test('no data, null and [] draw an empty frame, and later data draws', () => {
  for (const props of [{}, { data: null }, { data: [] }] satisfies TestProps[]) {
    const { el, c } = easy(props);
    expect(el.querySelector('canvas')).not.toBeNull();
    expect(grabbed.listed()).toHaveLength(0);
    c.update({ data: ramp(2, () => 0.5), colors: [RED], yAxis: { domain: [0, 1] } });
    expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  }
});

test("theme 'auto' follows a media change with the theme and its palette, and destroy stops listening", () => {
  const { flip, media } = mockMedia(false);
  const { c } = easy({ data: pair(), y: ['a', 'b'] }, schemed('light dark'));
  expect(grabbed.theme()).toBe(light);
  const spy = vi.spyOn(c.chart, 'update');
  flip(true);
  expect(keysOf(spy)).toEqual([['marks', 'theme']]);
  expect(grabbed.theme()).toBe(dark);
  expect(built[0]!.color).toBe(paletteDark[0]);
  c.destroy();
  expect(media.listeners.size).toBe(0);
});

const BOX = { width: 100, height: 100, margin: ZERO };
const days = <T extends object>(n: number, f: (i: number) => T) =>
  Array.from({ length: n }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, ...f(i) }));
const tipRows = (el: HTMLElement) => {
  const tip = [...el.querySelectorAll('div')].find(d => d.style.zIndex === '100');
  return tip ? [...tip.children].map(c => c.textContent) : undefined;
};
const drawn = (el: HTMLElement) => el.querySelector('canvas')!.toDataURL();
/** Whether some pixel of the canvas is this colour, at least half covered. */
const shows = (el: HTMLElement, color: string) => {
  const c = el.querySelector('canvas')!;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const want = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3]! > 128 && want.every((v, k) => Math.abs(d[i + k]! - v) <= 3)) return true;
  return false;
};
/** The options each build of an xy chart gave the controller. */
const builds_ = <D extends Input | undefined = undefined>(
  props: AreaProps<D> & ScatterProps<D>,
  el = host(),
  kind: 'line' | 'area' | 'bar' | 'scatter' = 'line',
) => {
  const seen: Options[] = [];
  const build = xy(`${kind}Chart`, kind);
  const c: EasyChart<AreaProps<D> & ScatterProps<D>> = create(el, props as never, (p, ctx) => {
    const b = build(p, ctx);
    seen.push(b.options as Options);
    return b;
  });
  return { el, c, seen };
};
const optionsOf = (m: Mark) => m.options as { x: Col; y: Col; color: string; curve?: string; join?: boolean };

test('lineChart guesses the fields and draws two lines with a legend and an x tooltip', () => {
  const el = host();
  const data = days(5, () => ({ api: 0.5, web: 0.25 }));
  lineChart(el, { data, ...BOX, yAxis: { domain: [0, 1] } });
  expect(shows(el, palette[0]!)).toBe(true);
  expect(shows(el, palette[1]!)).toBe(true);
  expect(entriesOf(el).map(e => e.textContent)).toEqual(['api', 'web']);
  const spec = lineChart.spec({ data });
  expect(spec.x).toMatchObject({ label: 'date', utc: true });
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['2024-01-03', 'api: 0.5', 'web: 0.25']);
});

test('lineChart.spec gives the options plot() draws the same, with keys and labels and no auto theme', () => {
  const props = { data: days(5, i => ({ api: i, web: 4 - i })), ...BOX };
  const a = host();
  const b = host();
  lineChart(a, props);
  const spec = lineChart.spec(props);
  plot(b, spec);
  expect(drawn(a)).toBe(drawn(b));
  expect(spec.marks.map(m => [m.key, m.label])).toEqual([
    ['series:api', 'api'],
    ['series:web', 'web'],
  ]);
  expect(lineChart.spec({ ...props, theme: 'auto' })).not.toHaveProperty('theme');
  expect(spec).not.toHaveProperty('theme');
  expect(spec.marks.map(m => m.color)).toEqual(palette.slice(0, 2));
  expect(lineChart.spec({ ...props, theme: 'dark' })).toMatchObject({ theme: dark });
});

test('lineChart: one series has no legend, a number array is "value", and the features follow the props', async () => {
  const one = host();
  lineChart(one, { data: days(3, i => ({ api: i })), ...BOX });
  expect(entriesOf(one)).toEqual([]);

  const numbers = host();
  lineChart(numbers, { data: [1, 2, 3], ...BOX, yAxis: { domain: [0, 4] } });
  expect(lineChart.spec({ data: [1, 2, 3] }).marks.map(m => m.label)).toEqual(['value']);
  hover(numbers, 50, 50);
  expect(tipRows(numbers)).toEqual(['1', 'value: 2']);

  const data = days(3, i => ({ api: i, web: i + 1 }));
  const off = host();
  lineChart(off, { data, ...BOX, legend: false, tooltip: false });
  hover(off, 50, 50);
  expect(entriesOf(off)).toEqual([]);
  expect(tipRows(off)).toBeUndefined();

  const many = host();
  const long = Array.from({ length: 60 }, (_, i) => ({ s: `series ${i % 30}`, x: i % 2, v: 0.5 }));
  lineChart(many, { data: long, series: 's', width: 300, height: 600, legend: { rows: 1 } });
  expect(new Set(entriesOf(many).map(s => s.parentElement)).size).toBe(1);

  const yAfterZoom = async (zoom: Axes['zoom']) => {
    const onViewChange = vi.fn();
    const el = host();
    lineChart(el, { data, ...BOX, zoom, onViewChange });
    await zoomIn(el);
    return onViewChange.mock.calls.at(-1)![0].y;
  };
  narrower(await yAfterZoom({ axes: 'xy' }), await yAfterZoom(true));
});

test('lineChart: a legend appears when an update brings a second series, by recreating the chart', () => {
  const el = host();
  const c = lineChart(el, BOX);
  const canvas = el.querySelector('canvas');
  expect(entriesOf(el)).toEqual([]);
  c.update({ data: days(3, i => ({ api: i, web: i + 1 })) });
  expect(entriesOf(el).map(e => e.textContent)).toEqual(['api', 'web']);
  expect(el.querySelector('canvas')).not.toBe(canvas);
});

test('lineChart x kinds: text is a band axis with a clamped nearest-category title, numbers and the index are linear', () => {
  const data = ['a', 'b', 'c'].map(name => ({ name, v: 0.5 }));
  const spec = lineChart.spec({ data });
  expect(spec.x).toMatchObject({ label: 'name', categories: ['a', 'b', 'c'] });
  const ticked = host();
  lineChart(ticked, { data, width: 300, height: 200 });
  expect(ticked.textContent).toContain('abc');

  const el = host();
  lineChart(el, { data, ...BOX });
  const titleAt = (px: number) => (hover(el, px, 50), tipRows(el)![0]);
  const px = (x: number) => ((x + 0.5) * 100) / 3;
  expect(titleAt(px(1))).toBe('b');
  expect(titleAt(px(1.4))).toBe('b');
  expect(titleAt(px(1.6))).toBe('c');
  expect(titleAt(0.5)).toBe('a');
  expect(titleAt(99.5)).toBe('c');

  const numeric = lineChart.spec({ data: [0, 5, 9].map(t => ({ t, v: t * 2 })) }).x!;
  expect(numeric).toMatchObject({ label: 't', domain: 'nice' });
  expect(numeric).not.toHaveProperty('categories');
  expect(numeric).not.toHaveProperty('utc');
  const index = lineChart.spec({ data: [1, 2, 3] }).x!;
  expect(index).toMatchObject({ label: '', domain: 'nice' });
  expect(index).not.toHaveProperty('scale');
});

test('lineChart: the tooltip follows new categories and a new y format without a recreate', () => {
  const el = host();
  const rows = (names: string[]) => names.map(name => ({ name, v: 0.5 }));
  const c = lineChart(el, { data: rows(['a', 'b', 'c']), ...BOX });
  const chart = c.chart;
  c.update({ data: rows(['p', 'q', 'r']) });
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['q', 'v: 0.5']);
  c.update({ yAxis: { format: v => `${v * 100}%` } });
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['q', 'v: 50%']);
  expect(c.chart).toBe(chart);
});

test('lineChart identity: an equal copy sends nothing; categories and formats stay the same objects', () => {
  const format = (v: number) => `${v}`;
  const props = { data: ['a', 'b'].map(name => ({ name, v: 1 })), xAxis: { label: 'n' }, yAxis: { format } };
  const { c, seen } = builds_(props);
  const spy = vi.spyOn(c.chart, 'update');
  c.update({ ...props, xAxis: { label: 'n' }, yAxis: { format } });
  expect(spy).not.toHaveBeenCalled();
  c.update({ colors: [RED] });
  c.update({ colors: [BLUE] });
  expect(keysOf(spy)).toEqual([['marks'], ['marks']]);
  const [first, last] = [seen[0]!, seen.at(-1)!];
  expect((last.x as BandAxis).categories).toBe((first.x as BandAxis).categories);
  expect(last.y!.format).toBe(format);
  expect(first.y!.format).toBe(format);
});

test('lineChart sorts rows by x, stably, and keeps the sorted and per-series arrays across updates', () => {
  const sorted = days(6, i => ({ v: (i * 7) % 5 }));
  const props = (data: typeof sorted) => ({ data, ...BOX });
  const a = host();
  const b = host();
  const c = host();
  lineChart(a, props(sorted));
  lineChart(b, props([...sorted].reverse()));
  lineChart(c, props([3, 0, 5, 1, 4, 2].map(i => sorted[i]!)));
  expect(drawn(b)).toBe(drawn(a));
  expect(drawn(c)).toBe(drawn(a));

  const ties = lineChart.spec({
    data: [
      { x: 1, v: 5 },
      { x: 0, v: 1 },
      { x: 1, v: 7 },
    ],
  });
  expect(Array.from(optionsOf(ties.marks[0]!).x)).toEqual([0, 1, 1]);
  expect(Array.from(optionsOf(ties.marks[0]!).y)).toEqual([1, 5, 7]);

  const shuffled = builds_({ data: [...sorted].reverse() });
  shuffled.c.update({ colors: [RED] });
  const [s0, s1] = shuffled.seen.map(o => optionsOf(o.marks[0]!));
  expect(s1!.x).toBe(s0!.x);
  expect(s1!.y).toBe(s0!.y);

  const long = [
    { s: 'a', x: 2, v: 1 },
    { s: 'b', x: 1, v: 2 },
    { s: 'a', x: 0, v: 3 },
    { s: 'b', x: 0, v: 4 },
  ];
  const grouped = builds_({ data: long, series: 's' });
  grouped.c.update({ colors: [RED, BLUE] });
  const [g0, g1] = grouped.seen.map(o => o.marks.map(m => optionsOf(m)));
  for (const i of [0, 1]) {
    expect(g1![i]!.x).toBe(g0![i]!.x);
    expect(g1![i]!.y).toBe(g0![i]!.y);
  }
});

test('lineChart axis props reach the axes by x kind, and the chart props reach plot()', () => {
  const xFormat = (v: number) => `x${v}`;
  const yFormat = (v: number) => `${v} ms`;
  const numeric = lineChart.spec({
    data: [0, 5, 9].map(t => ({ t, v: t })),
    xAxis: { label: 'T', domain: [0, 10], step: 2, format: xFormat },
  });
  expect(numeric.x).toEqual({ label: 'T', domain: [0, 10], step: 2, format: xFormat });

  const timed = lineChart.spec({
    data: days(3, i => ({ v: i })),
    xAxis: { label: 'D', domain: [0, 1e9], format: xFormat, utc: false, unit: 'day', every: 2, step: 5 },
  });
  expect(timed.x).toMatchObject({
    label: 'D',
    domain: [0, 1e9],
    format: xFormat,
    utc: false,
    unit: 'day',
    every: 2,
  });
  expect(timed.x!.step).toBeUndefined();

  const yAxis = { label: 'Y', domain: [0, 2] as [number, number], step: 0.5, format: yFormat };
  const spec = lineChart.spec({
    data: [0, 1, 2].map(t => ({ t, v: 1 })),
    yAxis,
    colors: [RED],
    curve: 'step',
    join: true,
    width: 120,
    height: 80,
    margin: ZERO,
    description: 'Latency',
  });
  expect(spec.y).toEqual(yAxis);
  expect(optionsOf(spec.marks[0]!)).toMatchObject({ color: RED, curve: 'step', join: true });
  expect(spec).toMatchObject({ width: 120, height: 80, margin: ZERO, description: 'Latency' });

  const el = host();
  lineChart(el, { data: [0, 1, 2].map(t => ({ t, v: 1 })), yAxis, ...BOX, description: 'Latency' });
  expect(el.innerHTML).toContain('Latency');
  const root = el.firstElementChild!.getBoundingClientRect();
  expect([root.width, root.height]).toEqual([100, 100]);
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['1', 'v: 1 ms']);
});

test('lineChart long data draws a line per series over its own x; a missing y is a gap that join bridges', () => {
  const long = [
    { s: 'a', x: 0, v: 1 },
    { s: 'a', x: 1, v: 2 },
    { s: 'b', x: 1, v: 3 },
    { s: 'a', x: 2, v: 1 },
    { s: 'b', x: 3, v: 4 },
  ];
  const spec = lineChart.spec({ data: long, series: 's' });
  expect(spec.marks.map(m => [m.label, Array.from(optionsOf(m).x)])).toEqual([
    ['a', [0, 1, 2]],
    ['b', [1, 3]],
  ]);

  const data = [1.2, 1.2, null, 1.2, 1.2].map((v, t) => ({ t, v }));
  const props = { data, ...BOX, yAxis: { domain: [0, 2] as [number, number] } };
  const gap = host();
  lineChart(gap, props);
  expect(pixel(gap, 10, 40)[3]).toBeGreaterThan(0);
  expect(pixel(gap, 50, 40)[3]).toBe(0);
  const joined = host();
  lineChart(joined, { ...props, join: true });
  expect(pixel(joined, 50, 40)[3]).toBeGreaterThan(0);
});

/** The rows of one CSS pixel column, top to bottom, in device pixels. */
const columnOf = (el: HTMLElement, x: number) => {
  const c = el.querySelector('canvas')!;
  const d = c.getContext('2d')!.getImageData(Math.round(x * devicePixelRatio), 0, 1, c.height).data;
  return Array.from({ length: c.height }, (_, i) => [...d.subarray(i * 4, i * 4 + 4)]);
};
const near = (got: number[], want: number[]) => got.every((v, i) => Math.abs(v - want[i]!) <= 3);
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/** How many device pixels of the column are this opaque colour. */
const tall = (column: number[][], color: string) => column.filter(p => near(p, [...rgb(color), 255])).length;
const areaOptions = (m: Mark) => m.options as { x: Col; y: Col; alpha?: number; stack?: string };

test('areaChart fills one y from zero, and two y overlap at half alpha', () => {
  const one = host();
  areaChart(one, { data: days(5, () => ({ v: 0.5 })), ...BOX, yAxis: { domain: [0, 1] } });
  expect(pixel(one, 50, 75)).toEqual([...rgb(palette[0]!), 255]);
  expect(pixel(one, 50, 95)).toEqual([...rgb(palette[0]!), 255]);
  expect(pixel(one, 50, 25)[3]).toBe(0);

  const data = days(5, () => ({ a: 0.75, b: 0.25 }));
  const two = host();
  areaChart(two, { data, ...BOX, legend: false, colors: [RED, BLUE], yAxis: { domain: [0, 1] } });
  expect(near(pixel(two, 50, 40), [255, 0, 0, 128])).toBe(true);
  expect(near(pixel(two, 50, 90), [85, 0, 170, 191])).toBe(true);
  expect(areaChart.spec({ data }).marks.map(m => areaOptions(m).alpha)).toEqual([0.5, 0.5]);
  expect(areaChart.spec({ data, y: 'a' }).marks.map(m => areaOptions(m).alpha)).toEqual([undefined]);
  // @ts-expect-error stacking is for areas
  lineChart.spec({ data, stack: true });
});

test('areaChart stack: true lays the second on the first, hiding the first re-lays it, and the tooltip shows own values', () => {
  const el = host();
  const props = { data: days(5, () => ({ a: 0.25, b: 0.5 })), width: 100, height: 200, margin: ZERO };
  areaChart(el, { ...props, stack: true, colors: [RED, BLUE], yAxis: { domain: [0, 1] } });
  const before = columnOf(el, 50);
  const [a, b] = [tall(before, RED), tall(before, BLUE)];
  expect(b / a).toBeCloseTo(2, 1);
  expect(before.findLastIndex(p => near(p, [...rgb(BLUE), 255]))).toBeLessThan(
    before.findIndex(p => near(p, [...rgb(RED), 255])),
  );
  hover(el, 50, 150);
  expect(tipRows(el)).toEqual(['2024-01-03', 'a: 0.25', 'b: 0.5']);
  hideFirst(el);
  const after = columnOf(el, 50);
  expect(tall(after, RED)).toBe(0);
  expect(Math.abs(tall(after, BLUE) - b)).toBeLessThanOrEqual(2);
  expect(after.findLastIndex(p => p[3]! > 0)).toBe(before.findLastIndex(p => p[3]! > 0));
  expect(areaChart.spec({ ...props, stack: true }).marks.map(m => areaOptions(m).alpha)).toEqual([
    undefined,
    undefined,
  ]);
});

test('areaChart stacks long data over the sorted union of x, a missing value stacking as zero', () => {
  const long = [
    { s: 'b', x: 2, v: 0.5 },
    { s: 'a', x: 1, v: 0.25 },
    { s: 'a', x: 0, v: 0.25 },
    { s: 'b', x: 0, v: 0.5 },
    { s: 'a', x: 2, v: 0.25 },
  ];
  const spec = areaChart.spec({ data: long, series: 's', stack: true });
  const [b, a] = spec.marks.map(m => areaOptions(m));
  expect(spec.marks.map(m => m.label)).toEqual(['b', 'a']);
  expect(Array.from(a!.x)).toEqual([0, 1, 2]);
  expect(b!.x).toBe(a!.x);
  expect(Array.from(a!.y)).toEqual([0.25, 0.25, 0.25]);
  expect(Array.from(b!.y)).toEqual([0.5, Number.NaN, 0.5]);
  expect(b!.stack).toBe(a!.stack);

  const el = host();
  areaChart(el, {
    data: long,
    series: 's',
    stack: true,
    colors: [BLUE, RED],
    legend: false,
    ...BOX,
    yAxis: { domain: [0, 1] },
  });
  const column = columnOf(el, 50);
  expect(tall(column, BLUE)).toBeLessThanOrEqual(2 * devicePixelRatio);
  expect(tall(column, RED) / column.length).toBeCloseTo(0.25, 1);
  expect(tall(columnOf(el, 1), BLUE) / column.length).toBeCloseTo(0.5, 1);

  const { c, seen } = builds_({ data: long, series: 's', stack: true }, host(), 'area');
  c.update({ colors: [RED, BLUE] });
  const [s0, s1] = seen.map(o => o.marks.map(m => areaOptions(m)));
  for (const i of [0, 1]) {
    expect(s1![i]!.x).toBe(s0![i]!.x);
    expect(s1![i]!.y).toBe(s0![i]!.y);
  }
});

test('areaChart keeps its marks for a label-only update and builds them again for colors, stack and data', () => {
  const data = days(5, () => ({ a: 0.25, b: 0.5 }));
  const { c, seen } = builds_({ data, stack: true }, host(), 'area');
  const marks = () => seen.at(-1)!.marks;
  const first = marks();
  c.update({ yAxis: { label: 'share' } });
  expect(marks()).toBe(first);
  for (const p of [{ colors: [RED, BLUE] }, { stack: false }, { data: [...data] }]) {
    const before = marks();
    c.update(p);
    expect(marks()).not.toBe(before);
  }
});

test('areaChart unstacked: a missing y is a gap that join bridges; curve, sorting and long data are as for lineChart', () => {
  const data = [1.2, 1.2, null, 1.2, 1.2].map((v, t) => ({ t, v }));
  const props = { data, ...BOX, yAxis: { domain: [0, 2] as [number, number] } };
  const gap = host();
  areaChart(gap, props);
  expect(pixel(gap, 10, 80)[3]).toBeGreaterThan(0);
  expect(pixel(gap, 50, 80)[3]).toBe(0);
  const joined = host();
  areaChart(joined, { ...props, join: true });
  expect(pixel(joined, 50, 80)[3]).toBeGreaterThan(0);

  const sorted = days(6, i => ({ v: (i * 7) % 5 }));
  const [a, b] = [host(), host()];
  areaChart(a, { data: sorted, ...BOX });
  areaChart(b, { data: [...sorted].reverse(), ...BOX });
  expect(drawn(b)).toBe(drawn(a));

  const long = [
    { s: 'a', x: 2, v: 1 },
    { s: 'b', x: 3, v: 2 },
    { s: 'a', x: 0, v: 3 },
    { s: 'b', x: 1, v: 4 },
  ];
  const marks = (o: Options) =>
    o.marks.map(m => [Array.from(optionsOf(m).x), Array.from(optionsOf(m).y), optionsOf(m).curve]);
  const grouped = { data: long, series: 's' as const, curve: 'step' as const };
  expect(marks(areaChart.spec(grouped))).toEqual(marks(lineChart.spec(grouped)));
  const shuffled = { data: [...sorted].reverse() };
  expect(marks(areaChart.spec(shuffled))).toEqual(marks(lineChart.spec(shuffled)));
});

const barOptions = (m: Mark) =>
  m.options as { x: Col; y: Col; color: string; stack?: string; dodge?: string };
const tallShare = (el: HTMLElement, x: number, color: string) => {
  const column = columnOf(el, x);
  return tall(column, color) / column.length;
};

test('barChart draws one bar per row from zero on a band axis whose ticks are the names', () => {
  const data = [
    { name: 'a', value: 1 },
    { name: 'b', value: 2 },
    { name: 'c', value: 3 },
  ];
  const spec = barChart.spec({ data });
  const x = spec.x as BandAxis;
  expect(x).toMatchObject({ label: 'name', categories: ['a', 'b', 'c'] });
  expect(x.scale!(x, () => [0, 0]).ticks.map(t => t.label)).toEqual(['a', 'b', 'c']);
  expect(spec.marks.map(m => [m.label, Array.from(barOptions(m).x), Array.from(barOptions(m).y)])).toEqual([
    ['value', [0, 1, 2], [1, 2, 3]],
  ]);
  const el = host();
  barChart(el, { data, ...BOX, colors: [RED], yAxis: { domain: [0, 4] } });
  expect(tallShare(el, 16, RED)).toBeCloseTo(0.25, 1);
  expect(tallShare(el, 83, RED)).toBeCloseTo(0.75, 1);
  expect(near(pixel(el, 16, 99), [...rgb(RED), 255])).toBe(true);
  expect(pixel(el, 16, 70)[3]).toBe(0);
});

test('barChart tooltip names the category, the series under the pointer and its own value', () => {
  const one = host();
  barChart(one, {
    data: [
      { name: 'a', value: 1 },
      { name: 'b', value: 2 },
      { name: 'c', value: 3 },
    ],
    ...BOX,
    yAxis: { domain: [0, 4] },
  });
  hover(one, 50, 90);
  expect(tipRows(one)).toEqual(['b · value: 2']);

  const data = [
    { name: 'a', p: 1, q: 3 },
    { name: 'b', p: 2, q: 1 },
  ];
  const props = { data, ...BOX, legend: false, yAxis: { domain: [0, 4] as [number, number] } };
  const side = host();
  barChart(side, props);
  hover(side, 15, 95);
  expect(tipRows(side)).toEqual(['a · p: 1']);
  hover(side, 35, 95);
  expect(tipRows(side)).toEqual(['a · q: 3']);
  const stacked = host();
  barChart(stacked, { ...props, stack: true });
  hover(stacked, 25, 50);
  expect(tipRows(stacked)).toEqual(['a · q: 3']);
  hover(stacked, 25, 90);
  expect(tipRows(stacked)).toEqual(['a · p: 1']);
});

test('barChart draws two y side by side within each category, and stack: true stacks them', () => {
  const data = [
    { name: 'a', p: 1, q: 3 },
    { name: 'b', p: 2, q: 1 },
  ];
  const props = {
    data,
    ...BOX,
    legend: false,
    colors: [RED, BLUE],
    yAxis: { domain: [0, 4] as [number, number] },
  };
  const side = host();
  barChart(side, props);
  expect(tallShare(side, 15, RED)).toBeCloseTo(0.25, 1);
  expect(tallShare(side, 15, BLUE)).toBe(0);
  expect(tallShare(side, 35, BLUE)).toBeCloseTo(0.75, 1);
  expect(tallShare(side, 35, RED)).toBe(0);
  const stacked = host();
  barChart(stacked, { ...props, stack: true });
  expect(tallShare(stacked, 25, RED)).toBeCloseTo(0.25, 1);
  expect(tallShare(stacked, 25, BLUE)).toBeCloseTo(0.75, 1);
  expect(barChart.spec(props).marks.map(m => [barOptions(m).dodge, barOptions(m).stack])).toEqual([
    ['dodge', undefined],
    ['dodge', undefined],
  ]);
  // @ts-expect-error curves are for lines and areas
  barChart.spec({ data, curve: 'step' });
});

test('barChart wide data: one category per row in row order, labelled with the ISO date or the number', () => {
  const categories = (o: Options) => (o.x as BandAxis).categories;
  const dated = barChart.spec({
    data: [
      { date: '2024-01-02', v: 1 },
      { date: '2024-01-01', v: 2 },
      { date: '2024-01-02', v: 3 },
    ],
  });
  expect(categories(dated)).toEqual(['2024-01-02', '2024-01-01', '2024-01-02']);
  expect(Array.from(barOptions(dated.marks[0]!).x)).toEqual([0, 1, 2]);
  expect(Array.from(barOptions(dated.marks[0]!).y)).toEqual([1, 2, 3]);
  const numbered = barChart.spec({
    data: [
      { year: 2020, v: 1 },
      { year: 2019, v: 2 },
    ],
  });
  expect(categories(numbered)).toEqual(['2020', '2019']);
  expect(numbered.x).toMatchObject({ label: 'year' });
});

test('barChart long data: one category per distinct x in order of first appearance, over the union', () => {
  const data = [
    { s: 'a', x: 20, v: 1 },
    { s: 'b', x: 10, v: 2 },
    { s: 'a', x: 30, v: 3 },
    { s: 'a', x: 20, v: 4 },
  ];
  const spec = barChart.spec({ data, series: 's' });
  expect((spec.x as BandAxis).categories).toEqual(['20', '10', '30']);
  const [a, b] = spec.marks.map(m => barOptions(m));
  expect(Array.from(a!.x)).toEqual([0, 1, 2]);
  expect(b!.x).toBe(a!.x);
  expect(Array.from(a!.y)).toEqual([4, Number.NaN, 3]);
  expect(Array.from(b!.y)).toEqual([Number.NaN, 2, Number.NaN]);

  const props = {
    data,
    series: 's' as const,
    ...BOX,
    legend: false,
    colors: [RED, BLUE],
    yAxis: { domain: [0, 5] as [number, number] },
  };
  const side = host();
  barChart(side, props);
  expect(tallShare(side, 43, RED)).toBe(0);
  expect(tallShare(side, 57, BLUE)).toBeCloseTo(0.4, 1);
  const stacked = host();
  barChart(stacked, { ...props, stack: true });
  expect(tallShare(stacked, 50, BLUE)).toBeCloseTo(0.4, 1);
  expect(near(pixel(stacked, 50, 99), [...rgb(BLUE), 255])).toBe(true);
  expect(tallShare(stacked, 16, RED)).toBeCloseTo(0.8, 1);
});

test('barChart ignores xAxis.utc: the same categories and grouping either way', () => {
  const data = [
    { s: 'a', t: '2024-01-02T00:00:00Z', v: 1 },
    { s: 'b', t: '2024-01-01', v: 2 },
    { s: 'a', t: '2024-01-01T00:00:00Z', v: 3 },
  ];
  const specs = [undefined, true, false].map(utc =>
    barChart.spec({ data, series: 's', ...(utc !== undefined && { xAxis: { utc } }) }),
  );
  for (const spec of specs) {
    expect((spec.x as BandAxis).categories).toEqual(['2024-01-02', '2024-01-01']);
    expect(spec.marks.map(m => Array.from(barOptions(m).y))).toEqual([
      [1, 3],
      [Number.NaN, 2],
    ]);
  }
});

test('barChart: a missing or NaN y draws no bar and the others keep their places; negatives go below zero', () => {
  const data = [
    { name: 'a', v: 1 },
    { name: 'b', v: null },
    { name: 'c', v: Number.NaN },
    { name: 'd', v: -1 },
  ];
  const el = host();
  barChart(el, { data, ...BOX, colors: [RED], yAxis: { domain: [-2, 2] } });
  expect(near(pixel(el, 12, 40), [...rgb(RED), 255])).toBe(true);
  expect(pixel(el, 12, 60)[3]).toBe(0);
  expect(tallShare(el, 37, RED)).toBe(0);
  expect(tallShare(el, 62, RED)).toBe(0);
  expect(near(pixel(el, 87, 60), [...rgb(RED), 255])).toBe(true);
  expect(pixel(el, 87, 40)[3]).toBe(0);
});

test('barChart identity: the index column and the categories stay the same objects across non-data updates', () => {
  const data = [
    { s: 'a', x: 'q1', v: 1 },
    { s: 'b', x: 'q2', v: 2 },
  ];
  const { c, seen } = builds_({ data, series: 's' }, host(), 'bar');
  c.update({ colors: [RED, BLUE] });
  c.update({ stack: true });
  c.update({ yAxis: { label: 'v' } });
  const [first, ...rest] = seen;
  for (const o of rest) {
    expect((o.x as BandAxis).categories).toBe((first!.x as BandAxis).categories);
    o.marks.forEach((m, i) => expect(barOptions(m).x).toBe(barOptions(first!.marks[i]!).x));
  }
  c.update({ data: [...data] });
  expect((seen.at(-1)!.x as BandAxis).categories).not.toBe((first!.x as BandAxis).categories);
});

const dotOptions = (m: Mark) => m.options as { x: Col; y: Col; r: Col; color: string };
const columns = (o: Options) =>
  o.marks.map(m => [
    m.label,
    Array.from(dotOptions(m).x),
    Array.from(dotOptions(m).y),
    Array.from(dotOptions(m).r),
  ]);
const DOMAINS = {
  xAxis: { domain: [0, 10] as [number, number] },
  yAxis: { domain: [0, 10] as [number, number] },
};
const isRed = (el: HTMLElement, x: number, y: number) => near(pixel(el, x, y), [...rgb(RED), 255]);

test('scatterChart draws a dot of radius 4 at each row in row order, both axes labelled', () => {
  const data = [
    { height: 7, weight: 3 },
    { height: 3, weight: 7 },
  ];
  const spec = scatterChart.spec({ data });
  expect(spec.x).toMatchObject({ label: 'height' });
  expect(spec.y).toMatchObject({ label: 'weight' });
  expect(columns(spec)).toEqual([['weight', [7, 3], [3, 7], [4, 4]]]);
  const el = host();
  scatterChart(el, { data, ...BOX, ...DOMAINS, colors: [RED] });
  for (const [x, y] of [
    [70, 70],
    [30, 30],
  ] as const) {
    expect(isRed(el, x, y)).toBe(true);
    expect(isRed(el, x + 2, y)).toBe(true);
    expect(isRed(el, x + 5, y)).toBe(false);
  }
  expect(isRed(el, 30, 70)).toBe(false);
});

test('scatterChart r: a number, a field or an accessor, per group with series; the constant column is kept', () => {
  const data = [
    { s: 'a', h: 2, w: 2, size: 2 },
    { s: 'b', h: 5, w: 5, size: 6 },
    { s: 'a', h: 8, w: 8, size: 3 },
  ];
  const el = host();
  scatterChart(el, { data: [{ h: 5, w: 5 }], ...BOX, ...DOMAINS, colors: [RED], r: 8 });
  expect(isRed(el, 56, 50)).toBe(true);
  expect(isRed(el, 59, 50)).toBe(false);
  expect(() => scatterChart(host(), { data, ...BOX, ...DOMAINS, r: -2 })).not.toThrow();
  const grouped = [
    ['a', [2, 8], [2, 8], [2, 3]],
    ['b', [5], [5], [6]],
  ];
  expect(columns(scatterChart.spec({ data, series: 's', r: 'size' }))).toEqual(grouped);
  expect(columns(scatterChart.spec({ data, series: 's', r: d => d.size }))).toEqual(grouped);
  expect(scatterChart.spec({ data, r: 'size' }).x).toMatchObject({ label: 'h' });

  const { c, seen } = builds_({ data, series: 's' }, host(), 'scatter');
  c.update({ colors: [RED, BLUE] });
  c.update({ yAxis: { label: 'w' } });
  const [first, ...rest] = seen;
  for (const o of rest)
    o.marks.forEach((m, i) => expect(dotOptions(m).r).toBe(dotOptions(first!.marks[i]!).r));
  c.update({ r: 8 });
  expect(Array.from(dotOptions(seen.at(-1)!.marks[1]!).r)).toEqual([8]);
});

test('scatterChart series draws one coloured group per value with a legend', () => {
  const data = [
    { species: 'a', h: 2, w: 2 },
    { species: 'b', h: 5, w: 5 },
    { species: 'a', h: 8, w: 8 },
  ];
  const el = host();
  scatterChart(el, { data, series: 'species', ...BOX, ...DOMAINS, colors: [RED, BLUE] });
  expect(shows(el, RED)).toBe(true);
  expect(shows(el, BLUE)).toBe(true);
  expect(entriesOf(el).map(e => e.textContent)).toEqual(['a', 'b']);
});

test("scatterChart tooltip is the nearest dot's series, x and y in the axis formats", () => {
  const data = [
    { s: 'a', h: 2, w: 2.5 },
    { s: 'b', h: 7, w: 1234 },
  ];
  const props = {
    data,
    series: 's' as const,
    ...BOX,
    legend: false,
    yAxis: { domain: [0, 2000] as [number, number] },
  };
  const plain = host();
  scatterChart(plain, { ...props, xAxis: { domain: [0, 10] } });
  hover(plain, 71, 39);
  expect(tipRows(plain)).toEqual(['b: 7, 1,234']);
  const formatted = host();
  scatterChart(formatted, {
    ...props,
    xAxis: { domain: [0, 10], format: v => `${v} cm` },
    yAxis: { ...props.yAxis, format: v => `${v} kg` },
  });
  hover(formatted, 20, 99);
  expect(tipRows(formatted)).toEqual(['a: 2 cm, 2.5 kg']);
  const dated = host();
  scatterChart(dated, { data: [{ t: '2024-01-02', v: 5 }], ...BOX, yAxis: { domain: [0, 10] } });
  hover(dated, 50, 50);
  expect(tipRows(dated)).toEqual(['v: 2024-01-02, 5']);
  const named = host();
  scatterChart(named, {
    data: [{ c: 'east', v: 5 }],
    x: 'c',
    ...BOX,
    xAxis: { format: v => `${v} cm` },
    yAxis: { domain: [0, 10] },
  });
  hover(named, 50, 50);
  expect(tipRows(named)).toEqual(['v: east, 5']);
});

const spans = [
  { dose: 'none', mean: 5, low: 4, high: 6 },
  { dose: 'some', mean: 7, low: 5, high: 8 },
  { dose: 'much', mean: 3, low: 2, high: 3.5 },
];
const errorsOf = (o: Options) =>
  o.marks
    .filter(m => m.type === 'errorBars')
    .map(m => {
      const { x, y1, y2 } = m.options as { x: Col; y1: Col; y2: Col };
      return [m.group, numbers(x), numbers(y1), numbers(y2)];
    });
const PURE = '#00ff00';
const SPREAD = { low: 'low', high: 'high' } as const;

test('errorBars add one unlabelled mark at the x of the series and leave the guessing pool', () => {
  for (const [spec, types] of [
    [lineChart.spec({ data: spans, errorBars: SPREAD }), ['errorBars', 'line']],
    [barChart.spec({ data: spans, errorBars: SPREAD }), ['bar', 'errorBars']],
    [scatterChart.spec({ data: spans, x: 'dose', errorBars: SPREAD }), ['errorBars', 'dots']],
  ] as const) {
    expect(spec.marks.map(m => m.type)).toEqual(types);
    expect((spec.x as BandAxis).categories).toEqual(['none', 'some', 'much']);
    expect(errorsOf(spec)).toEqual([['mean', [0, 1, 2], [4, 5, 2], [6, 8, 3.5]]]);
    expect(spec.marks.map(m => m.label).filter(l => l !== undefined)).toEqual(['mean']);
  }
  const styled = lineChart.spec({
    data: spans,
    y: 'mean',
    colors: [RED],
    errorBars: { low: d => d.mean - 1, high: 'high', cap: 0, width: 3 },
  });
  expect(styled.marks[0]!.options).toMatchObject({ cap: 0, width: 3, color: RED });
  expect(
    errorsOf(
      lineChart.spec({ data: spans, y: 'mean', errorBars: { low: d => d.mean - 1, high: 'high' } }),
    )[0]![2],
  ).toEqual([4, 6, 2]);
  expect(barChart.spec({ data: spans, errorBars: SPREAD }).marks[1]!.color).toBe(light.text);
});

test('errorBars follow a sorted line, a series split and a dropped row, and an end missing draws none', () => {
  const data = [
    { t: 3, s: 'a', v: 3, low: 2.5, high: 3.5 },
    { t: 1, s: 'b', v: 1, low: null, high: 1.5 },
    { t: null, s: 'a', v: 9, low: 8, high: 10 },
    { t: 1, s: 'a', v: 2, low: 1.5, high: 2.5 },
  ];
  const series = { data, x: 't', y: 'v', series: 's', errorBars: SPREAD } as const;
  expect(errorsOf(lineChart.spec(series))).toEqual([
    ['a', [1, 3], [1.5, 2.5], [2.5, 3.5]],
    ['b', [1], [Number.NaN], [1.5]],
  ]);
  expect(errorsOf(scatterChart.spec(series))).toEqual([
    ['a', [3, 1], [2.5, 1.5], [3.5, 2.5]],
    ['b', [1], [Number.NaN], [1.5]],
  ]);
  expect(errorsOf(barChart.spec(series))).toEqual([
    ['a', [0, 1], [2.5, 1.5], [3.5, 2.5]],
    ['b', [0, 1], [Number.NaN, Number.NaN], [Number.NaN, 1.5]],
  ]);
});

test('an automatic y domain leaves out the end left of an incomplete error bar', () => {
  const rows = (high: number | null, low: number | null = null) => [
    { q: 'one', s: 'a', v: 5, low: 4, high: 7 },
    { q: 'two', s: 'a', v: 6, low, high },
    { q: 'one', s: 'b', v: 4, low: 3, high: 5 },
  ];
  for (const chart of [lineChart, barChart, scatterChart])
    for (const count of [2, 3]) {
      const show = (data: ReturnType<typeof rows>) => {
        const el = host();
        chart(el, {
          data: data.slice(0, count),
          x: 'q',
          y: 'v',
          series: 's',
          errorBars: SPREAD,
          width: 200,
          height: 200,
        });
        return el.innerText;
      };
      const none = show(rows(null));
      expect(show(rows(1e6))).toBe(none);
      expect(show(rows(null, -1e6))).toBe(none);
      expect(show(rows(1e6, 5))).not.toBe(none);
    }
});

test('errorBars of one series and another series named like them each keep their own mark on update', () => {
  const spec = (v: number) =>
    lineChart.spec({
      data: ['a', 'errorBars:a', 'series:a'].flatMap(s =>
        [0, 1].map(t => ({ t, s, v: v + t, low: v - 1, high: v + 2 })),
      ),
      x: 't',
      y: 'v',
      series: 's',
      errorBars: SPREAD,
      ...BOX,
    });
  const [before, after] = [spec(1), spec(2)];
  const names = ['a', 'errorBars:a', 'series:a'];
  expect(before.marks.map(m => m.group)).toEqual(names.concat(names));
  const c = plot(host(), before);
  const prepared = after.marks.map(m => vi.spyOn(m, 'prepare'));
  c.update({ marks: after.marks });
  prepared.forEach((p, i) => expect(p.mock.calls[0]![1]).toBe(before.marks[i]));
});

test('errorBars errors name the chart, the field and the prop; areaChart takes none', () => {
  const two = spans.map(d => ({ ...d, other: 1 }));
  const bad =
    (errorBars: object, data: object[] = spans, y?: string) =>
    () =>
      lineChart.spec({ data, y, errorBars } as never);
  expect(bad({ low: 'nope', high: 'high' })).toThrow(
    /^lineChart: there is no field "nope".*Pass errorBars.low as one of these fields\.$/,
  );
  expect(bad({ low: 'low', high: 'dose' })).toThrow(/errorBars.high "dose" is text/);
  expect(bad({ low: 'low', high: (d: { dose: string }) => d.dose }, spans, 'mean')).toThrow(
    /accessor errorBars.high is text/,
  );
  expect(bad(SPREAD, two)).toThrow(/with errorBars there is one y\..*Pass y as one field\.$/);
  expect(() => barChart.spec({ data: two, y: ['mean', 'other'], errorBars: SPREAD })).toThrow(
    /there is one y/,
  );
  expect(() =>
    barChart.spec({ data: spans, x: 'mean', y: 'mean', series: 'dose', stack: true, errorBars: SPREAD }),
  ).toThrow(/^barChart: errorBars do not apply to stacked bars/);
  expect(() => barChart.spec({ data: spans, stack: true, errorBars: SPREAD })).not.toThrow();
  expect(() => lineChart.spec({ data: null, errorBars: { low: 'nope', high: 'nope' } })).not.toThrow();
  expect(areaChart.spec({ data: spans, errorBars: SPREAD } as never).marks.map(m => m.label)).toEqual([
    'mean',
    'low',
    'high',
  ]);
});

test('errorBars on dodged bars stand on their own bar and move with it as a series is hidden', () => {
  const data = [
    { q: 'one', s: 'a', v: 4, low: 2, high: 8 },
    { q: 'one', s: 'b', v: 4, low: 2, high: 8 },
  ];
  const el = host();
  const c = barChart(el, {
    data,
    y: 'v',
    series: 's',
    x: 'q',
    errorBars: { ...SPREAD, width: 2 },
    ...BOX,
    legend: false,
    theme: { ...light, text: PURE },
    colors: [RED, BLUE],
    yAxis: { domain: [0, 10] },
  });
  const green = (x: number) => near(pixel(el, x, 50), [...rgb(PURE), 255]);
  expect([30, 50, 70].map(green)).toEqual([true, false, true]);
  c.update({ hidden: ['b'] });
  expect([30, 50, 70].map(green)).toEqual([false, true, false]);
});

test('errorBars and alpha and ring: an equal copy sends nothing and a change redraws', () => {
  const props = () =>
    ({ data: spans, x: 'dose', errorBars: { ...SPREAD, cap: 4 }, alpha: 0.5, ring: 2 }) as const;
  const el = host();
  const c = scatterChart(el, { ...BOX, ...props() });
  const update = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(update).not.toHaveBeenCalled();
  for (const change of [
    { errorBars: { ...SPREAD, cap: 0 } },
    { alpha: 0.2 },
    { ring: 3 },
    { errorBars: undefined },
  ]) {
    c.update(change);
    expect(update).toHaveBeenCalledTimes(1);
    expect(Object.keys(update.mock.calls[0]![0])).toEqual(['marks']);
    update.mockClear();
  }
});

test('scatterChart passes alpha and ring to the dots of every series', () => {
  const data = [
    { s: 'a', h: 2, w: 2 },
    { s: 'b', h: 5, w: 5 },
  ];
  for (const m of scatterChart.spec({ data, series: 's', alpha: 0.6, ring: 2 }).marks)
    expect(m.options).toMatchObject({ alpha: 0.6, ring: 2 });
  expect(scatterChart.spec({ data, series: 's' }).marks[0]!.options).not.toHaveProperty('ring');
});

const DELIVERIES = [
  { courier: 'North', minutes: 2, late: 1 },
  { courier: 'East', minutes: 8, late: 3 },
  { courier: 'North', minutes: 5, late: 2 },
];

test('scatterChart puts a text y on a band axis in order of first appearance, by name or accessor', () => {
  const spec = scatterChart.spec({ data: DELIVERIES, x: 'minutes', y: 'courier' });
  expect(spec.x).toMatchObject({ label: 'minutes' });
  expect(spec.y).toMatchObject({ label: 'courier', categories: ['North', 'East'] });
  expect(columns(spec)).toEqual([['courier', [2, 8, 5], [0, 1, 0], [4, 4, 4]]]);
  expect(scatterChart.spec({ data: DELIVERIES, x: 'minutes', y: d => d.courier }).y).toMatchObject({
    label: '',
    categories: ['North', 'East'],
  });
  expect(scatterChart.spec({ data: DELIVERIES, y: 'courier', yAxis: { label: 'Who' } }).y).toMatchObject({
    label: 'Who',
  });
  const grouped = scatterChart.spec({ data: DELIVERIES, x: 'minutes', y: 'courier', series: 'courier' });
  expect(columns(grouped)).toEqual([
    ['North', [2, 5], [0, 0], [4, 4]],
    ['East', [8], [1], [4]],
  ]);
  const both = scatterChart.spec({ data: DELIVERIES, x: 'minutes', y: 'courier', y2: 'late' });
  expect(both.y2).toMatchObject({ label: 'late' });
  expect(both.y2).not.toHaveProperty('categories');
  expect(both.marks[1]!.yAxis).toBe('y2');
});

test('scatterChart tooltip names the category of a text y, and a y2 value stays a number', () => {
  const el = host();
  scatterChart(el, {
    data: DELIVERIES,
    x: 'minutes',
    y: 'courier',
    y2: 'late',
    ...BOX,
    legend: false,
    xAxis: { domain: [0, 10] },
    yAxis: { format: v => `${v} no` },
    y2Axis: { domain: [0, 10] },
  });
  hover(el, 80, 25);
  expect(tipRows(el)).toEqual(['courier: 8, East']);
  hover(el, 80, 70);
  expect(tipRows(el)).toEqual(['late: 8, 3']);
});

test('a text y is never guessed, and is scatterChart alone', () => {
  expect(scatterChart.spec({ data: DELIVERIES }).y).toMatchObject({ label: 'late' });
  expect(() =>
    scatterChart.spec({ data: DELIVERIES.map(({ courier, minutes }) => ({ courier, minutes })) }),
  ).toThrow(/^scatterChart: a scatter chart needs two fields/);
  for (const chart of [lineChart, areaChart, barChart]) {
    expect(() => chart.spec({ data: DELIVERIES, x: 'minutes', y: 'courier' } as never)).toThrow(
      /: y "courier" is text, not numbers\./,
    );
    expect(() =>
      chart.spec({ data: DELIVERIES, x: 'minutes', y: d => d.courier, series: 'courier' }),
    ).toThrow(/: the accessor y1 is text, not numbers\./);
  }
  const dated = [{ at: '2026-01-02', n: 1 }];
  expect(() => scatterChart.spec({ data: dated, x: 'n', y: 'at' })).toThrow(
    /^scatterChart: y "at" is time, not numbers or text/,
  );
  const bad = (props: object) => () =>
    scatterChart.spec({ data: DELIVERIES, x: 'minutes', y: 'courier', ...props } as never);
  expect(bad({ yAxis: LOG })).toThrow(/^scatterChart: yAxis.scale 'log' does not apply to a text y/);
  expect(bad({ errorBars: { low: 'late', high: 'late', axis: 'y' } })).toThrow(
    /^scatterChart: errorBars along y do not apply to a text y/,
  );
});

test('scatterChart errorBars lie down along x with a text y or axis x, and only there', () => {
  const lying = (o: Options) =>
    o.marks
      .filter(m => m.type === 'errorBars')
      .map(m => {
        const { y, x1, x2 } = m.options as { y: Col; x1: Col; x2: Col };
        return [numbers(y), numbers(x1), numbers(x2)];
      });
  const flat = [
    [0, 1, 2],
    [4, 5, 2],
    [6, 8, 3.5],
  ];
  expect(lying(scatterChart.spec({ data: spans, x: 'mean', y: 'dose', errorBars: SPREAD }))).toEqual([flat]);
  const numeric = {
    data: spans,
    x: 'mean',
    y: 'high',
    errorBars: { low: 'low', high: 'high', axis: 'x' },
  } as const;
  expect(lying(scatterChart.spec(numeric))).toEqual([[[6, 8, 3.5], flat[1], flat[2]]]);
  expect(lying(scatterChart.spec({ ...numeric, yAxis: { scale: 'log' } }))[0]!.slice(1)).toEqual(
    flat.slice(1),
  );
  expect(() => scatterChart.spec({ ...numeric, x: 'dose' })).toThrow(
    /^scatterChart: errorBars along x need an x of numbers/,
  );
  expect(() =>
    lineChart.spec({ data: spans, y: 'mean', errorBars: { ...SPREAD, axis: 'y' } } as never),
  ).toThrow(/^lineChart: errorBars.axis applies to scatterChart only/);
});

test("scatterChart shape 'tick' draws ticks r long that answer no tooltip, and an update switches the shape", () => {
  const props = {
    data: DELIVERIES,
    x: 'minutes' as const,
    y: 'courier' as const,
    ...BOX,
    xAxis: { domain: [0, 10] as [number, number] },
    colors: [RED],
  };
  const spec = scatterChart.spec({ ...props, shape: 'tick', r: 10, alpha: 0.6 });
  expect(spec.marks.map(m => [m.type, m.options])).toEqual([
    ['ticks', expect.objectContaining({ size: 10, alpha: 0.6, label: 'courier', color: RED })],
  ]);
  expect(scatterChart.spec({ ...props, shape: 'tick' }).marks[0]!.options).toMatchObject({ size: 4 });
  expect(scatterChart.spec({ ...props, shape: 'dot' }).marks[0]!.type).toBe('dots');
  for (const wrong of [{ r: 'late' }, { ring: 2 }])
    expect(() => scatterChart.spec({ ...props, ...wrong, shape: 'tick' } as never)).toThrow(
      /^scatterChart: .* does not apply to shape 'tick'/,
    );

  const el = host();
  const c = scatterChart(el, { ...props, r: 10 });
  hover(el, 20, 75);
  expect(tipRows(el)).toEqual(['courier: 2, North']);
  expect(isRed(el, 26, 75)).toBe(true);
  c.update({ shape: 'tick' });
  hover(el, 20, 75);
  expect(tipOf(el)()).toBe(false);
  expect(isRed(el, 26, 75)).toBe(false);
  const inked = (y: number) => [19, 20].some(x => pixel(el, x, y)[3]! > 0);
  expect([67, 75, 83].map(inked)).toEqual([true, true, true]);
  expect([61, 88].map(inked)).toEqual([false, false]);
  c.update({ r: 4 });
  expect([67, 75, 83].map(inked)).toEqual([false, true, false]);
});

test('types: errorBars check field names, and alpha and ring are for scatter', () => {
  const cols = { t: [1], v: [1], lo: [1], hi: [1], note: ['a'] };
  lineChart.spec({
    data: cols,
    x: 't',
    y: 'v',
    series: 'note',
    errorBars: { low: 'lo', high: 'hi', cap: 0 },
  });
  barChart.spec({ data: spans, y: 'mean', errorBars: { low: d => d.low, high: 'high', width: 2 } });
  lineChart.spec({ errorBars: { low: 'anything', high: 'anything' } });
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    lineChart.spec({ data: spans, errorBars: { low: 'nope', high: 'high' } });
    // @ts-expect-error a text field is not an end
    barChart.spec({ data: spans, errorBars: { low: 'low', high: 'dose' } });
    // @ts-expect-error a list is not an end
    scatterChart.spec({ data: spans, errorBars: { low: ['low'], high: 'high' } });
    // @ts-expect-error both ends are needed
    scatterChart.spec({ data: spans, errorBars: { low: 'low' } });
    // @ts-expect-error not a column
    lineChart.spec({ data: cols, errorBars: { low: 'nope', high: 'hi' } });
    // @ts-expect-error numbers have no fields to name
    lineChart.spec({ data: [1, 2], errorBars: { low: 'value', high: 'value' } });
    // @ts-expect-error an area chart has no error bars
    areaChart.spec({ data: spans, errorBars: { low: 'low', high: 'high' } });
    // @ts-expect-error a line has no ring
    lineChart.spec({ data: spans, ring: 2 });
    // @ts-expect-error bars have no alpha
    barChart.spec({ data: spans, alpha: 0.5 });
  };
  expect(wrong).toBeTypeOf('function');
});

const BOTH = days(3, i => ({ rain: 10 * (i + 1), sun: i + 1, wind: 6 - i }));
const axesOf = (o: Options) => o.marks.map(m => [m.label, m.yAxis ?? 'y']);

test('y2 adds series on a right-hand axis with its own settings, and its fields are not guessed for y', () => {
  for (const chart of [lineChart, areaChart, barChart, scatterChart]) {
    const spec = chart.spec({ data: BOTH, y: 'sun', y2: 'rain', y2Axis: { step: 10 }, colors: [RED, BLUE] });
    expect(axesOf(spec)).toEqual([
      ['sun', 'y'],
      ['rain', 'y2'],
    ]);
    expect(spec.marks.map(m => m.color)).toEqual([RED, BLUE]);
    expect(spec.y).toMatchObject({ label: 'sun', domain: 'nice' });
    expect(spec.y2).toEqual({ label: 'rain', domain: 'nice', step: 10 });
    expect(chart.spec({ data: BOTH, y: 'sun', y2Axis: { step: 10 } })).not.toHaveProperty('y2');
    expect(chart.spec({ data: BOTH, y: 'sun', y2: [] })).not.toHaveProperty('y2');
    expect(axesOf(chart.spec({ data: BOTH, y: 'sun', y2: ['rain', 'wind'] }))).toEqual([
      ['sun', 'y'],
      ['rain', 'y2'],
      ['wind', 'y2'],
    ]);
  }
  expect(axesOf(lineChart.spec({ data: BOTH, y2: 'rain' }))).toEqual([
    ['sun', 'y'],
    ['wind', 'y'],
    ['rain', 'y2'],
  ]);
  const noted = BOTH.map(d => ({ ...d, note: 'a' }));
  expect(axesOf(lineChart.spec({ data: noted, y: 'sun', y2: 'rain' }))).toEqual([
    ['sun', 'y'],
    ['rain', 'y2'],
  ]);
  const two = lineChart.spec({ data: BOTH, y: d => d.sun, y2: [d => d.rain, 'wind'] });
  expect(axesOf(two)).toEqual([
    ['y1', 'y'],
    ['y2', 'y2'],
    ['wind', 'y2'],
  ]);
  expect([(two.y as { label?: string }).label, two.y2!.label]).toEqual(['', '']);
  const el = host();
  lineChart(el, { data: BOTH, y: 'sun', y2: 'rain', y2Axis: { label: 'mm' }, width: 300, height: 200 });
  expect(entriesOf(el).map(e => e.textContent)).toEqual(['sun', 'rain']);
  expect(el.textContent).toContain('mm');
});

test('an accessor beside y2 is named apart from the columns y1 and y2', () => {
  const data = [{ x: 1, y1: 2, y2: 3 }];
  expect(axesOf(lineChart.spec({ data, x: 'x', y: d => d.y2, y2: 'y1' }))).toEqual([
    ['y2', 'y'],
    ['y1', 'y2'],
  ]);
  expect(axesOf(lineChart.spec({ data, x: 'x', y: 'y2', y2: d => d.y1 }))).toEqual([
    ['y2', 'y'],
    ['y3', 'y2'],
  ]);
  expect(axesOf(lineChart.spec({ data, x: 'x', y: [d => d.y2, d => d.x], y2: 'y1' }))).toEqual([
    ['y2', 'y'],
    ['y3', 'y'],
    ['y1', 'y2'],
  ]);
});

test('y2 errors name the chart, the fields and the props', () => {
  const bad = (props: object) => () => lineChart.spec({ data: BOTH, ...props } as never);
  expect(bad({ y: 'sun', y2: 'date' })).toThrow(/^lineChart: y2 "date" is time, not numbers/);
  expect(bad({ y: 'sun', y2: 'nope' })).toThrow(/no field "nope".*Pass y2 as one of these fields/);
  expect(bad({ y: 'sun', y2: () => 'a' })).toThrow(/the accessor y2 is text/);
  expect(bad({ y: ['sun', 'rain'], y2: 'rain' })).toThrow(/"rain" is named in both y and y2/);
  expect(() => areaChart.spec({ data: BOTH, y: 'sun', y2: ['rain', 'rain'], stack: true })).toThrow(
    /^areaChart: "rain" is named twice in y2.*Pass it once\.$/,
  );
  expect(bad({ y2: ['sun', 'rain', 'wind'] })).toThrow(/no field of numbers for y\./);
  expect(bad({ y: 'sun', y2: 'rain', series: 'wind' })).toThrow(/series and y2 do not go together/);
  expect(bad({ y: 'sun', y2: 'rain', errorBars: { low: 'wind', high: 'wind' } })).toThrow(
    /errorBars and y2 do not go together/,
  );
  expect(() => scatterChart.spec({ data: BOTH, y: 'sun', y2: 'rain', series: 'wind' })).toThrow(
    /^scatterChart: series and y2/,
  );
  const stacked = { y: 'sun', y2: 'rain', stack: true } as const;
  expect(() => barChart.spec({ data: BOTH, ...stacked })).toThrow(
    /^barChart: stack does not apply to bars on both y and y2\. Leave out stack or y2\.$/,
  );
  expect(() => barChart.spec({ data: null, y2: 'rain', stack: true })).not.toThrow();
  expect(lineChart.spec({ data: null, y2: 'rain' }).y2).toMatchObject({ label: 'rain' });
});

test('bars on both axes stand side by side, and areas stack within their axis only', () => {
  const box = { ...BOX, legend: false, colors: [RED, BLUE] };
  const bars = host();
  barChart(bars, {
    data: [{ name: 'a', p: 1, q: 30 }],
    y: 'p',
    y2: 'q',
    ...box,
    yAxis: { domain: [0, 4] },
    y2Axis: { domain: [0, 40] },
  });
  expect(tallShare(bars, 30, RED)).toBeCloseTo(0.25, 1);
  expect(tallShare(bars, 30, BLUE)).toBe(0);
  expect(tallShare(bars, 70, BLUE)).toBeCloseTo(0.75, 1);
  expect(tallShare(bars, 70, RED)).toBe(0);

  const areas = host();
  areaChart(areas, {
    data: days(5, () => ({ a: 1, b: 2, c: 10 })),
    y: ['a', 'b'],
    y2: 'c',
    stack: true,
    ...box,
    yAxis: { domain: [0, 4] },
    y2Axis: { domain: [0, 40] },
  });
  const filled = (y: number) => pixel(areas, 50, y)[3]! > 0;
  expect([20, 30, 60, 90].map(filled)).toEqual([false, true, true, true]);
  // The area on y2 is see-through, so the stack on y shows under it.
  expect(pixel(areas, 50, 90)).not.toEqual(pixel(areas, 50, 60));
  expect(areaChart.spec({ data: BOTH, y: 'sun', y2: 'rain', stack: true }).marks.map(m => m.options)).toEqual(
    [0, 1].map(() => expect.objectContaining({ stack: 'stack', alpha: 0.5 })),
  );
});

test('the tooltip gives each value in the format of its axis and follows a new y2 format', () => {
  const formats = {
    yAxis: { domain: [0, 4] as [number, number], format: (v: number) => `${v} h` },
    y2Axis: { domain: [0, 40] as [number, number], format: (v: number) => `${v} mm` },
  };
  const lines = host();
  const c = lineChart(lines, { data: BOTH, y: 'sun', y2: 'rain', ...BOX, legend: false, ...formats });
  hover(lines, 50, 50);
  expect(tipRows(lines)).toEqual(['2024-01-02', 'sun: 2 h', 'rain: 20 mm']);
  const { chart } = c;
  c.update({ y2Axis: { ...formats.y2Axis, format: v => `${v / 10} cm` } });
  expect(c.chart).toBe(chart);
  hover(lines, 50, 50);
  expect(tipRows(lines)).toEqual(['2024-01-02', 'sun: 2 h', 'rain: 2 cm']);

  const bars = host();
  const data = [{ name: 'a', p: 2, q: 30 }];
  barChart(bars, { data, y: 'p', y2: 'q', ...BOX, legend: false, ...formats });
  hover(bars, 30, 90);
  expect(tipRows(bars)).toEqual(['a · p: 2 h']);
  hover(bars, 70, 90);
  expect(tipRows(bars)).toEqual(['a · q: 30 mm']);

  const points = host();
  scatterChart(points, {
    data: [{ x: 5, p: 2, q: 30 }],
    x: 'x',
    y: 'p',
    y2: 'q',
    ...BOX,
    legend: false,
    xAxis: { domain: [0, 10] },
    ...formats,
  });
  hover(points, 50, 50);
  expect(tipRows(points)).toEqual(['p: 5, 2 h']);
  hover(points, 50, 25);
  expect(tipRows(points)).toEqual(['q: 5, 30 mm']);
});

test('y2 identity: an equal copy sends nothing, and a field moved between the axes moves', () => {
  const props = () => ({ data: BOTH, y: ['sun'] as const, y2: ['rain'] as const, y2Axis: { step: 10 } });
  const el = host();
  const c = lineChart(el, { ...BOX, ...props() });
  const update = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(update).not.toHaveBeenCalled();
  const fresh = (p: LineChartProps<typeof BOTH>) => {
    const one = host();
    lineChart(one, { ...BOX, ...p });
    return drawn(one);
  };
  c.update({ y: ['sun', 'rain'], y2: undefined, y2Axis: undefined });
  expect(drawn(el)).toBe(fresh({ data: BOTH, y: ['sun', 'rain'] }));
  c.update(props());
  expect(drawn(el)).toBe(fresh(props()));
});

test('a recreation carries a zoomed y2 window, and one fitted to the x window refits', async () => {
  const wide = (k: number) => days(9, i => ({ a: i, b: k * i * i }));
  const base = { y: 'a', y2: 'b', ...BOX, legend: false } as const;
  const onViewChange = vi.fn();
  const el = host();
  const c = lineChart(el, { data: wide(1), ...base, zoom: { axes: 'xy' }, onViewChange });
  await zoomIn(el);
  const zoomed = drawn(el);
  const view = onViewChange.mock.calls.at(-1)![0];
  expect(view.y2).toHaveLength(2);
  const { chart } = c;
  c.update({ zoom: true });
  expect(c.chart).not.toBe(chart);
  expect(drawn(el)).toBe(zoomed);
  const other = host();
  lineChart(other, { data: wide(1), ...base, view: { x: view.x, y: view.y } });
  expect(drawn(other)).not.toBe(zoomed);

  const fit = { ...base, y2Axis: { fit: 'window' as const } };
  const fitted = host();
  const f = lineChart(fitted, { data: wide(1), ...fit, zoom: true, onViewChange });
  await zoomIn(fitted);
  const { x, y2 } = onViewChange.mock.calls.at(-1)![0];
  expect(y2).toBeUndefined();
  f.update({ zoom: { axes: 'x' } });
  f.update({ data: wide(3.3) });
  const fresh = host();
  lineChart(fresh, { data: wide(3.3), ...fit, view: { x } });
  expect(drawn(fitted)).toBe(drawn(fresh));
});

test('types: y2 takes number fields of rows and columns', () => {
  const cols = { t: [1], v: [1], w: [1], note: ['a'] };
  lineChart.spec({ data: cols, x: 't', y: 'v', y2: ['w'], y2Axis: { format: String, fit: 'window' } });
  scatterChart.spec({ data: BOTH, y: 'sun', y2: ['rain', d => d.wind] });
  areaChart.spec({ y2: 'anything', y2Axis: { label: 'mm' } });
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    lineChart.spec({ data: BOTH, y2: 'nope' });
    // @ts-expect-error a text field is not drawn
    barChart.spec({ data: BOTH, y2: 'date' });
    // @ts-expect-error not a column of numbers
    areaChart.spec({ data: cols, y2: ['w', 'note'] });
    // @ts-expect-error numbers have no fields to name
    lineChart.spec({ data: [1, 2], y2: 'value' });
    // @ts-expect-error pairs have no second axis
    scatterChart.spec({ data: [[0, 1]], y2Axis: { label: 'mm' } });
    // @ts-expect-error y2Axis takes what yAxis takes
    lineChart.spec({ data: BOTH, y2: 'rain', y2Axis: { unit: 'day' } });
  };
  expect(wrong).toBeTypeOf('function');
});

const GROWTH = [
  { week: 1, users: 100, other: 10, low: 10, high: 1000 },
  { week: 2, users: 0, other: -1, low: 0, high: 10 },
  { week: 3, users: 1000, other: 1, low: 100, high: 10000 },
];
const LOG = { scale: 'log' } as const;

test("yAxis.scale 'log' draws through the core's log axis, with a gap at or below zero", () => {
  const format = (v: number) => `${v} users`;
  const spec = lineChart.spec({
    data: GROWTH,
    x: 'week',
    y: 'users',
    yAxis: { ...LOG, format, domain: [1, 1e4] },
  });
  expect(spec.y).toMatchObject({ base: 10, label: 'users', domain: [0, 4], format });
  expect(numbers(optionsOf(spec.marks[0]!).y)).toEqual([2, Number.NaN, 3]);
  expect(numbers(optionsOf(spec.marks[0]!).x)).toEqual([1, 2, 3]);
  expect(lineChart.spec({ data: GROWTH, y: 'users', yAxis: { scale: 'linear' } }).y).toEqual(
    lineChart.spec({ data: GROWTH, y: 'users' }).y,
  );

  for (const chart of [lineChart, scatterChart]) {
    const two = chart.spec({ data: GROWTH, x: 'week', y: 'users', y2: 'other', y2Axis: LOG });
    expect(two.y).not.toHaveProperty('base');
    expect(two.y2).toMatchObject({ base: 10, domain: 'nice' });
    expect(two.marks.map(m => numbers(optionsOf(m).y))).toEqual([
      [100, 0, 1000],
      [1, Number.NaN, 0],
    ]);
  }

  const el = host();
  const box = { ...BOX, legend: false, xAxis: { domain: [0, 4] as [number, number] } };
  const c = scatterChart(el, {
    data: GROWTH,
    x: 'week',
    y: 'users',
    ...box,
    yAxis: { ...LOG, format, domain: [1, 1e4] },
  });
  hover(el, 25, 50);
  expect(tipRows(el)).toEqual(['users: 1, 100 users']);
  c.update({ yAxis: { format, domain: [0, 200] } });
  hover(el, 25, 50);
  expect(tipRows(el)).toEqual(['users: 1, 100 users']);
  expect(tipOf(el)()).toBe(true);

  const twenty = {
    data: [
      { week: 1, users: 1, other: 20 },
      { week: 2, users: 20, other: 20 },
      { week: 3, users: 1, other: 20 },
    ],
    x: 'week',
    y: 'users',
    y2: 'other',
    ...box,
    yAxis: { ...LOG, format, domain: [1, 400] as [number, number] },
    y2Axis: { ...LOG, format, domain: [20, 2000] as [number, number] },
  } as const;
  const dotted = host();
  scatterChart(dotted, twenty);
  hover(dotted, 50, 50);
  expect(tipRows(dotted)).toEqual(['users: 2, 20 users']);
  const lined = host();
  lineChart(lined, twenty);
  hover(lined, 50, 50);
  expect(tipRows(lined)).toEqual(['2', 'users: 20 users', 'other: 20 users']);

  const precise = {
    ...twenty,
    data: [
      { week: 1, users: 20, other: 20 },
      { week: 2, users: 1.0000000000001, other: 20.000000000001 },
      { week: 2.5, users: 1.0000000000002, other: 21 },
      { week: 3, users: 20, other: 22 },
    ],
  } as const;
  const point = host();
  scatterChart(point, precise);
  hover(point, 50, 97);
  expect(tipRows(point)).toEqual(['users: 2, 1.0000000000001 users']);
  const exact = host();
  const path = lineChart(exact, precise);
  hover(exact, 50, 50);
  expect(tipRows(exact)).toEqual(['2', 'users: 1.0000000000001 users', 'other: 20.000000000001 users']);
  path.update({ curve: 'step' });
  hover(exact, 70, 50);
  expect(tipRows(exact)!.slice(1)).toEqual(['users: 1.0000000000002 users', 'other: 21 users']);
});

test('a log scale throws on areas and bars, with a step, and with a domain that is not above zero', () => {
  const bad = (chart: typeof areaChart | typeof barChart, props: object) => () =>
    chart.spec({ data: GROWTH, x: 'week', y: 'users', ...props } as never);
  expect(bad(areaChart, { yAxis: LOG })).toThrow(/^areaChart: yAxis.scale 'log' does not apply/);
  expect(bad(barChart, { yAxis: LOG })).toThrow(/^barChart: yAxis.scale 'log' does not apply/);
  expect(bad(barChart, { y2: 'other', y2Axis: LOG })).toThrow(/^barChart: y2Axis.scale 'log'/);
  expect(() => lineChart.spec({ data: GROWTH, yAxis: { ...LOG, step: 10 } })).toThrow(
    /^lineChart: yAxis.step does not apply to a log scale/,
  );
  expect(() => scatterChart.spec({ data: GROWTH, y2: 'other', y2Axis: { ...LOG, step: 10 } })).toThrow(
    /^scatterChart: y2Axis.step/,
  );
  for (const domain of [
    [0, 10],
    [1, Infinity],
  ] as [number, number][])
    expect(() => lineChart.spec({ data: GROWTH, yAxis: { ...LOG, domain } })).toThrow(
      /^lineChart: yAxis.domain must be above zero/,
    );
});

test('a y rule, a y zone and error bars on a log axis land at the logarithm of their values', () => {
  const { marks } = lineChart.spec({
    data: GROWTH,
    x: 'week',
    y: 'users',
    errorBars: SPREAD,
    yAxis: LOG,
    rules: [{ y: 1000 }, { x: 2 }, { y: 0 }],
    zones: [{ y: [10, 100] }, { x: [1, 2] }, { y: [0, 100] }],
  });
  const [band, along, open, errors, , up, across, none] = marks.map(
    m => m.options as Record<string, number & Col>,
  );
  expect([band!.y1, band!.y2]).toEqual([1, 2]);
  expect([along!.x1, along!.x2]).toEqual([1, 2]);
  expect([open!.y1, open!.y2]).toEqual([-Infinity, 2]);
  expect([numbers(errors!.y1!), numbers(errors!.y2!)]).toEqual([
    [1, Number.NaN, 2],
    [3, 1, 4],
  ]);
  expect([up!.y, across!.x, none!.y]).toEqual([3, 2, Number.NaN]);

  const el = host();
  lineChart(el, {
    data: GROWTH,
    x: 'week',
    y: 'users',
    ...BOX,
    yAxis: { ...LOG, domain: [1, 100] },
    zones: [{ y: [0, 10], color: PURE }],
  });
  expect([pixel(el, 50, 25)[3], pixel(el, 50, 75)[3]! > 0]).toEqual([0, true]);
});

test('rules and zones are marks with keys, zones under the data and rules over it, in no legend and no guess', () => {
  for (const chart of [lineChart, areaChart, barChart, scatterChart]) {
    const props = {
      data: BOTH,
      y: 'sun',
      y2: 'rain',
      rules: [
        { y: 2, text: 'two', dashed: true, color: RED },
        { y: 1, text: undefined },
      ],
      zones: [{ y: [1, 2], text: 'between', color: BLUE }, { y: [2, 1] }],
    } as const;
    const spec = chart.spec(props);
    const plain = chart.spec({ data: BOTH, y: 'sun', y2: 'rain' });
    expect(spec.marks.map(m => m.key)).toEqual([
      'zone:0',
      'zone:1',
      ...plain.marks.map(m => m.key),
      'rule:0',
      'rule:1',
    ]);
    expect(spec.marks.slice(2, 4).map(m => m.options)).toEqual(plain.marks.map(m => m.options));
    expect(spec.marks.map(m => m.type).filter(t => t === 'zone' || t === 'rule')).toHaveLength(4);
    expect(spec.marks.filter(m => m.label).map(m => m.label)).toEqual(['sun', 'rain']);
    expect(spec.marks[4]!.options).toEqual({ key: 'rule:0', y: 2, text: 'two', dashed: true, color: RED });
    expect(spec.marks[5]!.options).toEqual({ key: 'rule:1', y: 1, color: light.text });
    expect(spec.marks[0]!.options).toEqual({ key: 'zone:0', y1: 1, y2: 2, text: 'between', color: BLUE });
    expect(spec.marks[1]!.options).toEqual({ key: 'zone:1', y1: 2, y2: 1, color: light.muted });
    expect(chart.spec({ ...props, theme: 'dark' }).marks[5]!.color).toBe(dark.text);
    expect(chart.spec({ ...props, data: null }).marks).toHaveLength(4);
    expect(() => chart.spec({ data: BOTH, y: 'sun', rules: [{ text: 'x' }] } as never)).toThrow(
      /^\w+Chart: rules\[0\] takes x or y/,
    );
    expect(() => chart.spec({ data: BOTH, y: 'sun', zones: [{ text: 'x' }] } as never)).toThrow(
      /^\w+Chart: zones\[0\] takes x or y/,
    );
  }
  const one = host();
  lineChart(one, { data: days(3, i => ({ v: i })), width: 300, height: 200, rules: [{ y: 1, text: 'one' }] });
  expect(entriesOf(one)).toEqual([]);
  expect(one.textContent).toContain('one');
});

test('the x of a rule or a zone is a number, a date as the data writes them, or a category', () => {
  const at = (o: Options) =>
    o.marks
      .filter(m => m.type === 'rule' || m.type === 'zone')
      .map(m => m.options as { x?: number; x1?: number; x2?: number })
      .map(({ x, x1, x2 }) => x ?? [x1, x2]);
  const day = Date.UTC(2024, 0, 2);
  const dated = {
    rules: [{ x: '2024-01-02' }, { x: new Date(day) }, { x: day }, { x: 'nope' }],
    zones: [{ x: ['2024-01-02', new Date(day + 5)] }],
  } as const;
  expect(at(lineChart.spec({ data: BOTH, y: 'sun', ...dated }))).toEqual([
    [day, day + 5],
    day,
    day,
    day,
    Number.NaN,
  ]);
  expect(
    at(lineChart.spec({ data: BOTH, y: 'sun', xAxis: { utc: false }, rules: [{ x: '2024-01-02' }] })),
  ).toEqual([new Date(2024, 0, 2).getTime()]);
  expect(at(barChart.spec({ data: BOTH, y: 'sun', rules: dated.rules }))).toEqual([1, 1, 1, Number.NaN]);
  const midnights = ['2024-01-01', '2024-01-02'].map(date => ({ date, kind: 1, v: 1 }));
  for (const series of [undefined, 'kind'] as const)
    expect(
      at(
        barChart.spec({
          data: midnights,
          x: 'date',
          y: 'v',
          ...(series && { series }),
          rules: [{ x: '2024-01-01T12:00' }, { x: new Date(Date.UTC(2024, 0, 2)) }],
          zones: [{ x: ['2024-01-01', '2024-01-02T12:00'] }],
        } as never),
      ),
    ).toEqual([[Number.NaN, Number.NaN], Number.NaN, 1]);

  const named = { rules: [{ x: 'some' }, { x: 'nope' }], zones: [{ x: ['much', 'some'] }] } as const;
  for (const chart of [lineChart, barChart, scatterChart, areaChart])
    expect(at(chart.spec({ data: spans, x: 'dose', y: 'mean', ...named }))).toEqual([
      [0.5, 2.5],
      1,
      Number.NaN,
    ]);
  const years = [
    { year: 2019, v: 1 },
    { year: 2020, v: 2 },
  ];
  expect(
    at(
      barChart.spec({
        data: years,
        x: 'year',
        y: 'v',
        rules: [{ x: 2020 }],
        zones: [{ x: [2019, 2020] }],
      }),
    ),
  ).toEqual([[-0.5, 1.5], 1]);
  expect(at(lineChart.spec({ data: [], ...named }))).toEqual([
    [Number.NaN, Number.NaN],
    Number.NaN,
    Number.NaN,
  ]);
});

test('lineChart passes fill to the line; an equal copy of fill, rules, zones and a log scale sends nothing', () => {
  expect(lineChart.spec({ data: BOTH, y: 'sun' }).marks[0]!.options).not.toHaveProperty('fill');
  const fade = gradient(0.4, 0);
  for (const fill of [true, fade])
    expect(lineChart.spec({ data: BOTH, y: 'sun', fill }).marks[0]!.options).toMatchObject({ fill });
  const props = () => ({
    data: BOTH,
    y: 'sun' as const,
    fill: gradient(0.4, 0),
    yAxis: { scale: 'log' as const },
    rules: [{ x: '2024-01-02', text: 'here' }],
    zones: [{ y: [1, 2] as const }],
    brush: { axes: 'xy' as const },
  });
  const el = host();
  const c = lineChart(el, { ...BOX, ...props(), theme: 'light' });
  const { chart } = c;
  const update = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(update).not.toHaveBeenCalled();
  for (const change of [
    { fill: true },
    { rules: [{ x: '2024-01-03', text: 'here' }] },
    { zones: [] },
    { rules: undefined },
  ]) {
    c.update(change);
    expect(update).toHaveBeenCalledTimes(1);
    expect(Object.keys(update.mock.calls[0]![0])).toEqual(['marks']);
    update.mockClear();
  }
  expect(c.chart).toBe(chart);
});

test('brush reports the range to the newest onBrush, and only a change of brush recreates the chart', () => {
  const calls = [vi.fn(), vi.fn(), vi.fn()];
  for (const chart of [lineChart, areaChart, barChart, scatterChart]) {
    calls.forEach(f => f.mockClear());
    const el = host();
    const box = { ...BOX, legend: false, yAxis: { domain: [0, 10] as [number, number] } };
    const c = chart(el, { data: BOTH, y: 'sun', ...box, brush: true, onBrush: calls[0] });
    const { chart: first } = c;
    const update = vi.spyOn(c.chart, 'update');
    c.update({ onBrush: calls[1] });
    c.update({ brush: true, onBrush: calls[2] });
    expect(c.chart).toBe(first);
    expect(update).not.toHaveBeenCalled();
    drag(el, [20, 50], [80, 50]);
    expect(calls.map(f => f.mock.calls.length)).toEqual([0, 0, 1]);
    const { x, y } = calls[2]!.mock.calls[0]![0];
    expect(y).toEqual([0, 10]);
    expect(x[0]).toBeLessThan(x[1]);

    c.update({ brush: { axes: 'y' } });
    expect(c.chart).not.toBe(first);
    calls[2]!.mockClear();
    drag(el, [50, 80], [50, 20]);
    const [low, high] = calls[2]!.mock.calls.at(-1)![0].y;
    expect(low).toBeCloseTo(2, 0);
    expect(high).toBeCloseTo(8, 0);
    calls[2]!.mockClear();
    c.update({ brush: undefined });
    drag(el, [50, 80], [50, 20]);
    expect(calls[2]).not.toHaveBeenCalled();
  }
});

test('with zoom a release of the brush shows the range brushed, and a spec holds no onBrush', () => {
  const [onBrush, onViewChange] = [vi.fn(), vi.fn()];
  const data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const base = { data, ...BOX, brush: true, onBrush, onViewChange } as const;
  const zoomed = host();
  lineChart(zoomed, { ...base, zoom: true });
  drag(zoomed, [20, 50], [60, 50]);
  expect(onBrush).toHaveBeenCalledTimes(1);
  const { x } = onBrush.mock.calls[0]![0];
  expect(x[0]).toBeCloseTo(2, 0);
  expect(x[1]).toBeCloseTo(6, 0);
  expect(onViewChange.mock.calls[0]![0].x).toEqual(x);

  onViewChange.mockClear();
  const still = host();
  lineChart(still, base);
  drag(still, [20, 50], [60, 50]);
  expect(onViewChange).not.toHaveBeenCalled();
  expect(lineChart.spec(base)).not.toHaveProperty('onBrush');
  expect(lineChart.spec(base).use).toHaveLength(2);
});

test('a recreation that fails leaves the old brush reporting to the old onBrush', () => {
  const [was, now] = [vi.fn(), vi.fn()];
  const el = host();
  const c = lineChart(el, { data: BOTH, y: 'sun', ...BOX, brush: true, onBrush: was });
  const boom = () => {
    throw new Error('boom');
  };
  expect(() => c.update({ zoom: true, onBrush: now, yAxis: { format: boom } })).toThrow('boom');
  drag(el, [20, 50], [80, 50]);
  expect([was.mock.calls.length, now.mock.calls.length]).toEqual([1, 0]);
});

test('types: a log scale is for line and scatter, fill for line, and a rule takes x or y', () => {
  scatterChart.spec({ data: BOTH, yAxis: LOG, y2: 'rain', y2Axis: LOG });
  lineChart.spec({
    data: [1, 2],
    yAxis: LOG,
    rules: [{ y: 1 }],
    zones: [{ x: [0, 1] }],
    brush: true,
    fill: true,
  });
  lineChart.spec({ data: [[0, 1]], onBrush: range => range?.x[0].toFixed() });
  const wrong = () => {
    // @ts-expect-error an area starts at zero
    areaChart.spec({ data: BOTH, yAxis: LOG });
    // @ts-expect-error a bar starts at zero
    barChart.spec({ data: BOTH, yAxis: LOG });
    // @ts-expect-error a rule is on one axis
    lineChart.spec({ data: BOTH, rules: [{ x: 1, y: 1 }] });
    // @ts-expect-error a zone has two edges
    lineChart.spec({ data: BOTH, zones: [{ y: 1 }] });
    // @ts-expect-error dots have no fill
    scatterChart.spec({ data: BOTH, fill: true });
    // @ts-expect-error not an axis
    barChart.spec({ data: BOTH, brush: { axes: 'z' } });
  };
  expect(wrong).toBeTypeOf('function');
});

const DAY = 864e5;
const XS = Float64Array.from({ length: 11 }, (_, i) => i * DAY);
const HALF = new Float64Array(11).fill(0.5);
const QUARTER = new Float64Array(11).fill(0.25);
const grab: Feature = c => ((grabbed = c), { destroy() {} });
const twoLines = (a = RED, b = BLUE) => [
  line({ key: 'a', label: 'a', x: XS, y: HALF, color: a, width: 4 }),
  line({ key: 'b', label: 'b', x: XS, y: QUARTER, color: b, width: 4 }),
];
const explicit = (): Options => ({
  width: 200,
  height: 100,
  margin: ZERO,
  x: time({ label: '' }),
  y: { domain: [0, 1], label: '' },
  marks: [line({ key: 'a', label: 'a', x: XS, y: HALF, color: RED, width: 4 })],
});

test('mount draws what plot draws, draws new marks, exposes the core chart and is gone after destroy', () => {
  const [a, b] = [host(), host()];
  const m = mount(a, { ...explicit(), use: [legend()] });
  plot(b, { ...explicit(), use: [legend()] });
  expect(drawn(a)).toBe(drawn(b));
  expect(a.textContent).toBe(b.textContent);
  expect(shows(a, RED)).toBe(true);
  const spy = vi.spyOn(m.chart, 'update');
  m.update({ marks: [line({ key: 'a', label: 'a', x: XS, y: QUARTER, color: BLUE, width: 4 })] });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(shows(a, BLUE)).toBe(true);
  expect(shows(a, RED)).toBe(false);
  m.destroy();
  expect(a.childElementCount).toBe(0);
  m.update({ marks: [] });
  expect(a.childElementCount).toBe(0);
});

test('mount sends nothing for an equal copy of the options, so a tapped tooltip stays', () => {
  const el = host();
  const m = mount(el, { ...explicit(), use: [tooltip({ mode: 'x', title: String, value: String })] });
  const spy = vi.spyOn(m.chart, 'update');
  m.update(explicit());
  m.update({ ...explicit(), x: { ...explicit().x! }, y: { domain: [0, 1], label: '' } });
  expect(spy).not.toHaveBeenCalled();
  tap(el, 100, 50);
  const shown = tipOf(el);
  expect(shown()).toBe(true);
  m.update(explicit());
  expect(shown()).toBe(true);
});

test('mount keeps an uncontrolled window and hidden series, sends given state and drops it once undefined', async () => {
  const el = host();
  const m = mount(el, { ...explicit(), marks: twoLines(), use: [zoom(), legend(), grab] });
  await zoomIn(el);
  const zoomed = grabbed.view().x;
  narrower(zoomed, grabbed.domain().x);
  hideFirst(el);
  expect(grabbed.hidden()).toEqual(['a']);
  m.update({ marks: twoLines(BLUE, RED) });
  expect(grabbed.view().x).toEqual(zoomed);
  expect(grabbed.hidden()).toEqual(['a']);
  const spy = vi.spyOn(m.chart, 'update');
  const view = { x: [2 * DAY, 4 * DAY] as [number, number] };
  m.update({ view, hidden: ['b'] });
  expect(keysOf(spy)).toEqual([['hidden', 'view']]);
  expect(grabbed.view().x).toEqual(view.x);
  expect(grabbed.hidden()).toEqual(['b']);
  m.update({ view: undefined, hidden: undefined, marks: twoLines() });
  expect(keysOf(spy).at(-1)).toEqual(['marks']);
  expect(grabbed.view().x).toEqual(view.x);
  m.update({ view, hidden: ['b'] });
  expect(keysOf(spy).at(-1)).toEqual(['hidden', 'view']);
});

test('mount sends an option set to undefined, so the core goes back to its default', () => {
  const [el, ref] = [host(), host()];
  const m = mount(el, { ...explicit(), dim: 0.5, x: { domain: [0, 100 * DAY], label: '' } });
  const spy = vi.spyOn(m.chart, 'update');
  m.update({ dim: undefined });
  m.update({ x: undefined });
  expect(spy.mock.calls.map(([o]) => Object.entries(o))).toEqual([[['dim', undefined]], [['x', undefined]]]);
  plot(ref, { ...explicit(), x: undefined });
  expect(drawn(el)).toBe(drawn(ref));
});

test('mount reads use once and takes the theme as given, light when there is none, with no media listener', () => {
  const el = host();
  const m = mount(el, { ...explicit(), use: [grab] });
  const root = el.firstElementChild;
  const spy = vi.spyOn(m.chart, 'update');
  m.update({ use: [zoom()] });
  expect(spy).not.toHaveBeenCalled();
  expect(el.firstElementChild).toBe(root);
  expect(el.childElementCount).toBe(1);

  const { spy: media } = mockMedia(true);
  const watching = () => media.mock.calls.filter(([q]) => q === '(prefers-color-scheme: dark)').length;
  const darkPage = schemed('dark');
  mount(darkPage, { ...explicit(), use: [grab] });
  expect(grabbed.theme()).toBe(light);
  mount(schemed('light dark'), { ...explicit(), use: [grab] });
  expect(grabbed.theme()).toBe(light);
  const both = schemed('light dark');
  const given = mount(both, { ...explicit(), theme: dark, use: [grab] });
  expect(grabbed.theme()).toBe(dark);
  given.update({ marks: twoLines() });
  expect(grabbed.theme()).toBe(dark);
  given.update({ theme: undefined });
  expect(grabbed.theme()).toBe(light);
  expect(watching()).toBe(0);
});

test('equal compares plain objects and arrays by value and anything else by identity', () => {
  const f = () => 0;
  const typed = new Float64Array([1]);
  expect(equal({ a: [1, { b: 2 }], f }, { a: [1, { b: 2 }], f })).toBe(true);
  expect(equal(Object.assign(Object.create(null), { a: 1 }), { a: 1 })).toBe(true);
  expect(equal({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  expect(equal({ a: undefined }, { b: undefined })).toBe(false);
  expect(equal([1, 2], { 0: 1, 1: 2 })).toBe(false);
  expect(equal(typed, typed)).toBe(true);
  expect(equal(typed, new Float64Array([1]))).toBe(false);
  expect(
    equal(
      () => 0,
      () => 0,
    ),
  ).toBe(false);
  expect(equal(dark, { ...dark })).toBe(true);
  expect(equal(new Date(0), new Date(0))).toBe(false);
  expect(equal(NaN, NaN)).toBe(true);
  expect(equal([], Array(1))).toBe(false);
  const holed = [1];
  holed.length = 2;
  expect(equal([1], holed)).toBe(false);
  const cycle = (leaf: number) => {
    const o: Record<string, unknown> = { leaf };
    o.self = o;
    o.list = [o];
    return o;
  };
  expect(equal(cycle(1), cycle(1))).toBe(true);
  expect(equal(cycle(1), cycle(2))).toBe(false);
});

test('mount installs a mark whose key alone changed and prepares it', () => {
  const el = host();
  const m = mount(el, explicit());
  const old = explicit().marks[0]!;
  const prepare = vi.fn((...a: Parameters<Mark['prepare']>) => old.prepare(...a));
  const spy = vi.spyOn(m.chart, 'update');
  m.update({ marks: [{ ...old, key: 'replacement', prepare }] });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalled();
});

const capture = (o: unknown) =>
  typeof o === 'boolean' ? o : !!(o as AddEventListenerOptions | undefined)?.capture;
/** The document listeners added since the call and not removed since, by type, handler and capture. */
const documentListeners = () => {
  const add = vi.spyOn(document, 'addEventListener');
  const remove = vi.spyOn(document, 'removeEventListener');
  return {
    added: () => add.mock.calls.length,
    left: () => {
      const left = add.mock.calls.map(([t, f, o]) => [t, f, capture(o)] as const);
      for (const [t, f, o] of remove.mock.calls) {
        const i = left.findIndex(([a, b, c]) => a === t && b === f && c === capture(o));
        if (i >= 0) left.splice(i, 1);
      }
      return left;
    },
  };
};
const throwing: Mark = {
  type: 'throwing',
  key: 'throwing',
  label: 'throwing',
  color: RED,
  options: {},
  points: 0,
  channels: { x: [], y: [] },
  prepare: () => {
    throw new Error('boom');
  },
};
const boom = () => {
  throw new Error('boom');
};
type Pair = { x: number; a: number; b: number };

test('props rebuilt on every call with equal values read no column again and send nothing', () => {
  let reads = 0;
  const x = (d: Pair) => (reads++, d.x);
  const data = pair();
  const props = (): LineChartProps<Pair[]> => ({
    data,
    x,
    y: ['a', 'b'],
    xAxis: { label: 'x' },
    yAxis: { label: 'v' },
    colors: [RED, BLUE],
    ...BOX,
  });
  const c = lineChart(host(), props());
  const r = reads;
  expect(r).toBeGreaterThan(0);
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  c.update(props());
  expect(reads).toBe(r);
  expect(spy).not.toHaveBeenCalled();
});

test('a prop removed by an update goes back to what the chart does without it', async () => {
  const el = host();
  const like = (p: LineChartProps<Pair[]>) => {
    const ref = host();
    const r = lineChart(ref, p);
    expect(drawn(el)).toBe(drawn(ref));
    expect(el.textContent).toBe(ref.textContent);
    r.destroy();
    ref.remove();
  };
  const data = pair();
  const c = lineChart(el, { data, ...BOX, zoom: true, y: 'a', xAxis: { domain: [0, 20] } });
  const zoomed = c.chart;
  c.update({ zoom: undefined });
  expect(c.chart).not.toBe(zoomed);
  const before = drawn(el);
  await zoomIn(el);
  expect(drawn(el)).toBe(before);
  like({ data, ...BOX, y: 'a', xAxis: { domain: [0, 20] } });
  c.update({ y: undefined });
  like({ data, ...BOX, xAxis: { domain: [0, 20] } });
  c.update({ xAxis: undefined });
  like({ data, ...BOX });
  c.update({ data: undefined });
  like({ ...BOX });
});

test('a new inline callback on every call prepares and paints nothing, and the newest one is called', async () => {
  const fns = () => ({
    onClick: vi.fn(),
    onViewChange: vi.fn(),
    onHiddenChange: vi.fn(),
    onPointerChange: vi.fn(),
  });
  const props = (f: ReturnType<typeof fns>): TestProps => ({
    data: pair(),
    y: ['a', 'b'],
    zoom: true,
    legend: true,
    ...f,
  });
  const data = pair();
  const first = fns();
  const { el, c } = easy({ ...props(first), data });
  const [p, q] = [prepares, paints];
  const calls = [fns(), fns(), fns()];
  for (const f of calls) c.update({ ...props(f), data });
  expect([prepares, paints]).toEqual([p, q]);
  const newest = calls.at(-1)!;
  await zoomIn(el);
  hideFirst(el);
  hover(el, 50, 60);
  click(el, 50, 60);
  for (const k of Object.keys(newest) as (keyof typeof newest)[]) {
    expect(newest[k]).toHaveBeenCalled();
    for (const f of [first, ...calls.slice(0, -1)]) expect(f[k]).not.toHaveBeenCalled();
  }
});

test('a failed first lineChart leaves nothing behind, and good props on the same element draw', () => {
  const { media } = mockMedia(false);
  const el = schemed('light dark');
  expect(() => lineChart(el, { data: pair(), y: 'nope' as 'a', ...BOX })).toThrow(/no field "nope"/);
  expect(el.childElementCount).toBe(0);
  expect(media.listeners.size).toBe(0);
  lineChart(el, { data: pair(), ...BOX });
  expect(el.childElementCount).toBe(1);
  expect(shows(el, palette[0]!)).toBe(true);
});

test('create, destroy and create again on one element leave one root and one set of listeners', () => {
  const { media } = mockMedia(false);
  const el = schemed('light dark');
  const props: LineChartProps<Pair[]> = { data: pair(), y: ['a', 'b'], legend: true, ...BOX };
  const once = documentListeners();
  const baseline = lineChart(schemed('light dark'), props);
  const one = once.left().length;
  expect(one).toBeGreaterThan(0);
  const watched = media.listeners.size;
  baseline.destroy();
  vi.restoreAllMocks();
  const { media: again } = mockMedia(false);
  const docs = documentListeners();
  lineChart(el, props).destroy();
  const survivor = lineChart(el, props);
  expect(el.childElementCount).toBe(1);
  expect(docs.left()).toHaveLength(one);
  expect(again.listeners.size).toBe(watched);
  survivor.destroy();
});

test('a failed first draw destroys the features, removes their listeners and only its own root', () => {
  for (const draw of [plot, mount] as const) {
    const el = host();
    const other = el.appendChild(document.createElement('p'));
    let destroyed = 0;
    const observed: Feature = () => ({ destroy: () => void destroyed++ });
    const docs = documentListeners();
    expect(() =>
      draw(el, {
        ...explicit(),
        marks: [...twoLines(), throwing],
        use: [tooltip({ mode: 'x', title: String, value: String }), legend(), observed],
      }),
    ).toThrow('boom');
    expect(docs.added()).toBeGreaterThanOrEqual(2);
    expect(docs.left()).toEqual([]);
    expect(destroyed).toBe(1);
    expect([...el.children]).toEqual([other]);
    vi.restoreAllMocks();
  }
});

test('a failed first draw runs every cleanup when one throws and rethrows the draw error', () => {
  const el = host();
  const other = el.appendChild(document.createElement('p'));
  let destroyed = 0;
  const failing: Feature = () => ({
    destroy: () => {
      throw new Error('cleanup');
    },
  });
  const observed: Feature = () => ({ destroy: () => void destroyed++ });
  const docs = documentListeners();
  expect(() =>
    plot(el, { ...explicit(), marks: [...twoLines(), throwing], use: [failing, legend(), observed] }),
  ).toThrow('boom');
  expect(destroyed).toBe(1);
  expect(docs.left()).toEqual([]);
  expect([...el.children]).toEqual([other]);
});

test('a plot whose density query throws unwinds the observer and listeners it set up', () => {
  const el = host();
  const other = el.appendChild(document.createElement('p'));
  const docs = documentListeners();
  const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
  const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
  vi.spyOn(window, 'matchMedia').mockImplementation(() => {
    throw new Error('no media');
  });
  expect(() =>
    plot(el, { ...explicit(), width: undefined, height: undefined, marks: twoLines(), use: [legend()] }),
  ).toThrow('no media');
  expect(observe).toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalled();
  expect(docs.left()).toEqual([]);
  expect([...el.children]).toEqual([other]);
});

test('a mount whose rollback fails before its features start restores the series hidden before the failure', () => {
  const el = host();
  let inits = 0;
  const flaky: Feature = () => {
    if (++inits === 2) throw new Error('flaky');
    return { destroy() {} };
  };
  const good = (): Options => ({ ...explicit(), marks: twoLines(), use: [flaky, legend(), grab] });
  const m = mount(el, good());
  hideFirst(el);
  expect(() => m.update({ hidden: ['b'], marks: [throwing] })).toThrow('boom');
  expect(el.childElementCount).toBe(0);
  m.update(good());
  expect(grabbed.hidden()).toEqual(['a']);
  expect(shows(el, RED)).toBe(false);
  expect(shows(el, BLUE)).toBe(true);
});

test('a mark release that throws while features are recreated fails the update and keeps a live chart', () => {
  const el = host();
  let releases = 0;
  const leaky: Mark = {
    ...throwing,
    prepare: () => ({ paint() {} }),
    release: () => {
      if (++releases === 1) throw new Error('release');
    },
  };
  const c = create<TestProps>(el, {}, p => ({
    options: { ...explicit(), marks: [...twoLines(), leaky] },
    features: { zoom: p.zoom },
    use: () => [...(p.zoom ? [zoom()] : []), grab],
  }));
  expect(() => c.update({ zoom: true })).toThrow('release');
  expect(releases).toBe(1);
  expect(el.childElementCount).toBe(1);
  expect(shows(el, RED)).toBe(true);
  c.destroy();
  expect(el.childElementCount).toBe(0);
});

test('a mount whose rollback fails plots again on the next update, even an unchanged one', () => {
  const el = host();
  let inits = 0;
  const flaky: Feature = () => {
    if (++inits === 2) throw new Error('flaky');
    return { destroy() {} };
  };
  const good = (): Options => ({ ...explicit(), marks: twoLines(), use: [flaky, grab] });
  const m = mount(el, good());
  expect(() => m.update({ marks: [throwing] })).toThrow('boom');
  expect(inits).toBe(2);
  expect(el.childElementCount).toBe(0);
  m.update(good());
  expect(inits).toBe(3);
  expect(el.childElementCount).toBe(1);
  expect(shows(el, RED)).toBe(true);
  const live = m.chart;
  m.update({ ...good(), marks: twoLines(BLUE, BLUE) });
  expect(m.chart).toBe(live);
  expect(shows(el, RED)).toBe(false);
  m.destroy();
  expect(el.childElementCount).toBe(0);
});

test('a lineChart whose first tick layout throws removes the listeners and only its own root', () => {
  const el = host();
  const other = el.appendChild(document.createElement('p'));
  const docs = documentListeners();
  expect(() =>
    lineChart(el, { data: pair(), y: ['a', 'b'], legend: true, xAxis: { format: boom }, ...BOX }),
  ).toThrow('boom');
  expect(docs.added()).toBeGreaterThanOrEqual(2);
  expect(docs.left()).toEqual([]);
  expect([...el.children]).toEqual([other]);
});

test('a failed update recovers: the last good options draw, answer hits and keep the window and hidden series', async () => {
  const el = host();
  el.style.cssText = 'width:200px;height:100px';
  const onPointerChange = vi.fn();
  const r = new Float64Array(11).fill(3);
  const good = (): Options => ({
    ...explicit(),
    onPointerChange,
    width: undefined,
    height: undefined,
    marks: [...twoLines(), dots({ label: 'b', x: XS, y: QUARTER, r, color: BLUE })],
    use: [zoom(), legend(), grab],
  });
  const m = mount(el, good());
  await zoomIn(el);
  const zoomed = grabbed.view().x;
  narrower(zoomed, grabbed.domain().x);
  hideFirst(el);
  expect(() => m.update({ marks: [throwing] })).toThrow('boom');
  const spy = vi.spyOn(m.chart, 'update');
  m.update(good());
  expect(spy).not.toHaveBeenCalled();
  expect(el.childElementCount).toBe(1);
  expect(grabbed.view().x).toEqual(zoomed);
  expect(grabbed.hidden()).toEqual(['a']);
  expect(shows(el, BLUE)).toBe(true);
  expect(shows(el, RED)).toBe(false);
  hover(el, 100, 75);
  expect(onPointerChange).toHaveBeenLastCalledWith(expect.objectContaining({ x: expect.any(Number) }));
  expect(grabbed.hit(100, 75, 100)?.mark.label).toBe('b');
  el.style.width = '300px';
  await nextFrame();
  await nextFrame();
  expect(el.querySelector('canvas')!.style.width).toBe('300px');
  expect(grabbed.view().x).toEqual(zoomed);
  expect(grabbed.hidden()).toEqual(['a']);
  expect(shows(el, BLUE)).toBe(true);
  expect(() => m.update({ marks: [throwing] })).toThrow('boom');
});

test('a failed update rolls back to a controlled view it dropped and to a pointer kept after its prop was dropped', () => {
  const el = host();
  const view = { x: [2 * DAY, 6 * DAY] as [number, number] };
  const m = mount(el, { ...explicit(), marks: twoLines(), view, pointer: { x: 5 * DAY }, use: [grab] });
  m.update({ pointer: undefined });
  expect(grabbed.pointer()).not.toBeNull();
  expect(() => m.update({ view: undefined, marks: [throwing] })).toThrow('boom');
  expect(grabbed.view().x).toEqual(view.x);
  expect(grabbed.pointer()).not.toBeNull();
});

type Visit = { source: string; visits: number; share: number | null };
const visits = (): Visit[] => [
  { source: 'search', visits: 1, share: 4 },
  { source: 'direct', visits: 1, share: null },
];
const partCharts = [
  ['pieChart', pieChart, 'arcs', 'polar'],
  ['funnelChart', funnelChart, 'funnel', 'blank'],
  ['radialBarChart', radialBarChart, 'radialBars', 'polar'],
] as const;
type PartOptions = { values: Col; labels?: string[]; colors: string[] };
const partOf = (o: Options) => {
  expect(o.marks).toHaveLength(1);
  const { type, label, options } = o.marks[0]!;
  const { values: v, labels, colors, ...rest } = options as PartOptions & Record<string, unknown>;
  return { type, label, values: Array.from(v), labels, colors, rest };
};

test.each(partCharts)('%s picks label and value: named, guessed or positional', (_, chart, type, frame) => {
  const rows = visits();
  const guessed = chart.spec({ data: rows.map(({ source: s, visits: v }) => ({ v, s })) });
  expect(guessed).toMatchObject({ frame });
  expect(guessed).not.toHaveProperty('x');
  expect(partOf(guessed)).toMatchObject({ type, label: 'v', values: [1, 1], labels: ['search', 'direct'] });
  expect(partOf(chart.spec({ data: rows, value: 'visits' }))).toMatchObject({
    label: 'visits',
    labels: ['search', 'direct'],
  });
  expect(partOf(chart.spec({ data: rows, value: 'share', label: 'visits' }))).toMatchObject({
    values: [4, NaN],
    labels: ['1', '1'],
  });
  expect(partOf(chart.spec({ data: rows, label: 'share' }))).toMatchObject({
    label: 'visits',
    labels: ['4', ''],
  });
  expect(
    partOf(chart.spec({ data: rows, label: d => d.source.toUpperCase(), value: d => d.visits * 2 })),
  ).toMatchObject({ label: 'value', values: [2, 2], labels: ['SEARCH', 'DIRECT'] });
  expect(partOf(chart.spec({ data: { a: ['x', 'y'], b: ['p', 'q'], n: [3, 5] } }))).toMatchObject({
    label: 'n',
    values: [3, 5],
    labels: ['x', 'y'],
  });
  expect(partOf(chart.spec({ data: [{ day: '2026-11-01', n: 1 }], label: 'day' }))).toMatchObject({
    labels: ['2026-11-01'],
  });
  expect(
    partOf(
      chart.spec({
        data: [
          ['a', 1],
          ['b', 2],
        ],
      }),
    ),
  ).toMatchObject({ values: [1, 2], labels: ['a', 'b'] });
});

test.each(partCharts)('%s with no text field draws parts without names', (_, chart) => {
  for (const data of [
    [{ n: 3 }, { n: 5 }],
    [3, 5],
  ]) {
    const { values: v, labels } = partOf(chart.spec({ data: data as { n: number }[] }));
    expect(v).toEqual([3, 5]);
    expect(labels).toBeUndefined();
  }
  const el = host();
  chart(el, { data: [3, 5], width: 300, height: 300 });
  expect(entriesOf(el)).toEqual([]);
});

test.each(partCharts)('%s errors name the chart, the fields and the props to pass', (name, chart) => {
  const rows = visits();
  expect(() => chart.spec({ data: rows })).toThrow(
    new RegExp(
      `^${name}: .*"visits", "share".* The fields are source \\(text\\), visits \\(number\\), share \\(number\\)\\. Pass value as one of them\\.$`,
    ),
  );
  expect(() => chart.spec({ data: [{ a: 'x', b: '5' }] })).toThrow(
    /no field of numbers for value; "b" holds numbers as text.*Pass value as a field of numbers\.$/,
  );
  expect(() => chart.spec({ data: rows, value: 'source' as 'visits' })).toThrow(
    /value "source" is text, not numbers/,
  );
  expect(() => chart.spec({ data: rows, label: 'nope' as 'source' })).toThrow(
    /no field "nope".*Pass label as/,
  );
  expect(() => chart.spec({ data: rows, value: () => 'x' })).toThrow(/accessor value is text, not numbers/);
  for (const wrong of [{ x: 'source' }, { y: 'visits' }, { x: false }, { y: false }])
    expect(() => chart.spec({ data: rows, value: 'visits', ...wrong } as object)).toThrow(
      `${name}: use label and value, not x and y`,
    );
  for (const wrong of [
    { xAxis: {} },
    { yAxis: { label: 'v' } },
    { zoom: true },
    { xAxis: false },
    { yAxis: false },
    { zoom: false },
  ])
    expect(() => chart.spec({ data: rows, value: 'visits', ...wrong } as object)).toThrow(
      `${name}: ${Object.keys(wrong)[0]} does not apply, as there are no axes`,
    );
});

test.each(partCharts)(
  '%s with no data chooses nothing and throws nothing, and later data draws',
  (_, chart) => {
    for (const data of [undefined, null, []])
      expect(chart.spec({ data, label: 'a', value: 'b' } as object).marks).toEqual([]);
    const el = host();
    const c = chart(el, { ...BOX, colors: [RED] });
    expect(shows(el, RED)).toBe(false);
    c.update({ data: visits(), value: 'visits' });
    expect(shows(el, RED)).toBe(true);
  },
);

test.each(partCharts)('%s installs no zoom while data is pending', (_, chart) => {
  for (const data of [undefined, null, []]) {
    const count = (props: object) => chart.spec({ data, ...props } as object).use!.length;
    expect(count({ zoom: true })).toBe(count({}));
    expect(count({ zoom: {} })).toBe(count({}));
  }
});

test.each(partCharts)(
  '%s colours follow the theme and wrap, and the chart props reach plot()',
  (_, chart) => {
    const props = { data: visits(), value: 'visits' } as const;
    expect(partOf(chart.spec(props)).colors).toEqual(palette.slice(0, 2));
    expect(partOf(chart.spec({ ...props, theme: 'dark' })).colors).toEqual(paletteDark.slice(0, 2));
    expect(partOf(chart.spec({ ...props, colors: [RED] })).colors).toEqual([RED, RED]);
    const given = { ...BOX, description: 'visits', hidden: ['visits'] };
    expect(chart.spec({ ...props, ...given })).toMatchObject(given);
  },
);

test.each(partCharts)('%s lists two or more parts in a legend unless it is false', (_, chart) => {
  const names = (props: object) => {
    const el = host();
    chart(el, { data: visits(), value: 'visits', width: 300, height: 300, ...props });
    return entriesOf(el).map(e => e.textContent);
  };
  expect(names({})).toEqual(['search', 'direct']);
  expect(names({ legend: {} })).toEqual(['search', 'direct']);
  expect(names({ legend: false })).toEqual([]);
  expect(names({ data: visits().slice(0, 1) })).toEqual([]);
});

test.each(partCharts)(
  '%s sends nothing for an identical update and redraws after a dataVersion bump',
  (_, chart) => {
    const data = { name: ['a', 'b'], n: new Float64Array([3, 3]) };
    const props = () => ({ data, label: 'name', value: 'n', colors: [RED, BLUE], ...BOX }) as const;
    const el = host();
    const c = chart(el, props());
    const spy = vi.spyOn(c.chart, 'update');
    c.update(props());
    expect(spy).not.toHaveBeenCalled();
    c.update({ legend: {} });
    expect(spy).not.toHaveBeenCalled();
    const before = drawn(el);
    data.n[1] = 1;
    c.update({ dataVersion: 1 });
    expect(keysOf(spy)).toEqual([['marks']]);
    expect(drawn(el)).not.toBe(before);
  },
);

test.each(partCharts)(
  '%s answers the tooltip with the part and its value, also after new data',
  (_, chart) => {
    const el = host();
    const c = chart(el, { data: visits(), value: 'visits', ...BOX, legend: false, inner: 0.3 } as object);
    const live = c.chart;
    // Inside the second slice of the pie, the second stage and, on the second ring, the second bar.
    const at = { pieChart: [20, 50], funnelChart: [50, 75], radialBarChart: [74, 50] }[_] as [number, number];
    hover(el, ...at);
    expect(tipRows(el)).toEqual(['direct: 1']);
    c.update({
      data: [
        { source: 'a', visits: 1234.567 },
        { source: 'b', visits: 1234.567 },
      ],
    } as object);
    hover(el, ...at);
    expect(tipRows(el)).toEqual(['b: 1,234.57']);
    c.update({
      data: [
        { source: 'a', visits: 1 },
        { source: null, visits: 1 },
      ],
    } as object);
    hover(el, ...at);
    expect(tipRows(el)).toEqual(['visits: 1']);
    expect(c.chart).toBe(live);
    c.update({ tooltip: false });
    hover(el, ...at);
    expect(tipRows(el)).toBeUndefined();
  },
);

test('pieChart, funnelChart and radialBarChart pass their own props to the mark', () => {
  const props = { data: visits(), value: 'visits' } as const;
  expect(partOf(pieChart.spec(props)).rest).toEqual({ key: 'pie', label: 'visits', text: true });
  expect(partOf(pieChart.spec({ ...props, inner: 0.6, text: false, sweep: 0.3 })).rest).toEqual({
    key: 'pie',
    label: 'visits',
    inner: 0.6,
    sweep: 0.3,
  });
  const fill = gradient(RED, BLUE);
  expect(partOf(funnelChart.spec(props)).rest).toEqual({ key: 'funnel', label: 'visits', text: true });
  expect(partOf(funnelChart.spec({ ...props, text: false, fill })).rest).toEqual({
    key: 'funnel',
    label: 'visits',
    fill,
  });
  expect(partOf(radialBarChart.spec(props)).rest).toEqual({ key: 'radialBar', label: 'visits' });
  expect(partOf(radialBarChart.spec({ ...props, max: 100, sweep: 0.35, inner: 0.5 })).rest).toEqual({
    key: 'radialBar',
    label: 'visits',
    max: 100,
    sweep: 0.35,
    inner: 0.5,
  });
});

test('types: the part charts check field names and take no axis props', () => {
  const rows = visits();
  const columns = { name: ['a'], n: new Float64Array([1]) };
  for (const chart of [pieChart, funnelChart, radialBarChart] as const) {
    expectTypeOf(chart.spec({ data: rows, label: 'source', value: 'share' })).toEqualTypeOf<Options>();
    const c = chart(host(), { data: rows, value: d => d.visits });
    c.update({ label: 'source', value: 'visits' });
    chart.spec({ data: columns, label: 'name', value: 'n' });
    chart.spec({ label: 'anything' });
    expect(chart.spec({ data: [] }).marks).toEqual([]);
    const later = chart(host(), {});
    later.update({ data: rows, value: 'visits' });
    const wrong = () => {
      // @ts-expect-error not a field of the rows
      chart.spec({ data: rows, label: 'nope' });
      // @ts-expect-error a text field is not a value
      chart.spec({ data: rows, value: 'source' });
      // @ts-expect-error not a column
      chart.spec({ data: columns, label: 'nope' });
      // @ts-expect-error a text column is not a value
      chart.spec({ data: columns, value: 'name' });
      // @ts-expect-error a number array has no fields to name
      chart.spec({ data: [1, 2], value: 'value' });
      // @ts-expect-error pairs have no fields to name
      chart.spec({ data: [['a', 1]], label: 'x' });
      // @ts-expect-error not a field of the rows
      c.update({ label: 'nope' });
      // @ts-expect-error not a field of the rows
      later.update({ data: rows, label: 'nope' });
      // @ts-expect-error parts have no x
      chart.spec({ data: rows, x: 'source' });
      // @ts-expect-error parts have no y
      chart.spec({ data: rows, y: 'visits' });
      // @ts-expect-error there are no axes
      chart.spec({ data: rows, yAxis: {} });
      // @ts-expect-error there are no axes
      chart.spec({ data: rows, xAxis: {} });
      // @ts-expect-error there are no axes
      chart.spec({ data: rows, zoom: true });
      // @ts-expect-error there are no axes
      chart.spec({ data: rows, view: {} });
    };
    expect(wrong).toBeTypeOf('function');
  }
  expectTypeOf<NonNullable<PieProps<Visit[]>['inner']>>().toEqualTypeOf<number>();
});

type Rating = { feature: string; a: number; b: number | null };
const ratings = (): Rating[] => [
  { feature: 'screen', a: 1, b: 2 },
  { feature: 'sound', a: 3, b: null },
  { feature: 'price', a: 4, b: 2 },
  { feature: 'size', a: 4, b: -2 },
];
type RadarMark = { axes: string[]; hi: number; fill: number; values: Col; color: string };
const radarOf = (o: Options) => {
  const [grid, ...shapes] = o.marks;
  expect(grid).toMatchObject({ type: 'radar-grid', key: 'radar-grid' });
  const { axes, hi } = grid!.options as RadarMark;
  return {
    axes,
    hi,
    shapes: shapes.map(m => {
      const { values: v, color, fill } = m.options as RadarMark;
      expect(m).toMatchObject({ type: 'radar', key: `shape:${m.label}`, group: m.label });
      return { label: m.label, values: Array.from(v), color, fill };
    }),
  };
};
const shapesOf = (o: Options) => radarOf(o).shapes.map(s => [s.label, s.values]);

test('radarChart picks spokes and shapes: guessed, named or positional', () => {
  const rows = ratings();
  const guessed = radarChart.spec({ data: rows.map(({ feature, ...n }) => ({ ...n, feature })) });
  expect(guessed).toMatchObject({ frame: 'polar' });
  expect(guessed).not.toHaveProperty('x');
  expect(radarOf(guessed)).toEqual({
    axes: ['screen', 'sound', 'price', 'size'],
    hi: 4,
    shapes: [
      { label: 'a', values: [1, 3, 4, 4], color: palette[0], fill: 0.15 },
      { label: 'b', values: [2, NaN, 2, -2], color: palette[1], fill: 0.15 },
    ],
  });
  expect(shapesOf(radarChart.spec({ data: rows, y: ['b', 'a'] }))).toEqual([
    ['b', [2, NaN, 2, -2]],
    ['a', [1, 3, 4, 4]],
  ]);
  expect(shapesOf(radarChart.spec({ data: rows, y: 'a' }))).toEqual([['a', [1, 3, 4, 4]]]);
  const numbered = radarChart.spec({ data: rows, x: 'a' });
  expect(radarOf(numbered).axes).toEqual(['1', '3', '4', '4']);
  expect(shapesOf(numbered)).toEqual([['b', [2, NaN, 2, -2]]]);
  const read = radarChart.spec({
    data: rows,
    x: d => d.feature.toUpperCase(),
    y: [d => d.a * 2, 'b'],
  });
  expect(radarOf(read).axes[0]).toBe('SCREEN');
  expect(radarOf(read).shapes.map(s => s.label)).toEqual(['y1', 'b']);
  const dated = [{ day: '2026-11-01', when: 'early', n: 1 }];
  expect(radarOf(radarChart.spec({ data: dated })).axes).toEqual(['early']);
  expect(radarOf(radarChart.spec({ data: dated, x: 'day' })).axes).toEqual(['2026-11-01']);
  expect(radarOf(radarChart.spec({ data: { a: ['x', null], n: new Float64Array([3, 5]) } }))).toMatchObject({
    axes: ['x', ''],
    shapes: [{ label: 'n', values: [3, 5] }],
  });
  expect(
    radarOf(
      radarChart.spec({
        data: [
          ['a', 1],
          ['b', 2],
        ],
      }),
    ),
  ).toMatchObject({ axes: ['a', 'b'], shapes: [{ label: 'y', values: [1, 2] }] });
  expect(radarOf(radarChart.spec({ data: [3, 5] }))).toMatchObject({
    axes: ['', ''],
    shapes: [{ label: 'value', values: [3, 5] }],
  });
});

test('radarChart errors name the chart, the fields and the props to pass', () => {
  const rows = ratings();
  expect(() => radarChart.spec({ data: [{ a: 'x', b: '5' }] })).toThrow(
    /^radarChart: there is no field of numbers for y; "b" holds numbers as text.*Pass y as a field of numbers\.$/,
  );
  expect(() => radarChart.spec({ data: rows, y: 'feature' as 'a' })).toThrow(
    /y "feature" is text, not numbers/,
  );
  expect(() => radarChart.spec({ data: rows, x: 'nope' as 'a' })).toThrow(/no field "nope".*Pass x as/);
  expect(() => radarChart.spec({ data: rows, y: () => 'x' })).toThrow(/accessor y1 is text, not numbers/);
  for (const wrong of [{ label: 'feature' }, { value: 'a' }, { label: false }])
    expect(() => radarChart.spec({ data: rows, ...wrong } as object)).toThrow(
      'radarChart: use x and y, not label and value',
    );
  for (const k of ['xAxis', 'yAxis', 'zoom'])
    for (const v of [{}, false])
      expect(() => radarChart.spec({ data: rows, [k]: v } as object)).toThrow(
        `radarChart: ${k} does not apply, as there are no axes`,
      );
});

test('radarChart with no data chooses nothing, throws nothing and installs no zoom, and later data draws', () => {
  for (const data of [undefined, null, []]) {
    const spec = (props: object) => radarChart.spec({ data, x: 'a', y: 'b', ...props } as object);
    expect(spec({}).marks).toEqual([]);
    expect(spec({ zoom: true }).use!.length).toBe(spec({}).use!.length);
  }
  const el = host();
  const c = radarChart(el, { ...BOX, colors: [RED] });
  expect(shows(el, RED)).toBe(false);
  c.update({ data: ratings() });
  expect(shows(el, RED)).toBe(true);
});

test('radarChart passes max and fill to the mark, colours wrap, and the chart props reach plot()', () => {
  const props = { data: ratings(), colors: [RED] };
  const { hi, shapes } = radarOf(radarChart.spec({ ...props, max: 10, fill: 0 }));
  expect(hi).toBe(10);
  expect(shapes.map(s => [s.color, s.fill])).toEqual([
    [RED, 0],
    [RED, 0],
  ]);
  const onDark = radarOf(radarChart.spec({ data: ratings(), theme: 'dark' }));
  expect(onDark.shapes.map(s => s.color)).toEqual(paletteDark.slice(0, 2));
  const given = { ...BOX, description: 'phones', hidden: ['a'] };
  expect(radarChart.spec({ ...props, ...given })).toMatchObject(given);
});

test('radarChart lists two or more shapes in a legend unless it is false, and hides them', () => {
  const names = (props: object) => {
    const el = host();
    radarChart(el, { data: ratings(), width: 300, height: 300, ...props });
    return entriesOf(el).map(e => e.textContent);
  };
  expect(names({})).toEqual(['a', 'b']);
  expect(names({ y: 'a' })).toEqual([]);
  expect(names({ legend: false })).toEqual([]);

  const el = host();
  const onHiddenChange = vi.fn();
  radarChart(el, { data: ratings(), width: 300, height: 300, colors: [RED, BLUE], onHiddenChange });
  expect(shows(el, RED)).toBe(true);
  hideFirst(el);
  expect(onHiddenChange).toHaveBeenCalledWith(['a']);
  expect(shows(el, RED)).toBe(false);
  expect(shows(el, BLUE)).toBe(true);
  const given = host();
  radarChart(given, { data: ratings(), ...BOX, legend: false, colors: [RED, BLUE], hidden: ['b'] });
  expect(shows(given, RED)).toBe(true);
  expect(shows(given, BLUE)).toBe(false);
});

test('radarChart sends nothing for an identical update and redraws after a dataVersion bump', () => {
  const data = { name: ['p', 'q', 'r'], n: new Float64Array([3, 3, 3]), m: [1, 1, 1] };
  const props = () => ({ data, x: 'name', y: ['n', 'm'], max: 4, colors: [RED, BLUE], ...BOX }) as const;
  const el = host();
  const c = radarChart(el, props());
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(spy).not.toHaveBeenCalled();
  const before = drawn(el);
  data.n[1] = 1;
  c.update({ dataVersion: 1 });
  expect(keysOf(spy)).toEqual([['marks']]);
  expect(drawn(el)).not.toBe(before);
});

test('radarChart answers the tooltip with the spoke, the shape and its value, also after new data', () => {
  const el = host();
  const props = { ...BOX, max: 1, legend: false };
  const row = (feature: string, a: number | null) => ({ feature, a });
  const ring = (a: number | null) => ['N', 'E', 'S', 'W'].map(f => row(f, f === 'N' ? a : null));
  const c = radarChart(el, { ...props, data: ring(1234.567) });
  const live = c.chart;
  // The first spoke runs up to the rim, 25 px out at least; the corners of the rest are at the centre.
  hover(el, 50, 25);
  expect(tipRows(el)).toEqual(['N · a: 1,234.57']);
  c.update({ data: ring(2) });
  hover(el, 50, 25);
  expect(tipRows(el)).toEqual(['N · a: 2']);
  expect(c.chart).toBe(live);
  c.update({ data: ring(null).map(r => ({ ...r, a: r.feature === 'E' ? 1 : null })) });
  hover(el, 45, 55);
  expect(tipRows(el)).toEqual(['W · a: –']);
  c.update({ data: [{ a: 5 }] as never });
  hover(el, 50, 25);
  expect(tipRows(el)).toEqual(['a: 5']);
  c.update({ tooltip: false });
  hover(el, 50, 25);
  expect(tipRows(el)).toBeUndefined();
});

test('radarChart answers the tooltip with the value of the shape hit when two shapes share a label', () => {
  const el = host();
  const data = ['N', 'E', 'S', 'W'].map(name => ({ name, y1: name === 'N' ? 0.5 : 0, y2: 0 }));
  radarChart(el, { ...BOX, data, y: ['y2', d => d.y1 * 2], max: 1, legend: false });
  hover(el, 50, 25);
  expect(tipRows(el)).toEqual(['N · y2: 1']);
});

test('radarChart hides and pairs shapes that share a label, or are named like the grid, one by one', () => {
  const data = ['N', 'E', 'S', 'W'].map(name => ({ name, y1: name === 'N' ? 0.5 : 0, y2: 0 }));
  const props = { data, y: ['y2', (d: (typeof data)[0]) => d.y1 * 2], max: 1, colors: [RED, BLUE] } as const;
  const el = host();
  const onHiddenChange = vi.fn();
  radarChart(el, { ...props, width: 300, height: 300, onHiddenChange });
  expect(entriesOf(el).map(e => e.textContent)).toEqual(['y2', 'y2']);
  hideFirst(el);
  expect(onHiddenChange).toHaveBeenLastCalledWith(['y2']);
  expect([shows(el, RED), shows(el, BLUE)]).toEqual([false, true]);
  hideFirst(el);
  entriesOf(el)[1]!.click();
  expect(onHiddenChange).toHaveBeenLastCalledWith(['y2 (2)']);
  expect([shows(el, RED), shows(el, BLUE)]).toEqual([true, false]);

  const marksOf = (y: readonly (string | ((d: never) => number))[]) =>
    radarChart.spec({
      data: [{ name: 'N', y2: 1, 'y2 (2)': 2, 'radar-grid': 3 }],
      x: 'name',
      y: y as never,
    }).marks;
  const marks = marksOf(['y2', () => 1, 'y2', 'y2 (2)', 'radar-grid']);
  expect(new Set(marks.map(m => m.key)).size).toBe(6);
  expect(marks.map(m => m.group)).toEqual([undefined, 'y2', 'y2 (3)', 'y2 (4)', 'y2 (2)', 'radar-grid']);
  expect(marksOf([() => 1, 'y2']).map(m => m.group)).toEqual([undefined, 'y1', 'y2']);
});

test('types: radarChart checks field names and takes no axis props', () => {
  const rows = ratings();
  const columns = { name: ['a'], n: new Float64Array([1]) };
  expectTypeOf(radarChart.spec({ data: rows, x: 'feature', y: ['a', 'b'] })).toEqualTypeOf<Options>();
  const c = radarChart(host(), { data: rows, y: d => d.a });
  c.update({ x: 'feature', y: 'b' });
  radarChart.spec({ data: columns, x: 'name', y: ['n'] });
  radarChart.spec({ x: 'anything' });
  expect(radarChart.spec({ data: [] }).marks).toEqual([]);
  const later = radarChart(host(), {});
  later.update({ data: rows, y: 'a' });
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    radarChart.spec({ data: rows, x: 'nope' });
    // @ts-expect-error a text field is not a shape
    radarChart.spec({ data: rows, y: ['a', 'feature'] });
    // @ts-expect-error not a column
    radarChart.spec({ data: columns, x: 'nope' });
    // @ts-expect-error a text column is not a shape
    radarChart.spec({ data: columns, y: 'name' });
    // @ts-expect-error a number array has no fields to name
    radarChart.spec({ data: [1, 2], y: 'value' });
    // @ts-expect-error pairs have no fields to name
    radarChart.spec({ data: [['a', 1]], x: 'x' });
    // @ts-expect-error not a field of the rows
    c.update({ x: 'nope' });
    // @ts-expect-error not a field of the rows
    later.update({ data: rows, x: 'nope' });
    // @ts-expect-error a radar has no label
    radarChart.spec({ data: rows, label: 'feature' });
    // @ts-expect-error a radar has no series field
    radarChart.spec({ data: rows, series: 'feature' });
    // @ts-expect-error there are no axes
    radarChart.spec({ data: rows, xAxis: {} });
    // @ts-expect-error there are no axes
    radarChart.spec({ data: rows, yAxis: {} });
    // @ts-expect-error there are no axes
    radarChart.spec({ data: rows, zoom: true });
    // @ts-expect-error there are no axes
    radarChart.spec({ data: rows, view: {} });
  };
  expect(wrong).toBeTypeOf('function');
  expectTypeOf<NonNullable<RadarProps<Rating[]>['fill']>>().toEqualTypeOf<number>();
});

type Load = { day: string; hour: string; requests: number };
const loads = (): Load[] => [
  { day: 'Sun', hour: '00', requests: 1 },
  { day: 'Sun', hour: '01', requests: 2 },
  { day: 'Sat', hour: '00', requests: 3 },
  { day: 'Sat', hour: '01', requests: 4 },
];
const gridOf = (o: Options) => {
  expect(o.marks).toHaveLength(1);
  const { type, label, options } = o.marks[0]!;
  const { values: v, columns, color } = options as { values: Col; columns: number; color?: ColorScale };
  const side = (a: Options['x']) => (a as BandAxis).categories;
  return { type, label, values: Array.from(v), columns, color, x: side(o.x), y: side(o.y) };
};

test('heatmapChart lays long rows on a row-major grid, text in order of first appearance, numbers and dates ascending', () => {
  const grid = { values: [1, 2, 3, 4], columns: 2, x: ['00', '01'], y: ['Sun', 'Sat'] };
  const rows = loads();
  const named = { x: 'hour', y: 'day' } as const;
  expect(gridOf(heatmapChart.spec({ data: rows, ...named }))).toMatchObject({
    type: 'heatmap',
    label: 'requests',
    ...grid,
  });
  const shuffled = [0, 3, 2, 1].map(i => rows[i]!);
  expect(gridOf(heatmapChart.spec({ data: shuffled, ...named }))).toMatchObject(grid);
  expect(gridOf(heatmapChart.spec({ data: rows.toReversed(), ...named }))).toMatchObject({
    values: [4, 3, 2, 1],
    x: ['01', '00'],
    y: ['Sat', 'Sun'],
  });
  expect(gridOf(heatmapChart.spec({ data: rows, x: 'day', y: 'hour' }))).toMatchObject({
    values: [1, 3, 2, 4],
    x: ['Sun', 'Sat'],
    y: ['00', '01'],
  });
  const dated = [
    { hour: 10, date: '2026-11-02', n: 4 },
    { hour: 9, date: '2026-11-01', n: 1 },
    { hour: 10, date: '2026-11-01', n: 2 },
    { hour: 9, date: '2026-11-02', n: 3 },
  ];
  for (const data of [dated, dated.toReversed()])
    expect(gridOf(heatmapChart.spec({ data, x: 'hour', y: 'date' }))).toMatchObject({
      values: [1, 2, 3, 4],
      x: ['9', '10'],
      y: ['2026-11-01', '2026-11-02'],
    });
});

test('heatmapChart leaves a missing cell NaN, keeps the last of a repeated one and drops a row without a place', () => {
  const data = [
    ...loads().slice(0, 3),
    { day: 'Sun', hour: '01', requests: 9 },
    { day: null, hour: '07', requests: 5 },
    { day: 'Fri', hour: null, requests: 5 },
  ];
  expect(gridOf(heatmapChart.spec({ data, x: 'hour', y: 'day' }))).toMatchObject({
    values: [1, 9, 3, NaN],
    x: ['00', '01'],
    y: ['Sun', 'Sat'],
  });
  const el = host();
  heatmapChart(el, { ...BOX, data: data.slice(4), x: 'hour', y: 'day' });
  expect(legendOf(el)).toBe('');
});

test('heatmapChart guesses x and y from text and dates and value from the number left', () => {
  const data = loads().map(({ day, hour, requests }) => ({ requests, day, hour }));
  expect(heatmapChart.spec({ data })).toMatchObject({ x: { label: 'day' }, y: { label: 'hour' } });
  expect(gridOf(heatmapChart.spec({ data })).label).toBe('requests');
  expect(heatmapChart.spec({ data, x: 'hour' })).toMatchObject({ x: { label: 'hour' }, y: { label: 'day' } });
  expect(heatmapChart.spec({ data, y: 'day' })).toMatchObject({ x: { label: 'hour' }, y: { label: 'day' } });
  const when = { n: [1], when: ['2026-11-01'], at: ['a'] };
  expect(heatmapChart.spec({ data: when })).toMatchObject({ x: { label: 'when' }, y: { label: 'at' } });
  const read = heatmapChart.spec({
    data,
    x: d => d.day.toUpperCase(),
    y: 'hour',
    value: d => d.requests * 2,
  });
  expect(read).toMatchObject({ x: { label: '' } });
  expect(gridOf(read)).toMatchObject({ label: 'value', values: [2, 6, 4, 8], x: ['SUN', 'SAT'] });
  const labelled = { xAxis: { label: 'Hour' }, yAxis: { label: '' } };
  expect(heatmapChart.spec({ data, ...labelled })).toMatchObject({ x: { label: 'Hour' }, y: { label: '' } });
});

test('heatmapChart errors name the chart, the fields and the props to pass', () => {
  const rows = loads();
  expect(() => heatmapChart.spec({ data: rows.map(r => ({ ...r, errors: 1 })) })).toThrow(
    /^heatmapChart: "requests", "errors" are all fields of numbers.*Pass value as one of them\.$/,
  );
  expect(() => heatmapChart.spec({ data: [{ a: 'x', b: 'y', c: '5' }] })).toThrow(
    /no field of numbers for value; "c" holds numbers as text/,
  );
  expect(() => heatmapChart.spec({ data: [{ n: 1 }] })).toThrow(/left for x\..*Pass x as/);
  expect(() => heatmapChart.spec({ data: [{ a: 'x', n: 1 }] })).toThrow(/left for y\..*Pass y as/);
  expect(() => heatmapChart.spec({ data: rows, x: 'nope' as 'day' })).toThrow(/no field "nope".*Pass x as/);
  expect(() => heatmapChart.spec({ data: rows, value: 'day' as 'requests' })).toThrow(
    /value "day" is text, not numbers/,
  );
  for (const data of [[1, 2], [['a', 1]]])
    expect(() => heatmapChart.spec({ data } as object)).toThrow(/Pass rows or columns with fields for x, y/);
  expect(() => heatmapChart.spec({ data: rows, label: 'day' } as object)).toThrow(
    'heatmapChart: use x, y and value, not label and value',
  );
  for (const zoomed of [true, false])
    expect(() => heatmapChart.spec({ data: rows, zoom: zoomed } as object)).toThrow(
      'heatmapChart: zoom does not apply',
    );
});

test('heatmapChart refuses a grid over ten million cells, with its dimensions, before laying it out', () => {
  expect([fits(10_000, 1000), fits(10_000, 1001), fits(1001, 10_000)]).toEqual([true, false, false]);
  const data = Array.from({ length: 10_000 }, (_, i) => ({ a: i, b: i % 1001, n: 1 }));
  expect(() => heatmapChart.spec({ data, x: 'a', y: 'b', value: 'n' })).toThrow(
    /^heatmapChart: a grid of 10,000 columns by 1,001 rows is over the limit of 10,000,000 cells\..*Pass x and y as/,
  );
});

test('heatmapChart names distinct times apart on both sides and in the tooltip', () => {
  const at = (ms: number) => new Date(Date.UTC(2026, 10, 22, 12) + ms);
  const data = [
    { x: at(1000), y: at(1250), n: 1 },
    { x: at(2000), y: at(1500), n: 2 },
  ];
  const x = ['2026-11-22 12:00:01', '2026-11-22 12:00:02'];
  const y = ['2026-11-22 12:00:01.250', '2026-11-22 12:00:01.500'];
  expect(gridOf(heatmapChart.spec({ data }))).toMatchObject({ x, y });
  const minutes = data.map((d, i) => ({ ...d, x: at(i * 6e4 + 1000) }));
  expect(gridOf(heatmapChart.spec({ data: minutes })).x).toEqual(['2026-11-22 12:00', '2026-11-22 12:01']);
  const el = host();
  heatmapChart(el, { ...BOX, data, legend: false });
  hover(el, 75, 25);
  expect(tipRows(el)).toEqual([`${x[1]} · ${y[1]} · n: 2`]);
});

test('heatmapChart with no data chooses nothing, throws nothing and installs no zoom, and later data draws', () => {
  for (const data of [undefined, null, []]) {
    const spec = (props: object) => heatmapChart.spec({ data, x: 'a', value: 'b', ...props } as object);
    expect(spec({}).marks).toEqual([]);
    expect(spec({ zoom: true }).use!.length).toBe(spec({}).use!.length);
  }
  const el = host();
  const c = heatmapChart(el, { ...BOX, legend: false, color: sequential({ stops: [RED, RED] }) });
  expect(shows(el, RED)).toBe(false);
  c.update({ data: loads() });
  expect(shows(el, RED)).toBe(true);
});

const legendOf = (el: HTMLElement) =>
  [...el.querySelectorAll('span')]
    .filter(s => s.style.backgroundImage.includes('linear-gradient'))
    .map(s => s.parentElement!.textContent)
    .join();

test('heatmapChart colours by the scale given and shows its strip unless legend is false', () => {
  const color = sequential({ stops: [RED, BLUE] });
  const props = { data: loads(), color };
  expect(gridOf(heatmapChart.spec(props)).color).toBe(color);
  expect(gridOf(heatmapChart.spec({ data: loads() })).color).toBeUndefined();
  const el = host();
  heatmapChart(el, { ...props, width: 300, height: 300 });
  expect([shows(el, RED), shows(el, BLUE)]).toEqual([true, true]);
  expect(legendOf(el)).toBe('requests 14');
  const bare = host();
  heatmapChart(bare, { ...props, width: 300, height: 300, legend: false });
  expect(legendOf(bare)).toBe('');
  const given = { ...BOX, description: 'load', hidden: ['requests'] };
  expect(heatmapChart.spec({ ...props, ...given })).toMatchObject(given);
});

test('heatmapChart sends nothing for an identical update, with a scale made inline, and redraws what changed', () => {
  const data = { x: ['a', 'b'], y: ['p', 'p'], n: new Float64Array([1, 2]) };
  const props = (to = BLUE) => ({ data, color: sequential({ stops: [RED, to], domain: [0, 4] }), ...BOX });
  const el = host();
  const c = heatmapChart(el, props());
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(spy).not.toHaveBeenCalled();
  const before = drawn(el);
  data.n[1] = 4;
  c.update({ dataVersion: 1 });
  const after = drawn(el);
  expect(after).not.toBe(before);
  c.update(props('#00ff00'));
  expect(keysOf(spy)).toEqual([['marks'], ['marks']]);
  expect(drawn(el)).not.toBe(after);
});

test('heatmapChart answers the tooltip with the cell and its value, also after new data', () => {
  const el = host();
  const c = heatmapChart(el, { ...BOX, data: loads(), x: 'hour', y: 'day', legend: false });
  const live = c.chart;
  hover(el, 75, 25);
  expect(tipRows(el)).toEqual(['01 · Sat · requests: 4']);
  c.update({ data: loads().map(r => ({ ...r, day: r.day === 'Sat' ? 'Fri' : r.day, requests: 1234.567 })) });
  hover(el, 75, 25);
  expect(tipRows(el)).toEqual(['01 · Fri · requests: 1,234.57']);
  expect(c.chart).toBe(live);
  c.update({ tooltip: false });
  hover(el, 75, 25);
  expect(tipRows(el)).toBeUndefined();
});

test('types: heatmapChart checks field names and takes axis titles only', () => {
  const rows = loads();
  const columns = { a: ['p'], b: ['q'], n: new Float64Array([1]) };
  expectTypeOf(
    heatmapChart.spec({ data: rows, x: 'hour', y: d => d.day, value: 'requests' }),
  ).toEqualTypeOf<Options>();
  const c = heatmapChart(host(), { data: rows, x: 'hour', y: 'day' });
  c.update({ x: 'day', y: 'hour' });
  heatmapChart.spec({ data: columns, x: 'a', y: 'b', value: 'n' });
  heatmapChart.spec({ x: 'anything' });
  heatmapChart.spec({ data: [], x: 'anything' });
  const later = heatmapChart(host(), {});
  later.update({ data: rows, x: 'hour' });
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    heatmapChart.spec({ data: rows, x: 'nope' });
    // @ts-expect-error a text field is not a value
    heatmapChart.spec({ data: rows, value: 'day' });
    // @ts-expect-error not a column
    heatmapChart.spec({ data: columns, y: 'nope' });
    // @ts-expect-error a text column is not a value
    heatmapChart.spec({ data: columns, value: 'a' });
    // @ts-expect-error numbers have no cells
    heatmapChart.spec({ data: [1, 2] });
    // @ts-expect-error pairs have no cells
    heatmapChart.spec({ data: [['a', 1]] });
    // @ts-expect-error not a field of the rows
    c.update({ x: 'nope' });
    // @ts-expect-error not a field of the rows
    later.update({ data: rows, x: 'nope' });
    // @ts-expect-error a heatmap has no label
    heatmapChart.spec({ data: rows, label: 'day' });
    // @ts-expect-error a category axis takes a title only
    heatmapChart.spec({ data: rows, xAxis: { step: 1 } });
    // @ts-expect-error a category axis takes a title only
    heatmapChart.spec({ data: rows, yAxis: { format: String } });
    // @ts-expect-error a heatmap does not zoom
    heatmapChart.spec({ data: rows, zoom: true });
    // @ts-expect-error a heatmap does not zoom
    heatmapChart.spec({ data: rows, view: {} });
  };
  expect(wrong).toBeTypeOf('function');
  expectTypeOf<NonNullable<HeatmapProps<Load[]>['color']>>().toEqualTypeOf<ColorScale>();
});

const only = (o: Options) => {
  expect(o.marks).toHaveLength(1);
  return o.marks[0]!;
};
const barsOf = (o: Options) => {
  const { x1, x2, y2 } = only(o).options as { x1: Col; x2: Col; y2: Col };
  return { x1: Array.from(x1), x2: Array.from(x2), y2: Array.from(y2) };
};

test('histogramChart counts numbers, the sole number field or the field named into bins', () => {
  const numbers = [1, 2, 2, 3, 9, 5];
  const auto = bin(numbers);
  const rows = numbers.map(ms => ({ page: 'a', ms }));
  for (const spec of [
    histogramChart.spec({ data: numbers }),
    histogramChart.spec({ data: Float64Array.from(numbers) }),
    histogramChart.spec({ data: rows }),
    histogramChart.spec({ data: { ms: numbers, page: rows.map(r => r.page) } }),
    histogramChart.spec({ data: rows.map(r => ({ ...r, other: 1 })), x: 'ms' }),
    histogramChart.spec({ data: rows, x: d => d.ms }),
  ]) {
    expect(only(spec)).toMatchObject({ type: 'bar', label: 'count', options: { gap: 1 } });
    expect(barsOf(spec)).toEqual({ x1: [...auto.x1], x2: [...auto.x2], y2: [...auto.y2] });
  }
  expect(histogramChart.spec({ data: rows })).toMatchObject({
    x: { label: 'ms', domain: 'nice' },
    y: { label: 'count', domain: 'nice' },
  });
  expect(histogramChart.spec({ data: numbers })).toMatchObject({ x: { label: 'value' } });
  expect(histogramChart.spec({ data: rows, x: d => d.ms })).toMatchObject({ x: { label: '' } });
});

test('histogramChart takes bins as a count or as edges, up to a million of a count', () => {
  const data = [0, 1, 2, 10, null];
  expect(barsOf(histogramChart.spec({ data, bins: 2 }))).toEqual({ x1: [0, 5], x2: [5, 10], y2: [3, 1] });
  for (const bins of [[0, 1, 10], new Float64Array([0, 1, 10])])
    expect(barsOf(histogramChart.spec({ data, bins }))).toEqual({ x1: [0, 1], x2: [1, 10], y2: [1, 3] });
  expect(barsOf(histogramChart.spec({ data, bins: 1_000_000 })).y2).toHaveLength(1_000_000);
  expect(() => histogramChart.spec({ data, bins: 1_000_001 })).toThrow(
    'histogramChart: 1,000,001 bins are over the limit of 1,000,000',
  );
});

test('histogramChart passes the axis settings on and zooms', async () => {
  const format = (v: number) => `${v} ms`;
  const props = {
    data: [1, 2, 3],
    xAxis: { label: 'Load', step: 1, format },
    yAxis: { label: 'Pages', step: 2 },
  };
  expect(histogramChart.spec(props)).toMatchObject({
    x: { label: 'Load', step: 1, format },
    y: { label: 'Pages', step: 2 },
  });
  const el = host();
  const onViewChange = vi.fn();
  histogramChart(el, { ...BOX, data: [1, 2, 3], zoom: true, onViewChange });
  await zoomIn(el);
  expect(onViewChange).toHaveBeenCalled();
});

test('histogramChart errors name the chart, the fields and the prop to pass', () => {
  expect(() => histogramChart.spec({ data: [{ a: 1, b: 2 }] })).toThrow(
    /^histogramChart: "a", "b" are all fields of numbers, so x cannot be guessed\..*Pass x as one of them\.$/,
  );
  expect(() => histogramChart.spec({ data: [{ a: '5' }] })).toThrow(
    /no field of numbers for x; "a" holds numbers as text/,
  );
  expect(() => histogramChart.spec({ data: [{ a: 1 }], x: 'nope' as 'a' })).toThrow(/no field "nope"/);
  expect(() => histogramChart.spec({ data: [{ a: 'p' }], x: 'a' as never })).toThrow(
    /x "a" is text, not numbers/,
  );
  expect(() => histogramChart.spec({ data: [[1, 2]] } as object)).toThrow(/a list of pairs/);
  for (const k of ['y', 'label', 'value'])
    expect(() => histogramChart.spec({ data: [{ a: 1 }], [k]: 'a' })).toThrow(
      `histogramChart: use x for the values counted, not ${k}`,
    );
});

test('histogramChart sends nothing for an identical update, with edges made inline, and redraws what changed', () => {
  const data = new Float64Array([0.5, 1.5, 1.5]);
  const props = (to = 2) => ({ ...BOX, data, bins: [0, 1, to] });
  const el = host();
  const c = histogramChart(el, props());
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(spy).not.toHaveBeenCalled();
  const before = drawn(el);
  c.update({ bins: [0, 0.2, 2] });
  expect(drawn(el)).not.toBe(before);
  c.update(props());
  expect(drawn(el)).toBe(before);
  data[1] = 0.5;
  data[2] = 0.5;
  c.update({ dataVersion: 1 });
  expect(drawn(el)).not.toBe(before);
});

test('histogramChart draws in the first colour and answers the tooltip with the bin, also after an update', () => {
  const el = host();
  const props = { ...BOX, data: [0, 1, 1, 1], bins: 2, colors: [RED, BLUE], legend: false };
  const c = histogramChart(el, props);
  const live = c.chart;
  expect([shows(el, RED), shows(el, BLUE)]).toEqual([true, false]);
  hover(el, 75, 75);
  expect(tipRows(el)).toEqual(['0.5 – 1 · count: 3']);
  c.update({ data: [0, 0.001, 0.001, 0.0015] });
  hover(el, 60, 90);
  expect(tipRows(el)).toEqual(['0.00075 – 0.0015 · count: 3']);
  c.update({ data: [0, 1.5e-22], bins: [0, 1e-22, 2e-22] });
  hover(el, 75, 75);
  expect(tipRows(el)).toEqual(['1e-22 – 2e-22 · count: 1']);
  c.update({ data: [0, 0.001, 0.001, 0.0015], bins: 2 });
  c.update({ xAxis: { format: v => `${v}s` }, yAxis: { format: v => `${v} rows` } });
  hover(el, 60, 90);
  expect(tipRows(el)).toEqual(['0.00075s – 0.0015s · count: 3 rows']);
  expect(c.chart).toBe(live);
  c.update({ tooltip: false });
  hover(el, 60, 90);
  expect(tipRows(el)).toBeUndefined();
});

type Trip = { day: string; minutes: number };
const trips = (): Trip[] => [
  { day: 'Tue', minutes: 10 },
  { day: 'Mon', minutes: 1 },
  { day: 'Tue', minutes: 20 },
  { day: 'Mon', minutes: 3 },
  { day: 'Tue', minutes: 30 },
];
const boxesOf = (o: Options) => {
  const { x, min, q1, median, q3, max } = only(o).options as Record<string, Col>;
  return {
    at: Array.from(x!),
    five: [min, q1, median, q3, max].map(c => Array.from(c!)),
    names: (o.x as BandAxis).categories,
  };
};
const fives = (...groups: number[][]) => Object.values(fiveNumbers(groups)).map(c => Array.from(c));

test('boxPlotChart draws one box with no text field, of numbers, or with x null', () => {
  const one = { at: [0], five: fives([1, 2, 3, 10]), names: [''] };
  const minutes = [1, 2, 3, 10];
  const rows = minutes.map((m, i) => ({ id: `r${i}`, minutes: m }));
  for (const spec of [
    boxPlotChart.spec({ data: minutes }),
    boxPlotChart.spec({ data: new Float32Array(minutes) }),
    boxPlotChart.spec({ data: minutes.map(m => ({ minutes: m })) }),
    boxPlotChart.spec({ data: { minutes } }),
    boxPlotChart.spec({ data: rows, x: null }),
  ])
    expect(boxesOf(spec)).toEqual(one);
  expect(boxPlotChart.spec({ data: rows, x: null })).toMatchObject({
    x: { label: '' },
    y: { label: 'minutes', domain: 'nice' },
  });
  expect(only(boxPlotChart.spec({ data: rows, x: null }))).toMatchObject({ type: 'box', label: 'minutes' });
});

test('boxPlotChart groups by the sole text field or the x named, in order of first appearance', () => {
  const rows = trips();
  const two = { at: [0, 1], five: fives([10, 20, 30], [1, 3]), names: ['Tue', 'Mon'] };
  for (const spec of [
    boxPlotChart.spec({ data: rows }),
    boxPlotChart.spec({ data: rows, x: 'day', y: 'minutes' }),
    boxPlotChart.spec({ data: rows, x: d => d.day, y: d => d.minutes }),
    boxPlotChart.spec({ data: { day: rows.map(r => r.day), minutes: rows.map(r => r.minutes) } }),
    boxPlotChart.spec({ data: rows.map(r => [r.day, r.minutes] as [string, number]) }),
  ])
    expect(boxesOf(spec)).toEqual(two);
  expect(boxPlotChart.spec({ data: rows })).toMatchObject({ x: { label: 'day' }, y: { label: 'minutes' } });
  expect(boxPlotChart.spec({ data: rows, x: d => d.day, y: d => d.minutes })).toMatchObject({
    x: { label: '' },
    y: { label: '' },
    marks: [{ label: 'y' }],
  });
  const numbered = rows.map(r => ({ hour: r.day === 'Tue' ? 9 : 8, minutes: r.minutes }));
  expect(boxesOf(boxPlotChart.spec({ data: numbered, x: 'hour' }))).toEqual({ ...two, names: ['9', '8'] });
  const dated = rows.map(r => ({ ...r, day: r.day === 'Tue' ? '2026-11-02' : '2026-11-01' }));
  expect(boxesOf(boxPlotChart.spec({ data: dated, x: 'day' })).names).toEqual(['2026-11-02', '2026-11-01']);
});

test('boxPlotChart drops a row without a group and leaves a group without values empty', () => {
  const data = [...trips(), { day: null, minutes: 99 }, { day: 'Wed', minutes: null }];
  const { five, names } = boxesOf(boxPlotChart.spec({ data }));
  expect(names).toEqual(['Tue', 'Mon', 'Wed']);
  expect(five).toEqual(fives([10, 20, 30], [1, 3], []));
});

test('boxPlotChart errors name the chart, the fields and the props to pass', () => {
  const rows = trips();
  const ids = rows.map((r, i) => ({ id: `r${i}`, minutes: r.minutes }));
  expect(() => boxPlotChart.spec({ data: ids })).toThrow(
    /^boxPlotChart: no value of "id" repeats.*Pass x as the field of groups, or x: null for one box\.$/,
  );
  expect(() =>
    boxPlotChart.spec({ data: [...ids, { id: null, minutes: 1 }, { id: null, minutes: 2 }] }),
  ).toThrow(/no value of "id" repeats/);
  expect(boxesOf(boxPlotChart.spec({ data: ids, x: 'id' })).names).toHaveLength(5);
  expect(() => boxPlotChart.spec({ data: rows.map(r => ({ ...r, town: 'A' })) })).toThrow(
    /^boxPlotChart: "day", "town" are all fields of text.*Pass x as one of them, or x: null for one box\.$/,
  );
  expect(() => boxPlotChart.spec({ data: rows.map(r => ({ ...r, km: 1 })) })).toThrow(
    /"minutes", "km" are all fields of numbers, so y cannot be guessed/,
  );
  expect(() => boxPlotChart.spec({ data: rows, y: 'day' as 'minutes' })).toThrow(
    /y "day" is text, not numbers/,
  );
  expect(() => boxPlotChart.spec({ data: rows, x: 'nope' as 'day' })).toThrow(/no field "nope".*Pass x as/);
  expect(() => boxPlotChart.spec({ data: rows, value: 'minutes' } as object)).toThrow(
    'boxPlotChart: use x and y, not label and value',
  );
  for (const zoomed of [true, false])
    expect(() => boxPlotChart.spec({ data: rows, zoom: zoomed } as object)).toThrow('boxPlotChart: zoom');
});

test('histogramChart and boxPlotChart with no data choose nothing and throw nothing, and later data draws', () => {
  for (const data of [undefined, null, []]) {
    expect(histogramChart.spec({ data, x: 'a', y: 'b', bins: 1e9 } as object).marks).toEqual([]);
    const spec = (props: object) => boxPlotChart.spec({ data, x: 'a', value: 'b', ...props } as object);
    expect(spec({}).marks).toEqual([]);
    expect(spec({ zoom: true }).use!.length).toBe(spec({}).use!.length);
  }
  const [bars, box] = [host(), host()];
  const h = histogramChart(bars, { ...BOX, colors: [RED] });
  const b = boxPlotChart(box, { ...BOX, colors: [RED] });
  expect([shows(bars, RED), shows(box, RED)]).toEqual([false, false]);
  h.update({ data: trips() });
  b.update({ data: trips() });
  expect([shows(bars, RED), shows(box, RED)]).toEqual([true, true]);
});

test('boxPlotChart takes axis settings and a fill, and sends nothing for an identical update', () => {
  const data = trips();
  const props = (from = 0.6) => ({
    ...BOX,
    data,
    fill: gradient(from, 0.05),
    yAxis: { step: 5, label: 'Min' },
  });
  expect(boxPlotChart.spec({ ...props(), xAxis: { label: 'Day' } })).toMatchObject({
    x: { label: 'Day' },
    y: { label: 'Min', step: 5 },
    marks: [{ options: { fill: gradient(0.6, 0.05) } }],
  });
  expect(only(boxPlotChart.spec({ data })).options).not.toHaveProperty('fill');
  const el = host();
  const c = boxPlotChart(el, props());
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(spy).not.toHaveBeenCalled();
  const before = drawn(el);
  c.update(props(0.9));
  expect(keysOf(spy)).toEqual([['marks']]);
  expect(drawn(el)).not.toBe(before);
});

test('boxPlotChart draws in the first colour and answers the tooltip with the group and its five numbers', () => {
  const el = host();
  const c = boxPlotChart(el, {
    ...BOX,
    data: trips(),
    colors: [RED, BLUE],
    legend: false,
    yAxis: { domain: [0, 40] },
  });
  const live = c.chart;
  expect([shows(el, RED), shows(el, BLUE)]).toEqual([true, false]);
  hover(el, 25, 50);
  expect(tipRows(el)).toEqual(['Tue · minutes: min 10, q1 15, median 20, q3 25, max 30']);
  c.update({
    data: trips().map(r => ({ ...r, day: 'All' })),
    yAxis: { domain: [0, 40], format: v => `${v}m` },
  });
  hover(el, 50, 75);
  expect(tipRows(el)).toEqual(['All · minutes: min 1m, q1 3m, median 10m, q3 20m, max 30m']);
  c.update({ x: null });
  hover(el, 50, 75);
  expect(tipRows(el)).toEqual(['minutes: min 1m, q1 3m, median 10m, q3 20m, max 30m']);
  expect(c.chart).toBe(live);
});

test('types: histogramChart and boxPlotChart check field names and props', () => {
  const rows = trips();
  const columns = { day: ['p'], minutes: new Float64Array([1]) };
  expectTypeOf(
    histogramChart.spec({ data: rows, x: 'minutes', bins: 4, zoom: true }),
  ).toEqualTypeOf<Options>();
  histogramChart.spec({ data: columns, x: 'minutes', bins: new Float32Array(2) });
  histogramChart.spec({ x: 'anything' });
  boxPlotChart.spec({ data: rows, x: 'day', y: d => d.minutes, fill: RED });
  boxPlotChart.spec({ data: columns, x: null, y: 'minutes' });
  boxPlotChart.spec({ x: 'anything' });
  const later = histogramChart(host(), {});
  later.update({ data: rows, x: 'minutes' });
  const xAxis = { label: 'Minutes', step: 1, format: String, fit: 'all', domain: 'data' } as const;
  histogramChart.spec({ data: rows, x: 'minutes', xAxis, view: {}, onViewChange: () => {} });
  histogramChart.spec({ data: columns, xAxis });
  histogramChart.spec({ data: [1, 2], xAxis });
  histogramChart.spec({ xAxis });
  const wrong = () => {
    // @ts-expect-error the values are never dates
    histogramChart.spec({ data: rows, xAxis: { unit: 'day' } });
    // @ts-expect-error the values are never dates
    histogramChart.spec({ data: columns, xAxis: { every: 2 } });
    // @ts-expect-error the values are never dates
    histogramChart.spec({ data: [1, 2], xAxis: { utc: false } });
    // @ts-expect-error the values are never dates
    histogramChart.spec({ xAxis: { unit: 'day' } });
    // @ts-expect-error the values are never dates
    later.update({ xAxis: { utc: false } });
    // @ts-expect-error not a field of the rows
    histogramChart.spec({ data: rows, x: 'nope' });
    // @ts-expect-error a text field is not counted
    histogramChart.spec({ data: rows, x: 'day' });
    // @ts-expect-error a text column is not counted
    histogramChart.spec({ data: columns, x: 'day' });
    // @ts-expect-error numbers have no fields
    histogramChart.spec({ data: [1, 2], x: 'value' });
    // @ts-expect-error pairs are not one list of values
    histogramChart.spec({ data: [['a', 1]] });
    // @ts-expect-error a histogram has no y
    histogramChart.spec({ data: rows, y: 'minutes' });
    // @ts-expect-error not a field of the rows
    later.update({ data: rows, x: 'nope' });
    // @ts-expect-error not a field of the rows
    boxPlotChart.spec({ data: rows, x: 'nope' });
    // @ts-expect-error a text field is not a value
    boxPlotChart.spec({ data: rows, y: 'day' });
    // @ts-expect-error a text column is not a value
    boxPlotChart.spec({ data: columns, y: 'day' });
    // @ts-expect-error numbers have no fields
    boxPlotChart.spec({ data: [1, 2], x: null });
    // @ts-expect-error a category axis takes a title only
    boxPlotChart.spec({ data: rows, xAxis: { step: 1 } });
    // @ts-expect-error a box plot does not zoom
    boxPlotChart.spec({ data: rows, zoom: true });
    // @ts-expect-error a box plot does not zoom
    boxPlotChart.spec({ data: rows, view: {} });
  };
  expect(wrong).toBeTypeOf('function');
});

type Candle = { date: string; open: number; high: number; low: number; close: number };
const candles = (): Candle[] => [
  { date: '2026-11-03', open: 20, high: 90, low: 10, close: 70 },
  { date: '2026-11-06', open: 80, high: 85, low: 15, close: 30 },
  { date: '2026-11-05', open: 30, high: 60, low: 20, close: 50 },
];
const candlesOf = (o: Options) => {
  const m = only(o);
  expect(m.type).toBe('candlestick');
  const { x, open, high, low, close, width } = m.options as Record<
    'x' | 'open' | 'high' | 'low' | 'close',
    Col
  > & {
    width: number;
  };
  return { x: Array.from(x), prices: [open, high, low, close].map(c => Array.from(c)), width };
};
const WHOLE_DAY = 864e5;

test('candlestickChart matches the four prices by full name in any case, or takes the fields named', () => {
  const rows = candles();
  const prices = (['open', 'high', 'low', 'close'] as const).map(k => rows.map(r => r[k]));
  const x = rows.map(r => Date.parse(r.date));
  const expected = { x, prices, width: 0.6 * WHOLE_DAY };
  const [first, highest, lowest, last] = prices as [number[], number[], number[], number[]];
  for (const spec of [
    candlestickChart.spec({ data: rows }),
    candlestickChart.spec({
      data: rows.map(r => ({
        Close: r.close,
        volume: 5,
        LOW: r.low,
        High: r.high,
        OPEN: r.open,
        day: r.date,
      })),
    }),
    candlestickChart.spec({
      data: { date: x.map(t => new Date(t)), open: first, high: highest, low: lowest, close: last },
    }),
    candlestickChart.spec({
      data: rows.map(r => ({ o: r.open, h: r.high, l: r.low, c: r.close, t: r.date })),
      open: 'o',
      high: d => d.h,
      low: d => d.l,
      close: 'c',
      x: d => d.t,
    }),
    candlestickChart.spec({ data: rows.map(r => ({ ...r, Open: 1 })), open: 'open' }),
    candlestickChart.spec({ data: rows.map(r => ({ ...r, Open: null })), open: 'open' }),
  ])
    expect(candlesOf(spec)).toEqual(expected);
  const missing = candlestickChart.spec({ data: rows.map(r => ({ ...r, open: null })) });
  expect(candlesOf(missing).prices).toEqual([[NaN, NaN, NaN], highest, lowest, last]);
  expect(candlestickChart.spec({ data: rows })).toMatchObject({
    x: { label: 'date', utc: true },
    y: { label: '', domain: 'nice' },
    marks: [{ label: 'price' }],
  });
});

test('candlestickChart errors name the chart, the fields and the four props', () => {
  const rows = candles();
  const pass = 'Pass open, high, low and close as fields of numbers\\.$';
  expect(() =>
    candlestickChart.spec({
      data: rows.map(r => ({ t: r.date, o: r.open, h: r.high, l: r.low, c: r.close })),
    }),
  ).toThrow(
    new RegExp(`^candlestickChart: there is no field called open\\. The fields are t \\(time\\), o.*${pass}`),
  );
  expect(() =>
    candlestickChart.spec({ data: rows.map(({ date, open, high, close }) => ({ date, open, high, close })) }),
  ).toThrow(new RegExp(`there is no field called low\\..*${pass}`));
  expect(() => candlestickChart.spec({ data: rows.map(r => ({ ...r, CLOSE: 1 })) })).toThrow(
    new RegExp(`"close", "CLOSE" are all called close, so it cannot be guessed\\..*${pass}`),
  );
  expect(() => candlestickChart.spec({ data: rows.map(r => ({ ...r, open: 'x' })) })).toThrow(
    /open "open" is text, not numbers/,
  );
  expect(() => candlestickChart.spec({ data: rows.map(r => ({ ...r, OPEN: null })) })).toThrow(
    /"open", "OPEN" are all called open, so it cannot be guessed/,
  );
  expect(() => candlestickChart.spec({ data: rows.map(r => ({ ...r, open: {} })) })).toThrow(
    /"open" holds values that are not numbers, dates or text.*Pass open as another field/,
  );
  expect(() => candlestickChart.spec({ data: rows.map(r => ({ ...r, date: 1 })) })).toThrow(
    /no field of dates or text for x/,
  );
  expect(() => candlestickChart.spec({ data: rows, x: 'nope' as 'date' })).toThrow(/no field "nope"/);
  expect(() => candlestickChart.spec({ data: [[1, 2]] } as object)).toThrow(/has no candles/);
  for (const k of ['y', 'series', 'label', 'value'])
    expect(() => candlestickChart.spec({ data: rows, [k]: 'open' })).toThrow(
      `candlestickChart: use x, open, high, low and close, not ${k}`,
    );
});

test('candlestickChart prefers dates over text, gives each text row a category and takes a number x named', () => {
  const rows = candles().map(({ open, high, low, close }, i) => ({
    week: ['Mon', 'Tue', 'Mon'][i]!,
    n: i * 5,
    open,
    high,
    low,
    close,
  }));
  const spec = candlestickChart.spec({ data: rows });
  expect(candlesOf(spec)).toMatchObject({ x: [0, 1, 2], width: 0.6 });
  expect(spec.x).toMatchObject({ label: 'week', categories: ['Mon', 'Tue', 'Mon'] });
  const dated = candlestickChart.spec({ data: rows.map((r, i) => ({ ...r, at: candles()[i]!.date })) });
  expect(dated.x).toMatchObject({ label: 'at', utc: true });
  const numbered = candlestickChart.spec({ data: rows, x: 'n' });
  expect(candlesOf(numbered)).toMatchObject({ x: [0, 5, 10], width: 3 });
  expect(numbered.x).toMatchObject({ label: 'n', domain: 'nice' });
  const gap = candlestickChart.spec({ data: rows.map((r, i) => ({ ...r, week: i === 1 ? null : r.week })) });
  expect(candlesOf(gap)).toMatchObject({ x: [0, Number.NaN, 2], width: 0.6 });
  expect(gap.x).toMatchObject({ categories: ['Mon', '', 'Mon'] });
});

test('candlestickChart is 0.6 of the smallest gap wide, and a candle alone 0.6 of a day or a unit of axis', () => {
  const at = (...times: (string | null)[]) => times.map(date => ({ ...candles()[0]!, date }));
  const width = (...times: (string | null)[]) =>
    candlesOf(candlestickChart.spec({ data: at(...times) })).width;
  expect(width('2026-11-02T12:00', null, '2026-11-02T10:00', '2026-11-02T12:00', '2026-11-02T10:30')).toBe(
    0.6 * 18e5,
  );
  const t = Date.parse('2026-11-02');
  for (const times of [['2026-11-02'], ['2026-11-02', '2026-11-02', null]]) {
    expect(width(...times)).toBe(0.6 * WHOLE_DAY);
    expect(candlestickChart.spec({ data: at(...times) }).x).toMatchObject({
      domain: [t - WHOLE_DAY / 2, t + WHOLE_DAY / 2],
    });
  }
  expect(candlestickChart.spec({ data: at('2026-11-02'), xAxis: { domain: [0, t] } }).x).toMatchObject({
    domain: [0, t],
  });
  expect(candlestickChart.spec({ data: candles() }).x).toMatchObject({ domain: 'data' });
  const el = host();
  candlestickChart(el, { ...BOX, data: at('2026-11-02'), colors: [RED], yAxis: { domain: [0, 100] } });
  expect([10, 50, 90].map(x => pixel(el, x, 45)[0] === 255)).toEqual([false, true, false]);
  const numbered = (n: number, count = 1) => Array.from({ length: count }, () => ({ ...candles()[0]!, n }));
  for (const data of [numbered(5), numbered(5, 2)]) {
    const spec = candlestickChart.spec({ data, x: 'n' });
    expect(candlesOf(spec).width).toBe(0.6);
    expect(spec.x).toMatchObject({ domain: [4.5, 5.5] });
  }
  expect(candlestickChart.spec({ data: numbered(5), x: 'n', xAxis: { domain: [0, 10] } }).x).toMatchObject({
    domain: [0, 10],
  });
  const el2 = host();
  candlestickChart(el2, {
    ...BOX,
    data: numbered(5),
    x: 'n',
    colors: [RED],
    yAxis: { domain: [0, 100] },
  });
  expect([10, 50, 90].map(x => pixel(el2, x, 45)[0] === 255)).toEqual([false, true, false]);
  const text = candlestickChart.spec({ data: [{ ...candles()[0]!, date: 'Mon' }] });
  expect(candlesOf(text)).toMatchObject({ x: [0], width: 0.6 });
});

test('candlestickChart draws up and down in their colours, else in the first of colors', () => {
  const el = host();
  const c = candlestickChart(el, { ...BOX, data: candles(), up: RED, down: BLUE, legend: false });
  expect([shows(el, RED), shows(el, BLUE)]).toEqual([true, true]);
  c.update({ up: undefined, down: undefined, colors: ['#00ff00', RED] });
  expect([shows(el, '#00ff00'), shows(el, RED), shows(el, BLUE)]).toEqual([true, false, false]);
  const { options } = only(candlestickChart.spec({ data: candles() }));
  expect(options).not.toHaveProperty('up');
  expect(options).not.toHaveProperty('down');
  expect(options).toMatchObject({ color: palette[0] });
});

test('candlestickChart passes the axis settings on, reads local time with utc false, and zooms', async () => {
  const format = (v: number) => `$${v}`;
  const spec = candlestickChart.spec({
    data: candles(),
    xAxis: { label: 'Day', unit: 'day', every: 2, utc: false },
    yAxis: { label: 'Price', step: 20, format },
  });
  expect(spec).toMatchObject({
    x: { label: 'Day', unit: 'day', every: 2, utc: false },
    y: { label: 'Price', step: 20, format },
  });
  expect(candlesOf(spec).x[0]).toBe(new Date(2026, 10, 3).getTime());
  const weeks = candles().map((r, i) => ({ ...r, date: `week ${i}` }));
  for (const data of [candles(), weeks]) {
    const el = host();
    const onViewChange = vi.fn();
    candlestickChart(el, { ...BOX, data, zoom: true, onViewChange });
    await zoomIn(el);
    expect(onViewChange).toHaveBeenCalled();
  }
});

test('candlestickChart answers the tooltip with the date and the four prices, also after an update', () => {
  const el = host();
  const props = { ...BOX, data: candles(), yAxis: { domain: [0, 100] as [number, number] } };
  const c = candlestickChart(el, props);
  const live = c.chart;
  hover(el, 8, 50);
  expect(tipRows(el)).toEqual(['2026-11-03 · open 20, high 90, low 10, close 70']);
  c.update({ data: candles().map((r, i) => ({ ...r, date: `2026-11-03T10:0${i}`, close: 1234.567 })) });
  hover(el, 8, 50);
  expect(tipRows(el)).toEqual(['2026-11-03 10:00 · open 20, high 90, low 10, close 1,234.57']);
  const folded = candles().map((r, i) => ({ ...r, date: `2026-11-01T0${5 + i}:30Z` }));
  c.update({ data: folded, xAxis: { utc: false } });
  hover(el, 8, 50);
  expect(tipRows(el)).toEqual(['2026-11-01 01:30 UTC-04:00 · open 20, high 90, low 10, close 70']);
  c.update({ data: candles().map((r, i) => ({ ...r, date: `week ${i}` })) });
  c.update({ yAxis: { ...props.yAxis, format: v => `$${v}` } });
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['week 1 · open $80, high $85, low $15, close $30']);
  expect(c.chart).toBe(live);
  c.update({ tooltip: false });
  hover(el, 50, 50);
  expect(tipRows(el)).toBeUndefined();
});

test('candlestickChart sends nothing for an identical update and redraws what changed', () => {
  const rows = candles();
  const data = {
    date: rows.map(r => r.date),
    open: rows.map(r => r.open),
    high: rows.map(r => r.high),
    low: rows.map(r => r.low),
    close: Float64Array.from(rows, r => r.close),
  };
  const props = () => ({ ...BOX, data, down: RED, xAxis: { label: 'Day' } });
  const el = host();
  const c = candlestickChart(el, props());
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(spy).not.toHaveBeenCalled();
  const before = drawn(el);
  data.close[0] = 40;
  c.update({ dataVersion: 1 });
  expect(drawn(el)).not.toBe(before);
  c.update({ down: BLUE });
  expect(keysOf(spy)).toEqual([['marks'], ['marks']]);
});

test('candlestickChart keeps the categories of unchanged data', () => {
  const data = candles().map((r, i) => ({ ...r, date: `week ${i}` }));
  const c = candlestickChart(host(), { ...BOX, data, xAxis: { label: 'a' } });
  const spy = vi.spyOn(c.chart, 'update');
  for (const label of ['b', 'c']) c.update({ xAxis: { label } });
  expect(keysOf(spy)).toEqual([['x'], ['x']]);
  const [first, second] = spy.mock.calls.map(([o]) => (o.x as { categories?: string[] }).categories);
  expect(first).toEqual(['week 0', 'week 1', 'week 2'].slice(0, data.length));
  expect(second).toBe(first);
});

test('candlestickChart with no data chooses nothing and throws nothing, and later data draws', () => {
  for (const data of [undefined, null, []])
    expect(candlestickChart.spec({ data, x: 'a', open: 'b', y: 'c' } as object).marks).toEqual([]);
  const el = host();
  const c = candlestickChart(el, { ...BOX, colors: [RED] });
  expect(shows(el, RED)).toBe(false);
  c.update({ data: candles() });
  expect(shows(el, RED)).toBe(true);
});

test('types: candlestickChart checks field names and props', () => {
  const rows = candles();
  const columns = { day: ['p'], open: [1], high: [2], low: [0], close: new Float64Array([1]) };
  expectTypeOf(
    candlestickChart.spec({
      data: rows,
      x: 'date',
      open: 'open',
      high: d => d.high,
      up: RED,
      down: BLUE,
      zoom: true,
    }),
  ).toEqualTypeOf<Options>();
  candlestickChart.spec({ data: columns, x: 'day', close: 'close', xAxis: { unit: 'day' }, view: {} });
  candlestickChart.spec({ x: 'anything', open: 'anything' });
  candlestickChart.spec({ data: [], x: 'anything' });
  const later = candlestickChart(host(), {});
  later.update({ data: rows, x: 'date' });
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    candlestickChart.spec({ data: rows, x: 'nope' });
    // @ts-expect-error a text field is not a price
    candlestickChart.spec({ data: rows, open: 'date' });
    // @ts-expect-error a text column is not a price
    candlestickChart.spec({ data: columns, high: 'day' });
    // @ts-expect-error not a column
    candlestickChart.spec({ data: columns, low: 'nope' });
    // @ts-expect-error numbers have no candles
    candlestickChart.spec({ data: [1, 2] });
    // @ts-expect-error pairs have no candles
    candlestickChart.spec({ data: [['a', 1]] });
    // @ts-expect-error a candlestick chart has no y
    candlestickChart.spec({ data: rows, y: 'close' });
    // @ts-expect-error not a field of the rows
    later.update({ data: rows, close: 'nope' });
  };
  expect(wrong).toBeTypeOf('function');
});

type Flow = { from: string; to: string; amount: number };
const flows = (): Flow[] => [
  { from: 'Salary', to: 'Budget', amount: 4200 },
  { from: 'Freelance', to: 'Budget', amount: 800 },
  { from: 'Budget', to: 'Home', amount: 3000 },
];
const linksOf = (o: Options) => {
  const m = only(o);
  expect(m.type).toBe('sankey');
  const { nodes, source, target, value, colors, ...rest } = m.options as {
    nodes: string[];
    source: Col;
    target: Col;
    value: Col;
    colors: string[];
  };
  return {
    links: { nodes, source: Array.from(source), target: Array.from(target), value: Array.from(value) },
    colors,
    rest,
  };
};

test('sankeyChart guesses source, target and value, or takes the fields named', () => {
  const rows = flows();
  const expected = {
    nodes: ['Salary', 'Budget', 'Freelance', 'Home'],
    source: [0, 2, 1],
    target: [1, 1, 3],
    value: [4200, 800, 3000],
  };
  const columns = {
    from: rows.map(r => r.from),
    to: rows.map(r => r.to),
    amount: Float64Array.from(rows, r => r.amount),
  };
  for (const spec of [
    sankeyChart.spec({ data: rows }),
    sankeyChart.spec({ data: columns }),
    sankeyChart.spec({
      data: rows.map(({ from, to, amount }) => ({ id: 7, to, from, amount })),
      source: 'from',
      value: 'amount',
    }),
    sankeyChart.spec({ data: rows, source: d => d.from, target: d => d.to, value: d => d.amount }),
  ])
    expect(linksOf(spec).links).toEqual(expected);
  const back = sankeyChart.spec({ data: rows.slice(0, 1), source: 'to' });
  expect(linksOf(back).links).toMatchObject({ nodes: ['Budget', 'Salary'], source: [0], target: [1] });
  const numbered = sankeyChart.spec({ data: [{ a: 1, b: 2, n: 5 }], source: 'a', target: 'b' });
  expect(linksOf(numbered).links.nodes).toEqual(['1', '2']);
  expect(sankeyChart.spec({ data: rows }).frame).toBe('blank');
  expect(linksOf(sankeyChart.spec({ data: rows })).colors).toEqual(palette.slice(0, 4));
  expect(linksOf(sankeyChart.spec({ data: rows, colors: [RED, BLUE] })).colors).toEqual([
    RED,
    BLUE,
    RED,
    BLUE,
  ]);
});

test('sankeyChart drops a link without an end and passes blend and text to the mark', () => {
  const rows = [{ from: null, to: 'Budget', amount: 1 }, ...flows(), { from: 'Home', to: '', amount: 2 }];
  expect(linksOf(sankeyChart.spec({ data: rows })).links).toEqual(
    linksOf(sankeyChart.spec({ data: flows() })).links,
  );
  const rest = (props: object) => linksOf(sankeyChart.spec({ data: flows(), ...props })).rest;
  expect(rest({})).toEqual({ key: 'sankey', label: 'amount' });
  expect(rest({ text: true, blend: true })).toEqual({ key: 'sankey', label: 'amount', blend: true });
  expect(rest({ text: false })).toEqual({ key: 'sankey', label: 'amount', text: false });
});

test('sankeyChart errors name the chart, the fields and the props to pass', () => {
  const rows = flows();
  expect(() => sankeyChart.spec({ data: rows.map(({ from, amount }) => ({ from, amount })) })).toThrow(
    /^sankeyChart: there is no field of text left for target\. The fields are from \(text\), amount \(number\)\. Pass target as/,
  );
  expect(() => sankeyChart.spec({ data: rows.map(r => ({ ...r, rate: 1 })) })).toThrow(
    /"amount", "rate" are all fields of numbers, so value cannot be guessed/,
  );
  expect(() => sankeyChart.spec({ data: rows, target: 'nope' as 'to' })).toThrow(/no field "nope"/);
  expect(() => sankeyChart.spec({ data: [['a', 1]] } as object)).toThrow(/has no links/);
  for (const k of ['x', 'y', 'label', 'series'])
    expect(() => sankeyChart.spec({ data: rows, [k]: 'from' })).toThrow(
      `sankeyChart: use source, target and value, not ${k}`,
    );
  expect(() => sankeyChart.spec({ data: rows, zoom: true } as object)).toThrow(
    'sankeyChart: zoom does not apply, as there are no axes',
  );
  expect(() => sankeyChart.spec({ data: [{ from: 'a', to: 'a', n: 1 }] })).toThrow(
    /^sankeyChart: a links to itself/,
  );
  const circle = [
    { from: 'a', to: 'b', n: 1 },
    { from: 'b', to: 'a', n: 1 },
  ];
  expect(() => sankeyChart.spec({ data: circle })).toThrow(/^sankeyChart: the links go round in a circle/);
});

test('sankeyChart sends nothing for an identical update and redraws what changed', () => {
  const data = flows();
  const props = () => ({ ...BOX, data, text: false, colors: [RED, BLUE] });
  const el = host();
  const c = sankeyChart(el, props());
  const spy = vi.spyOn(c.chart, 'update');
  c.update(props());
  expect(spy).not.toHaveBeenCalled();
  const before = drawn(el);
  data[0]!.amount = 1;
  c.update({ dataVersion: 1 });
  expect(drawn(el)).not.toBe(before);
  c.update({ blend: true });
  expect(keysOf(spy)).toEqual([['marks'], ['marks']]);
});

test('sankeyChart answers the tooltip with a node and its flow, or a link, also after new data', () => {
  const el = host();
  const c = sankeyChart(el, { ...BOX, data: [{ a: 'In', b: 'Out', n: 1234.567 }], text: false });
  const live = c.chart;
  hover(el, 3, 50);
  expect(tipRows(el)).toEqual(['In: 1,234.57']);
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['In → Out: 1,234.57']);
  c.update({
    data: [
      { a: 'New', b: 'Out', n: 5 },
      { a: 'New', b: 'Out', n: -2 },
      { a: 'Out', b: 'End', n: 7 },
    ],
  });
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['Out: 7']);
  expect(c.chart).toBe(live);
  c.update({ tooltip: false });
  hover(el, 50, 50);
  expect(tipRows(el)).toBeUndefined();
});

test('sankeyChart with no data chooses nothing and throws nothing, and later data draws', () => {
  for (const data of [undefined, null, []])
    expect(sankeyChart.spec({ data, source: 'a', x: 'b' } as object).marks).toEqual([]);
  const el = host();
  const c = sankeyChart(el, { ...BOX, colors: [RED], legend: false });
  expect(shows(el, RED)).toBe(false);
  c.update({ data: flows() });
  expect(shows(el, RED)).toBe(true);
});

const disk = (): Nested[] => [
  {
    name: 'Media',
    children: [
      { name: 'Photos', value: 60 },
      { name: 'Video', value: 20 },
    ],
  },
  { name: 'Code', value: 20 },
];
const treeOf = (o: Options) => {
  const m = only(o);
  const { nodes, parent, value, colors, ...rest } = m.options as {
    nodes: string[];
    parent: Col;
    value: Col;
    colors: string[];
  };
  return { type: m.type, nodes, parent: Array.from(parent), value: Array.from(value), colors, rest };
};
const TREES = [
  ['treemapChart', treemapChart, 'treemap', 'blank'],
  ['sunburstChart', sunburstChart, 'sunburst', 'polar'],
] as const;

for (const [name, chart, type, frame] of TREES) {
  test(`${name} takes one root or a list of roots, with a colour per branch`, () => {
    const spec = chart.spec({ data: disk() });
    expect(spec.frame).toBe(frame);
    expect(treeOf(spec)).toEqual({
      type,
      nodes: ['Media', 'Photos', 'Video', 'Code'],
      parent: [-1, 0, 0, -1],
      value: [0, 60, 20, 20],
      colors: palette.slice(0, 2),
      rest: { key: type },
    });
    const root = { name: 'Disk', children: [...disk(), { name: 'Rest', value: 1 }] };
    expect(treeOf(chart.spec({ data: root }))).toMatchObject({
      nodes: ['Disk', 'Media', 'Photos', 'Video', 'Code', 'Rest'],
      parent: [-1, 0, 1, 1, 0, 0],
      colors: palette.slice(0, 3),
    });
    expect(treeOf(chart.spec({ data: root, colors: [RED, BLUE] })).colors).toEqual([RED, BLUE, RED]);
    const same = { name: 'Same', value: 1 };
    expect(treeOf(chart.spec({ data: [same, same] as readonly Nested[] })).nodes).toEqual(['Same', 'Same']);
    const el = host();
    chart(el, { ...BOX, data: disk(), colors: [RED, BLUE], text: false });
    expect([shows(el, RED), shows(el, BLUE)]).toEqual([true, true]);
  });

  test(`${name} draws a lone node in the first colour`, () => {
    const solo = { name: 'Solo', value: 7 };
    for (const data of [solo, [{ ...solo, children: [] }]])
      for (const props of [{}, { shade: 1 }]) {
        const el = host();
        chart(el, { ...BOX, data, colors: [RED], text: false, ...props });
        expect(shows(el, RED)).toBe(true);
      }
    expect(treeOf(chart.spec({ data: solo })).colors).toEqual(palette.slice(0, 1));
  });

  test(`${name} passes shade and text to the mark`, () => {
    const rest = (props: object) => treeOf(chart.spec({ data: disk(), ...props })).rest;
    expect(rest({ shade: 0.3, text: true })).toEqual({ key: type, shade: 0.3 });
    expect(rest({ text: false })).toEqual({ key: type, text: false });
  });

  test(`${name} errors name the chart and the shape of the data`, () => {
    const shape = `${name}: data must be a root { name, value, children } or a list of roots`;
    const bad: unknown[] = [
      [1, 2],
      [['a', 1]],
      [null],
      { name: ['a'], value: [1] },
      [{ folder: 'a', size: 1 }],
      { name: 'a', children: [null] },
      { name: 'a', children: 5 },
    ];
    for (const data of bad) expect(() => chart.spec({ data } as object)).toThrow(shape);
    const loop: Nested = { name: 'Loop', children: [] };
    loop.children!.push(loop);
    expect(() => chart.spec({ data: loop })).toThrow(`${name}: Loop is among its own children`);
    for (const k of ['x', 'y', 'series', 'label', 'value', 'source', 'target'])
      expect(() => chart.spec({ data: disk(), [k]: 'name' })).toThrow(
        `${name}: ${k} does not apply, as data is a tree of { name, value, children }`,
      );
    expect(() => chart.spec({ data: disk(), xAxis: {} } as object)).toThrow(
      `${name}: xAxis does not apply, as there are no axes`,
    );
  });

  test(`${name} with no data draws an empty frame, and later data draws`, () => {
    for (const data of [undefined, null, [], {}])
      expect(chart.spec({ data, x: 'a' } as object).marks).toEqual([]);
    const el = host();
    const c = chart(el, { ...BOX, colors: [RED], legend: false });
    expect(shows(el, RED)).toBe(false);
    c.update({ data: disk() });
    expect(shows(el, RED)).toBe(true);
    c.update({ data: null });
    expect(shows(el, RED)).toBe(false);
  });

  test(`${name} sends nothing for an identical update and sees an in-place change after a dataVersion bump`, () => {
    for (const data of [disk(), { name: 'Disk', children: disk() }]) {
      const props = () => ({ ...BOX, data, text: false, colors: [RED, BLUE] });
      const el = host();
      const c = chart(el, props());
      const spy = vi.spyOn(c.chart, 'update');
      c.update(props());
      expect(spy).not.toHaveBeenCalled();
      const before = drawn(el);
      (Array.isArray(data) ? data[0]! : data.children[0]!).children![0]!.value = 1;
      c.update(props());
      expect(drawn(el)).toBe(before);
      c.update({ dataVersion: 1 });
      expect(drawn(el)).not.toBe(before);
      c.update({ shade: 0.3 });
      expect(keysOf(spy)).toEqual([['marks'], ['marks']]);
    }
  });

  test(`${name} answers the tooltip with the path to a node and its size, also after new data`, () => {
    const el = host();
    const c = chart(el, { ...BOX, data: { name: 'All', children: [{ name: 'One', value: 1234.567 }] } });
    const live = c.chart;
    hover(el, 85, 50);
    expect(tipRows(el)).toEqual(['All · One: 1,234.57']);
    c.update({ data: [{ name: 'Solo', value: 7, children: [] }] });
    hover(el, 60, 50);
    expect(tipRows(el)).toEqual(['Solo: 7']);
    expect(c.chart).toBe(live);
    c.update({ tooltip: false });
    hover(el, 60, 50);
    expect(tipRows(el)).toBeUndefined();
  });
}

test('sunburstChart gives a parent in the tooltip the sum of what is under it', () => {
  const el = host();
  const kids = [
    { name: 'a', value: 3 },
    { name: 'b', value: -5 },
    { name: 'c', value: 4, children: [{ name: 'd', value: 2 }] },
  ];
  sunburstChart(el, { ...BOX, data: { name: 'All', value: 100, children: kids } });
  hover(el, 50, 50);
  expect(tipRows(el)).toEqual(['All: 5']);
});

test('a total past the largest number says so in the tooltip of a parent and of a flow node', () => {
  const tree = host();
  const kids = [
    { name: 'a', value: 1e308 },
    { name: 'b', value: 1e308 },
  ];
  sunburstChart(tree, { ...BOX, data: { name: 'All', children: kids } });
  hover(tree, 50, 50);
  expect(tipRows(tree)).toEqual(['All: over 1.79e+308']);
  const flow = host();
  const data = kids.map(k => ({ from: k.name, to: 'Out', n: k.value }));
  sankeyChart(flow, { ...BOX, data, text: false });
  hover(flow, 97, 50);
  expect(tipRows(flow)).toEqual(['Out: over 1.79e+308']);
});

test('types: sankeyChart checks field names; the tree charts take a nested tree and no fields', () => {
  const rows = flows();
  const columns = { a: ['x'], b: ['y'], n: new Float64Array([1]) };
  expectTypeOf(
    sankeyChart.spec({ data: rows, source: 'from', target: d => d.to, value: 'amount', blend: true }),
  ).toEqualTypeOf<Options>();
  sankeyChart.spec({ data: columns, source: 'a', target: 'b', value: 'n', text: false });
  sankeyChart.spec({ source: 'anything' });
  sankeyChart.spec({ data: [], source: 'anything' });
  const later = sankeyChart(host(), {});
  later.update({ data: rows, source: 'from' });
  const inferred = { name: 'Disk', children: [{ name: 'a', value: 1 }, { name: 'b' }] };
  const root: Nested = inferred;
  for (const chart of [treemapChart, sunburstChart] as const) {
    expectTypeOf(chart.spec({ data: root, shade: 0.3, text: false })).toEqualTypeOf<Options>();
    chart.spec({ data: inferred });
    chart.spec({ data: [root] as readonly Nested[] });
    const c = chart(host(), {});
    c.update({ data: root, colors: [RED] });
    c.update({ data: [root], shade: 0.5 });
    const wrongTree = () => {
      // @ts-expect-error a node has a name
      chart.spec({ data: [{ folder: 'a', size: 1 }] });
      // @ts-expect-error numbers are not a tree
      chart.spec({ data: [1, 2] });
      // @ts-expect-error columns are not a tree
      chart.spec({ data: { name: ['a'], value: [1] } });
      // @ts-expect-error a tree has no fields to name
      chart.spec({ data: root, value: 'value' });
      // @ts-expect-error there are no axes
      chart.spec({ data: root, zoom: true });
      // @ts-expect-error a node has a name
      c.update({ data: [{ folder: 'a' }] });
    };
    expect(wrongTree).toBeTypeOf('function');
  }
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    sankeyChart.spec({ data: rows, source: 'nope' });
    // @ts-expect-error a text field is not a value
    sankeyChart.spec({ data: rows, value: 'from' });
    // @ts-expect-error not a column
    sankeyChart.spec({ data: columns, target: 'nope' });
    // @ts-expect-error a text column is not a value
    sankeyChart.spec({ data: columns, value: 'a' });
    // @ts-expect-error numbers have no links
    sankeyChart.spec({ data: [1, 2] });
    // @ts-expect-error pairs have no links
    sankeyChart.spec({ data: [['a', 1]] });
    // @ts-expect-error a sankey has no x
    sankeyChart.spec({ data: rows, x: 'from' });
    // @ts-expect-error not a field of the rows
    later.update({ data: rows, target: 'nope' });
  };
  expect(wrong).toBeTypeOf('function');
});

const CLIMATE = [
  { month: 'Jan', temperature: 3, rain: 78 },
  { month: 'Feb', temperature: 4, rain: 61 },
  { month: 'Mar', temperature: 7, rain: 55 },
];
const MIXED = days(3, i => ({ a: i + 1, b: 2, c: 10 * (i + 1), d: 30 }));

test('comboChart draws the bars of rain on y2 under the line of temperature over a band x', () => {
  const spec = comboChart.spec({
    data: CLIMATE,
    lines: 'temperature',
    y2Bars: 'rain',
    y2Axis: { label: 'Rain (mm)' },
    colors: [RED, BLUE],
  });
  expect(spec.x).toMatchObject({ label: 'month', categories: ['Jan', 'Feb', 'Mar'] });
  expect([spec.y, spec.y2]).toEqual([
    { label: 'temperature', domain: 'nice' },
    { label: 'Rain (mm)', domain: 'nice' },
  ]);
  expect(spec.marks.map(m => [m.type, m.label, m.yAxis ?? 'y', m.color, numbers(barOptions(m).y)])).toEqual([
    ['bar', 'rain', 'y2', BLUE, [78, 61, 55]],
    ['line', 'temperature', 'y', RED, [3, 4, 7]],
  ]);
  expect(spec.marks.map(m => numbers(barOptions(m).x))).toEqual([
    [0, 1, 2],
    [0, 1, 2],
  ]);
  expect(spec.marks[0]!.options).not.toHaveProperty('width');
  expect(comboChart.spec({ data: CLIMATE, lines: 'temperature', y2Axis: {} })).not.toHaveProperty('y2');
});

test('comboChart takes all four props, one field or a list, with the bars first and colours in prop order', () => {
  const spec = comboChart.spec({
    data: MIXED,
    lines: 'a',
    bars: ['b'],
    y2Lines: d => d.c,
    y2Bars: 'd',
    colors: ['#000001', '#000002', '#000003', '#000004'],
  });
  expect(spec.marks.map(m => [m.type, m.label, m.yAxis ?? 'y', m.color])).toEqual([
    ['bar', 'b', 'y', '#000002'],
    ['bar', 'd', 'y2', '#000004'],
    ['line', 'a', 'y', '#000001'],
    ['line', 'y3', 'y2', '#000003'],
  ]);
  expect(spec.x).toMatchObject({ label: 'date', utc: true });
  expect(comboChart.spec({ data: { n: [1, 2], v: [3, 4] }, bars: 'v' }).x).toMatchObject({ label: 'n' });
  expect(comboChart.spec({ data: [{ n: 1, v: 2 }], y2Bars: 'v' }).x).toMatchObject({ label: 'n' });
  const indexed = comboChart.spec({ data: [{ v: 2 }, { v: 3 }], bars: 'v' });
  expect(indexed.x).toMatchObject({ label: '' });
  expect(numbers(barOptions(indexed.marks[0]!).x)).toEqual([0, 1]);
});

test('comboChart draws lines over bars, and bars of both axes side by side', () => {
  const el = host();
  comboChart(el, {
    data: [
      { name: 'p', bar: 3, other: 30, line: 2 },
      { name: 'q', bar: 3, other: 30, line: 2 },
    ],
    lines: 'line',
    bars: 'bar',
    y2Bars: 'other',
    ...BOX,
    legend: false,
    colors: [PURE, RED, BLUE],
    yAxis: { domain: [0, 4] },
    y2Axis: { domain: [0, 40] },
  });
  expect(near(pixel(el, 15, 90), [...rgb(RED), 255])).toBe(true);
  expect(near(pixel(el, 35, 90), [...rgb(BLUE), 255])).toBe(true);
  expect(pixel(el, 35, 50)[1]).toBeGreaterThan(150);
  expect(pixel(el, 35, 20)[3]).toBe(0);
});

test('comboChart bars on a number or time x take 0.6 of the smallest gap together, a lone one of a day or 1', () => {
  const widths = (o: Options) =>
    o.marks.filter(m => m.type === 'bar').map(m => (m.options as { width?: number }).width);
  const dates = ['2024-01-01', '2024-01-02', '2024-01-02', '2024-01-05'].map(date => ({ date, v: 1, w: 2 }));
  expect(widths(comboChart.spec({ data: dates, bars: ['v', 'w'] }))).toEqual([0.6 * DAY, 0.6 * DAY]);
  const unordered = comboChart.spec({ data: { n: [5, 1, 3], v: [50, 10, 30] }, x: 'n', bars: 'v' });
  expect(widths(unordered)[0]).toBeCloseTo(1.2);
  expect(numbers(barOptions(unordered.marks[0]!).y)).toEqual([50, 10, 30]);
  const lone = comboChart.spec({ data: dates.slice(0, 1), bars: 'v' });
  const start = Date.UTC(2024, 0, 1);
  expect(widths(lone)).toEqual([0.6 * DAY]);
  expect(lone.x).toMatchObject({ domain: [start - DAY / 2, start + DAY / 2] });
  expect(widths(comboChart.spec({ data: { n: [4], v: [1] }, x: 'n', bars: 'v' }))).toEqual([0.6]);
  expect(
    comboChart.spec({ data: { n: [4], v: [1] }, x: 'n', bars: 'v', xAxis: { domain: [0, 9] } }).x,
  ).toMatchObject({ domain: [0, 9] });
  expect(comboChart.spec({ data: { n: [4], v: [1] }, x: 'n', lines: 'v' }).x).toMatchObject({
    domain: 'nice',
  });

  const el = host();
  const props = {
    data: { n: [0, 10], v: [1, 1], w: [1, 1] },
    x: 'n',
    bars: ['v', 'w'],
    ...BOX,
    legend: false,
    colors: [RED, BLUE],
    xAxis: { domain: [-5, 15] as [number, number] },
    yAxis: { domain: [0, 1] as [number, number] },
  } as const;
  const c = comboChart(el, props);
  expect([8, 12, 22, 28, 38, 42].map(x => pixel(el, x, 55)[3] === 255)).toEqual([
    false,
    true,
    true,
    true,
    true,
    false,
  ]);
  expect(isRed(el, 20, 50)).toBe(true);
  expect(isRed(el, 30, 50)).toBe(false);
  c.update({ hidden: ['w'] });
  expect(isRed(el, 30, 50)).toBe(true);
});

test('comboChart stacks the bars of one axis and not its lines', () => {
  const spec = comboChart.spec({ data: MIXED, lines: 'a', bars: ['b', 'd'], y2Lines: 'c', stack: true });
  expect(spec.marks.map(m => [m.type, barOptions(m).stack, barOptions(m).dodge])).toEqual([
    ['bar', 'stack', undefined],
    ['bar', 'stack', undefined],
    ['line', undefined, undefined],
    ['line', undefined, undefined],
  ]);
  expect(() => comboChart.spec({ data: MIXED, lines: 'a', y2Bars: ['b', 'd'], stack: true })).not.toThrow();
  const both = { bars: 'b', y2Bars: 'd', stack: true } as const;
  expect(() => comboChart.spec({ data: MIXED, ...both })).toThrow(
    /^comboChart: stack does not apply to bars on both y and y2\. Leave out stack or y2Bars\.$/,
  );
  expect(() => comboChart.spec({ data: null, ...both })).not.toThrow();

  const el = host();
  comboChart(el, {
    data: MIXED,
    bars: ['a', 'b'],
    stack: true,
    ...BOX,
    legend: false,
    colors: [RED, BLUE],
    yAxis: { domain: [0, 10], format: v => `${v} mm` },
  });
  expect(tallShare(el, 50, RED)).toBeCloseTo(0.2, 1);
  expect(tallShare(el, 50, BLUE)).toBeCloseTo(0.2, 1);
  hover(el, 50, 90);
  expect(tipRows(el)).toEqual(['2024-01-02', 'a: 2 mm', 'b: 2 mm']);
});

test('comboChart errors name the four props, and nothing throws without data', () => {
  const bad = (props: object) => () => comboChart.spec({ data: MIXED, ...props } as never);
  for (const props of [{}, { lines: [], bars: [] }])
    expect(bad(props)).toThrow(
      /^comboChart: none of lines, bars, y2Lines and y2Bars is given\. The fields are date \(time\).*Pass at least one/,
    );
  expect(bad({ lines: 'a', y2Bars: ['b', 'a'] })).toThrow(
    /"a" is named in both lines and y2Bars.*Pass it in one/,
  );
  expect(bad({ bars: ['a', 'a'] })).toThrow(/"a" is named twice in bars.*Pass it once\.$/);
  expect(bad({ bars: 'date' })).toThrow(/^comboChart: bars "date" is time, not numbers/);
  expect(bad({ lines: 'a', y2Bars: 'nope' })).toThrow(/no field "nope".*Pass y2Bars as one of these fields/);
  expect(bad({ y2Lines: () => 'a' })).toThrow(/the accessor y2Lines is text/);
  for (const k of ['y', 'y2', 'series', 'errorBars'])
    expect(bad({ [k]: 'a' })).toThrow(`comboChart: use lines, bars, y2Lines and y2Bars, not ${k}`);
  expect(bad({ data: [1, 2], lines: 'value' })).toThrow(/^comboChart: a list of numbers or pairs/);
  expect(bad({ bars: 'a', yAxis: LOG })).toThrow(
    "comboChart: yAxis.scale 'log' does not apply, as bars start at zero, which it cannot show",
  );
  expect(bad({ lines: 'a', y2Bars: 'b', y2Axis: LOG })).toThrow(/^comboChart: y2Axis.scale 'log'/);
  const across = comboChart.spec({ data: GROWTH, x: 'week', lines: 'users', y2Bars: 'other', yAxis: LOG });
  expect(across.y).toMatchObject({ base: 10 });
  expect(numbers(optionsOf(across.marks[1]!).y)).toEqual([2, Number.NaN, 3]);
  for (const data of [null, undefined, []]) {
    expect(comboChart.spec({ data }).marks).toEqual([]);
    expect(comboChart.spec({ data, lines: 'a', y2Bars: ['b', 'b'] }).y2).toMatchObject({ domain: 'nice' });
    expect(comboChart.spec({ data, y: 'a' } as never).marks).toEqual([]);
  }
  comboChart(host(), { data: null, bars: 'a' });
});

test('comboChart tooltip gives every series at the nearest row in the format of its axis', () => {
  const formats = {
    yAxis: { domain: [0, 8] as [number, number], format: (v: number) => `${v} °C` },
    y2Axis: { domain: [0, 100] as [number, number], format: (v: number) => `${v} mm` },
  };
  const el = host();
  const c = comboChart(el, {
    data: CLIMATE,
    lines: 'temperature',
    y2Bars: 'rain',
    ...BOX,
    legend: false,
    ...formats,
  });
  for (const x of [38, 50, 60]) {
    hover(el, x, 60);
    expect(tipRows(el)).toEqual(['Feb', 'rain: 61 mm', 'temperature: 4 °C']);
  }
  c.update({ y2Axis: { ...formats.y2Axis, format: v => `${v / 10} cm` } });
  hover(el, 50, 60);
  expect(tipRows(el)).toEqual(['Feb', 'rain: 6.1 cm', 'temperature: 4 °C']);

  const timed = host();
  comboChart(timed, {
    data: MIXED.map(d => ({ ...d, b: d.a === 2 ? null : d.b })),
    lines: 'a',
    bars: 'b',
    ...BOX,
    legend: false,
  });
  for (const x of [35, 65]) {
    hover(timed, x, 50);
    expect(tipRows(timed)).toEqual(['2024-01-02', 'b: –', 'a: 2']);
  }
});

test('comboChart tooltip on the boundary of two categories gives the title and the values of one row', () => {
  const el = host();
  const data = [
    { name: 'p', a: 1, b: 10 },
    { name: 'q', a: 2, b: 20 },
  ];
  comboChart(el, { data, lines: 'a', bars: 'b', ...BOX, legend: false });
  const rows = [
    ['p', 'b: 10', 'a: 1'],
    ['q', 'b: 20', 'a: 2'],
  ];
  for (const x of [49, 50]) {
    hover(el, x, 60);
    expect(rows).toContainEqual(tipRows(el));
  }
  hover(el, 51, 60);
  expect(tipRows(el)).toEqual(rows[1]);
});

test('comboChart fits a window to its lines as drawn at the edges, as lineChart does', () => {
  const props = { data: { n: [0, 10, 20], v: [0, 1, 1000] }, x: 'n', ...BOX, legend: false } as const;
  const fit = { yAxis: { fit: 'window' } } as const;
  for (const x of [
    [9, 16],
    [-5, 4],
  ] as [number, number][]) {
    const [combo, plain] = [host(), host()];
    comboChart(combo, { ...props, ...fit, lines: 'v', view: { x } });
    lineChart(plain, { ...props, ...fit, y: 'v', view: { x } });
    expect(drawn(combo)).toBe(drawn(plain));
  }
});

test('comboChart bars of an unsorted x with gaps are clicked, selected and hovered by their row in the data', () => {
  const props = {
    data: { n: [null, 5, 1, null, 3], v: [1000, 50, 10, 1000, 30], w: [9, 5, 1, 9, 3] },
    x: 'n',
    bars: 'v',
    ...BOX,
    legend: false,
    xAxis: { domain: [0, 6] as [number, number] },
    yAxis: { domain: [0, 50] as [number, number] },
  } as const;
  for (const stack of [false, true]) {
    const el = host();
    const onClick = vi.fn();
    comboChart(el, { ...props, stack, lines: 'w', onClick });
    for (const [px, row] of [
      [83, 1],
      [17, 2],
      [50, 4],
    ] as const) {
      click(el, px, 95);
      expect(onClick.mock.lastCall![0]).toMatchObject({ row, x: props.data.n[row] });
      hover(el, px, 95);
      expect(tipRows(el)).toEqual([
        String(props.data.n[row]),
        `v: ${props.data.v[row]}`,
        `w: ${props.data.w[row]}`,
      ]);
    }
    const [plain, picked] = [host(), host()];
    comboChart(plain, { ...props, stack });
    comboChart(picked, { ...props, stack, selected: [{ id: 'v', rows: [1] }] });
    const differs = (from: number) =>
      [...Array(33).keys()].some(i => !near(pixel(plain, from + i, 95), pixel(picked, from + i, 95)));
    expect([0, 33, 66].map(differs)).toEqual([false, false, true]);
  }
});

test('comboChart bars on a text x with a gap are clicked and selected by their row in the data', () => {
  const props = {
    data: { name: [null, 'p', 'q'], v: [1000, 50, 40] },
    x: 'name',
    bars: 'v',
    ...BOX,
    legend: false,
    yAxis: { domain: [0, 50] as [number, number] },
  } as const;
  for (const stack of [false, true]) {
    const onClick = vi.fn();
    const [el, picked] = [host(), host()];
    comboChart(el, { ...props, stack, onClick });
    for (const [px, row] of [
      [25, 1],
      [75, 2],
    ] as const) {
      click(el, px, 95);
      expect(onClick.mock.lastCall![0]).toMatchObject({ row });
    }
    comboChart(picked, { ...props, stack, selected: [{ id: 'v', rows: [1] }] });
    const differs = (from: number) =>
      [...Array(50).keys()].some(i => !near(pixel(el, from + i, 95), pixel(picked, from + i, 95)));
    expect([0, 50].map(differs)).toEqual([true, false]);
  }
});

test('comboChart lists two or more series in the legend, and takes rules, zones and brush', () => {
  const box = { width: 300, height: 200 };
  const legendOf_ = (props: object) => {
    const el = host();
    comboChart(el, { data: CLIMATE, lines: 'temperature', y2Bars: 'rain', ...box, ...props });
    return entriesOf(el).map(e => e.textContent);
  };
  expect(legendOf_({})).toEqual(['rain', 'temperature']);
  expect(legendOf_({ legend: false })).toEqual([]);
  expect(legendOf_({ y2Bars: undefined })).toEqual([]);
  const spec = comboChart.spec({
    data: CLIMATE,
    lines: 'temperature',
    y2Bars: 'rain',
    rules: [{ x: 'Feb' }],
    zones: [{ x: ['Jan', 'Feb'] }],
  });
  expect(spec.marks.map(m => m.key)).toEqual(['zone:0', 'series:rain', 'series:temperature', 'rule:0']);
  expect(spec.marks[0]!.options).toMatchObject({ x1: -0.5, x2: 1.5 });
  const onBrush = vi.fn();
  const el = host();
  comboChart(el, { data: MIXED, bars: 'a', ...BOX, brush: true, onBrush });
  drag(el, [20, 50], [80, 50]);
  expect(onBrush).toHaveBeenCalledTimes(1);
});

test('comboChart identity: an equal copy sends nothing, and a field moved between the props moves', () => {
  for (const x of ['month', 'n']) {
    const data = CLIMATE.map((d, n) => ({ ...d, n }));
    type Row = (typeof data)[number];
    const props = (): ComboProps<Row[]> => ({
      data,
      x: x as 'n',
      lines: ['temperature'],
      y2Bars: ['rain'],
      y2Axis: { step: 20 },
      zones: [{ y: [1, 2] }],
    });
    const el = host();
    const c = comboChart(el, { ...BOX, ...props() });
    const update = vi.spyOn(c.chart, 'update');
    c.update(props());
    expect(update).not.toHaveBeenCalled();
    const fresh = (p: ComboProps<Row[]>) => {
      const one = host();
      comboChart(one, { ...BOX, ...props(), ...p });
      return drawn(one);
    };
    for (const p of [
      { lines: 'temperature', bars: 'rain', y2Bars: undefined },
      { lines: ['temperature', 'rain'], bars: undefined, y2Bars: undefined },
      { lines: 'temperature', bars: undefined, y2Bars: 'rain' },
    ] as ComboProps<Row[]>[]) {
      c.update(p);
      expect(drawn(el)).toBe(fresh(p));
    }
  }
});

test('types: comboChart takes number fields of rows and columns', () => {
  const cols = { t: [1], v: [1], w: [1], note: ['a'] };
  comboChart.spec({ data: cols, x: 't', lines: 'v', y2Bars: ['w'], y2Axis: { scale: 'linear' } });
  comboChart.spec({ data: CLIMATE, lines: [d => d.temperature], y2Bars: 'rain', stack: true });
  comboChart.spec({ lines: 'anything', y2Bars: ['other'] });
  const later = comboChart(host(), {});
  later.update({ data: CLIMATE, bars: 'rain' });
  const wrong = () => {
    // @ts-expect-error not a field of the rows
    comboChart.spec({ data: CLIMATE, lines: 'nope' });
    // @ts-expect-error a text field is not drawn
    comboChart.spec({ data: CLIMATE, bars: 'month' });
    // @ts-expect-error not a column of numbers
    comboChart.spec({ data: cols, y2Lines: ['w', 'note'] });
    // @ts-expect-error a field list holds fields of the rows
    comboChart.spec({ data: CLIMATE, y2Bars: ['rain', 'nope'] });
    // @ts-expect-error the fields are named by lines and bars
    comboChart.spec({ data: CLIMATE, y: 'rain' });
    // @ts-expect-error numbers have no fields to name
    comboChart.spec({ data: [1, 2], lines: 'value' });
    // @ts-expect-error not a field of the rows
    later.update({ data: CLIMATE, bars: 'nope' });
  };
  expect(wrong).toBeTypeOf('function');
});
