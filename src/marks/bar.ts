import type { Col, Mark } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/** One rectangle per row, from (x1, y1) to (x2, y2) in data units; either pair may be in any order. */
export type BarOptions = Common & { x1: Col; x2: Col; y1: Col; y2: Col };

export function bar(o: BarOptions): Mark {
  const { x1, x2, y1, y2, color, alpha = 1 } = o;
  const n = x1.length;
  return {
    ...base('bar', o, [x1, x2], [y1, y2]),
    prepare({ ctx, dpr, ox, kx, oy, ky, left, top, width, height }) {
      // Edges are snapped to device pixels so neighbours meet without a seam. box holds l, t, r, b per bar.
      const box = new Int32Array(n * 4);
      const path = new Path2D();
      for (let i = 0; i < n; i++) {
        const j = i * 4;
        const l = (box[j] = Math.round(ox + Math.min(x1[i]!, x2[i]!) * kx));
        const t = (box[j + 1] = Math.round(oy - Math.max(y1[i]!, y2[i]!) * ky));
        // A bar with a size keeps one pixel of it, so a narrow bin or a small value stays visible.
        const r = (box[j + 2] = Math.max(
          Math.round(ox + Math.max(x1[i]!, x2[i]!) * kx),
          l + +(x1[i] !== x2[i]),
        ));
        const b = (box[j + 3] = Math.max(
          Math.round(oy - Math.min(y1[i]!, y2[i]!) * ky),
          t + +(y1[i] !== y2[i]),
        ));
        path.rect(l, t, r - l, b - t);
      }
      return {
        paint(k) {
          ctx.globalAlpha = alpha * k;
          ctx.fillStyle = color;
          ctx.fill(path);
        },
        // ponytail: linear scan per pointer move; reports the middle of x and y2, which suits
        // vertical bars only. A bar orientation or a row index in Hit when horizontal bars need it.
        hit(px, py, max) {
          const x = px * dpr;
          const y = py * dpr;
          if (x < left || x > left + width || y < top || y > top + height) return null;
          for (let i = n - 1; i >= 0; i--) {
            const j = i * 4;
            if (x >= box[j]! && y >= box[j + 1]! && x < box[j + 2]! && y < box[j + 3]!) {
              return { x: (x1[i]! + x2[i]!) / 2, y: y2[i]!, distance: max };
            }
          }
          return null;
        },
      };
    },
  };
}
