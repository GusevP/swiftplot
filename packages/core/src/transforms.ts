import type { Col } from './types.js';

/**
 * Counts values per bin, as the bounds of one bar per bin. A bin holds its lower edge and the last bin
 * also its upper one; NaN, infinite values and values outside the edges are not counted.
 * @param values The values to count.
 * @param by The bin edges in ascending order, or how many equal bins span the finite values, rounded and at least 1; Sturges' rule when left out.
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
 * @param series The y column of each layer, stacked in this order.
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

/**
 * The two bounds of one bar per category on a band axis, where category i sits at i.
 * @param at A count for categories 0 to n - 1, or the indices themselves.
 */
export function bands(
  at: number | Col,
  {
    slot = 0,
    of = 1,
    width = 0.8,
  }: {
    /** Which of the `of` slots in each category these bars take, for grouped bars. @default 0 */
    slot?: number;
    /** How many slots each category is split into. @default 1 */
    of?: number;
    /** The share of the category that the bars of all slots take together. @default 0.8 */
    width?: number;
  } = {},
): [Float64Array, Float64Array] {
  const n = typeof at === 'number' ? at : at.length;
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const each = width / of;
  const offset = slot * each - width / 2;
  for (let i = 0; i < n; i++) {
    lo[i] = (typeof at === 'number' ? i : at[i]!) + offset;
    hi[i] = lo[i]! + each;
  }
  return [lo, hi];
}

/**
 * The five numbers a box plot draws, for each group of values: minimum, quartiles and maximum.
 * Quartiles are interpolated between the two nearest values; NaN and infinite values are left out,
 * and a group with nothing left gives NaN, which draws nothing.
 * @param groups The values of each group, one box per group.
 */
export function fiveNumbers(groups: Col[]) {
  const column = () => new Float64Array(groups.length);
  const [min, q1, median, q3, max] = [column(), column(), column(), column(), column()];
  groups.forEach((group, g) => {
    const v = Float64Array.from(group).filter(Number.isFinite).sort();
    const quantile = (p: number) => {
      const at = (v.length - 1) * p;
      const [a, b, t] = [v[Math.floor(at)]!, v[Math.ceil(at)]!, at % 1];
      // The difference overflows for huge values of opposite sign; the weighted sum does not.
      return Number.isFinite(b - a) ? a + (b - a) * t : a * (1 - t) + b * t;
    };
    min[g] = v[0] ?? NaN;
    q1[g] = quantile(0.25);
    median[g] = quantile(0.5);
    q3[g] = quantile(0.75);
    max[g] = v.at(-1) ?? NaN;
  });
  return { min, q1, median, q3, max };
}
