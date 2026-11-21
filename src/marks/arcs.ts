import { rgba } from '../gl.js';
import type { Col, Mark } from '../types.js';
import { inRing, TURN, turnAt } from './common.js';

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
  /** Text on each slice that has room for it: true for its share as a percentage, or your own. */
  text?: true | ((row: number, share: number) => string);
  /**
   * Each slice starts at this opacity and reaches its full colour at its end, clockwise. Where
   * the browser has no conic gradient the slices stay solid.
   */
  sweep?: number;
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

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
      // Slices are gathered until they are a device pixel wide at the rim, and drawn as one in
      // the colour of the widest among them: more shapes than pixels cost time and show nothing.
      const slices: { path: Path2D; from: number; to: number; lead: number; span: [number, number] }[] = [];
      const width1 = (i: number) => ends[i]! - (ends[i - 1] ?? 0);
      let [first, lead, start] = [0, 0, 0];
      for (let i = 0; i < n && outer; i++) {
        if (width1(i) > width1(lead) || lead < first) lead = i;
        const end = ends[i]!;
        if (end - start < 1 / (outer * TURN) && i < n - 1) continue;
        if (end > start) {
          const gap = wide > 1 ? Math.min(0.5 / outer, ((end - start) * TURN) / 4) : 0;
          const [a, b] = [start * TURN - TURN / 4 + gap, end * TURN - TURN / 4 - gap];
          const path = new Path2D();
          path.arc(cx, cy, outer, a, b);
          path.arc(cx, cy, hole, b, a, true);
          path.closePath();
          slices.push({ path, from: first, to: i + 1, lead, span: [start, end] });
        }
        [first, start] = [i + 1, end];
      }
      // One paint for every slice: round the clock, each from faint at its start to full at its end.
      const round = o.sweep !== undefined && ctx.createConicGradient?.(-TURN / 4, cx, cy);
      for (const { lead, span } of round ? slices : []) {
        const [red, green, blue, a = 1] = rgba(ctx, shade(lead)).map((v, at) =>
          at < 3 ? Math.round(v * 255) : v,
        );
        (round as CanvasGradient).addColorStop(span[0], `rgba(${red},${green},${blue},${a * o.sweep!})`);
        (round as CanvasGradient).addColorStop(span[1], `rgba(${red},${green},${blue},${a})`);
      }
      // Where a slice's label and its tooltip sit: half-way round it and half-way out.
      const anchor = (i: number) => {
        const middle = (((ends[i - 1] ?? 0) + ends[i]!) / 2) * TURN - TURN / 4;
        const far = (hole + outer) / 2;
        return [cx + Math.cos(middle) * far, cy + Math.sin(middle) * far] as const;
      };
      const said = o.text === true ? (_: number, share: number) => `${Math.round(share * 100)}%` : o.text;
      const within = (i: number, x: number, y: number, w: number, h: number) =>
        inRing([cx, cy, hole, outer, ends[i - 1] ?? 0, ends[i]!], x, y, w, h);
      const labels = !said
        ? undefined
        : Array.from(ends, (end, i) => {
            const share = end - (ends[i - 1] ?? 0);
            // A slice narrower at the rim than one character has no room, so it is not asked.
            const text = share * TURN * outer >= 7 * dpr ? said(i, share) : '';
            const [x, y] = anchor(i);
            if (!text || !within(i, x, y, text.length * 7 * dpr, 16 * dpr)) return undefined;
            return { x, y, text, color: '#fff', priority: share };
          }).filter(l => l !== undefined);
      return {
        labels,
        paint(k, row, rest = 1) {
          for (const { path, from, to, lead } of slices) {
            ctx.globalAlpha = alpha * k * (row === undefined || (row >= from && row < to) ? 1 : rest);
            ctx.fillStyle = round || shade(lead);
            ctx.fill(path);
          }
        },
        // A slice holds its starting edge and not its ending one. Reported at the slice's middle.
        hit(px, py, reach) {
          const [dx, dy] = [px * dpr - cx, py * dpr - cy];
          const far = Math.hypot(dx, dy);
          if (far < hole || far > outer || !outer) return null;
          const share = turnAt(dx, dy);
          // The first slice to end past the pointer, which is one with a width.
          let [row, past] = [0, n];
          while (row < past) {
            const mid = (row + past) >> 1;
            if (ends[mid]! > share) past = mid;
            else row = mid + 1;
          }
          if (row >= n) return null;
          const [x, y] = anchor(row);
          return {
            x: (x - left) / width,
            y: 1 - (y - top) / height,
            distance: reach,
            row,
          };
        },
      };
    },
  };
}
