import type { Col, Mark } from '../types.js';

export type Common = { key?: string; label?: string; group?: string; color: string; alpha?: number };

export const base = (type: string, o: Common, x: Col, y: Col[]) =>
  ({
    type,
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: o.color,
    options: o,
    points: x.length,
    channels: { x: [x], y },
  }) satisfies Partial<Mark>;

/** One min, max and last y per device-pixel column. x must be ascending. */
export function columns(x: Col, y: Col, ox: number, kx: number, oy: number, ky: number) {
  const n = x.length;
  const col = new Int32Array(n);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const last = new Float64Array(n);
  let k = -1;
  for (let i = 0; i < n; i++) {
    const c = Math.round(ox + x[i]! * kx);
    const v = oy - y[i]! * ky;
    if (k < 0 || c !== col[k]) {
      k++;
      col[k] = c;
      lo[k] = hi[k] = v;
    } else if (v < lo[k]!) lo[k] = v;
    else if (v > hi[k]!) hi[k] = v;
    last[k] = v;
  }
  return { n: k + 1, col, lo, hi, last };
}
