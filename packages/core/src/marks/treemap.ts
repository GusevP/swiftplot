import type { Label, Mark } from '../types.js';
import { gradient, painter } from '../paint.js';
import { first, grow, type TreeColumns } from './tree.js';

/**
 * Rectangles as large as their values, packed as near to square as they go, for a blank frame.
 * Only nodes without children are drawn, inside the room of their parents; see TreeColumns for
 * the input and fromTree() for nested objects. A parent with more children than it has pixels is
 * drawn as one rectangle, and is then the row a hit reports. Each root has a colour, or each child of a single
 * root, and everything below it shares that colour. A hit's row is the node's place in `nodes`.
 * ponytail: a pointer move looks through the siblings at each level, which is fine for
 * thousands; the rows the packing made would index them when a level holds many more.
 * ponytail: at most the 200 largest rectangles ask for a label, since the chart compares every
 * label with every other; an index of kept labels when more are wanted.
 */
export type TreemapOptions = TreeColumns & {
  colors: string[];
  /** Text in each rectangle that has room: the node's name by default, your own, or none. */
  text?: false | ((row: number) => string);
  /** Each branch starts at this opacity at the top of its room and reaches its full colour at the bottom. */
  shade?: number;
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

export function treemap(o: TreemapOptions): Mark {
  const { colors, alpha = 1 } = o;
  const { n, kids, roots, order, tint, size, named } = grow(o, 'treemap');
  const shade = (i: number) => colors[tint[i]! % colors.length] ?? '#888';
  const sorted = (list: number[]) =>
    list.filter(i => size[i]! > 0).sort((a, b) => size[b]! - size[a]! || a - b);
  const leaves = order.filter(i => !kids[i]!.length && size[i]! > 0);
  const largest = first(leaves, 200, (a, b) => size[b]! - size[a]! || a - b);
  return {
    type: 'treemap',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: colors[0] ?? '#888',
    options: o,
    points: n,
    channels: { x: [], y: [] },
    prepare({ ctx, dpr, left, top, width, height }) {
      // Each node's room as x, y, width and height; a node of no size has none.
      const room = new Float64Array(n * 4);
      // Rows of rectangles along the shorter side of what is left, each row closed when one
      // more rectangle would make its worst rectangle less square.
      const pack = (list: number[], x: number, y: number, w: number, h: number) => {
        const total = list.reduce((sum, i) => sum + size[i]!, 0);
        if (!(w > 0 && h > 0 && total > 0)) return;
        const scale = (w * h) / total;
        for (let start = 0; start < list.length;) {
          const short = Math.min(w, h);
          let [end, sum, least, most, worst] = [start, 0, Infinity, 0, Infinity];
          for (; end < list.length; end++) {
            const area = size[list[end]!]! * scale;
            const [all, lo, hi] = [sum + area, Math.min(least, area), Math.max(most, area)];
            const badly = Math.max((short * short * hi) / (all * all), (all * all) / (short * short * lo));
            if (end > start && badly > worst) break;
            [sum, least, most, worst] = [all, lo, hi, badly];
          }
          const thick = short > 0 ? sum / short : 0;
          let along = 0;
          for (let k = start; k < end; k++) {
            const long = thick ? (size[list[k]!]! * scale) / thick : 0;
            room.set(w >= h ? [x, y + along, thick, long] : [x + along, y, long, thick], list[k]! * 4);
            along += long;
          }
          if (w >= h) [x, w] = [x + thick, Math.max(0, w - thick)];
          else [y, h] = [y + thick, Math.max(0, h - thick)];
          start = end;
        }
      };
      pack(sorted(roots), left, top, width, height);
      // A parent keeps a pixel round its children, which is what sets branches apart; an only
      // child has no branch beside it and takes all the room, however long the chain.
      // A parent whose children would average under a device pixel each is drawn, and hit, as
      // one rectangle itself: more rectangles than pixels cost time and show nothing.
      const solid = new Uint8Array(n);
      const shown: number[] = [];
      for (const node of order) {
        const [x, y, w, h] = room.subarray(node * 4, node * 4 + 4);
        if (!(w! > 0 && h! > 0)) continue;
        if (!kids[node]!.length || (w! * h! < kids[node]!.length && tint[node]! >= 0)) {
          solid[node] = 1;
          shown.push(node);
          continue;
        }
        const some = sorted(kids[node]!);
        const [px, py] = some.length > 1 ? [Math.min(dpr, w! / 4), Math.min(dpr, h! / 4)] : [0, 0];
        pack(some, x! + px, y! + py, w! - 2 * px, h! - 2 * py);
      }
      // What is painted and hit of a leaf: its room less half a pixel all round, or less where
      // that would leave nothing.
      const box = (i: number) => {
        const [x, y, w, h] = room.subarray(i * 4, i * 4 + 4);
        const [gx, gy] = [Math.min(dpr / 2, w! / 4), Math.min(dpr / 2, h! / 4)];
        return [x! + gx, y! + gy, w! - 2 * gx, h! - 2 * gy] as const;
      };
      // One shape per colour, since no two rectangles overlap: a fill each would cost far more.
      // With a shade each branch has its own paint, lighter at the top of the branch's room.
      const sheets = new Map<string | number, { path: Path2D; ink: string | CanvasGradient }>();
      const sheetOf = (i: number) => (o.shade === undefined ? shade(i) : tint[i]!);
      for (const i of shown) {
        if (!sheets.has(sheetOf(i))) {
          const branch =
            tint[i]! < 0 ? roots[0]! : roots.length === 1 ? kids[roots[0]!]![tint[i]!]! : roots[tint[i]!]!;
          const [x, y, w, h] = room.subarray(branch * 4, branch * 4 + 4);
          const ink = painter(
            ctx,
            o.shade === undefined ? undefined : gradient(o.shade, 1),
            shade(i),
          )([x!, y!, x! + w!, y! + h!]);
          sheets.set(sheetOf(i), { path: new Path2D(), ink });
        }
        sheets.get(sheetOf(i))!.path.rect(...box(i));
      }
      const labels: Label[] = [];
      for (const i of o.text === false ? [] : largest) {
        const text = o.text ? o.text(i) : named(i);
        const [x, y, w, h] = box(i);
        if (!text || (text.length * 7 + 8) * dpr > w || 20 * dpr > h) continue;
        labels.push({
          x: x + 4 * dpr,
          y: y + 10 * dpr,
          text,
          align: 'start',
          color: '#fff',
          priority: size[i],
        });
      }
      return {
        labels,
        paint(k, row, rest = 1) {
          ctx.save();
          if (row !== undefined && solid[row]) {
            ctx.globalAlpha = alpha * k;
            ctx.fillStyle = sheets.get(sheetOf(row))?.ink ?? shade(row);
            ctx.fillRect(...box(row));
            // The rest is drawn through a hole where that rectangle is, so it is not painted twice.
            const around = new Path2D();
            around.rect(...box(row));
            around.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.clip(around, 'evenodd');
          }
          ctx.globalAlpha = alpha * k * (row === undefined ? 1 : rest);
          for (const { path, ink } of sheets.values()) {
            ctx.fillStyle = ink;
            ctx.fill(path);
          }
          ctx.restore();
        },
        // Down from the roots through the rooms the pointer is in, to a leaf's painted box.
        hit(px, py, max) {
          const [hx, hy] = [px * dpr, py * dpr];
          const holds = (i: number) => {
            const k = i * 4;
            return (
              hx >= room[k]! &&
              hx < room[k]! + room[k + 2]! &&
              hy >= room[k + 1]! &&
              hy < room[k + 1]! + room[k + 3]!
            );
          };
          let node = roots.find(holds);
          while (node !== undefined && !solid[node]) node = kids[node]!.find(holds);
          if (node === undefined) return null;
          const [x, y, w, h] = box(node);
          if (hx < x || hx >= x + w || hy < y || hy >= y + h) return null;
          return {
            x: (x + w / 2 - left) / width,
            y: 1 - (y + h / 2 - top) / height,
            distance: max,
            row: node,
            color: shade(node),
          };
        },
      };
    },
  };
}
