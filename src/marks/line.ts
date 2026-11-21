import type { Col, Mark } from '../types.js';
import { gradient, painter, type Paint } from '../paint.js';
import { base, columns, sampleAt, smooth } from './common.js';
import type { Common, Curve } from './common.js';

/**
 * x must be ascending. `stroke` draws the line with something other than its colour: a blend
 * across the plot area, say. `fill` shades what is under the line, down to the bottom of the plot
 * area: `true` for a faint fade of the line's colour, or a paint of your own.
 */
export type LineOptions = Common & {
  x: Col;
  y: Col;
  curve?: Curve;
  width?: number;
  stroke?: Paint;
  fill?: Paint | boolean;
};

export function line(o: LineOptions): Mark {
  const { x, y, color, curve = 'linear', width = 1.5, alpha = 1 } = o;
  const step = curve === 'step';
  return {
    ...base('line', o, [x], [y]),
    overhang: width / 2,
    prepare({ ctx, dpr, ox, kx, oy, ky, left, top, width: wide, height }) {
      const c = columns(x, y, ox, kx, oy, ky, !step);
      const cx = step ? c.col : c.at;
      const curved = curve === 'smooth' && c.n === c.real;
      const trace = (path: Path2D, a: number, b: number) => {
        if (curved) {
          path.moveTo(c.at[a]!, c.first[a]!);
          smooth(path, c.at.subarray(a, b), c.first.subarray(a, b), b - a);
          return;
        }
        for (let i = a; i < b; i++) {
          const px = cx[i]!;
          if (i === a) path.moveTo(px, step ? c.last[i]! : c.first[i]!);
          else path.lineTo(px, step ? c.last[i - 1]! : c.first[i]!);
          if (c.lo[i] !== c.hi[i]) {
            path.lineTo(px, c.lo[i]!);
            path.lineTo(px, c.hi[i]!);
          }
          path.lineTo(px, c.last[i]!);
        }
      };
      const path = new Path2D();
      for (const [a, b] of c.runs) trace(path, a, b);
      const ink = painter(ctx, o.stroke, color)([left, top, left + wide, top + height]);
      let under: Path2D | undefined;
      let shade: string | CanvasGradient = color;
      if (o.fill && c.n) {
        const floor = top + height;
        under = new Path2D();
        for (const [a, b] of c.runs) {
          trace(under, a, b);
          under.lineTo(cx[b - 1]!, floor);
          under.lineTo(cx[a]!, floor);
          under.closePath();
        }
        let high = floor;
        for (let i = 0; i < c.n; i++) high = Math.min(high, c.lo[i]!);
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
    sampleAtX: v => sampleAt(x, y, v, step),
  };
}
