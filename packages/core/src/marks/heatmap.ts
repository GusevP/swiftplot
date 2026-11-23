import { extent } from '../scale.js';
import { sequential } from '../scales/color.js';
import type { ColorScale } from '../scales/color.js';
import type { Col, Mark } from '../types.js';
import type { Common } from './common.js';

/**
 * A grid of cells coloured by value. `values` runs along x first: the cell in column c of row r
 * is values[r * columns + c], and row 0 is at the bottom. By default cell (c, r) is centred on
 * x = c and y = r, which is where a band axis puts its categories; `x` and `y` give the grid's
 * edges instead, from the first cell's to the last one's, in either order. A cell whose value is
 * not finite is left empty. Where several cells share a pixel, the pixel shows and answers for
 * the largest of them, so a peak is never lost.
 */
export type HeatmapOptions = Omit<Common, 'color'> & {
  values: Col;
  columns: number;
  x?: [number, number];
  y?: [number, number];
  color?: ColorScale;
};

export function heatmap(o: HeatmapOptions): Mark {
  const { values, alpha = 1, color = sequential() } = o;
  const columns = Number.isFinite(o.columns) ? Math.max(1, Math.floor(o.columns)) : 1;
  const rows = Math.ceil(values.length / columns);
  const [x0, x1] = o.x ?? [-0.5, columns - 0.5];
  const [y0, y1] = o.y ?? [-0.5, rows - 0.5];
  // Found when first asked for, by the legend or the first paint, whichever comes first.
  let found: [number, number] | undefined;
  const domain = () => (found ??= color.domain ?? extent([values]));

  return {
    type: 'heatmap',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: color.stops.at(-1)!,
    options: o,
    points: values.length,
    channels: { x: [[x0], [x1]], y: [[y0], [y1]] },
    ramp() {
      const [lo, hi] = domain();
      return { table: color.table, lo, hi };
    },
    prepare({ ctx, dpr, ox, kx, oy, ky, left, top, width, height }) {
      // Column c starts at ax + c * bx in device pixels, row r at ay + r * by.
      const [ax, bx] = [ox + x0 * kx, ((x1 - x0) / columns) * kx];
      const [ay, by] = [oy - y0 * ky, (-(y1 - y0) / (rows || 1)) * ky];
      // Only the cells that reach into the plot are drawn, however large the grid is.
      const seen = (a: number, b: number, n: number, from: number, size: number) => {
        const [p, q] = b ? [(from - a) / b, (from + size - a) / b] : [0, -1];
        return [
          Math.max(0, Math.floor(Math.min(p, q))),
          Math.min(n - 1, Math.ceil(Math.max(p, q)) - 1),
        ] as const;
      };
      const [c0, c1] = seen(ax, bx, columns, left, width);
      const [r0, r1] = seen(ay, by, rows, top, height);
      const some = c1 >= c0 && r1 >= r0;
      // Where those cells lie, and the picture that is drawn over it. Along an axis where cells are
      // at least a pixel, that is a pixel per cell, stretched. Where they are smaller it is exactly
      // the device pixels they cover, drawn one for one: a stretch there could skip a pixel's peak.
      const along = (a: number, b: number, lo: number, hi: number) => {
        const [start, size, cells] = [
          Math.min(a + lo * b, a + (hi + 1) * b),
          Math.abs((hi + 1 - lo) * b),
          hi - lo + 1,
        ];
        if (size >= cells) return [start, size, Math.max(1, cells)] as const;
        const first = Math.floor(start);
        const pixels = Math.max(1, Math.ceil(start + size) - first);
        return [first, pixels, pixels] as const;
      };
      const [dl, dw, w] = along(ax, bx, c0, c1);
      const [dt, dh, h] = along(ay, by, r0, r1);
      const pixel = (at: number, start: number, size: number, n: number) =>
        Math.max(0, Math.min(n - 1, Math.floor(((at - start) / size) * n)));
      // For each pixel of the picture, the cell it shows: the one with the largest value there.
      const shows = new Int32Array(some ? w * h : 0).fill(-1);
      for (let r = r0; some && r <= r1; r++) {
        const ty = pixel(ay + (r + 0.5) * by, dt, dh, h) * w;
        for (let c = c0, i = r * columns + c0; c <= c1 && i < values.length; c++, i++) {
          const v = values[i]!;
          if (!Number.isFinite(v)) continue;
          const t = ty + pixel(ax + (c + 0.5) * bx, dl, dw, w);
          if (shows[t]! < 0 || v > values[shows[t]!]!) shows[t] = i;
        }
      }
      let picture: OffscreenCanvas | undefined;
      if (some) {
        const [lo, hi] = domain();
        picture = new OffscreenCanvas(w, h);
        const c = picture.getContext('2d')!;
        const image = c.createImageData(w, h);
        const pixels = new Uint32Array(image.data.buffer);
        // Halved before subtracting only where the plain difference overflows: for a tiny domain
        // the halves would both round to zero.
        const [span, half] = [hi - lo, hi / 2 - lo / 2];
        shows.forEach((i, p) => {
          if (i < 0) return;
          const v = values[i]!;
          const t = !span ? 0 : Number.isFinite(span) ? (v - lo) / span : (v / 2 - lo / 2) / half;
          pixels[p] = color.table[Math.round(Math.max(0, Math.min(1, t)) * 255)]!;
        });
        c.putImageData(image, 0, 0);
      }
      const draw = (k: number) => {
        ctx.globalAlpha = alpha * k;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(picture!, dl, dt, dw, dh);
      };
      return {
        paint(k, row, rest = 1) {
          if (!picture) return;
          const c = (row ?? -1) % columns;
          const r = Math.floor((row ?? -1) / columns);
          if (row === undefined || c < c0 || c > c1 || r < r0 || r > r1) return draw(k);
          // The pixel of the picture that holds the focused cell, at full strength; the rest dimmed.
          const one = new Path2D();
          one.rect(
            dl + (pixel(ax + (c + 0.5) * bx, dl, dw, w) * dw) / w,
            dt + (pixel(ay + (r + 0.5) * by, dt, dh, h) * dh) / h,
            dw / w,
            dh / h,
          );
          const around = new Path2D(one);
          around.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
          for (const [clip, strength] of [
            [one, k],
            [around, k * rest],
          ] as const) {
            ctx.save();
            ctx.clip(clip, 'evenodd');
            draw(strength);
            ctx.restore();
          }
        },
        // The pixel of the picture under the pointer answers with the cell it shows. A filled
        // shape, so the weakest hit.
        hit(px, py, reach) {
          const [hx, hy] = [px * dpr, py * dpr];
          if (hx < left || hx > left + width || hy < top || hy > top + height) return null;
          if (!picture || hx < dl || hx > dl + dw || hy < dt || hy > dt + dh) return null;
          const row = shows[pixel(hy, dt, dh, h) * w + pixel(hx, dl, dw, w)]!;
          if (row < 0) return null;
          return {
            x: x0 + (((row % columns) + 0.5) / columns) * (x1 - x0),
            y: y0 + ((Math.floor(row / columns) + 0.5) / rows) * (y1 - y0),
            distance: reach,
            row,
          };
        },
      };
    },
  };
}
