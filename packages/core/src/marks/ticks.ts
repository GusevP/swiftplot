import type { Col, Mark } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/** A vertical tick at each point. */
export type TicksOptions = Common & {
  /** The x of each tick. */
  x: Col;
  /** The y each tick is centred on. */
  y: Col;
  /** How far each tick reaches above and below its point, in CSS pixels. */
  size: number;
};

export function ticks(o: TicksOptions): Mark {
  const { x, y, color, size, alpha = 1 } = o;
  return {
    ...base('ticks', o, [x], [y]),
    oneShape: true,
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
