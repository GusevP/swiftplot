import type { Col, Mark } from '../types.js';
import { gradient, painter, type Paint } from '../paint.js';
import { base, chains, columns, extent, joined, reach, sampleAt, smooth, span } from './common.js';
import type { Common, Curve } from './common.js';

/**
 * x must be ascending. `stroke` draws the line with something other than its colour: a blend
 * across the plot area, say. `fill` shades what is under the line, down to the bottom of the plot
 * area: `true` for a faint fade of the line's colour, or a paint of your own. `join` draws it straight
 * across a value that is not finite, where it would otherwise leave a gap.
 */
export type LineOptions = Common & {
  x: Col;
  y: Col;
  curve?: Curve;
  width?: number;
  stroke?: Paint;
  fill?: Paint | boolean;
  join?: boolean;
};

export function line(o: LineOptions): Mark {
  const { color, curve = 'linear', width = 1.5, alpha = 1 } = o;
  const [[x, y], cuts] = o.join ? joined(o.x, o.y) : [[o.x, o.y]];
  const end = o.join && !Number.isFinite(o.y[o.y.length - 1]!) ? x[x.length - 1]! : Infinity;
  const step = curve === 'step';
  const ys = o.fill ? extent([y]) : undefined;
  return {
    ...base('line', o, [o.x], [o.y]),
    oneShape: true,
    overhang: width / 2,
    prepare({ ctx, dpr, ox, kx, oy, ky, left, top, width: wide, height }) {
      const rows = span(x, ox, kx, left - width * dpr, left + wide + width * dpr, curve === 'smooth' ? 2 : 1);
      const c = columns(x, y, ox, kx, oy, ky, !step || o.join, undefined, rows, cuts);
      const cx = step ? c.col : c.at;
      const trace = (path: Path2D, [a, b, kept]: (typeof c.runs)[number], on = false) => {
        const go = on ? 'lineTo' : 'moveTo';
        if (curve === 'smooth' && kept === b - a) {
          path[go](c.at[a]!, c.first[a]!);
          smooth(path, c.at.subarray(a, b), c.first.subarray(a, b), b - a);
          return;
        }
        for (let i = a; i < b; i++) {
          const px = cx[i]!;
          if (i === a) path[go](px, step && !on ? c.last[i]! : c.first[i]!);
          else path.lineTo(px, step ? c.last[i - 1]! : c.first[i]!);
          if (c.lo[i] !== c.hi[i]) {
            path.lineTo(px, c.lo[i]!);
            path.lineTo(px, c.hi[i]!);
          }
          path.lineTo(px, c.last[i]!);
        }
      };
      const path = new Path2D();
      const groups = chains(c.runs);
      for (const runs of groups) runs.forEach((run, i) => trace(path, run, i > 0));
      const ink = painter(ctx, o.stroke, color)([left, top, left + wide, top + height]);
      let under: Path2D | undefined;
      let shade: string | CanvasGradient = color;
      if (o.fill && c.n) {
        const floor = top + height;
        under = new Path2D();
        for (const runs of groups) {
          runs.forEach((run, i) => trace(under!, run, i > 0));
          under.lineTo(cx[runs[runs.length - 1]![1] - 1]!, floor);
          under.lineTo(cx[runs[0]![0]]!, floor);
          under.closePath();
        }
        const high = Math.min(floor, reach(ys!, [y], oy, ky)[0]);
        shade = painter(
          ctx,
          o.fill === true ? gradient(0.18, 0) : o.fill,
          color,
        )([left, high, left + wide, floor]);
      }
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          if (under) {
            ctx.fillStyle = shade;
            ctx.fill(under);
          }
          ctx.lineWidth = width * dpr;
          ctx.strokeStyle = ink;
          ctx.stroke(path);
        },
      };
    },
    sampleAtX: (v, straight) =>
      // A step holds its last value past the end, which a trailing gap left out by `join` must not.
      v > end
        ? undefined
        : sampleAt(x, y, v, straight && curve === 'smooth' ? 'linear' : curve, undefined, cuts),
  };
}
