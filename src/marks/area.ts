import type { Col, Mark } from '../types.js';
import { base, columns } from './common.js';
import type { Common } from './common.js';

/** x must be ascending. */
export type AreaOptions = Common & { x: Col; y1: Col; y2: Col; curve: 'step' };

export function area(o: AreaOptions): Mark {
  const { x, y1, y2, color, alpha = 1 } = o;
  return {
    ...base('area', o, x, [y1, y2]),
    prepare({ ctx, ox, kx, oy, ky }) {
      const u = columns(x, y2, ox, kx, oy, ky);
      const l = columns(x, y1, ox, kx, oy, ky);
      const path = new Path2D();
      for (let i = 0; i < u.n; i++) {
        const px = u.col[i]!;
        if (i) path.lineTo(px, u.last[i - 1]!);
        path.lineTo(px, u.lo[i]!);
        path.lineTo(px, u.last[i]!);
      }
      for (let i = l.n - 1; i >= 0; i--) {
        const px = l.col[i]!;
        path.lineTo(px, l.last[i]!);
        path.lineTo(px, l.hi[i]!);
        if (i) path.lineTo(px, l.last[i - 1]!);
      }
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          ctx.fillStyle = color;
          ctx.fill(path);
        },
      };
    },
  };
}
