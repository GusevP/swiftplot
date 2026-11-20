import type { Col, Mark } from '../types.js';
import { base, columns } from './common.js';
import type { Common, Curve } from './common.js';

/** Filled between 0 and y, or between y1 and y2. x must be ascending. */
export type AreaOptions = Common & { x: Col; curve?: Curve } & ({ y: Col } | { y1: Col; y2: Col });

export function area(o: AreaOptions): Mark {
  const { x, color, curve = 'linear', alpha = 1 } = o;
  const step = curve === 'step';
  const y2 = 'y' in o ? o.y : o.y2;
  const y1 = 'y' in o ? undefined : o.y1;
  return {
    ...base('area', o, [x], [y1 ?? (x.length ? [0] : []), y2]),
    prepare({ ctx, ox, kx, oy, ky }) {
      const u = columns(x, y2, ox, kx, oy, ky, !step);
      const ux = step ? u.col : u.at;
      const path = new Path2D();
      for (let i = 0; i < u.n; i++) {
        const px = ux[i]!;
        if (!step || i) path.lineTo(px, step ? u.last[i - 1]! : u.first[i]!);
        path.lineTo(px, u.lo[i]!);
        path.lineTo(px, u.last[i]!);
      }
      if (!y1) {
        if (u.n) {
          path.lineTo(ux[u.n - 1]!, oy);
          path.lineTo(ux[0]!, oy);
        }
      } else {
        const l = columns(x, y1, ox, kx, oy, ky, !step);
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
          ctx.fillStyle = color;
          ctx.fill(path);
        },
      };
    },
  };
}
