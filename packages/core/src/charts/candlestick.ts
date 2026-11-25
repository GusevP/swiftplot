import { candlestick } from '../marks/candlestick.js';
import { band } from '../scales/band.js';
import type { Axis, Col, Span } from '../types.js';
import { dates, defined, easyChart, featuresOf, given, install, linear, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { colorsFor, DAY, formatNumber, namesOf, spacing } from './defaults.js';
import { reader, type Field } from './fields.js';
import type { Kind, Source } from './source.js';
import type { Axes, Base, CandlestickProps } from './types.js';

const NAME = 'candlestickChart';
const PRICES = ['open', 'high', 'low', 'close'] as const;
const LISTED = 'open, high, low and close';

type Price = (typeof PRICES)[number];
type CandlestickFields<R> = { x?: Field<R> } & { [K in Price]?: Field<R> };
type CandlestickInput = Axes &
  Base &
  CandlestickFields<never> &
  Pick<CandlestickProps<undefined>, 'up' | 'down'> & { data?: unknown };
type Picked = {
  kind: Kind;
  label: string;
  x: Col;
  width: number;
  lone?: Span;
  categories?: string[];
  nameAt: (row: number) => string;
  prices: Record<Price, Col>;
};

function pick<R>(s: Source<R>, p: CandlestickFields<R>, utc: boolean): Picked | undefined {
  const { kinds, fail, check, read, numeric } = reader(s, NAME);
  if (!s.length) return undefined;
  if (s.shape)
    fail('a list of numbers or pairs has no candles', `rows or columns with fields for x, ${LISTED}`);
  const named = PRICES.map(k => [k, p[k]] as const);
  check([['x', p.x], ...named], PRICES);
  const unnamed = s.fields().filter(f => f !== p.x && !named.some(([, g]) => g === f));
  const priced = PRICES.map((role): [Price, Field<R>] => {
    const field = p[role];
    if (field !== undefined) return [role, field];
    const found = unnamed.filter(f => f.toLowerCase() === role);
    if (found.length !== 1)
      fail(
        found.length
          ? `${found.map(f => `"${f}"`).join(', ')} are all called ${role}, so it cannot be guessed`
          : `there is no field called ${role}`,
        `${LISTED} as fields of numbers`,
      );
    return [role, found[0]!];
  });
  const pool = check([['x', p.x], ...priced], PRICES);
  const first = (k: Kind) => pool.find(f => kinds.get(f) === k);
  const x =
    p.x ??
    first('time') ??
    first('text') ??
    fail('there is no field of dates or text for x', 'x as the field of where each candle stands');
  const prices = Object.fromEntries(priced.map(([k, f]) => [k, numeric(f, k).values])) as Record<Price, Col>;
  const { kind, values, categories } = read(x, 'the accessor x', 'x', { utc });
  const name = namesOf(kind, categories, [values], utc);
  const at =
    kind === 'text' ? Float64Array.from(values, (v, i) => (Number.isFinite(v) ? i : Number.NaN)) : values;
  const nameAt = (row: number) => (Number.isFinite(values[row]) ? name(values[row]!) : '');
  return {
    kind,
    label: typeof x === 'string' ? x : '',
    x: at,
    ...(kind === 'text'
      ? { width: 0.6, categories: Array.from(at, (_, i) => nameAt(i)) }
      : spacing(at, kind === 'time' ? DAY : 1)),
    nameAt,
    prices,
  };
}

function xAxis({ kind, label, lone, categories }: Picked, a: Axes['xAxis'], utc: boolean): Axis {
  if (categories) return band({ label: a?.label ?? label, categories });
  const shown = lone && !Array.isArray(a?.domain) ? { ...a, domain: lone } : a;
  return kind === 'number' ? linear(shown, label) : dates(shown, label, utc);
}

const build: Build<CandlestickInput> = (p, { source: s, theme, memo }) => {
  if (s.length)
    for (const k of ['y', 'series', 'label', 'value'])
      if (given(p, k)) throw new Error(`${NAME}: use x, ${LISTED}, not ${k}`);
  const utc = p.xAxis?.utc ?? true;
  const picked = memo('fields', [s, p.x, ...PRICES.map(k => p[k]), utc], () => pick(s, p, utc));
  const color = colorsFor(theme, p.colors, 1)[0]!;
  const marks = memo('marks', [picked, color, p.up, p.down], () =>
    picked
      ? [
          candlestick(
            defined({
              key: 'candlestick',
              label: 'price',
              x: picked.x,
              ...picked.prices,
              width: picked.width,
              color,
              up: p.up,
              down: p.down,
            }),
          ),
        ]
      : [],
  );
  const features = featuresOf(p, 1);
  const text = { picked, value: p.yAxis?.format ?? formatNumber };
  const ref = memo<{ current?: typeof text }>('tooltip', [], () => ({}));
  ref.current = text;
  return {
    options: {
      ...sizeOf(p),
      theme,
      x: picked ? xAxis(picked, p.xAxis, utc) : linear(p.xAxis, ''),
      y: linear(p.yAxis, ''),
      marks,
    },
    features,
    use: () => {
      ref.current = text;
      return install(features, {
        mode: 'nearest',
        text: (_label, _x, _y, row) => {
          const { picked: shown, value } = ref.current!;
          const numbers = PRICES.map(k => `${k} ${value(shown!.prices[k][row!]!)}`);
          return `${shown!.nameAt(row!)} · ${numbers.join(', ')}`;
        },
      });
    },
  };
};

export const candlestickChart = easyChart<'candlestick'>(build);
