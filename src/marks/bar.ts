import type { Col, Mark, View } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/** One rectangle per row, from (x1, y1) to (x2, y2) in data units; either pair may be in any order. */
export type BarOptions = Common & { x1: Col; x2: Col; y1: Col; y2: Col };

// ponytail: a morph rebuilds every bar each frame, so beyond this many they cross-fade instead.
const MORPH_MAX = 2000;

// Edges are snapped to device pixels so neighbours meet without a seam. Holds l, t, r, b per bar,
// as doubles: a bar far outside the domain must not wrap round into view as a 32-bit integer would.
function boxes({ x1, x2, y1, y2 }: BarOptions, { ox, kx, oy, ky }: View) {
  const box = new Float64Array(x1.length * 4);
  for (let i = 0, j = 0; j < box.length; i++, j += 4) {
    const l = (box[j] = Math.round(ox + Math.min(x1[i]!, x2[i]!) * kx));
    const t = (box[j + 1] = Math.round(oy - Math.max(y1[i]!, y2[i]!) * ky));
    // A bar with a size keeps one pixel of it, so a narrow bin or a small value stays visible.
    box[j + 2] = Math.max(Math.round(ox + Math.max(x1[i]!, x2[i]!) * kx), l + +(x1[i] !== x2[i]));
    box[j + 3] = Math.max(Math.round(oy - Math.min(y1[i]!, y2[i]!) * ky), t + +(y1[i] !== y2[i]));
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
  const { x1, x2, y1, y2, color, alpha = 1 } = o;
  const n = x1.length;
  return {
    ...base('bar', o, [x1, x2], [y1, y2]),
    prepare(view, previous) {
      const { ctx, dpr, left, top, width, height } = view;
      const box = boxes(o, view);
      const own = rects(box);
      let path = own;
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
            if (t >= 1) return void ([path, shown] = [own, box]);
            // In this view, not the one the previous bars were drawn in: the axes have already moved.
            const from = (start ??= boxes(before, view));
            shown = box.map((v, i) => Math.round(from[i]! + (v - from[i]!) * t));
            path = rects(shown);
          }),
        // ponytail: linear scan per pointer move; reports the middle of x and y2, which suits
        // vertical bars only. A bar orientation or a row index in Hit when horizontal bars need it.
        hit(px, py, max) {
          const x = px * dpr;
          const y = py * dpr;
          if (x < left || x > left + width || y < top || y > top + height) return null;
          for (let i = n - 1; i >= 0; i--) {
            const j = i * 4;
            if (x >= box[j]! && y >= box[j + 1]! && x < box[j + 2]! && y < box[j + 3]!) {
              return { x: (x1[i]! + x2[i]!) / 2, y: y2[i]!, distance: max, row: i };
            }
          }
          return null;
        },
      };
    },
  };
}
