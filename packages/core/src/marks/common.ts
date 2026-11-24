import type { Col, Mark } from '../types.js';

export type Common = {
  /** Pairs the mark with the one it replaces in update(), to keep or morph its shape; its place in `marks` if left out. */
  key?: string;
  /** The mark's name in a legend, a tooltip and the chart's description. */
  label?: string;
  /** Marks of one group are focused, dimmed and hidden together; the label when left out. */
  group?: string;
  /** A CSS colour. */
  color: string;
  /** The mark's opacity, from 0 to 1. @default 1 */
  alpha?: number;
  /**
   * Draws the mark against the chart's second y axis, `y2`, which then fits it; 'y' when left out.
   * A stack holds the marks of one `yAxis`, also on a chart with no `y2`, where all are drawn on `y`.
   */
  yAxis?: 'y' | 'y2';
};

export const base = (type: string, o: Common, x: Col[], y: Col[]) =>
  ({
    type,
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: o.color,
    options: o,
    yAxis: o.yAxis,
    points: x[0]?.length ?? 0,
    channels: { x, y },
  }) satisfies Partial<Mark>;

/** A stack's key: one id on the two y axes is two stacks, as values on two scales do not add up. */
export const stackKey = (type: string, o: { yAxis?: 'y' | 'y2'; stack?: string }) =>
  `${type}:stack:${o.yAxis ?? 'y'}:${o.stack}`;

/** The least and the greatest finite x, or Infinity and -Infinity when there is none. */
export function ends(x: Col): [number, number] {
  let [first, last] = [Infinity, -Infinity];
  for (let i = 0; i < x.length; i++) {
    if (x[i]! < first && x[i] !== -Infinity) first = x[i]!;
    if (x[i]! > last && x[i] !== Infinity) last = x[i]!;
  }
  return [first, last];
}

/** 'smooth' curves through the points where they are further apart than a pixel, and is 'linear' where they are not. */
export type Curve = 'linear' | 'step' | 'smooth';

/**
 * A curve on from the path's current point through n points, forwards or backwards, that never
 * goes above or below the points it joins: its lean at each is the harmonic mean of the leans
 * either side of it, and level where they turn.
 */
export function smooth(path: Path2D, xs: ArrayLike<number>, ys: ArrayLike<number>, n: number, back = false) {
  const at = (k: number) => (back ? n - 1 - k : k);
  const rise = (k: number) => (ys[at(k + 1)]! - ys[at(k)]!) / (xs[at(k + 1)]! - xs[at(k)]! || 1);
  const lean = (k: number) => {
    if (k === 0 || k === n - 1) return rise(Math.min(k, n - 2));
    const [a, b] = [rise(k - 1), rise(k)];
    return a * b > 0 ? (2 * a * b) / (a + b) : 0;
  };
  for (let k = 1; k < n; k++) {
    const [x0, y0, x1, y1] = [xs[at(k - 1)]!, ys[at(k - 1)]!, xs[at(k)]!, ys[at(k)]!];
    const third = (x1 - x0) / 3;
    path.bezierCurveTo(x0 + third, y0 + lean(k - 1) * third, x1 - third, y1 - lean(k) * third, x1, y1);
  }
}

export const TURN = 2 * Math.PI;

/** How far round the clock from twelve the point (dx, dy) from the centre is, from 0 up to 1. */
/**
 * Whether level text w by h, centred at (x, y), lies inside the part of a ring round (cx, cy)
 * between two radii and two shares of the turn: its nearest and furthest points between the
 * radii, and its corners between the two edges.
 */
export function inRing(
  [cx, cy, inner, outer, from, to]: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const [l, t, r, b] = [x - w / 2 - cx!, y - h / 2 - cy!, x + w / 2 - cx!, y + h / 2 - cy!];
  const near = Math.hypot(Math.max(l, 0, -r), Math.max(t, 0, -b));
  const far = Math.hypot(Math.max(-l, r), Math.max(-t, b));
  if (near < inner! || far > outer!) return false;
  if (to! - from! >= 1) return true;
  return [
    [l, t],
    [r, t],
    [r, b],
    [l, b],
  ].every(([px, py]) => {
    const share = turnAt(px!, py!);
    return share >= from! && share < to!;
  });
}

export const turnAt = (dx: number, dy: number) => ((((Math.atan2(dy, dx) + TURN / 4) / TURN) % 1) + 1) % 1;

/**
 * One min, max and last y per device-pixel column. x must be ascending.
 * `first` (each column's first y) and `at` (its exact x) are kept only with `straight`;
 * without it they alias `lo` and must not be read.
 * A y that is not finite once projected, or a value of `also` at the same row that is not, ends a
 * run: `runs` holds each run's first column, the column after its last and how many values it
 * kept, and a pixel column a run ends in is split. A run also ends after a row in `cuts`, and is
 * marked as following one when nothing else broke it since.
 */
export function columns(
  x: Col,
  y: Col,
  ox: number,
  kx: number,
  oy: number,
  ky: number,
  straight = false,
  also?: Col,
  [from, to] = [0, x.length],
  cuts?: Set<number>,
) {
  const n = to - from;
  const col = new Int32Array(n);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const last = new Float64Array(n);
  const first = straight ? new Float64Array(n) : lo;
  const at = straight ? new Float64Array(n) : lo;
  const runs: [number, number, number, boolean][] = [];
  let cut = true;
  let bridged = false;
  let k = -1;
  for (let i = from; i < to; i++) {
    const p = ox + x[i]! * kx;
    const c = Math.round(p);
    const v = oy - y[i]! * ky;
    if (!Number.isFinite(v) || (also && !Number.isFinite(oy - also[i]! * ky))) {
      cut = true;
      bridged = false;
      continue;
    }
    if (cut) runs.push([k + 1, k + 1, 0, bridged]);
    const run = runs[runs.length - 1]!;
    run[2]++;
    if (cut || c !== col[k]) {
      k++;
      run[1] = k + 1;
      cut = false;
      col[k] = c;
      at[k] = p;
      first[k] = lo[k] = hi[k] = v;
    } else if (v < lo[k]!) lo[k] = v;
    else if (v > hi[k]!) hi[k] = v;
    last[k] = v;
    if (cuts?.has(i)) cut = bridged = true;
  }
  return { n: k + 1, col, lo, hi, last, first, at, runs };
}

/** Runs of columns() put together where each follows a cut, for `join` to draw as one. */
export function chains<T extends [number, number, number, boolean]>(runs: T[]) {
  const out: T[][] = [];
  for (const run of runs) {
    if (run[3] && out.length) out[out.length - 1]!.push(run);
    else out.push([run]);
  }
  return out;
}

/**
 * x and ys cut to the rows where every y is finite, and the kept rows a gap follows: the curve is
 * drawn straight from each of those to the next.
 */
export function joined<T extends Col[]>(x: Col, ...ys: T): [[Col, ...T], Set<number>] {
  const keep: number[] = [];
  for (let i = 0; i < x.length; i++) if (ys.every(y => Number.isFinite(y[i]!))) keep.push(i);
  const cuts = new Set<number>();
  for (let k = 1; k < keep.length; k++) if (keep[k] !== keep[k - 1]! + 1) cuts.add(k - 1);
  if (keep.length === x.length) return [[x, ...ys], cuts];
  const cut = (c: Col) => Float64Array.from(keep, i => c[i]!);
  return [[cut(x), ...ys.map(cut)] as unknown as [Col, ...T], cuts];
}

/** How many rows of an ascending x are at or below v. */
export function upTo(x: Col, v: number) {
  let a = 0;
  let b = x.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (x[mid]! <= v) a = mid + 1;
    else b = mid;
  }
  return a;
}

/**
 * The rows of an ascending x that a curve drawn between the device pixels lo and hi reads: those
 * between them and `keep` pixel columns of rows beyond each, so no column is cut in two.
 */
export function span(x: Col, ox: number, kx: number, lo: number, hi: number, keep: number): [number, number] {
  const column = (i: number) => Math.round(ox + x[i]! * kx);
  let [a, b] = [upTo(x, (lo - ox) / kx), upTo(x, (hi - ox) / kx)];
  if (a > b) [a, b] = [b, a];
  for (let k = 0; k < keep && a > 0; k++) for (a--; a > 0 && column(a - 1) === column(a);) a--;
  for (let k = 0; k < keep && b < x.length; k++) for (b++; b < x.length && column(b) === column(b - 1);) b++;
  return [a, b];
}

/** The least and greatest f(value) over the rows where f of every column is finite. */
export function extent(ys: Col[], f = (v: number) => v): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  rows: for (let i = 0; i < ys[0]!.length; i++) {
    for (const y of ys) if (!Number.isFinite(f(y[i]!))) continue rows;
    for (const y of ys) {
      const v = f(y[i]!);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}

/**
 * The least and greatest oy - y * ky over the rows of ys, from their extent: when an end of it
 * overflows once projected, the rows are scanned again for the ones that do not.
 */
export function reach([lo, hi]: [number, number], ys: Col[], oy: number, ky: number): [number, number] {
  const [a, b] = [oy - lo * ky, oy - hi * ky];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return extent(ys, v => oy - v * ky);
  return a < b ? [a, b] : [b, a];
}

/**
 * y at v as the curve draws it: the held sample of a step, else the line or smooth() between
 * samples, and the line from a row in `cuts` to the next. A row where y, or `also` like columns(), is not
 * finite breaks the curve.
 */
export function sampleAt(x: Col, y: Col, v: number, curve: Curve, also?: Col, cuts?: Set<number>) {
  const ok = (i: number) => Number.isFinite(y[i]!) && (!also || Number.isFinite(also[i]!));
  const a = upTo(x, v);
  if (!a) return undefined;
  const x0 = x[a - 1]!;
  const y0 = y[a - 1]!;
  if (!ok(a - 1)) return undefined;
  if (x0 === v) return y0;
  if (a < x.length && !ok(a)) return undefined;
  if (cuts?.has(a - 1)) curve = 'linear';
  if (curve === 'step') return y0;
  if (a === x.length) return undefined;
  const [x1, y1] = [x[a]!, y[a]!];
  const t = (v - x0) / (x1 - x0);
  if (curve !== 'smooth') return y0 + (y1 - y0) * t;
  const rise = (i: number) =>
    i >= 0 && i + 1 < x.length && ok(i) && ok(i + 1) && !cuts?.has(i)
      ? (y[i + 1]! - y[i]!) / (x[i + 1]! - x[i]! || 1)
      : undefined;
  const lean = (i: number) => {
    const [p, q] = [rise(i - 1), rise(i)];
    if (p === undefined || q === undefined) return (p ?? q)!;
    return p * q > 0 ? (2 * p * q) / (p + q) : 0;
  };
  const [m0, m1] = [lean(a - 1) * (x1 - x0), lean(a) * (x1 - x0)];
  const s = 1 - t;
  return s * s * (1 + 2 * t) * y0 + s * s * t * m0 + t * t * (3 - 2 * t) * y1 - t * t * s * m1;
}
