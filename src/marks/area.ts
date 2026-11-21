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
      if (top === undefined) return undefined;
      const bottom = y1 ? sampleAt(x, y1, v, step)! : 0;
      return { value: top - bottom, y1: bottom, y2: top };
    },
    prepare({ ctx, ox, kx, oy, ky, left, width }) {
      const u = columns(x, y2, ox, kx, oy, ky, !step);
      const ux = step ? u.col : u.at;
      const path = new Path2D();
      const l = y1 && columns(x, y1, ox, kx, oy, ky, !step);
      const curved = curve === 'smooth' && u.n === x.length && u.n > 1 && (!l || l.n === u.n);
      if (curved) {
        path.moveTo(u.at[0]!, u.first[0]!);
        smooth(path, u.at, u.first, u.n);
        if (l) {
          path.lineTo(l.at[l.n - 1]!, l.first[l.n - 1]!);
          smooth(path, l.at, l.first, l.n, true);
        } else {
          path.lineTo(u.at[u.n - 1]!, oy);
          path.lineTo(u.at[0]!, oy);
        }
      }
      // How far up and down the area reaches, for a blend to run across.
      let [high, low] = l ? [Infinity, -Infinity] : [oy, oy];
      for (const c of l ? [u, l] : [u]) {
        for (let i = 0; i < c.n; i++) [high, low] = [Math.min(high, c.lo[i]!), Math.max(low, c.hi[i]!)];
      }
      const ink = painter(ctx, o.fill, color)([left, high, left + width, low], l ? undefined : oy);
      for (let i = 0; i < u.n && !curved; i++) {
        const px = ux[i]!;
        if (!step || i) path.lineTo(px, step ? u.last[i - 1]! : u.first[i]!);
        path.lineTo(px, u.lo[i]!);
        path.lineTo(px, u.last[i]!);
      }
      if (!curved && !l) {
        if (u.n) {
          path.lineTo(ux[u.n - 1]!, oy);
          path.lineTo(ux[0]!, oy);
        }
      } else if (!curved && l) {
        const lx = step ? l.col : l.at;
        for (let i = l.n - 1; i >= 0; i--) {
          const px = lx[i]!;
          path.lineTo(px, l.last[i]!);
          path.lineTo(px, l.hi[i]!);
          if (!step || i) path.lineTo(px, step ? l.last[i - 1]! : l.first[i]!);
        }
      }
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
