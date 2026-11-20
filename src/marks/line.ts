import type { Col, Mark } from '../types.js';
import { base, columns } from './common.js';
import type { Common } from './common.js';

/** x must be ascending. */
export type LineOptions = Common & { x: Col; y: Col; curve: 'step'; width?: number };

export function line(o: LineOptions): Mark {
  const { x, y, color, width = 1.5, alpha = 1 } = o;
  return {
    ...base('line', o, x, [y]),
    prepare({ ctx, dpr, ox, kx, oy, ky }) {
      const c = columns(x, y, ox, kx, oy, ky);
      const path = new Path2D();
      for (let i = 0; i < c.n; i++) {
        const px = c.col[i]!;
        if (i) path.lineTo(px, c.last[i - 1]!);
        else path.moveTo(px, c.last[0]!);
        if (c.lo[i] !== c.hi[i]) {
          path.lineTo(px, c.lo[i]!);
          path.lineTo(px, c.hi[i]!);
        }
        path.lineTo(px, c.last[i]!);
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
    sampleAtX(v) {
      let a = 0;
      let b = x.length;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (x[mid]! <= v) a = mid + 1;
        else b = mid;
      }
      return a ? y[a - 1] : undefined;
    },
  };
}
