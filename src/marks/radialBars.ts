import { scale } from '../scale.js';
import type { Label, Col, Mark } from '../types.js';
import { TURN, turnAt } from './common.js';

/**
 * One bar per value, bent round the centre on its own ring, for a polar frame. The first value
 * is outermost. A bar starts at twelve o'clock and runs clockwise; three quarters of a turn
 * stand for `max`, or for the largest value rounded up to a whole step, and the last quarter is
 * kept for the names. A value that is negative or not a number has no bar, and one above `max`
 * stops at the three quarters. `inner` is the share of the radius left empty in the middle.
 */
export type RadialBarsOptions = {
  values: Col;
  colors: string[];
  /** Names for a legend, and written at the start of each ring unless `text` is false. */
  labels?: string[];
  text?: boolean;
  max?: number;
  inner?: number;
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

const SWEEP = 0.75;

export function radialBars(o: RadialBarsOptions): Mark {
  const { values, colors, inner = 0.3, alpha = 1 } = o;
  const n = values.length;
  const worth = (v: number | undefined) => (v! > 0 && Number.isFinite(v) ? v! : 0);
  let most = 0;
  for (let i = 0; i < n; i++) most = Math.max(most, worth(values[i]));
  const hi = worth(o.max) || scale('nice', [0, most || 1]).hi;
  // How far round each bar goes, as a share of a whole turn.
  const round = Float64Array.from({ length: n }, (_, i) => (Math.min(worth(values[i]), hi) / hi) * SWEEP);
  const shade = (i: number) => colors[i % colors.length] ?? '#888';
  return {
    type: 'radialBars',
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
      const thick = (outer - hole) / (n || 1);
      const gap = Math.min(2 * dpr, thick / 4);
      // Ring i between its two radii, from twelve o'clock round to a share of the turn.
      const reach = (i: number) => [outer - (i + 1) * thick + gap, outer - i * thick] as const;
      const bent = (i: number, share: number) => {
        const [near, far] = reach(i);
        const [a, b] = [-TURN / 4, share * TURN - TURN / 4];
        const path = new Path2D();
        path.arc(cx, cy, far, a, b);
        path.arc(cx, cy, near, b, a, true);
        path.closePath();
        return path;
      };
      const tracks = new Path2D();
      for (let i = 0; i < n && thick; i++) tracks.addPath(bent(i, SWEEP));
      const bars = Array.from(round, (share, i) => (share && thick ? bent(i, share) : undefined));
      const anchor = (i: number) => {
        const angle = (round[i]! / 2) * TURN - TURN / 4;
        const far = (reach(i)[0] + reach(i)[1]) / 2;
        return [cx + Math.cos(angle) * far, cy + Math.sin(angle) * far] as const;
      };
      const labels: Label[] = [];
      for (let i = 0; o.text !== false && thick && i < n && i < (o.labels?.length ?? 0); i++) {
        labels.push({
          x: cx - 6 * dpr,
          y: cy - (reach(i)[0] + reach(i)[1]) / 2,
          text: o.labels![i]!,
          align: 'end',
          priority: n - i,
        });
      }
      return {
        labels,
        paint(k, row, rest = 1) {
          ctx.globalAlpha = alpha * k * 0.06;
          ctx.fillStyle = '#000';
          ctx.fill(tracks);
          bars.forEach((path, i) => {
            if (!path) return;
            ctx.globalAlpha = alpha * k * (row === undefined || row === i ? 1 : rest);
            ctx.fillStyle = shade(i);
            ctx.fill(path);
          });
        },
        // The bar the pointer is on, not its empty track. Reported at the middle of the bar.
        hit(px, py, max) {
          const [dx, dy] = [px * dpr - cx, py * dpr - cy];
          const row = Math.floor((outer - Math.hypot(dx, dy)) / (thick || 1));
          if (!(row >= 0 && row < n) || !bars[row]) return null;
          if (Math.hypot(dx, dy) < reach(row)[0] || turnAt(dx, dy) >= round[row]!) return null;
          const [x, y] = anchor(row);
          return { x: (x - left) / width, y: 1 - (y - top) / height, distance: max, row };
        },
      };
    },
  };
}
