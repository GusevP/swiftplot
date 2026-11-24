import { glLayer } from '../gl.js';
import type { Col, Mark, Prepared, View } from '../types.js';
import { base, ends } from './common.js';
import type { Common } from './common.js';
import { focused, gpuRows, type Part } from './rects.js';

/** A candle per x: a wick from low to high and a body from open to close. */
export type CandlestickOptions = Common & {
  /** Where each candle stands along x. */
  x: Col;
  /** One end of the body. */
  open: Col;
  /** The top of the wick. */
  high: Col;
  /** The bottom of the wick. */
  low: Col;
  /** The other end of the body; below `open`, the candle takes the `down` colour. */
  close: Col;
  /** The body's width in x units, so 0.6 on a band axis is 60% of the category. @default 0.6 */
  width?: number;
  /** The colour of a candle whose close is not below its open; `color` unless given. */
  up?: string;
  /** The colour of a candle whose close is below its open; `color` unless given. */
  down?: string;
};

// Per candle: the body's left and right, the wick's top and bottom, the body's top and bottom.
const EDGES = 6;

export function candlestick(o: CandlestickOptions): Mark {
  const { x, open, high, low, close, color, alpha = 1, width = 0.6 } = o;
  const n = x.length;
  const inks = [o.up ?? color, o.down ?? color];
  const falls = (i: number) => close[i]! < open[i]!;
  const [first, last] = ends(x);
  let sides: ReturnType<typeof gpuRows>[] | undefined;
  // In device pixels; a row with a number missing has none.
  const bounds = ({ ox, kx, oy, ky }: View) => {
    const edges = new Float64Array(n * EDGES).fill(NaN);
    const y = (v: number) => Math.round(oy - v * ky);
    for (let i = 0; i < n; i++) {
      if (![x, open, high, low, close].every(c => Number.isFinite(c[i]))) continue;
      const mid = ox + x[i]! * kx;
      const l = Math.round(mid - (width * kx) / 2);
      const top = y(Math.max(open[i]!, close[i]!));
      edges.set(
        [
          l,
          Math.max(Math.round(mid + (width * kx) / 2), l + 1),
          y(high[i]!),
          y(low[i]!),
          top,
          Math.max(y(Math.min(open[i]!, close[i]!)), top + 1),
        ],
        i * EDGES,
      );
    }
    return edges;
  };
  // The whole candle answers, wick included, and from 3 CSS pixels beside it: a candle is often a pixel or two wide.
  const hit =
    ({ dpr, left, top, width: plotWidth, height }: View, bounded: () => Float64Array): Prepared['hit'] =>
    (px, py, reach) => {
      const [hx, hy] = [px * dpr, py * dpr];
      if (hx < left || hx > left + plotWidth || hy < top || hy > top + height) return null;
      const edges = bounded();
      let [row, gap] = [-1, 3 * dpr];
      for (let i = n - 1; i >= 0; i--) {
        const j = i * EDGES;
        if (!(hy >= edges[j + 2]! && hy < Math.max(edges[j + 3]!, edges[j + 2]! + 1))) continue;
        const beside = Math.max(edges[j]! - hx, hx - edges[j + 1]!, 0);
        if (beside < gap || (beside === gap && row < 0)) [row, gap] = [i, beside];
      }
      return row < 0 ? null : { x: x[row]!, y: close[row]!, distance: reach, row, color: inks[+falls(row)]! };
    };
  return {
    ...base('candlestick', o, [x, [first - width / 2, last + width / 2]], [low, high]),
    prepare(view) {
      const { ctx, dpr } = view;
      const edges = bounds(view);
      const wick = Math.max(1, Math.round(dpr));
      // The rising candles and the falling ones, each one filled shape.
      const paths = (rows: (i: number) => boolean) => {
        const made = [new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
          const j = i * EDGES;
          const [l, r] = [edges[j]!, edges[j + 1]!];
          if (!rows(i) || Number.isNaN(l)) continue;
          const path = made[+falls(i)]!;
          path.rect(
            Math.round((l + r - wick) / 2),
            edges[j + 2]!,
            wick,
            Math.max(edges[j + 3]! - edges[j + 2]!, 1),
          );
          path.rect(l, edges[j + 4]!, r - l, edges[j + 5]! - edges[j + 4]!);
        }
        return made;
      };
      const all = paths(() => true);
      let split: { row: number; one: Path2D[]; others: Path2D[] } | undefined;
      const draw = (made: Path2D[], k: number) => {
        ctx.globalAlpha = alpha * k;
        made.forEach((path, at) => {
          ctx.fillStyle = inks[at]!;
          ctx.fill(path);
        });
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
        // The painter takes one colour, so each direction is its own rows, with the other's left out as gaps.
        sides ??= [false, true].map(fall => {
          const opened = new Float64Array(n);
          for (let i = 0; i < n; i++) opened[i] = falls(i) === fall ? open[i]! : NaN;
          return gpuRows(new WeakMap(), [x], [high, low, close, opened]);
        });
        const pens = sides.map((rows, at) => rows.on(view, gl, inks[at]!));
        const wick = Math.max(1, Math.round(view.dpr));
        // Columns: x, then high, low, close and open, which is last so that its gaps do not set the rows' offset.
        // ponytail: a candle whose open equals its close shows only its wick here; give the body a pixel if it matters.
        const parts: Part[] = [
          { xa: 0, xb: 0, ya: 4, yb: 3, pad: [Math.max((width * view.kx) / 2, 0.5), 0], snap: true },
          { xa: 0, xb: 0, ya: 1, yb: 2, pad: [wick / 2, 0], shift: [(wick % 2) / 2, 0], snap: true },
        ];
        let edges: Float64Array | undefined;
        return {
          paint(a, row, rest = 1) {
            for (const { draw, once } of pens) {
              once(() => {
                for (const [strength, ...run] of focused(n, row, rest)) {
                  for (const part of parts) draw(part, alpha * a * strength, ...run);
                }
              });
            }
          },
          hit: hit(view, () => (edges ??= bounds(view))),
        };
      },
    },
    release(layer) {
      if (layer) for (const rows of sides ?? []) rows.release(layer.gl);
    },
  };
}
