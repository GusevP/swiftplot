import type { Col, Mark } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/**
 * A box from q1 to q3 with a line at the median and whiskers out to min and max, one per x.
 * `width` is the box's width in x units, so 0.6 on a band axis is 60% of the category.
 * ponytail: upright only, and the whiskers go to whatever min and max are given; outliers are
 * for the caller to leave out and draw with dots().
 */
export type BoxOptions = Common & {
  x: Col;
  min: Col;
  q1: Col;
  median: Col;
  q3: Col;
  max: Col;
  width?: number;
};

export function box(o: BoxOptions): Mark {
  const { x, min, q1, median, q3, max, color, alpha = 1, width = 0.6 } = o;
  const n = x.length;
  // The axis must make room for the boxes, not only for their centres.
  let [first, last] = [Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    if (x[i]! < first && x[i] !== -Infinity) first = x[i]!;
    if (x[i]! > last && x[i] !== Infinity) last = x[i]!;
  }
  return {
    ...base('box', o, [x, [first - width / 2, last + width / 2]], [min, max]),
    prepare({ ctx, dpr, ox, kx, oy, ky, left, top, width: plotWidth, height }) {
      const edges = new Float64Array(n * 4).fill(NaN);
      const y = (v: number) => Math.round(oy - v * ky);
      const trace = (fill: Path2D, lines: Path2D, i: number) => {
        // A row with a number missing draws nothing: see errorBars for what a NaN does to a path.
        if (![x, min, q1, median, q3, max].every(c => Number.isFinite(c[i]))) return;
        const mid = ox + x[i]! * kx;
        const l = Math.round(mid - (width * kx) / 2);
        const r = Math.max(Math.round(mid + (width * kx) / 2), l + 1);
        const [t, b] = [y(q3[i]!), y(q1[i]!)];
        edges.set([l, t, r, b], i * 4);
        fill.rect(l, t, r - l, b - t);
        lines.rect(l, t, r - l, b - t);
        for (const [from, to] of [
          [t, y(max[i]!)],
          [b, y(min[i]!)],
        ]) {
          lines.moveTo(mid, from!);
          lines.lineTo(mid, to!);
          lines.moveTo(mid - (r - l) / 4, to!);
          lines.lineTo(mid + (r - l) / 4, to!);
        }
        lines.moveTo(l, y(median[i]!));
        lines.lineTo(r, y(median[i]!));
      };
      const paths = (rows: (i: number) => boolean) => {
        const made = [new Path2D(), new Path2D()] as const;
        for (let i = 0; i < n; i++) if (rows(i)) trace(...made, i);
        return made;
      };
      const all = paths(() => true);
      // The one focused row and the rest, kept for as long as the focus stays on that row.
      let split: { row: number; one: typeof all; others: typeof all } | undefined;
      const draw = ([fill, lines]: typeof all, k: number) => {
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * k * 0.25;
        ctx.fill(fill);
        ctx.globalAlpha = alpha * k;
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke(lines);
      };
      return {
        paint(a, row, rest = 1) {
          if (row === undefined || row >= n) return draw(all, a);
          if (split?.row !== row) split = { row, one: paths(i => i === row), others: paths(i => i !== row) };
          draw(split.others, a * rest);
          draw(split.one, a);
        },
        // The box itself answers, with its median; reported as the weakest hit like any filled shape.
        hit(px, py, reach) {
          const [hx, hy] = [px * dpr, py * dpr];
          if (hx < left || hx > left + plotWidth || hy < top || hy > top + height) return null;
          for (let i = n - 1; i >= 0; i--) {
            const j = i * 4;
            if (hx >= edges[j]! && hy >= edges[j + 1]! && hx < edges[j + 2]! && hy < edges[j + 3]!) {
              return { x: x[i]!, y: median[i]!, distance: reach, row: i };
            }
          }
          return null;
        },
      };
    },
  };
}
