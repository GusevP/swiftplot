import type { Col, Mark } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/**
 * A line from y1 to y2 at each x with a cap at both ends, or from x1 to x2 at each y.
 * `cap` is half the cap's length and `width` the line width, both in CSS pixels.
 */
export type ErrorBarsOptions = Common & { width?: number; cap?: number } & (
    | { x: Col; y1: Col; y2: Col }
    | { y: Col; x1: Col; x2: Col }
  );

export function errorBars(o: ErrorBarsOptions): Mark {
  const { color, alpha = 1, width = 1, cap = 4 } = o;
  const upright = 'x' in o;
  // `at` is the position the bar stands on; `from` and `to` are its ends along the other axis.
  const [at, from, to] = upright ? [o.x, o.y1, o.y2] : [o.y, o.x1, o.x2];
  return {
    ...base('errorBars', o, upright ? [at] : [from, to], upright ? [from, to] : [at]),
    overhang: Math.max(cap, width / 2),
    prepare({ ctx, dpr, ox, kx, oy, ky }) {
      const c = cap * dpr;
      const path = new Path2D();
      for (let i = 0; i < at.length; i++) {
        // Canvas ignores a moveTo with a NaN in it, and the next lineTo would then join two rows.
        if (!Number.isFinite(at[i]) || !Number.isFinite(from[i]) || !Number.isFinite(to[i])) continue;
        // A stem between the two ends, and a cap across each end.
        if (upright) {
          const px = ox + at[i]! * kx;
          const [a, b] = [oy - from[i]! * ky, oy - to[i]! * ky];
          path.moveTo(px, a);
          path.lineTo(px, b);
          path.moveTo(px - c, a);
          path.lineTo(px + c, a);
          path.moveTo(px - c, b);
          path.lineTo(px + c, b);
        } else {
          const py = oy - at[i]! * ky;
          const [a, b] = [ox + from[i]! * kx, ox + to[i]! * kx];
          path.moveTo(a, py);
          path.lineTo(b, py);
          path.moveTo(a, py - c);
          path.lineTo(a, py + c);
          path.moveTo(b, py - c);
          path.lineTo(b, py + c);
        }
      }
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          ctx.lineWidth = width * dpr;
          ctx.strokeStyle = color;
          ctx.stroke(path);
        },
      };
    },
  };
}
