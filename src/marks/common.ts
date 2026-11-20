import type { Col, Mark } from '../types.js';

export type Common = { key?: string; label?: string; group?: string; color: string; alpha?: number };

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

export type Curve = 'linear' | 'step';

/**
 * One min, max and last y per device-pixel column. x must be ascending.
 * `first` (each column's first y) and `at` (its exact x) are kept only with `straight`;
 * without it they alias `lo` and must not be read.
 */
export function columns(x: Col, y: Col, ox: number, kx: number, oy: number, ky: number, straight = false) {
  const n = x.length;
  const col = new Int32Array(n);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const last = new Float64Array(n);
  const first = straight ? new Float64Array(n) : lo;
  const at = straight ? new Float64Array(n) : lo;
  let k = -1;
  for (let i = 0; i < n; i++) {
    const p = ox + x[i]! * kx;
    const c = Math.round(p);
    const v = oy - y[i]! * ky;
    if (k < 0 || c !== col[k]) {
      k++;
      col[k] = c;
      at[k] = p;
      first[k] = lo[k] = hi[k] = v;
    } else if (v < lo[k]!) lo[k] = v;
    else if (v > hi[k]!) hi[k] = v;
    last[k] = v;
  }
  return { n: k + 1, col, lo, hi, last, first, at };
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
  if (step || x0 === v) return y0;
  return a < x.length ? y0 + ((y[a]! - y0) * (v - x0)) / (x[a]! - x0) : undefined;
}
