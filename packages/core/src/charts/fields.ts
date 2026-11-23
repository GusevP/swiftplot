import type { Col } from '../types.js';
import type { Accessor, Column, Kind, Source } from './source.js';

type Field<R> = string | Accessor<R>;
export type FieldProps<R> = {
  x?: Field<R>;
  y?: Field<R> | readonly Field<R>[];
  series?: Field<R>;
  r?: number | Field<R>;
  xAxis?: { utc?: boolean };
};
export type Family = 'xy' | 'scatter';
export type Series = { name: string; x: Col; y: Col; r?: Col };
export type Assigned = {
  x: { label: string; kind: Kind | 'index'; categories?: string[] };
  y: { label: string };
  ys: Series[];
  /** With series and firstSeen: the distinct x across all series in order of first appearance. */
  order?: number[];
};

const quote = (f: string) => `"${f}"`;

export function assign<R>(
  s: Source<R>,
  props: FieldProps<R>,
  family: Family,
  name: string,
  firstSeen = false,
): Assigned {
  const p: FieldProps<R> =
    s.shape === 'numbers'
      ? { xAxis: props.xAxis, y: 'value' }
      : s.shape === 'pairs'
        ? { xAxis: props.xAxis, x: 'x', y: 'y' }
        : props;
  const own = <T>(read: () => T): T => {
    try {
      return read();
    } catch (e) {
      throw new Error(`${name}: ${(e as Error).message}`, { cause: e });
    }
  };
  const fields = own(() => s.fields());
  const kinds = new Map(fields.map(f => [f, own(() => s.kind(f))]));
  if (!s.length) return { x: { label: '', kind: 'index' }, y: { label: '' }, ys: [] };
  const unplottable = (f: string) => {
    if (kinds.get(f)) return false;
    try {
      s.column(f);
      return false;
    } catch {
      return true;
    }
  };
  const describe = (f: string) => kinds.get(f) ?? (unplottable(f) ? 'not plottable' : 'no values');
  const fail = (why: string, pass: string, cause?: unknown): never => {
    const list = fields.length
      ? `The fields are ${fields.map(f => `${f} (${describe(f)})`).join(', ')}`
      : 'There are no fields';
    throw new Error(`${name}: ${why}. ${list}. Pass ${pass}.`, { cause });
  };

  const named = p.y === undefined ? [] : ((Array.isArray(p.y) ? p.y : [p.y]) as Field<R>[]);
  const r = family === 'scatter' && typeof p.r !== 'number' ? p.r : undefined;
  const roles: [string, Field<R> | undefined][] = [
    ['x', p.x],
    ...named.map(f => ['y', f] as [string, Field<R>]),
    ['series', p.series],
    ['r', r],
  ];
  const names = roles.map(([, f]) => f).filter((f): f is string => typeof f === 'string');
  for (const [role, f] of roles) {
    if (typeof f !== 'string') continue;
    if (!kinds.has(f)) {
      // fields() lists only the keys of the first rows, so a named field is looked up in every row
      const kind = ((): Kind | undefined | null => {
        try {
          return s.kind(f);
        } catch {
          return null;
        }
      })();
      if (kind === null || (!kind && !unplottable(f)))
        fail(`there is no field ${quote(f)}`, `${role} as one of these fields`);
      kinds.set(f, kind ?? undefined);
    }
    if (unplottable(f))
      fail(`${quote(f)} holds values that are not numbers, dates or text`, `${role} as another field`);
    const kind = kinds.get(f);
    if ((role === 'y' || role === 'r') && kind && kind !== 'number')
      fail(`${role} ${quote(f)} is ${kind}, not numbers`, `${role} as a field of numbers`);
  }

  const pool = fields.filter(f => kinds.get(f) && !names.includes(f));
  const first = (k: Kind, not?: Field<R>) => pool.find(f => kinds.get(f) === k && f !== not);
  let x = p.x;
  if (x === undefined && family === 'scatter') x = first('time') ?? first('number');
  else if (x === undefined) {
    x = first('time') ?? first('text');
    const numbers = pool.filter(f => kinds.get(f) === 'number');
    if (x === undefined && numbers.length > (named.length ? 0 : 1)) x = numbers[0];
  }
  const xField = x;
  const left = pool.filter(f => f !== xField && kinds.get(f) === 'number');
  const ys = named.length ? named : family === 'scatter' ? left.slice(0, 1) : left;

  if (family === 'scatter') {
    if (named.length > 1) fail('a scatter chart has one y', 'y as one field');
    if (!ys.length || (x === undefined && !s.shape))
      fail('a scatter chart needs two fields of numbers or dates', 'x and y as fields of numbers or dates');
  } else if (!ys.length) {
    const asText = fields.filter(
      f =>
        kinds.get(f) === 'text' &&
        own(() => s.column(f)).categories!.every(c => c.trim() !== '' && Number.isFinite(Number(c))),
    );
    const hint = asText.length
      ? `; ${asText.map(quote).join(', ')} ${asText.length > 1 ? 'hold' : 'holds'} numbers as text: convert them with Number()`
      : '';
    fail(`there is no field of numbers for y${hint}`, 'y as a field of numbers');
  }
  const leftText = pool.find(f => f !== x && kinds.get(f) === 'text');
  if (family === 'xy' && p.series === undefined && leftText !== undefined)
    fail(
      `${quote(leftText)} is text, so the rows look like long data with one row per series and x`,
      `series: '${leftText}'`,
    );
  if (p.series !== undefined && ys.length > 1) fail('with series there is one y', 'y as one field');

  const read = (f: Field<R>, what: string, role: string, zone?: { utc: boolean }): Column => {
    if (typeof f === 'string') return own(() => s.column(f, zone));
    try {
      return s.column(f, zone);
    } catch (e) {
      return fail(`${what} cannot be read: ${(e as Error).message}`, `${role} as another field`, e);
    }
  };
  const numeric = (f: Field<R>, i: number, role: string): Column => {
    const what = typeof f === 'string' ? `${role} ${quote(f)}` : `the accessor ${role}${i + 1}`;
    const c = read(f, what, role);
    if (c.kind !== 'number') fail(`${what} is ${c.kind}, not numbers`, `${role} as a field of numbers`);
    return c;
  };
  const yColumns = ys.map((f, i) => numeric(f, i, 'y').values);
  const rColumn = r === undefined ? undefined : numeric(r, 0, 'r').values;
  const xColumn =
    x === undefined ? undefined : read(xField!, 'the accessor x', 'x', { utc: p.xAxis?.utc ?? true });
  const xs = xColumn?.values ?? Float64Array.from({ length: s.length }, (_, i) => i);

  const kept: number[] = [];
  for (let i = 0; i < s.length; i++)
    if (Number.isFinite(xs[i]) && (!rColumn || Number.isFinite(rColumn[i]))) kept.push(i);
  const at = (c: Col, rows: number[]) => (rows.length === s.length ? c : Float64Array.from(rows, i => c[i]!));
  const series = (label: string, rows: number[], y: Col): Series => ({
    name: label,
    x: at(xs, rows),
    y: at(y, rows),
    ...(rColumn && { r: at(rColumn, rows) }),
  });

  let out: Series[];
  let order: Set<number> | undefined;
  if (p.series === undefined)
    out = ys.map((f, i) => series(typeof f === 'string' ? f : `y${i + 1}`, kept, yColumns[i]!));
  else {
    const by = read(p.series, 'the accessor series', 'series');
    const groups = new Map<number, number[]>();
    if (firstSeen) order = new Set();
    for (const i of kept) {
      const v = by.values[i]!;
      if (Number.isNaN(v)) continue;
      order?.add(xs[i]!);
      const rows = groups.get(v);
      if (rows) rows.push(i);
      else groups.set(v, [i]);
    }
    out = [...groups].map(([v, rows]) => series(by.categories?.[v] ?? String(v), rows, yColumns[0]!));
  }
  return {
    x: {
      label: typeof x === 'string' ? x : '',
      kind: xColumn?.kind ?? 'index',
      ...(xColumn?.categories && { categories: xColumn.categories }),
    },
    y: { label: ys.length === 1 && typeof ys[0] === 'string' ? ys[0] : '' },
    ys: out,
    ...(order && { order: [...order] }),
  };
}
