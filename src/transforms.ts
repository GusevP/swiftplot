import type { Col } from './types.js';

/**
 * Counts values per bin, as the bounds of one bar per bin. `by` is the bin edges in ascending
 * order, or the number of equal bins across the extent of the finite values (rounded to a whole
 * number of at least 1, and 1 when it is not finite; Sturges' rule by default). A bin holds its lower edge and the last bin
 * also its upper one; NaN, infinite values and values outside the edges are not counted.
 */
export function bin(values: Col, by?: number | Col) {
  let edges: Float64Array;
  if (typeof by === 'object') edges = Float64Array.from(by);
  else {
    let lo = Infinity;
    let hi = -Infinity;
    let finite = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      if (!Number.isFinite(v)) continue;
      finite++;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!finite) [lo, hi] = [0, 1];
    if (lo === hi) {
      const pad = Math.abs(lo) / 2 || 0.5;
      lo = Math.max(lo - pad, -Number.MAX_VALUE);
      hi = Math.min(hi + pad, Number.MAX_VALUE);
    }
    const wanted = by ?? Math.ceil(Math.log2(finite || 1)) + 1;
    const count = Number.isFinite(wanted) ? Math.max(1, Math.round(wanted)) : 1;
    // Weighted, not lo + (hi - lo) * t: that overflows for a huge extent and can miss hi by a rounding step.
    edges = Float64Array.from({ length: count + 1 }, (_, i) => lo * (1 - i / count) + hi * (i / count));
  }
  const n = Math.max(edges.length - 1, 0);
  const y2 = new Float64Array(n);
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v)) continue;
    let a = 0;
    let b = n + 1;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (edges[mid]! <= v) a = mid + 1;
      else b = mid;
    }
    const at = v === edges[n] ? n - 1 : a - 1;
    if (at >= 0 && at < n) y2[at]!++;
  }
  return { x1: edges.subarray(0, n), x2: edges.subarray(1), y1: new Float64Array(n), y2 };
}

/**
 * Stacks series that share their x column, row by row: each gets the y1 and y2 of its layer.
 * Negative values stack downwards from zero, apart from the positive ones; NaN counts as zero.
 */
export function stack(series: Col[]) {
  const n = series[0]?.length ?? 0;
  const up = new Float64Array(n);
  const down = new Float64Array(n);
  return series.map(s => {
    const y1 = new Float64Array(n);
    const y2 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const v = s[i] || 0;
      const base = v < 0 ? down : up;
      y1[i] = base[i]!;
      y2[i] = base[i]! += v;
    }
    return { y1, y2 };
  });
}
