import { heatmap } from '../marks/heatmap.js';
import { band } from '../scales/band.js';
import type { Col } from '../types.js';
import { defined, easyChart, featuresOf, given, install, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { formatNumber, namesOf } from './defaults.js';
import { reader, type Field } from './fields.js';
import type { Column, Source } from './source.js';
import type { Base, HeatmapProps } from './types.js';

type HeatmapFields<R> = { x?: Field<R>; y?: Field<R>; value?: Field<R> };
type HeatmapInput = Base &
  HeatmapFields<never> &
  Pick<HeatmapProps<undefined>, 'color' | 'xAxis' | 'yAxis'> & { data?: unknown };
type Side = { label: string; categories: string[] };
type Picked = { x: Side; y: Side; label: string; values: Col; some: boolean };

const NAME = 'heatmapChart';
const MAX_CELLS = 10_000_000;

export const fits = (columns: number, rows: number) => columns * rows <= MAX_CELLS;

function pick<R>(s: Source<R>, p: HeatmapFields<R>): Picked | undefined {
  const { kinds, fail, check, sole, read, numeric } = reader(s, NAME);
  if (!s.length) return undefined;
  if (s.shape)
    fail('a list of numbers or pairs has no cells', 'rows or columns with fields for x, y and value');
  const pool = check(
    [
      ['x', p.x],
      ['y', p.y],
      ['value', p.value],
    ],
    ['value'],
  );
  const named = pool.filter(f => kinds.get(f) === 'text' || kinds.get(f) === 'time');
  const side = (role: 'x' | 'y') =>
    p[role] ??
    named.shift() ??
    fail(`there is no field of text or dates left for ${role}`, `${role} as a field of the cells' places`);
  const x = side('x');
  const y = side('y');
  const value = sole('value', p.value, pool);

  const { values } = numeric(value, 'value');
  const xs = read(x, 'the accessor x', 'x');
  const ys = read(y, 'the accessor y', 'y');
  const kept = Array.from({ length: s.length }, (_, i) => i).filter(
    i => Number.isFinite(xs.values[i]) && Number.isFinite(ys.values[i]),
  );
  const lay = (f: Field<R>, { kind, values: at, categories }: Column) => {
    const order = [...new Set(kept.map(i => at[i]!))];
    if (kind !== 'text') order.sort((a, b) => a - b);
    return {
      label: typeof f === 'string' ? f : '',
      categories: order.map(namesOf(kind, categories, [order], true)),
      slots: new Map(order.map((v, i) => [v, i])),
    };
  };
  const { slots: columns, ...across } = lay(x, xs);
  const { slots: rows, ...up } = lay(y, ys);
  if (!fits(columns.size, rows.size))
    fail(
      `a grid of ${formatNumber(columns.size)} columns by ${formatNumber(rows.size)} rows is over the limit of ${formatNumber(MAX_CELLS)} cells`,
      'x and y as fields with fewer distinct values',
    );
  const cells = new Float64Array(columns.size * rows.size).fill(Number.NaN);
  for (const i of kept)
    cells[rows.get(ys.values[i]!)! * columns.size + columns.get(xs.values[i]!)!] = values[i]!;
  return {
    x: across,
    y: up,
    label: typeof value === 'string' ? value : 'value',
    values: cells,
    some: cells.some(Number.isFinite),
  };
}

const build: Build<HeatmapInput> = (p, { source: s, theme, memo }) => {
  if (s.length) {
    if (given(p, 'label')) throw new Error(`${NAME}: use x, y and value, not label and value`);
    if (given(p, 'zoom')) throw new Error(`${NAME}: zoom does not apply to a grid of cells`);
  }
  const picked = memo('fields', [s, p.x, p.y, p.value], () => pick(s, p));
  const { color: scale } = p;
  // By value, not identity: a scale made inline is new on every render.
  const color = memo(
    'color',
    scale ? [...(scale.domain ?? []), ...scale.stops, ...scale.table] : [],
    () => scale,
  );
  const axis = (side: Side | undefined, label: string | undefined) =>
    band({ label: label ?? side?.label ?? '', categories: side?.categories ?? [] });
  const features = featuresOf({ ...p, zoom: false }, picked?.some ? 2 : 0);
  const ref = memo<{ current?: Picked }>('tooltip', [], () => ({}));
  ref.current = picked;
  return {
    options: {
      ...sizeOf(p),
      theme,
      x: axis(picked?.x, p.xAxis?.label),
      y: axis(picked?.y, p.yAxis?.label),
      marks: picked
        ? [
            heatmap(
              defined({
                key: 'heatmap',
                label: picked.label,
                values: picked.values,
                columns: picked.x.categories.length,
                color,
              }),
            ),
          ]
        : [],
    },
    features,
    use: () => {
      ref.current = picked;
      return install(features, {
        mode: 'nearest',
        text: (label, _x, _y, row) => {
          const { x, y, values } = ref.current!;
          const n = x.categories.length;
          const [column, line] = [x.categories[row! % n], y.categories[Math.floor(row! / n)]];
          return `${column} · ${line} · ${label}: ${formatNumber(values[row!]!)}`;
        },
      });
    },
  };
};

export const heatmapChart = easyChart<'heatmap'>(build);
