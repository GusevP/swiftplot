import type { Col, Mark } from '../types.js';
import { painter, type Paint } from '../paint.js';
import { base, columns, sampleAt, smooth } from './common.js';
import type { Common, Curve } from './common.js';

/**
 * Filled between 0 and y, or between y1 and y2. x must be ascending. `fill` fills it with
 * something other than its colour. An upright blend runs from the furthest the area reaches to
 * its baseline, on both sides of it and whichever side that is, so gradient(0.4, 0) fades the area
 * out where it meets the axis.
 */
export type AreaOptions = Common & { x: Col; curve?: Curve; fill?: Paint } & (
    | { y: Col }
    | { y1: Col; y2: Col }
  );

export function area(o: AreaOptions): Mark {
  const { x, color, curve = 'linear', alpha = 1 } = o;
  const step = curve === 'step';
  const y2 = 'y' in o ? o.y : o.y2;
  const y1 = 'y' in o ? undefined : o.y1;
  return {
    ...base('area', o, [x], [y1 ?? (x.length ? [0] : []), y2]),
    sampleAtX(v) {
      // A step line holds its last value, but the fill ends at the last x.
      if (v > x[x.length - 1]!) return undefined;
      const top = sampleAt(x, y2, v, step);
      const bottom = y1 ? sampleAt(x, y1, v, step) : 0;
      if (top === undefined || bottom === undefined) return undefined;
      return { value: top - bottom, y1: bottom, y2: top };
    },
    prepare({ ctx, ox, kx, oy, ky, left, width }) {
      // Both outlines break where either value is missing, so their runs share their columns.
      const u = columns(x, y2, ox, kx, oy, ky, !step, y1);
      const l = y1 && columns(x, y1, ox, kx, oy, ky, !step, y2);
      const ux = step ? u.col : u.at;
      const lx = l && (step ? l.col : l.at);
      const path = new Path2D();
      for (const [a, b, kept] of u.runs) {
        if (curve === 'smooth' && kept === b - a) {
          path.moveTo(u.at[a]!, u.first[a]!);
          smooth(path, u.at.subarray(a, b), u.first.subarray(a, b), b - a);
          if (l) {
            path.lineTo(l.at[b - 1]!, l.first[b - 1]!);
            smooth(path, l.at.subarray(a, b), l.first.subarray(a, b), b - a, true);
          }
        } else {
          for (let i = a; i < b; i++) {
            const px = ux[i]!;
            if (i === a) path.moveTo(px, step ? u.lo[i]! : u.first[i]!);
            else path.lineTo(px, step ? u.last[i - 1]! : u.first[i]!);
            path.lineTo(px, u.lo[i]!);
            path.lineTo(px, u.last[i]!);
          }
          for (let i = b - 1; l && i >= a; i--) {
            const px = lx![i]!;
            path.lineTo(px, l.last[i]!);
            path.lineTo(px, l.hi[i]!);
            if (!step || i > a) path.lineTo(px, step ? l.last[i - 1]! : l.first[i]!);
          }
        }
        if (!l) {
          path.lineTo(ux[b - 1]!, oy);
          path.lineTo(ux[a]!, oy);
        }
        path.closePath();
      }
      // How far up and down the area reaches, for a blend to run across.
      let [high, low] = l ? [Infinity, -Infinity] : [oy, oy];
      for (const c of l ? [u, l] : [u]) {
        for (let i = 0; i < c.n; i++) [high, low] = [Math.min(high, c.lo[i]!), Math.max(low, c.hi[i]!)];
      }
      const ink = u.n
        ? painter(ctx, o.fill, color)([left, high, left + width, low], l ? undefined : oy)
        : color;
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          ctx.fillStyle = ink;
          ctx.fill(path);
        },
      };
    },
  };
}
