import { glLayer } from '../gl.js';
import { painter, stops, type Paint } from '../paint.js';
import type { Col, Mark, Prepared, View } from '../types.js';
import { base, ends } from './common.js';
import type { Common } from './common.js';
import { focused, gpuRows, type Part } from './rects.js';

/**
 * A box from q1 to q3 with a line at the median and whiskers out to min and max, one per x.
 * `width` is the box's width in x units, so 0.6 on a band axis is 60% of the category.
 * ponytail: upright only, and the whiskers go to whatever min and max are given; outliers are
 * for the caller to leave out and draw with dots().
 */
export type BoxOptions = Common & {
  x: Col;
  min: Col;
  q1: Col;
  median: Col;
  q3: Col;
  max: Col;
  width?: number;
  /** What the boxes are filled with: a colour, drawn faint, or a blend down each box, drawn as given. */
  fill?: Paint;
  /** Rounds the boxes' corners by so many CSS pixels; boxes drawn by WebGL stay square. */
  radius?: number;
  /** The width of the median line in CSS pixels; 1.5 like the other lines unless given. */
  medianWidth?: number;
  /** The opacity of the whiskers against the rest; 1 unless given. */
  whiskers?: number;
};

export function box(o: BoxOptions): Mark {
  const { x, min, q1, median, q3, max, color, alpha = 1, width = 0.6 } = o;
  const n = x.length;
  const [corner, heavy, faint] = [o.radius ?? 0, o.medianWidth ?? 1.5, o.whiskers ?? 1];
  const blended = typeof o.fill === 'object' ? o.fill : undefined;
  // The axis must make room for the boxes, not only for their centres.
  const [first, last] = ends(x);
  const rows = gpuRows(new WeakMap(), [x], [min, q1, median, q3, max]);
  // Each box's left, top, right and bottom in device pixels; a row with a number missing has none.
  const bounds = ({ ox, kx, oy, ky }: View) => {
    const edges = new Float64Array(n * 4).fill(NaN);
    for (let i = 0; i < n; i++) {
      if (![x, min, q1, median, q3, max].every(c => Number.isFinite(c[i]))) continue;
      const mid = ox + x[i]! * kx;
      const l = Math.round(mid - (width * kx) / 2);
      const r = Math.max(Math.round(mid + (width * kx) / 2), l + 1);
      edges.set([l, Math.round(oy - q3[i]! * ky), r, Math.round(oy - q1[i]! * ky)], i * 4);
    }
    return edges;
  };
  // The box itself answers, with its median; reported as the weakest hit like any filled shape.
  const hit =
    ({ dpr, left, top, width: plotWidth, height }: View, bounded: () => Float64Array): Prepared['hit'] =>
    (px, py, reach) => {
      const [hx, hy] = [px * dpr, py * dpr];
      if (hx < left || hx > left + plotWidth || hy < top || hy > top + height) return null;
      const edges = bounded();
      for (let i = n - 1; i >= 0; i--) {
        const j = i * 4;
        if (hx >= edges[j]! && hy >= edges[j + 1]! && hx < edges[j + 2]! && hy < edges[j + 3]!) {
          return { x: x[i]!, y: median[i]!, distance: reach, row: i };
        }
      }
      return null;
    };
  return {
    ...base('box', o, [x, [first - width / 2, last + width / 2]], [min, max]),
    overhang: 0.75,
    prepare(view) {
      const { ctx, dpr, ox, kx, oy, ky } = view;
      const edges = bounds(view);
      const y = (v: number) => Math.round(oy - v * ky);
      const shape = (path: CanvasPath, i: number) => {
        const [l, t, w, h] = [
          edges[i * 4]!,
          edges[i * 4 + 1]!,
          edges[i * 4 + 2]! - edges[i * 4]!,
          edges[i * 4 + 3]! - edges[i * 4 + 1]!,
        ];
        const r = Math.min(corner * dpr, w / 2, h / 2);
        if (r >= 1) path.roundRect(l, t, w, h, r);
        else path.rect(l, t, w, h);
      };
      // The bodies, their outlines, the whiskers with their ends, and the medians.
      const paths = (rows: (i: number) => boolean) => {
        const [body, frame, whisk, mid] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
          const [l, t, r, b] = [edges[i * 4]!, edges[i * 4 + 1]!, edges[i * 4 + 2]!, edges[i * 4 + 3]!];
          // A row with a number missing draws nothing: see errorBars for what a NaN does to a path.
          if (!rows(i) || Number.isNaN(l)) continue;
          const centre = ox + x[i]! * kx;
          shape(body, i);
          shape(frame, i);
          for (const [from, to] of [
            [t, y(max[i]!)],
            [b, y(min[i]!)],
          ]) {
            whisk.moveTo(centre, from!);
            whisk.lineTo(centre, to!);
            whisk.moveTo(centre - (r - l) / 4, to!);
            whisk.lineTo(centre + (r - l) / 4, to!);
          }
          mid.moveTo(l, y(median[i]!));
          mid.lineTo(r, y(median[i]!));
        }
        return { body, frame, whisk, mid, rows };
      };
      const all = paths(() => true);
      // The one focused row and the rest, kept for as long as the focus stays on that row.
      let split: { row: number; one: typeof all; others: typeof all } | undefined;
      const ink = painter(ctx, o.fill, color);
      const draw = ({ body, frame, whisk, mid, rows }: typeof all, k: number) => {
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * k * (blended ? 1 : 0.25);
        // A blend runs over each box's own height, so each is filled on its own.
        for (let i = 0; blended && i < n; i++) {
          if (!rows(i) || Number.isNaN(edges[i * 4]!)) continue;
          ctx.fillStyle = ink([...edges.subarray(i * 4, i * 4 + 4)]);
          ctx.beginPath();
          shape(ctx, i);
          ctx.fill();
        }
        if (!blended) {
          ctx.fillStyle = ink([]);
          ctx.fill(body);
        }
        ctx.lineWidth = 1.5 * dpr;
        ctx.globalAlpha = alpha * k * faint;
        ctx.stroke(whisk);
        ctx.globalAlpha = alpha * k;
        ctx.stroke(frame);
        ctx.lineWidth = heavy * dpr;
        ctx.stroke(mid);
      };
      return {
        paint(a, row, rest = 1) {
          if (row === undefined || row >= n) return draw(all, a);
          if (split?.row !== row) split = { row, one: paths(i => i === row), others: paths(i => i !== row) };
          draw(split.others, a * rest);
          draw(split.one, a);
        },
        hit: hit(view, () => edges),
      };
    },
    gl: {
      layer: glLayer,
      under: true,
      prepare(view, { gl }) {
        const upright = blended?.toward === 'down' || blended?.toward === 'up';
        const blend = blended && { stops: stops(view.ctx, blended, color), upright, based: false };
        const { draw, once } = rows.on(view, gl, color, 0.75);
        const filled = rows.on(view, gl, typeof o.fill === 'string' ? o.fill : color, 0.75, blend).draw;
        // Columns: x, then min, q1, median, q3 and max. Half the box's width, and half a line's.
        const [w, h] = [Math.max((width * view.kx) / 2, 0.5), 0.75 * view.dpr];
        const at = (ya: number, yb: number, pad: [number, number], more?: Partial<Part>): Part => ({
          xa: 0,
          xb: 0,
          ya,
          yb,
          pad,
          snap: true,
          ...more,
        });
        const body = at(2, 4, [w, 0], { alpha: blended ? 1 : 0.25 });
        // The median, the four sides, and the two whiskers with their ends: the first to reach a pixel keeps it.
        const lines = [
          at(3, 3, [w, (heavy * view.dpr) / 2]),
          at(4, 4, [w + h, h]),
          at(2, 2, [w + h, h]),
          at(2, 4, [h, h], { shift: [-w, 0] }),
          at(2, 4, [h, h], { shift: [w, 0] }),
          at(4, 5, [h, 0], { alpha: faint }),
          at(1, 2, [h, 0], { alpha: faint }),
          at(5, 5, [w / 2, h], { alpha: faint }),
          at(1, 1, [w / 2, h], { alpha: faint }),
        ];
        let edges: Float64Array | undefined;
        return {
          // The bodies as one filled shape and then the lines as one stroke, as on the canvas.
          paint(a, row, rest = 1) {
            for (const [parts, pen] of [
              [[body], filled],
              [lines, draw],
            ] as const) {
              once(() => {
                for (const [strength, ...run] of focused(n, row, rest)) {
                  for (const part of parts) pen(part, alpha * a * strength, ...run);
                }
              });
            }
          },
          hit: hit(view, () => (edges ??= bounds(view))),
        };
      },
    },
    release(layer) {
      if (layer) rows.release(layer.gl);
    },
  };
}
