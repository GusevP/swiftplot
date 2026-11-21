import { glLayer } from '../gl.js';
import type { Col, Mark, Prepared, View } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';
import { focused, gpuRows } from './rects.js';

/**
 * One rectangle per row, from (x1, y1) to (x2, y2) in data units; either pair may be in any order.
 * A single `y` (or `x`) stands for a pair that starts at zero.
 */
export type BarOptions = Common & ({ x1: Col; x2: Col } | { x: Col }) & ({ y1: Col; y2: Col } | { y: Col });

// A bound left out is zero throughout, which needs no column.
type Bounds = { x1?: Col; x2: Col; y1?: Col; y2: Col };
const bounds = (o: BarOptions): Bounds => ({
  x1: 'x' in o ? undefined : o.x1,
  x2: 'x' in o ? o.x : o.x2,
  y1: 'y' in o ? undefined : o.y1,
  y2: 'y' in o ? o.y : o.y2,
});

// ponytail: a morph rebuilds every bar each frame, so beyond this many they cross-fade instead.
const MORPH_MAX = 2000;
const PART = { xa: 0, xb: 1, ya: 2, yb: 3, snap: true };

// Edges are snapped to device pixels so neighbours meet without a seam. Holds l, t, r, b per bar,
// as doubles: a bar far outside the domain must not wrap round into view as a 32-bit integer would.
function boxes({ x1, x2, y1, y2 }: Bounds, { ox, kx, oy, ky }: View) {
  const box = new Float64Array(x2.length * 4);
  for (let i = 0, j = 0; j < box.length; i++, j += 4) {
    const xa = x1 ? x1[i]! : 0;
    const xb = x2[i]!;
    const ya = y1 ? y1[i]! : 0;
    const yb = y2[i]!;
    const l = (box[j] = Math.round(ox + Math.min(xa, xb) * kx));
    const t = (box[j + 1] = Math.round(oy - Math.max(ya, yb) * ky));
    // A bar with a size keeps one pixel of it, so a narrow bin or a small value stays visible.
    box[j + 2] = Math.max(Math.round(ox + Math.max(xa, xb) * kx), l + +(xa !== xb));
    box[j + 3] = Math.max(Math.round(oy - Math.min(ya, yb) * ky), t + +(ya !== yb));
  }
  return box;
}

function rects(box: Float64Array) {
  const path = new Path2D();
  for (let j = 0; j < box.length; j += 4) {
    path.rect(box[j]!, box[j + 1]!, box[j + 2]! - box[j]!, box[j + 3]! - box[j + 1]!);
  }
  return path;
}

export function bar(o: BarOptions): Mark {
  const { color, alpha = 1 } = o;
  const own = bounds(o);
  const { x1, x2, y2 } = own;
  const n = x2.length;
  const zero = n ? [0] : [];
  const rows = gpuRows(new WeakMap(), [x1, x2], [own.y1, y2]);
  // ponytail: linear scan per pointer move. The value end is y2, or x2 for a bar given as a
  // single x; a horizontal bar given all four bounds still reports as a vertical one.
  const hit =
    ({ dpr, left, top, width, height }: View, boxed: () => Float64Array): Prepared['hit'] =>
    (px, py, max) => {
      const box = boxed();
      const x = px * dpr;
      const y = py * dpr;
      if (x < left || x > left + width || y < top || y > top + height) return null;
      for (let i = n - 1; i >= 0; i--) {
        const j = i * 4;
        if (x >= box[j]! && y >= box[j + 1]! && x < box[j + 2]! && y < box[j + 3]!) {
          const y1i = own.y1 ? own.y1[i]! : 0;
          return 'x' in o
            ? { x: x2[i]!, y: (y1i + y2[i]!) / 2, distance: max, row: i }
            : { x: ((x1 ? x1[i]! : 0) + x2[i]!) / 2, y: y2[i]!, distance: max, row: i };
        }
      }
      return null;
    };
  return {
    ...base('bar', o, [x2, x1 ?? zero], [y2, own.y1 ?? zero]),
    prepare(view, previous) {
      const { ctx } = view;
      const box = boxes(own, view);
      const full = rects(box);
      let path = full;
      // What is drawn now, which during a move is not yet `box`; hit() keeps answering for `box`.
      let shown = box;
      // Rows are matched by position, so the previous bars must be as many.
      const before =
        previous?.type === 'bar' && previous.points === n && n <= MORPH_MAX
          ? (previous.options as BarOptions)
          : undefined;
      let start: Float64Array | undefined;
      return {
        paint(k, row, rest = 1) {
          ctx.fillStyle = color;
          ctx.globalAlpha = alpha * k;
          if (row === undefined || row >= n) return ctx.fill(path);
          const j = row * 4;
          const one = new Path2D();
          one.rect(shown[j]!, shown[j + 1]!, shown[j + 2]! - shown[j]!, shown[j + 3]! - shown[j + 1]!);
          ctx.fill(one);
          // The rest is drawn through a hole where that bar is, so it is not painted twice.
          const around = new Path2D(one);
          around.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.save();
          ctx.clip(around, 'evenodd');
          ctx.globalAlpha = alpha * k * rest;
          ctx.fill(path);
          ctx.restore();
        },
        morph:
          before &&
          (t => {
            if (t >= 1) return void ([path, shown] = [full, box]);
            // In this view, not the one the previous bars were drawn in: the axes have already moved.
            const from = (start ??= boxes(bounds(before), view));
            shown = box.map((v, i) => Math.round(from[i]! + (v - from[i]!) * t));
            path = rects(shown);
          }),
        hit: hit(view, () => box),
      };
    },
    gl: {
      layer: glLayer,
      under: true,
      prepare(view, { gl }) {
        const { draw, once } = rows.on(view, gl, color);
        let box: Float64Array | undefined;
        return {
          paint(k, row, rest = 1) {
            once(() => {
              for (const [strength, ...run] of focused(n, row, rest))
                draw(PART, alpha * k * strength, ...run);
            });
          },
          hit: hit(view, () => (box ??= boxes(own, view))),
        };
      },
    },
    release(layer) {
      if (layer) rows.release(layer.gl);
    },
  };
}
