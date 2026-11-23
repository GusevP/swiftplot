import { make as moment } from '../scales/time.js';
import type { Col } from '../types.js';

export type Kind = 'number' | 'time' | 'text';
export type Column = { kind: Kind; values: Col; categories?: string[] };
export type Accessor<R> = (row: R, index: number) => unknown;
export type Zone = { utc: boolean };
export type Source<R = unknown> = {
  length: number;
  fields(): string[];
  /** undefined for a field that is unplottable or holds only missing values */
  kind(field: string): Kind | undefined;
  /** zone applies to ISO strings without an offset; utc is the default */
  column(field: string | Accessor<R>, zone?: Zone): Column;
  /** set for the positional shapes, whose fields are fixed and never guessed */
  shape?: 'numbers' | 'pairs';
};
export type Data<R = unknown> = readonly R[] | ArrayLike<number> | Record<string, ArrayLike<unknown>>;

type Read = (i: number) => unknown;

const FIELD_SCAN = 100;

const numeric = (v: unknown): v is Col =>
  ArrayBuffer.isView(v) &&
  !(v instanceof DataView) &&
  !(v instanceof BigInt64Array) &&
  !(v instanceof BigUint64Array);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const missing = (v: unknown) => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));

const infinite = (c: Col) => {
  for (let i = 0; i < c.length; i++) if (c[i] === Infinity || c[i] === -Infinity) return true;
  return false;
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const leap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

/** undefined when s is not ISO 8601, NaN when it names an impossible date */
function iso(s: string, utc: boolean): number | undefined {
  const m = ISO.exec(s);
  if (!m) return undefined;
  const [y, mo, d, h, mi, sec] = [+m[1]!, +m[2]!, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)];
  const ms = m[7] ? Number(m[7].slice(1, 4).padEnd(3, '0')) : 0;
  if (
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > DAYS[mo - 1]! + (mo === 2 && leap(y) ? 1 : 0) ||
    h > 23 ||
    mi > 59 ||
    sec > 59
  )
    return Number.NaN;
  const zone = m[8];
  if (!zone && !utc) return moment([y, mo - 1, d, h, mi, sec], false) + ms;
  const t = new Date(0).setUTCFullYear(y, mo - 1, d) + ((h * 60 + mi) * 60 + sec) * 1000 + ms;
  if (zone === 'Z' || !zone) return t;
  const [oh, om] = [Number(zone.slice(1, 3)), Number(zone.slice(4))];
  if (oh > 23 || om > 59) return Number.NaN;
  const offset = oh * 60 + om;
  return t - (zone[0] === '-' ? -offset : offset) * 60_000;
}

function kindOf(v: unknown): Kind | 'unplottable' | undefined {
  if (missing(v)) return undefined;
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') {
    const t = iso(v, true);
    return t === undefined ? 'text' : Number.isNaN(t) ? undefined : 'time';
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : 'time';
  return 'unplottable';
}

/** fresh gives borrowed typed arrays new views, as the core keeps a mark whose columns are the same objects. */
export function source<R>(data: Data<R> | null | undefined, fresh = false): Source<R> {
  if (data == null) return make(0, [], () => () => undefined);
  if (Array.isArray(data)) return array(data as readonly unknown[]) as Source<R>;
  if (typeof data.length === 'number') return numbers(data as ArrayLike<number>, fresh);
  return columns(data as Record<string, ArrayLike<unknown>>, fresh);
}

function array(data: readonly unknown[]): Source<unknown> {
  const first = data.find(d => d != null);
  if (!data.length) return source(null);
  if (first === undefined || typeof first === 'number') return numbers(data);
  if (Array.isArray(first)) {
    const at = (k: 0 | 1) => (i: number) => {
      const p = data[i];
      if (!Array.isArray(p) || p.length !== 2)
        throw new Error(`Row ${i} is not an [x, y] pair: every row must hold exactly two values`);
      return p[k];
    };
    return {
      ...make(data.length, ['x', 'y'], f => {
        if (typeof f === 'function') throw new Error('Accessors work on row objects only');
        return f === 'x' ? at(0) : f === 'y' ? at(1) : unknown(f, ['x', 'y']);
      }),
      shape: 'pairs',
    };
  }
  const row = (i: number) => {
    const r = data[i];
    if (!isObject(r)) throw new Error(`Row ${i} is neither an object nor an [x, y] pair`);
    return r;
  };
  let names: string[] | undefined;
  const fields = () => {
    if (names) return names;
    const found = new Set<string>();
    for (let i = 0; i < Math.min(data.length, FIELD_SCAN); i++)
      for (const k of Object.keys(row(i))) found.add(k);
    return (names = [...found]);
  };
  return {
    ...make(data.length, [], f =>
      typeof f === 'function'
        ? i => f(row(i), i)
        : i => {
            const r = row(i);
            return Object.hasOwn(r, f) ? r[f] : undefined;
          },
    ),
    fields,
  };
}

function columns<R>(data: Record<string, ArrayLike<unknown>>, fresh: boolean): Source<R> {
  const names = Object.keys(data);
  const length = names.length ? (data[names[0]!]?.length ?? 0) : 0;
  const get = (f: string) => {
    const c = data[f];
    if (!c || typeof c.length !== 'number') throw new Error(`Field "${f}" is not an array`);
    if (c.length !== length)
      throw new Error(`Columns differ in length: "${names[0]}" has ${length} values, "${f}" has ${c.length}`);
    return c;
  };
  return make(
    length,
    names,
    f => {
      if (typeof f === 'function')
        throw new Error('Accessors work on row objects only; name a field of the columns object');
      if (!Object.hasOwn(data, f)) return unknown(f, names);
      const c = get(f);
      return i => c[i];
    },
    f => {
      const c = Object.hasOwn(data, f) && numeric(data[f]) ? get(f) : undefined;
      return c as Col | undefined;
    },
    fresh,
  );
}

function numbers<R>(data: ArrayLike<unknown>, fresh = false): Source<R> {
  const read: Read = i => data[i];
  return {
    ...make(
      data.length,
      ['value'],
      f => {
        if (typeof f === 'function') throw new Error('Accessors work on row objects only');
        return f === 'value' ? read : unknown(f, ['value']);
      },
      f => (f === 'value' && numeric(data) ? data : undefined),
      fresh,
    ),
    shape: 'numbers',
  };
}

function unknown(field: string, names: string[]): never {
  throw new Error(`No field "${field}"; the fields are ${names.map(n => `"${n}"`).join(', ')}`);
}

function make<R>(
  length: number,
  names: string[],
  reader: (field: string | Accessor<R>) => Read,
  borrow: (field: string) => Col | undefined = () => undefined,
  fresh = false,
): Source<R> {
  const cache = new Map<string, { utc?: Column; local?: Column }>();
  const scan = (read: Read) => {
    for (let i = 0; i < length; i++) {
      const k = kindOf(read(i));
      if (k) return k;
    }
    return undefined;
  };
  return {
    length,
    fields: () => names,
    kind(field) {
      const k = scan(reader(field));
      return k === 'unplottable' ? undefined : k;
    },
    column(field, zone) {
      const utc = zone?.utc ?? true;
      const at = (typeof field === 'string' && cache.get(field)) || {};
      const hit = utc ? at.utc : at.local;
      if (hit) return hit;
      const own = typeof field === 'string' ? borrow(field) : undefined;
      const usable = own && !infinite(own);
      const c: Column = usable
        ? { kind: 'number', values: fresh ? (own as Float64Array).subarray(0) : own }
        : convert(field, reader(field), length, scan, utc);
      if (c.kind !== 'time') at.utc = at.local = c;
      else if (utc) at.utc = c;
      else at.local = c;
      // an accessor is often a new inline function on each update, so caching it by identity would leak
      if (typeof field === 'string') cache.set(field, at);
      return c;
    },
  };
}

function convert<R>(
  field: string | Accessor<R>,
  read: Read,
  length: number,
  scan: (read: Read) => Kind | 'unplottable' | undefined,
  utc: boolean,
): Column {
  const raw = Array.from({ length }, (_, i) => read(i));
  const kind = scan(i => raw[i]) ?? 'number';
  if (kind === 'unplottable') {
    const name = typeof field === 'string' ? `Field "${field}"` : 'The accessor';
    throw new Error(`${name} holds values that are not numbers, dates or text, and cannot be plotted`);
  }
  const values = new Float64Array(length).fill(Number.NaN);
  if (kind === 'text') {
    const index = new Map<string, number>();
    raw.forEach((v, i) => {
      if (typeof v !== 'string' || kindOf(v) !== 'text') return;
      let k = index.get(v);
      if (k === undefined) index.set(v, (k = index.size));
      values[i] = k;
    });
    return { kind, values, categories: [...index.keys()] };
  }
  raw.forEach((v, i) => {
    if (kind === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) values[i] = v;
    } else if (v instanceof Date) values[i] = v.getTime();
    else if (typeof v === 'string') values[i] = iso(v, utc) ?? Number.NaN;
  });
  return { kind, values };
}
