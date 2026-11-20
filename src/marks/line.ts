import type { Col, Mark } from '../types.js';
import { base, columns, sampleAt } from './common.js';
import type { Common, Curve } from './common.js';

/** x must be ascending. */
export type LineOptions = Common & { x: Col; y: Col; curve?: Curve; width?: number };

export function line(o: LineOptions): Mark {
  const { x, y, color, curve = 'linear', width = 1.5, alpha = 1 } = o;
  const step = curve === 'step';
  return {
    ...base('line', o, [x], [y]),
    prepare({ ctx, dpr, ox, kx, oy, ky }) {
      const c = columns(x, y, ox, kx, oy, ky, !step);
      const path = new Path2D();
      for (let i = 0; i < c.n; i++) {
        const px = step ? c.col[i]! : c.at[i]!;
        if (!i) path.moveTo(px, step ? c.last[0]! : c.first[0]!);
        else path.lineTo(px, step ? c.last[i - 1]! : c.first[i]!);
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
    sampleAtX: v => sampleAt(x, y, v, step),
  };
}
