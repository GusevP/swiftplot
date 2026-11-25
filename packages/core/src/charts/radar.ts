import { radar } from '../marks/radar.js';
import type { Col, Mark } from '../types.js';
import { defined, easyChart, featuresOf, given, install, noAxes, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { colorsFor, formatNumber, namesOf } from './defaults.js';
import { list, reader, type Field } from './fields.js';
import type { Source } from './source.js';
import type { Base } from './types.js';

type RadarFields<R> = { x?: Field<R>; y?: Field<R> | readonly Field<R>[] };
type RadarInput = Base & RadarFields<never> & { data?: unknown; max?: number; fill?: number };
type Picked = { axes: string[]; shapes: { id: string; label: string; values: Col }[] };

const NAME = 'radarChart';

function pick<R>(s: Source<R>, props: RadarFields<R>): Picked {
  const { kinds, check, noNumbers, read, numeric } = reader(s, NAME);
  if (!s.length) return { axes: [], shapes: [] };
  const p: RadarFields<R> =
    s.shape === 'numbers' ? { y: 'value' } : s.shape === 'pairs' ? { x: 'x', y: 'y' } : props;
  const named = list(p.y ?? undefined);
  const pool = check([['x', p.x], ...named.map(f => ['y', f] as const)], ['y']);
  const x = p.x ?? pool.find(f => kinds.get(f) === 'text');
  const ys = named.length ? named : pool.filter(f => kinds.get(f) === 'number');
  if (!ys.length) noNumbers('y');
  const spokes = x === undefined ? undefined : read(x, 'the accessor x', 'x');
  const nameOf = spokes && namesOf(spokes.kind, spokes.categories, [spokes.values], true);
  const ids = new Set<Field<R>>(ys);
  const seen = new Set<Field<R>>();
  const idOf = (f: Field<R>, label: string) => {
    let id = label;
    if (typeof f !== 'string' || seen.has(f)) for (let n = 2; ids.has(id); n++) id = `${label} (${n})`;
    ids.add(id);
    seen.add(f);
    return id;
  };
  return {
    axes: Array.from({ length: s.length }, (_, i) =>
      nameOf && Number.isFinite(spokes.values[i]) ? nameOf(spokes.values[i]!) : '',
    ),
    shapes: ys.map((f, i) => {
      const label = typeof f === 'string' ? f : `y${i + 1}`;
      return { id: idOf(f, label), label, values: numeric(f, 'y', `${i + 1}`).values };
    }),
  };
}

const build: Build<RadarInput> = (p, { source: s, theme, memo }) => {
  if (s.length) {
    if (given(p, 'label') || given(p, 'value')) throw new Error(`${NAME}: use x and y, not label and value`);
    noAxes(p, NAME);
  }
  const picked = memo('fields', [s, p.x, ...list(p.y ?? undefined)], () => pick(s, p));
  const { axes, shapes } = picked;
  const colors = colorsFor(theme, p.colors, shapes.length);
  const marks = memo('marks', [picked, p.max, p.fill, ...colors], (): Mark[] => {
    if (!shapes.length) return [];
    const series = shapes.map(({ id, ...r }, i) => ({
      ...r,
      key: `shape:${id}`,
      group: id,
      color: colors[i]!,
    }));
    const [grid, ...rest] = radar(defined({ axes, series, max: p.max, fill: p.fill }));
    return [{ ...grid!, key: 'radar-grid' }, ...rest];
  });
  const features = featuresOf({ ...p, zoom: false }, shapes.length);
  const ref = memo<{ current?: Picked }>('tooltip', [], () => ({}));
  ref.current = picked;
  return {
    options: { ...sizeOf(p), theme, frame: 'polar', marks },
    features,
    use: () => {
      ref.current = picked;
      return install(features, {
        mode: 'nearest',
        text: (label, _x, v, row) => {
          const spoke = ref.current!.axes[row!];
          return `${spoke ? `${spoke} · ` : ''}${label}: ${Number.isFinite(v) ? formatNumber(v) : '–'}`;
        },
      });
    },
  };
};

export const radarChart = easyChart<'radar'>(build);
