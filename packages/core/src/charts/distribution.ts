import { bar } from '../marks/bar.js';
import { box } from '../marks/box.js';
import { band } from '../scales/band.js';
import { bin, fiveNumbers } from '../transforms.js';
import { defined, easyChart, featuresOf, given, install, linear, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { colorsFor, formatNumber, namesOf } from './defaults.js';
import { reader, type Field } from './fields.js';
import type { Source } from './source.js';
import type { Axes, Base, BoxPlotProps, HistogramProps } from './types.js';

type HistogramInput = Axes &
  Base & { data?: unknown; x?: Field<never> } & Pick<HistogramProps<undefined>, 'bins'>;
type Bins = ReturnType<typeof bin>;
type Counts = { label: string; bins: Bins; edge: (v: number) => string };

const HISTOGRAM = 'histogramChart';
const MAX_BINS = 1_000_000;

/** Two decimals at most, or as many as tell the edges of the narrowest bin apart, in full past the 20 all engines take. */
function edgeFormat({ x1, x2 }: Bins) {
  let narrowest = Infinity;
  for (let i = 0; i < x1.length; i++) {
    const w = x2[i]! - x1[i]!;
    if (w > 0 && w < narrowest) narrowest = w;
  }
  const digits = Math.max(Math.ceil(-Math.log10(narrowest)) + 1, 2);
  if (digits > 20) return String;
  const f = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits });
  return (v: number) => f.format(v);
}

function count<R>(s: Source<R>, named: Field<R> | undefined, by: HistogramInput['bins']): Counts | undefined {
  const { fail, check, sole, numeric } = reader(s, HISTOGRAM);
  if (!s.length) return undefined;
  if (s.shape === 'pairs')
    fail(
      'a list of pairs has no one list of values',
      'numbers, or rows or columns with a field of numbers for x',
    );
  if (typeof by === 'number' && by > MAX_BINS)
    throw new Error(`${HISTOGRAM}: ${formatNumber(by)} bins are over the limit of ${formatNumber(MAX_BINS)}`);
  const given = s.shape ? 'value' : named;
  const x = sole('x', given, check([['x', given]], ['x']));
  const bins = bin(numeric(x, 'x').values, by);
  return { label: typeof x === 'string' ? x : '', bins, edge: edgeFormat(bins) };
}

const buildHistogram: Build<HistogramInput> = (p, { source: s, theme, memo }) => {
  if (s.length)
    for (const k of ['y', 'label', 'value'])
      if (given(p, k)) throw new Error(`${HISTOGRAM}: use x for the values counted, not ${k}`);
  const { bins: by } = p;
  const picked = memo(
    'fields',
    [s, p.x, typeof by, ...(typeof by === 'object' ? Array.from(by) : [by])],
    () => count(s, p.x, by),
  );
  const features = featuresOf(p, 1);
  const text = { picked, x: p.xAxis?.format ?? picked?.edge, y: p.yAxis?.format ?? formatNumber };
  const ref = memo<{ current?: typeof text }>('tooltip', [], () => ({}));
  ref.current = text;
  return {
    options: {
      ...sizeOf(p),
      theme,
      x: linear(p.xAxis, picked?.label ?? ''),
      y: linear(p.yAxis, picked ? 'count' : ''),
      marks: picked
        ? [
            bar({
              key: 'histogram',
              label: 'count',
              ...picked.bins,
              color: colorsFor(theme, p.colors, 1)[0]!,
              gap: 1,
            }),
          ]
        : [],
    },
    features,
    use: () => {
      ref.current = text;
      return install(features, {
        mode: 'nearest',
        text: (label, _x, v, row) => {
          const { picked: shown, x, y } = ref.current!;
          const { x1, x2 } = shown!.bins;
          return `${x!(x1[row!]!)} – ${x!(x2[row!]!)} · ${label}: ${y(v)}`;
        },
      });
    },
  };
};

type BoxFields<R> = { x?: Field<R> | null; y?: Field<R> };
type BoxInput = Base &
  BoxFields<never> & { data?: unknown } & Pick<BoxPlotProps<undefined>, 'fill' | 'xAxis' | 'yAxis'>;
type Boxes = {
  x: string;
  y: string;
  label: string;
  categories: string[];
  at: Float64Array;
  five: ReturnType<typeof fiveNumbers>;
};

const BOX_PLOT = 'boxPlotChart';

function boxes<R>(s: Source<R>, props: BoxFields<R>): Boxes | undefined {
  const { kinds, fail, check, sole, read, numeric } = reader(s, BOX_PLOT);
  if (!s.length) return undefined;
  const p: BoxFields<R> =
    s.shape === 'numbers' ? { y: 'value' } : s.shape === 'pairs' ? { x: 'x', y: 'y' } : props;
  const pool = check(
    [
      ['x', p.x ?? undefined],
      ['y', p.y],
    ],
    ['y'],
  );
  const y = sole('y', p.y, pool);
  const { values } = numeric(y, 'y');
  let x = p.x;
  if (x === undefined) {
    const texts = pool.filter(f => kinds.get(f) === 'text');
    const pass = 'or x: null for one box';
    if (texts.length > 1)
      fail(
        `${texts.map(f => `"${f}"`).join(', ')} are all fields of text, so x cannot be guessed`,
        `x as one of them, ${pass}`,
      );
    x = texts[0];
    if (x !== undefined) {
      const c = read(x, '', 'x');
      if (c.categories!.length === c.values.length - Array.from(c.values).filter(Number.isNaN).length)
        fail(
          `no value of "${x}" repeats, so every box would hold one row`,
          `x as the field of groups, ${pass}`,
        );
    }
  }
  const groups = new Map<number, number[]>();
  let categories = [''];
  if (x != null) {
    const by = read(x, 'the accessor x', 'x');
    for (let i = 0; i < s.length; i++) {
      const g = by.values[i]!;
      if (!Number.isFinite(g)) continue;
      const group = groups.get(g);
      if (group) group.push(values[i]!);
      else groups.set(g, [values[i]!]);
    }
    const name = namesOf(by.kind, by.categories, [by.values], true);
    categories = Array.from(groups.keys(), name);
  }
  return {
    x: typeof x === 'string' ? x : '',
    y: typeof y === 'string' ? y : '',
    label: typeof y === 'string' ? y : 'y',
    categories,
    at: Float64Array.from(categories, (_, i) => i),
    five: fiveNumbers(x == null ? [values] : [...groups.values()]),
  };
}

const buildBoxPlot: Build<BoxInput> = (p, { source: s, theme, memo }) => {
  if (s.length) {
    if (given(p, 'label') || given(p, 'value'))
      throw new Error(`${BOX_PLOT}: use x and y, not label and value`);
    if (given(p, 'zoom')) throw new Error(`${BOX_PLOT}: zoom does not apply to boxes`);
  }
  const picked = memo('fields', [s, p.x, p.y], () => boxes(s, p));
  const features = featuresOf({ ...p, zoom: false }, 1);
  const text = { picked, value: p.yAxis?.format ?? formatNumber };
  const ref = memo<{ current?: typeof text }>('tooltip', [], () => ({}));
  ref.current = text;
  return {
    options: {
      ...sizeOf(p),
      theme,
      x: band({ label: p.xAxis?.label ?? picked?.x ?? '', categories: picked?.categories ?? [] }),
      y: linear(p.yAxis, picked?.y ?? ''),
      marks: picked
        ? [
            box(
              defined({
                key: 'box',
                label: picked.label,
                x: picked.at,
                ...picked.five,
                color: colorsFor(theme, p.colors, 1)[0]!,
                fill: p.fill,
              }),
            ),
          ]
        : [],
    },
    features,
    use: () => {
      ref.current = text;
      return install(features, {
        mode: 'nearest',
        text: (label, _x, _y, row) => {
          const { picked: shown, value } = ref.current!;
          const group = shown!.categories[row!];
          const numbers = Object.entries(shown!.five).map(([k, v]) => `${k} ${value(v[row!]!)}`);
          return `${group ? `${group} · ` : ''}${label}: ${numbers.join(', ')}`;
        },
      });
    },
  };
};

export const histogramChart = easyChart<'histogram'>(buildHistogram);
export const boxPlotChart = easyChart<'boxPlot'>(buildBoxPlot);
