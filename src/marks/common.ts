import type { Col, Mark } from '../types.js';

export type Common = {
  key?: string;
  label?: string;
  group?: string;
  color: string;
  alpha?: number;
};

export const base = (type: string, o: Common, x: Col[], y: Col[]) =>
  ({
    type,
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: o.color,
    options: o,
    points: x[0]?.length ?? 0,
    channels: { x, y },
  }) satisfies Partial<Mark>;

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
 * kept, and a pixel column a run ends in is split.
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
) {
  const n = x.length;
  const col = new Int32Array(n);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const last = new Float64Array(n);
  const first = straight ? new Float64Array(n) : lo;
  const at = straight ? new Float64Array(n) : lo;
  const runs: [number, number, number][] = [];
  let cut = true;
  let k = -1;
  for (let i = 0; i < n; i++) {
    const p = ox + x[i]! * kx;
    const c = Math.round(p);
    const v = oy - y[i]! * ky;
    if (!Number.isFinite(v) || (also && !Number.isFinite(oy - also[i]! * ky))) {
      cut = true;
      continue;
    }
    if (cut) runs.push([k + 1, k + 1, 0]);
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
  }
  return { n: k + 1, col, lo, hi, last, first, at, runs };
}

/** y at v: the held sample of a step, the interpolated value of a straight line. */
export function sampleAt(x: Col, y: Col, v: number, step: boolean) {
  let a = 0;
  let b = x.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (x[mid]! <= v) a = mid + 1;
    else b = mid;
  }
  if (!a) return undefined;
  const x0 = x[a - 1]!;
  const y0 = y[a - 1]!;
  if (!Number.isFinite(y0)) return undefined;
  if (x0 === v) return y0;
  if (a < x.length && !Number.isFinite(y[a]!)) return undefined;
  if (step) return y0;
  return a < x.length ? y0 + ((y[a]! - y0) * (v - x0)) / (x[a]! - x0) : undefined;
}
