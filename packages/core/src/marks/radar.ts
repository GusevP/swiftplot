import { scale } from '../scale.js';
import type { Col, Label, Mark, View } from '../types.js';
import { TURN } from './common.js';

/**
 * A radar chart for a polar frame: `marks: radar({ axes, series })`. It gives one mark for the
 * rings, the spokes and their names, then one per series, so series are named, dimmed and hit
 * like any other marks, and a hit's row is the spoke. Spokes start at twelve o'clock and run
 * clockwise. A value that is negative or not a number sits at the centre.
 */
export type RadarOptions = {
  /** The spokes' names; a series has a value for each, in this order. */
  axes: string[];
  /** The series, each drawn as a mark of its own with its values, colour, label, group and key. */
  series: {
    /** The series' value on each spoke. */
    values: Col;
    /** A CSS colour. */
    color: string;
    /** The series' name in a legend, a tooltip and the chart's description. */
    label?: string;
    /** Series of one group are focused, dimmed and hidden together; the label when left out. */
    group?: string;
    /** Pairs the series with the one it replaces in update(), to keep or morph its shape. */
    key?: string;
  }[];
  /** What the rim stands for, capping larger values; the largest rounded up to a whole step when left out. */
  max?: number;
  /** The opacity of a series' filling; 0.15 by default. */
  fill?: number;
};

const worth = (v: number | undefined) => (v! > 0 && Number.isFinite(v) ? v! : 0);

export function radar(o: RadarOptions): Mark[] {
  const { axes, series, fill = 0.15 } = o;
  const n = axes.length;
  let most = 0;
  for (const s of series) for (let i = 0; i < n; i++) most = Math.max(most, worth(s.values[i]));
  const hi = worth(o.max) || scale('nice', [0, most || 1]).hi;
  const toward = (i: number) => {
    const angle = (i / (n || 1)) * TURN - TURN / 4;
    return [Math.cos(angle), Math.sin(angle)] as const;
  };
  // The rim is as far out as leaves every spoke's name inside the chart, 8 px beyond the rim
  // sideways and 12 px up or down. It keeps half the room whatever the names; one that then
  // does not fit is left out.
  const disc = ({ dpr, left, top, width, height }: View) => {
    let r = Math.min(width, height) / 2;
    for (let i = 0; i < n; i++) {
      const [c, s] = [Math.abs(toward(i)[0]), Math.abs(toward(i)[1])];
      if (c >= 0.01) r = Math.min(r, (width / 2 - (axes[i]!.length * 7 + 4) * dpr) / c - 8 * dpr);
      if (s >= 0.01) r = Math.min(r, (height / 2 - 10 * dpr) / s - 12 * dpr);
    }
    r = Math.max(r, Math.min(width, height) / 4, 0);
    return { cx: left + width / 2, cy: top + height / 2, r };
  };
  // With more spokes than the rim has device pixels, one is drawn for each pixel: the longest of
  // those it stands for. More shapes than pixels cost time and show nothing.
  const drawn = (r: number, far?: (i: number) => number) => {
    const room = Math.max(1, Math.ceil(TURN * r));
    if (n <= room) return Array.from({ length: n }, (_, i) => i);
    const best = new Int32Array(room).fill(-1);
    for (let i = 0; i < n; i++) {
      const at = Math.floor((i * room) / n);
      if (best[at]! < 0 || (far && far(i) > far(best[at]!))) best[at] = i;
    }
    return [...best].filter(i => i >= 0);
  };
  const ring = (cx: number, cy: number, far: (i: number) => number, spokes: number[]) => {
    const path = new Path2D();
    for (const i of spokes) path.lineTo(cx + toward(i)[0] * far(i), cy + toward(i)[1] * far(i));
    path.closePath();
    return path;
  };

  const grid: Mark = {
    type: 'radar-grid',
    color: '#888',
    options: { axes, hi },
    points: 0,
    channels: { x: [], y: [] },
    backdrop: true,
    prepare(view) {
      const { ctx, dpr } = view;
      const { cx, cy, r } = disc(view);
      const { ticks } = scale([0, hi], [0, hi], { length: r / dpr, horizontal: false });
      // The rim is drawn and given its value even where it has been thinned out of the ticks.
      const rings = [...new Set([...ticks.filter(t => t > 0), hi])];
      const lines = new Path2D();
      const spokes = drawn(r);
      for (const t of rings) lines.addPath(ring(cx, cy, () => (t / hi) * r, spokes));
      for (const i of spokes) {
        lines.moveTo(cx, cy);
        lines.lineTo(cx + toward(i)[0] * r, cy + toward(i)[1] * r);
      }
      const labels: Label[] = spokes.map(i => {
        const [[c, s], text] = [toward(i), axes[i]!];
        const side = Math.abs(c) < 0.01 ? 'center' : c > 0 ? 'start' : 'end';
        return { x: cx + c * (r + 8 * dpr), y: cy + s * (r + 12 * dpr), text, align: side, priority: 1 };
      });
      // Under its ring, clear of the name at the top of the first spoke.
      for (const t of rings) {
        const [x, y] = [cx + 4 * dpr, cy - (t / hi) * r + 9 * dpr];
        labels.push({
          x,
          y,
          text: String(t),
          align: 'start',
          color: view.theme.muted,
          priority: t === hi ? 0.5 : 0,
        });
      }
      return {
        labels: r && n ? labels : [],
        paint(k) {
          ctx.globalAlpha = k;
          ctx.strokeStyle = view.theme.grid;
          ctx.lineWidth = dpr;
          ctx.stroke(lines);
        },
      };
    },
  };

  return [
    grid,
    ...series.map((s): Mark => ({
      type: 'radar',
      key: s.key,
      label: s.label,
      group: s.group ?? s.label,
      color: s.color,
      // With the rim and the spokes, so that a change to either redraws a series left as it was.
      options: { ...s, hi, axes, fill },
      points: n,
      channels: { x: [], y: [] },
      oneShape: true,
      prepare(view) {
        const { ctx, dpr, left, top, width, height } = view;
        const { cx, cy, r } = disc(view);
        const far = (i: number) => (Math.min(worth(s.values[i]), hi) / hi) * r;
        const at = (i: number) => [cx + toward(i)[0] * far(i), cy + toward(i)[1] * far(i)] as const;
        const spokes = drawn(r, far);
        const shape = ring(cx, cy, far, spokes);
        const corners = new Path2D();
        for (const i of spokes) {
          corners.moveTo(...at(i));
          corners.arc(...at(i), 2 * dpr, 0, TURN);
        }
        return {
          paint(k) {
            ctx.fillStyle = ctx.strokeStyle = s.color;
            ctx.lineWidth = 1.5 * dpr;
            ctx.lineJoin = 'round';
            ctx.globalAlpha = k * fill;
            ctx.fill(shape);
            ctx.globalAlpha = k;
            ctx.stroke(shape);
            ctx.fill(corners);
          },
          // The nearest corner within reach, as a row: the spoke it is on.
          hit(px, py, max) {
            let [row, near] = [-1, max];
            for (let i = 0; i < n && r; i++) {
              const [x, y] = at(i);
              const d = Math.hypot(px - x / dpr, py - y / dpr);
              if (d <= near) [row, near] = [i, d];
            }
            if (row < 0) return null;
            const [x, y] = at(row);
            return {
              x: (x - left) / width,
              y: 1 - (y - top) / height,
              distance: near,
              row,
              value: s.values[row] ?? NaN,
            };
          },
        };
      },
    })),
  ];
}
