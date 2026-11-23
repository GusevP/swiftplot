import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';

import { create, type Build, type EasyChart } from '../src/charts/controller.js';
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
import { xy } from '../src/charts/xy.js';
import { bandTitle, colorsFor, formatNumber, themeOf, timeTitle } from '../src/charts/defaults.js';
import { assign, type Assigned, type Family, type FieldProps } from '../src/charts/fields.js';
import { source, type Data } from '../src/charts/source.js';
import type { AreaProps, Base, Input, ScatterProps } from '../src/charts/types.js';
import { dots, legend, line, plot, time, tooltip, zoom } from '../src/index.js';
import type { BandAxis } from '../src/scales/band.js';
import type { Col, Feature, Internals, Mark, Options } from '../src/types.js';
import { palette, paletteDark } from '../src/paint.js';
import { dark, light, type Theme } from '../src/theme.js';
import {
  click,
  doubleClick,
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
  // @ts-expect-error a text field is not a y
  scatterChart.spec({ data: rows, x: 'date', y: 'note' });
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

type TestProps = Base & { data?: unknown } & Pick<FieldProps<Record<string, number>>, 'x' | 'y' | 'series'>;

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
    ['api', 'api'],
    ['web', 'web'],
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

  const yAfterZoom = async (zoom: Base['zoom']) => {
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
