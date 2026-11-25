import type { Col } from '../types.js';
import type { Accessor, Column, Kind, Source } from './source.js';

export type Field<R> = string | Accessor<R>;
export type FieldProps<R> = {
  x?: Field<R>;
  y?: Field<R> | readonly Field<R>[];
  y2?: Field<R> | readonly Field<R>[];
  series?: Field<R>;
  r?: number | Field<R>;
  errorBars?: { low: Field<R>; high: Field<R> };
  xAxis?: { utc?: boolean };
  /** The prop each field of y and then of y2 came from, where it is not those; nothing is then guessed for y. */
  roles?: readonly string[];
};
export type Family = 'xy' | 'scatter';
export type Series = { name: string; x: Col; y: Col; r?: Col; low?: Col; high?: Col; yAxis?: 'y2' };
export type Assigned = {
  x: { label: string; kind: Kind | 'index'; categories?: string[] };
  y: { label: string; categories?: string[] };
  y2?: { label: string };
  ys: Series[];
  /** Without series, where some row has no place on x: the rows of the data that the rows of ys are. */
  rows?: number[];
  /** With series and firstSeen: the distinct x across all series in order of first appearance. */
  order?: number[];
};

export const list = <T>(f: T | readonly T[] | undefined): readonly T[] =>
  f === undefined ? [] : Array.isArray(f) ? f : [f as T];

const quote = (f: string) => `"${f}"`;

export function reader<R>(s: Source<R>, name: string) {
  const own = <T>(read: () => T): T => {
    try {
      return read();
    } catch (e) {
      throw new Error(`${name}: ${(e as Error).message}`, { cause: e });
    }
  };
  const fields = own(() => s.fields());
  const kinds = new Map(fields.map(f => [f, own(() => s.kind(f))]));
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

  const check = (
    roles: readonly (readonly [string, Field<R> | undefined])[],
    numberRoles: readonly string[],
  ) => {
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
      if (numberRoles.includes(role) && kind && kind !== 'number')
        fail(`${role} ${quote(f)} is ${kind}, not numbers`, `${role} as a field of numbers`);
    }
    const names = roles.map(([, f]) => f);
    return fields.filter(f => kinds.get(f) && !names.includes(f));
  };
  const noNumbers = (role: string): never => {
    const asText = fields.filter(
      f =>
        kinds.get(f) === 'text' &&
        own(() => s.column(f)).categories!.every(c => c.trim() !== '' && Number.isFinite(Number(c))),
    );
    const hint = asText.length
      ? `; ${asText.map(quote).join(', ')} ${asText.length > 1 ? 'hold' : 'holds'} numbers as text: convert them with Number()`
      : '';
    return fail(`there is no field of numbers for ${role}${hint}`, `${role} as a field of numbers`);
  };
  const sole = (role: string, named: Field<R> | undefined, pool: readonly string[]): Field<R> => {
    if (named !== undefined) return named;
    const numbers = pool.filter(f => kinds.get(f) === 'number');
    if (numbers.length > 1)
      fail(
        `${numbers.map(quote).join(', ')} are all fields of numbers, so ${role} cannot be guessed`,
        `${role} as one of them`,
      );
    return numbers[0] ?? noNumbers(role);
  };
  const read = (f: Field<R>, what: string, role: string, zone?: { utc: boolean }): Column => {
    if (typeof f === 'string') return own(() => s.column(f, zone));
    try {
      return s.column(f, zone);
    } catch (e) {
      return fail(`${what} cannot be read: ${(e as Error).message}`, `${role} as another field`, e);
    }
  };
  const numeric = (f: Field<R>, role: string, nth = '', orText = false): Column => {
    const what = typeof f === 'string' ? `${role} ${quote(f)}` : `the accessor ${role}${nth}`;
    const c = read(f, what, role);
    if (c.kind !== 'number' && !(orText && c.kind === 'text')) {
      const wanted = orText ? 'numbers or text' : 'numbers';
      fail(`${what} is ${c.kind}, not ${wanted}`, `${role} as a field of ${wanted}`);
    }
    return c;
  };
  return { kinds, fail, check, noNumbers, sole, read, numeric };
}

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
  const { kinds, fail, check, noNumbers, read, numeric } = reader(s, name);
  const named = list(p.y);
  const named2 = list(p.y2);
  const role = (i: number, otherwise: string) => p.roles?.[i] ?? otherwise;
  const labelled = (fs: readonly Field<R>[]) => ({
    label: fs.length === 1 && typeof fs[0] === 'string' ? fs[0] : '',
  });
  const second = named2.length ? { y2: labelled(named2) } : {};
  if (!s.length) return { x: { label: '', kind: 'index' }, y: { label: '' }, ...second, ys: [] };
  const r = family === 'scatter' && typeof p.r !== 'number' ? p.r : undefined;
  const roles: [string, Field<R> | undefined][] = [
    ['x', p.x],
    ...named.map((f, i) => [role(i, 'y'), f] as [string, Field<R>]),
    ...named2.map((f, i) => [role(named.length + i, 'y2'), f] as [string, Field<R>]),
    ['series', p.series],
    ['r', r],
    ['errorBars.low', p.errorBars?.low],
    ['errorBars.high', p.errorBars?.high],
  ];
  const pool = check(roles, [
    ...(family === 'scatter' ? [] : ['y']),
    'y2',
    'r',
    'errorBars.low',
    'errorBars.high',
    ...(p.roles ?? []),
  ]);
  const first = (k: Kind, not?: Field<R>) => pool.find(f => kinds.get(f) === k && f !== not);
  let x = p.x;
  if (x === undefined && family === 'scatter') x = first('time') ?? first('number');
  else if (x === undefined) {
    x = first('time') ?? first('text');
    const numbers = pool.filter(f => kinds.get(f) === 'number');
    if (x === undefined && numbers.length > (named.length || p.roles ? 0 : 1)) x = numbers[0];
  }
  const xField = x;
  const left = pool.filter(f => f !== xField && kinds.get(f) === 'number');
  const ys = named.length || p.roles ? named : family === 'scatter' ? left.slice(0, 1) : left;

  if (family === 'scatter') {
    if (named.length > 1) fail('a scatter chart has one y', 'y as one field');
    if (!ys.length || (x === undefined && !s.shape))
      fail('a scatter chart needs two fields of numbers or dates', 'x and y as fields of numbers or dates');
  } else if (!ys.length && !p.roles) noNumbers('y');
  const leftText = pool.find(f => f !== x && kinds.get(f) === 'text');
  if (family === 'xy' && p.series === undefined && !named2.length && !p.roles && leftText !== undefined)
    fail(
      `${quote(leftText)} is text, so the rows look like long data with one row per series and x`,
      `series: '${leftText}'`,
    );
  if (named2.length) {
    if (p.series !== undefined) fail('series and y2 do not go together', 'series or y2, not both');
    if (p.errorBars) fail('errorBars and y2 do not go together', 'errorBars or y2, not both');
  }
  if (p.series !== undefined && ys.length > 1) fail('with series there is one y', 'y as one field');
  if (p.errorBars && ys.length > 1) fail('with errorBars there is one y', 'y as one field');

  const drawn = [...ys, ...named2];
  const twice = named2.find((f): f is Field<R> & string => typeof f === 'string' && ys.includes(f));
  if (twice !== undefined) fail(`${quote(twice)} is named in both y and y2`, 'it in one of them');
  const again = named2.find(
    (f, i): f is Field<R> & string => typeof f === 'string' && named2.indexOf(f) !== i,
  );
  if (again !== undefined) fail(`${quote(again)} is named twice in y2`, 'it once');
  const taken = new Set(drawn.filter(f => typeof f === 'string'));
  const names = drawn.map((f, i) => {
    if (typeof f === 'string') return f;
    let n = i + 1;
    while (taken.has(`y${n}`)) n++;
    taken.add(`y${n}`);
    return `y${n}`;
  });
  const yColumns = drawn.map((f, i) =>
    p.roles
      ? numeric(f, p.roles[i]!)
      : i < ys.length
        ? numeric(f, 'y', `${i + 1}`, family === 'scatter')
        : numeric(f, 'y2'),
  );
  const yCategories = yColumns[0]!.categories;
  if (yCategories && p.errorBars)
    fail('errorBars do not apply to a text y', 'y as a field of numbers, or leave out errorBars');
  const rColumn = r === undefined ? undefined : numeric(r, 'r', '1').values;
  const bounds = p.errorBars && {
    low: numeric(p.errorBars.low, 'errorBars.low').values,
    high: numeric(p.errorBars.high, 'errorBars.high').values,
  };
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
    ...(bounds && { low: at(bounds.low, rows), high: at(bounds.high, rows) }),
  });

  let out: Series[];
  let order: Set<number> | undefined;
  if (p.series === undefined)
    out = names.map((n, i) => ({
      ...series(n, kept, yColumns[i]!.values),
      ...(i >= ys.length && { yAxis: 'y2' as const }),
    }));
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
    out = [...groups].map(([v, rows]) => series(by.categories?.[v] ?? String(v), rows, yColumns[0]!.values));
  }
  return {
    x: {
      label: typeof x === 'string' ? x : '',
      kind: xColumn?.kind ?? 'index',
      ...(xColumn?.categories && { categories: xColumn.categories }),
    },
    y: { ...labelled(ys), ...(yCategories && { categories: yCategories }) },
    ...second,
    ys: out,
    ...(p.series === undefined && kept.length < s.length && { rows: kept }),
    ...(order && { order: [...order] }),
  };
}
