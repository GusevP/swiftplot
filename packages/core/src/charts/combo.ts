import { easyChart, given } from './build.js';
import type { Build } from './controller.js';
import { list, reader, type Field } from './fields.js';
import type { Source } from './source.js';
import type { Axes, Base, ComboProps, Overlays, ScaledAxes } from './types.js';
import { xy } from './xy.js';

const NAME = 'comboChart';
const ROLES = ['lines', 'bars', 'y2Lines', 'y2Bars'] as const;
const LISTED = 'lines, bars, y2Lines and y2Bars';

type ComboFields<R> = { x?: Field<R> } & { [K in (typeof ROLES)[number]]?: Field<R> | readonly Field<R>[] };
type ComboInput = Axes &
  ScaledAxes &
  Overlays &
  Base &
  ComboFields<never> &
  Pick<ComboProps<undefined>, 'stack'> & { data?: unknown };

function check<R>(s: Source<R>, p: ComboFields<R>) {
  if (!s.length) return;
  const { fail } = reader(s, NAME);
  if (s.shape)
    fail('a list of numbers or pairs has no fields to name', `rows or columns with fields for ${LISTED}`);
  const named = ROLES.flatMap(k => list(p[k]).map(f => [k, f] as const));
  if (!named.length) fail(`none of ${LISTED} is given`, 'at least one of them as a field of numbers');
  const seen = new Map<string, string>();
  for (const [role, f] of named) {
    if (typeof f !== 'string') continue;
    const other = seen.get(f);
    if (other === role) fail(`"${f}" is named twice in ${role}`, 'it once');
    if (other) fail(`"${f}" is named in both ${other} and ${role}`, 'it in one of them');
    seen.set(f, role);
  }
}

const drawn = xy(NAME, 'combo');

const build: Build<ComboInput> = (p, context) => {
  const { source: s, memo } = context;
  if (s.length)
    for (const k of ['y', 'y2', 'series', 'errorBars'])
      if (given(p, k)) throw new Error(`${NAME}: use ${LISTED}, not ${k}`);
  memo('checked', [s, ...ROLES.flatMap(k => [k, ...list(p[k])])], () => check(s, p));
  const roles = ROLES.flatMap(k => list(p[k]).map(() => k));
  return drawn(
    {
      ...p,
      y: [...list(p.lines), ...list(p.bars)],
      y2: [...list(p.y2Lines), ...list(p.y2Bars)],
      roles,
      barred: roles.map(k => k === 'bars' || k === 'y2Bars'),
      series: undefined,
      errorBars: undefined,
      curve: undefined,
      join: undefined,
      fill: undefined,
    },
    context,
  );
};

export const comboChart = easyChart<'combo'>(build);
