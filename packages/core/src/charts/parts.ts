import { arcs } from '../marks/arcs.js';
import { funnel } from '../marks/funnel.js';
import { radialBars } from '../marks/radialBars.js';
import type { Col, Mark, Options } from '../types.js';
import { defined, easyChart, featuresOf, given, install, noAxes, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { colorsFor, formatNumber, namesOf } from './defaults.js';
import { reader, type Field } from './fields.js';
import type { Source } from './source.js';
import type { Base, FunnelProps, PieProps, RadialBarProps } from './types.js';

type PartFields<R> = { label?: Field<R>; value?: Field<R> };
type PartInput = Base & PartFields<never> & { data?: unknown };
type Picked = { label: string; values: Col; labels?: string[] };
type Part = { key: string; label: string; values: Col; labels?: string[]; colors: string[] };

function pick<R>(s: Source<R>, p: PartFields<R>, name: string): Picked | undefined {
  const { kinds, check, sole, read, numeric } = reader(s, name);
  if (!s.length) return undefined;
  const given: PartFields<R> =
    s.shape === 'numbers' ? { value: 'value' } : s.shape === 'pairs' ? { label: 'x', value: 'y' } : p;
  const pool = check(
    [
      ['label', given.label],
      ['value', given.value],
    ],
    ['value'],
  );
  const label = given.label ?? pool.find(f => kinds.get(f) === 'text');
  const value = sole('value', given.value, pool);
  const { values } = numeric(value, 'value');
  const named = label === undefined ? undefined : read(label, 'the accessor label', 'label');
  const nameOf = named && namesOf(named.kind, named.categories, [named.values], true);
  return {
    label: typeof value === 'string' ? value : 'value',
    values,
    ...(named && { labels: Array.from(named.values, v => (Number.isFinite(v) ? nameOf!(v) : '')) }),
  };
}

function reject(p: PartInput, name: string) {
  if (given(p, 'x') || given(p, 'y')) throw new Error(`${name}: use label and value, not x and y`);
  noAxes(p, name);
}

function parts<P>(
  kind: string,
  frame: Options['frame'],
  draw: (part: Part, props: P) => Mark,
): Build<PartInput & P> {
  const name = `${kind}Chart`;
  return (p, { source: s, theme, memo }) => {
    if (s.length) reject(p, name);
    const picked = memo('fields', [s, p.label, p.value], () => pick(s, p, name));
    const features = featuresOf({ ...p, zoom: false }, picked?.labels?.length ?? 0);
    const ref = memo<{ current?: Picked }>('tooltip', [], () => ({}));
    ref.current = picked;
    return {
      options: {
        ...sizeOf(p),
        theme,
        frame,
        marks: picked
          ? [
              draw(
                defined({ key: kind, ...picked, colors: colorsFor(theme, p.colors, picked.values.length) }),
                p,
              ),
            ]
          : [],
      },
      features,
      use: () => {
        ref.current = picked;
        return install(features, {
          mode: 'nearest',
          text: (label, _x, _y, row) =>
            `${label || ref.current!.label}: ${formatNumber(ref.current!.values[row!]!)}`,
        });
      },
    };
  };
}

const shown = (text: boolean | undefined) => (text === false ? undefined : true);

export const pieChart = easyChart<'pie'>(
  parts('pie', 'polar', (part, p: Pick<PieProps<undefined>, 'inner' | 'text' | 'sweep'>) =>
    arcs(defined({ ...part, inner: p.inner, text: shown(p.text), sweep: p.sweep })),
  ),
);
export const funnelChart = easyChart<'funnel'>(
  parts('funnel', 'blank', (part, p: Pick<FunnelProps<undefined>, 'text' | 'fill'>) =>
    funnel(defined({ ...part, text: shown(p.text), fill: p.fill })),
  ),
);
export const radialBarChart = easyChart<'radialBar'>(
  parts('radialBar', 'polar', (part, p: Pick<RadialBarProps<undefined>, 'max' | 'sweep' | 'inner'>) =>
    radialBars(defined({ ...part, max: p.max, sweep: p.sweep, inner: p.inner })),
  ),
);
