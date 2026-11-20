import type { Col, Mark } from '../types.js';

/**
 * Slices of a pie, or of a ring when `inner` (the hole's share of the radius) is above 0, for a
 * polar frame. They start at 12 o'clock and run clockwise, each as wide as its value's share of
 * the total; a value that is negative or not a number counts as 0. Colours repeat when there are
 * fewer than slices. `labels` name the slices for a legend.
 */
export type ArcsOptions = {
  values: Col;
  colors: string[];
  labels?: string[];
  inner?: number;
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

const TURN = 2 * Math.PI;

export function arcs(o: ArcsOptions): Mark {
  const { values, colors, inner = 0, alpha = 1 } = o;
  const n = values.length;
  // Where each slice ends, as a share of the turn; the last entry is 1 unless every value is 0.
  const ends = new Float64Array(n);
  const worth = (i: number) => (values[i]! > 0 && Number.isFinite(values[i]) ? values[i]! : 0);
  // Shares are summed as fractions of the largest value: the values themselves can overflow.
  let most = 0;
  for (let i = 0; i < n; i++) most = Math.max(most, worth(i));
  let total = 0;
  for (let i = 0; i < n; i++) ends[i] = total += worth(i) / (most || 1);
  for (let i = 0; i < n; i++) ends[i]! /= total || 1;
  let wide = 0;
  for (let i = 0; i < n; i++) wide += +(ends[i]! > (ends[i - 1] ?? 0));
  const shade = (i: number) => colors[i % colors.length] ?? '#888';
  return {
    type: 'arcs',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: shade(0),
    options: o,
    points: n,
    channels: { x: [], y: [] },
    entries: o.labels?.slice(0, n).map((label, i) => ({ label, color: shade(i) })),
    prepare({ ctx, dpr, left, top, width, height }) {
      const [cx, cy] = [left + width / 2, top + height / 2];
      const outer = Math.max(0, Math.min(width, height) / 2);
      const hole = outer * Math.max(0, Math.min(inner, 1));
      // A gap of a device pixel between neighbours, which shows whatever is behind the chart.
      const slices = Array.from(ends, (end, i) => {
        const from = ends[i - 1] ?? 0;
        if (!(end > from) || !outer) return undefined;
        const gap = wide > 1 ? Math.min(0.5 / outer, ((end - from) * TURN) / 4) : 0;
        const [a, b] = [from * TURN - TURN / 4 + gap, end * TURN - TURN / 4 - gap];
        const path = new Path2D();
        path.arc(cx, cy, outer, a, b);
        path.arc(cx, cy, hole, b, a, true);
        path.closePath();
        return path;
      });
      return {
        paint(k, row, rest = 1) {
          slices.forEach((path, i) => {
            if (!path) return;
            ctx.globalAlpha = alpha * k * (row === undefined || row === i ? 1 : rest);
            ctx.fillStyle = shade(i);
            ctx.fill(path);
          });
        },
        // A slice holds its starting edge and not its ending one. Reported at the slice's middle.
        hit(px, py, reach) {
          const [dx, dy] = [px * dpr - cx, py * dpr - cy];
          const far = Math.hypot(dx, dy);
          if (far < hole || far > outer || !outer) return null;
          const share = ((((Math.atan2(dy, dx) + TURN / 4) / TURN) % 1) + 1) % 1;
          const row = ends.findIndex((end, i) => share < end && end > (ends[i - 1] ?? 0));
          if (row < 0) return null;
          const middle = (((ends[row - 1] ?? 0) + ends[row]!) / 2) * TURN - TURN / 4;
          const reachOut = (hole + outer) / 2;
          return {
            x: (cx + Math.cos(middle) * reachOut - left) / width,
            y: 1 - (cy + Math.sin(middle) * reachOut - top) / height,
            distance: reach,
            row,
          };
        },
      };
    },
  };
}
