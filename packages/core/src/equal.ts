export const plain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** Plain objects and arrays by value, anything else (typed arrays, functions) by identity. */
export const equal = (a: unknown, b: unknown): boolean => same(a, b, false, new Map());

type Seen = Map<object, Set<object>>;

function same(a: unknown, b: unknown, data: boolean, seen: Seen): boolean {
  if (Object.is(a, b)) return true;
  if (plain(a) && plain(b)) return Array.isArray(a) === Array.isArray(b) && alike(a, b, data, seen);
  if (!data) return false;
  if (typeof a === 'function' && typeof b === 'function') return true;
  if (typed(a) && typed(b)) return every(a, b, Object.is);
  return akin(a, b) && alike(a as Fields, b as Fields, data, seen);
}

function alike(a: Fields, b: Fields, data: boolean, seen: Seen): boolean {
  if (Array.isArray(a) && a.length !== b.length) return false;
  const pairs = seen.get(a) ?? seen.set(a, new Set()).get(a)!;
  if (pairs.has(b)) return true;
  pairs.add(b);
  if (data && long(a) && long(b)) return every(a, b, (x, y) => same(x, y, data, seen));
  if (!plain(a)) {
    if (listed(a) && listed(b)) return same([...a], [...b], data, seen);
    // Dates, URLs and others keep their value in no field of their own.
    if (!same(json(a), json(b), data, seen)) return false;
  }
  const keys = Object.keys(a);
  if (!plain(a) && !keys.length && json(a) === undefined) return false;
  return (
    keys.length === Object.keys(b).length &&
    keys.every(k => Object.hasOwn(b, k) && same(a[k], b[k], data, seen))
  );
}

/**
 * Data by value, typed arrays too, and instances of a class by their own fields and toJSON(), where they have
 * either; any two functions are alike, as inline ones are new each time.
 */
export const sameData = (a: unknown, b: unknown) => same(a, b, true, new Map());

const typed = (v: unknown): v is Float64Array =>
  ArrayBuffer.isView(v) && typeof (v as Float64Array).length === 'number';

type Fields = Record<string, unknown>;

const akin = (a: unknown, b: unknown): boolean =>
  typeof a === 'object' &&
  typeof b === 'object' &&
  a !== null &&
  b !== null &&
  Object.getPrototypeOf(a) === Object.getPrototypeOf(b);

const listed = (v: unknown): v is Iterable<unknown> => v instanceof Map || v instanceof Set;

const json = (v: Fields): unknown =>
  typeof v.toJSON === 'function' ? (v as { toJSON(): unknown }).toJSON() : undefined;

/** A longer list is read by index, as the keys of a million rows take tens of milliseconds, but a sparse one is not. */
const LONG = 1000;
const long = (v: unknown): v is unknown[] =>
  Array.isArray(v) && v.length > LONG && [0, v.length >> 1, v.length - 1].every(i => i in v);

const every = (a: ArrayLike<unknown>, b: ArrayLike<unknown>, eq: (a: unknown, b: unknown) => boolean) => {
  const n = a.length;
  if (n !== b.length) return false;
  for (let i = 0; i < n; i++) if (!Object.is(a[i], b[i]) && !eq(a[i], b[i])) return false;
  return true;
};

/**
 * Data kept from later writes in place, to compare with another copy.
 * ponytail: of a long list only the length, `row` and LONG values evenly spread, so a write in place to another row of
 * one is missed; a digest of the whole list would see it, for a pass over every row each time the pointer comes.
 */
export const copied = (
  v: unknown,
  row = 0,
  seen = new Map<object, unknown>(),
  lists: [ArrayLike<unknown>, unknown[]][] = [],
): unknown => {
  if (typed(v) && v.length <= LONG) return v.slice();
  if (!typed(v) && !plain(v)) return v;
  if (seen.has(v)) return seen.get(v);
  if (typed(v) || long(v)) {
    const c: unknown[] = [v.length];
    seen.set(v, c);
    lists.push([v, c]);
    const step = (v.length - 1) / LONG;
    for (let i = 0; i <= LONG; i++) c.push(copied(v[Math.round(i * step)], row, seen, lists));
    c.push(copied(v[row], row, seen, lists));
    return c;
  }
  const c = (Array.isArray(v) ? Object.assign([], { length: v.length }) : Object.create(null)) as Record<
    string,
    unknown
  >;
  seen.set(v, c);
  for (const k of Object.keys(v)) c[k] = copied(v[k], row, seen, lists);
  return c;
};

/** A copy of data for `row`, and `to()`, which moves it to another row without reading the rest again. */
export function keep(of: unknown, row?: number) {
  const seen = new Map<object, unknown>();
  const lists: [ArrayLike<unknown>, unknown[]][] = [];
  return {
    of,
    data: copied(of, row, seen, lists),
    to(next = 0) {
      for (const [list, c] of lists) c[c.length - 1] = copied(list[next], next, seen, lists);
    },
  };
}
