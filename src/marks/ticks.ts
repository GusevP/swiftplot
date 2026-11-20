import type { Col, Mark } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/** A vertical tick of `size` CSS pixels above and below each point. */
export type TicksOptions = Common & { x: Col; y: Col; size: number };

export function ticks(o: TicksOptions): Mark {
  const { x, y, color, size, alpha = 1 } = o;
  return {
    ...base('ticks', o, [x], [y]),
    prepare({ ctx, dpr, ox, kx, oy, ky }) {
      const h = size * dpr;
      const path = new Path2D();
      for (let i = 0; i < x.length; i++) {
        const px = ox + x[i]! * kx;
        const py = oy - y[i]! * ky;
        path.moveTo(px, py - h);
        path.lineTo(px, py + h);
      }
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          ctx.lineWidth = dpr;
          ctx.strokeStyle = color;
          ctx.stroke(path);
        },
      };
    },
  };
}
