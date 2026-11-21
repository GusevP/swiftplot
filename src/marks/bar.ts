import { glLayer } from '../gl.js';
import { painter, stops, type Paint } from '../paint.js';
import type { Col, Mark, Prepared, View } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';
import { focused, gpuRows, type Blend, type Part } from './rects.js';

/**
 * One rectangle per row, from (x1, y1) to (x2, y2) in data units; either pair may be in any order.
 * A single `y` (or `x`) stands for a pair that starts at zero. `gap` takes so many CSS pixels off
 * the side of each bar, which sets touching bars such as a histogram's apart; a bar keeps a pixel
 * of its width. `radius` rounds the value end of a bar that starts at zero by so many CSS pixels,
 * and all the corners of one that does not; bars too narrow to
 * show it, and bars drawn by WebGL, stay square. `fill` fills the bars with something other than
 * their colour: a blend runs over each bar, and down a bar that stands on a baseline it runs from
 * the value end to the baseline. On the canvas blended bars are filled one at a time.
 */
export type BarOptions = Common & { fill?: Paint; radius?: number; gap?: number } & (
    | { x1: Col; x2: Col }
    | { x: Col }
  ) &
  ({ y1: Col; y2: Col } | { y: Col });

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

// Edges are snapped to device pixels so neighbours meet without a seam. Holds l, t, r, b per bar,
// as doubles: a bar far outside the domain must not wrap round into view as a 32-bit integer would.
function boxes({ x1, x2, y1, y2 }: Bounds, { ox, kx, oy, ky }: View, [gapX, gapY] = [0, 0]) {
  const box = new Float64Array(x2.length * 4);
  for (let i = 0, j = 0; j < box.length; i++, j += 4) {
    const xa = x1 ? x1[i]! : 0;
    const xb = x2[i]!;
    const ya = y1 ? y1[i]! : 0;
    const yb = y2[i]!;
    const l = (box[j] = Math.round(ox + Math.min(xa, xb) * kx));
    const t = (box[j + 1] = Math.round(oy - Math.max(ya, yb) * ky));
    // A bar with a size keeps one pixel of it, so a narrow bin or a small value stays visible.
    const r = Math.max(Math.round(ox + Math.max(xa, xb) * kx), l + +(xa !== xb));
    const b = Math.max(Math.round(oy - Math.min(ya, yb) * ky), t + +(ya !== yb));
    box[j + 2] = r - Math.max(0, Math.min(gapX, r - l - 1));
    box[j + 3] = b - Math.max(0, Math.min(gapY, b - t - 1));
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
  const corner = o.radius ?? 0;
  // The gap comes off a bar's thickness: its width, or its height when it lies down.
  const flat = 'x' in o && !('y' in o);
  const gaps = (dpr: number): [number, number] => {
    const g = Math.round((o.gap ?? 0) * dpr);
    return flat ? [0, g] : [g, 0];
  };
  const laid = (of: Bounds, view: View) => boxes(of, view, gaps(view.dpr));
  const trace = (path: CanvasPath, box: Float64Array, i: number, dpr: number) => {
    const j = i * 4;
    const [l, t, w, h] = [box[j]!, box[j + 1]!, box[j + 2]! - box[j]!, box[j + 3]! - box[j + 1]!];
    const r = Math.min(corner * dpr, w / 2, h / 2);
    if (!(r >= 1)) return path.rect(l, t, w, h);
    // Top left, top right, bottom right, bottom left: the value end of a bar that starts at zero.
    const up = y2[i]! >= 0 ? [r, r, 0, 0] : [0, 0, r, r];
    const along = x2[i]! >= 0 ? [0, r, r, 0] : [r, 0, 0, r];
    const grounded = (own.y1 ? own.y1[i] : 0) === 0;
    path.roundRect(l, t, w, h, grounded ? up : flat ? along : r);
  };
  const shaped = (box: Float64Array, dpr: number) => {
    if (!corner) return rects(box);
    const path = new Path2D();
    for (let i = 0; i < n; i++) trace(path, box, i, dpr);
    return path;
  };
  const blended = typeof o.fill === 'object' ? o.fill : undefined;
  const upright = blended?.toward === 'down' || blended?.toward === 'up';
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
      const box = laid(own, view);
      const full = shaped(box, view.dpr);
      const ink = painter(ctx, o.fill, color);
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
          for (let i = 0, j = 0; blended && i < n; i++, j += 4) {
            ctx.globalAlpha = alpha * k * (row === undefined || row >= n || row === i ? 1 : rest);
            ctx.fillStyle = ink([...shown.subarray(j, j + 4)], 'y' in o ? view.oy : undefined);
            ctx.beginPath();
            trace(ctx, shown, i, view.dpr);
            ctx.fill();
          }
          if (blended) return;
          ctx.fillStyle = ink([]);
          ctx.globalAlpha = alpha * k;
          if (row === undefined || row >= n) return ctx.fill(path);
          const one = new Path2D();
          trace(one, shown, row, view.dpr);
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
            const from = (start ??= laid(bounds(before), view));
            shown = box.map((v, i) => Math.round(from[i]! + (v - from[i]!) * t));
            path = shaped(shown, view.dpr);
          }),
        hit: hit(view, () => box),
      };
    },
    gl: {
      layer: glLayer,
      under: true,
      prepare(view, { gl }) {
        const based = upright && 'y' in o;
        const blend: Blend | undefined = blended && {
          stops: stops(view.ctx, blended, color, based),
          upright,
          based,
        };
        const { draw, once } = rows.on(view, gl, typeof o.fill === 'string' ? o.fill : color, 0, blend);
        let box: Float64Array | undefined;
        // Moved and shrunk by half the gap each, the far edge alone gives way, as on the canvas.
        const [gx, gy] = gaps(view.dpr);
        const part = {
          xa: 0,
          xb: 1,
          ya: 2,
          yb: 3,
          snap: true,
          shift: [-gx / 2, -gy / 2],
          pad: [-gx / 2, -gy / 2],
        };
        return {
          paint(k, row, rest = 1) {
            once(() => {
              for (const [strength, ...run] of focused(n, row, rest))
                draw(part as Part, alpha * k * strength, ...run);
            });
          },
          hit: hit(view, () => (box ??= laid(own, view))),
        };
      },
    },
    release(layer) {
      if (layer) rows.release(layer.gl);
    },
  };
}
