import type { Label, Mark } from '../types.js';
import { inRing, TURN, turnAt } from './common.js';
import { grow, type TreeColumns } from './tree.js';

/**
 * A tree as rings round a centre, for a polar frame: the roots innermost, each node's children
 * in the next ring out, sharing its part of the turn by their sizes. A single root is a disc in
 * the middle. See TreeColumns for the input and fromTree() for nested objects. Each root has a
 * colour, or each child of a single root, and what is below it is the same colour, lighter ring
 * by ring. A hit's row is the node's place in `nodes`; pointing at a node also picks out, more
 * faintly, the nodes it sits under.
 * ponytail: at most the 200 largest nodes ask for a label, as in treemap().
 */
export type SunburstOptions = TreeColumns & {
  colors: string[];
  /** Text on each node that has room: its name by default, your own, or none. */
  text?: false | ((row: number) => string);
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

export function sunburst(o: SunburstOptions): Mark {
  const { colors, parent, alpha = 1 } = o;
  const { n, kids, roots, order, depth, tint, size, named } = grow(o, 'sunburst');
  const shade = (i: number) => (tint[i]! < 0 ? '#999' : (colors[tint[i]! % colors.length] ?? '#888'));
  // Where each node starts and ends, as shares of the turn: parents before their children.
  const [from, to] = [new Float64Array(n), new Float64Array(n)];
  const share = (list: number[], start: number, span: number) => {
    const total = list.reduce((sum, i) => sum + size[i]!, 0);
    // The last one with any size ends exactly where its parent does, whatever the sums round
    // to, and none ends beyond it; one of no size has no part of the turn.
    const last = list.findLast(i => size[i]! > 0);
    let at = start;
    for (const i of list) {
      from[i] = at;
      to[i] = at =
        i === last ? start + span : Math.min(start + span, at + (total ? (size[i]! / total) * span : 0));
    }
  };
  share(roots, 0, 1);
  for (const node of order) share(kids[node]!, from[node]!, to[node]! - from[node]!);
  const drawn = order.filter(i => to[i]! > from[i]!);
  // Rings are counted over what is drawn: a branch of no size takes no room, however deep.
  const rings = drawn.reduce((most, i) => Math.max(most, depth[i]! + 1), 0);
  const largest = [...drawn]
    .sort((a, b) => size[b]! / 2 ** depth[b]! - size[a]! / 2 ** depth[a]! || a - b)
    .slice(0, 200);
  let above: { row?: number; rows: Set<number> } = { rows: new Set() };
  const over = (row: number) => {
    if (above.row !== row) {
      const rows = new Set<number>();
      for (let p = parent[row]!; p >= 0; p = parent[p]!) rows.add(p);
      above = { row, rows };
    }
    return above.rows;
  };
  return {
    type: 'sunburst',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: colors[0] ?? '#888',
    options: o,
    points: n,
    channels: { x: [], y: [] },
    prepare({ ctx, dpr, left, top, width, height }) {
      const [cx, cy] = [left + width / 2, top + height / 2];
      const outer = Math.max(0, Math.min(width, height) / 2);
      const thick = outer / (rings || 1);
      // A ring starts a pixel out from the one inside it; the innermost starts at the centre.
      const reach = (i: number) => {
        const d = depth[i]!;
        return [d * thick + (d ? Math.min(dpr, thick / 4) : 0), (d + 1) * thick] as const;
      };
      const whole = (i: number) => to[i]! - from[i]! >= 1;
      const shapes = new Map(
        drawn.map(i => {
          const [near, far] = reach(i);
          const gap = whole(i) || !outer ? 0 : Math.min(0.5 / far, ((to[i]! - from[i]!) * TURN) / 4);
          const [a, b] = [from[i]! * TURN - TURN / 4 + gap, to[i]! * TURN - TURN / 4 - gap];
          const path = new Path2D();
          path.arc(cx, cy, far, a, b);
          path.arc(cx, cy, near, b, a, true);
          path.closePath();
          return [i, path] as const;
        }),
      );
      // Half-way round the node and half-way out; a disc is named at its centre.
      const anchor = (i: number) => {
        const [near, far] = reach(i);
        if (whole(i) && !near) return [cx, cy] as const;
        const middle = ((from[i]! + to[i]!) / 2) * TURN - TURN / 4;
        return [
          cx + (Math.cos(middle) * (near + far)) / 2,
          cy + (Math.sin(middle) * (near + far)) / 2,
        ] as const;
      };
      const labels: Label[] = [];
      for (const i of o.text === false || !outer ? [] : largest) {
        const text = o.text ? o.text(i) : named(i);
        const [x, y] = anchor(i);
        if (!text || !inRing([cx, cy, ...reach(i), from[i]!, to[i]!], x, y, text.length * 7 * dpr, 16 * dpr))
          continue;
        labels.push({ x, y, text, color: '#fff', priority: size[i]! / 2 ** depth[i]! });
      }
      return {
        labels,
        paint(k, row, rest = 1) {
          for (const [i, path] of shapes) {
            const lit = row === undefined || row === i ? 1 : over(row).has(i) ? (1 + rest) / 2 : rest;
            ctx.globalAlpha = alpha * k * lit * (0.4 + 0.6 * (1 - depth[i]! / rings));
            ctx.fillStyle = shade(i);
            ctx.fill(path);
          }
        },
        // The ring from the distance, then down from the roots by the share of the turn, and
        // last the painted shape itself, which leaves out the gaps between neighbours.
        hit(px, py, max) {
          const [hx, hy] = [px * dpr, py * dpr];
          const ring = Math.floor(Math.hypot(hx - cx, hy - cy) / (thick || 1));
          if (!thick || ring >= rings) return null;
          const at = turnAt(hx - cx, hy - cy);
          // Siblings start in ascending order, so the one holding the pointer is the last to
          // start at or before it.
          const holding = (list: number[]) => {
            let [lo, hi] = [0, list.length];
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (from[list[mid]!]! <= at) lo = mid + 1;
              else hi = mid;
            }
            return lo ? list[lo - 1] : undefined;
          };
          let node = holding(roots);
          while (node !== undefined && depth[node]! < ring) node = holding(kids[node]!);
          const shape = node === undefined ? undefined : shapes.get(node);
          if (node === undefined || !shape || !ctx.isPointInPath(shape, hx, hy)) return null;
          const [x, y] = anchor(node);
          return { x: (x - left) / width, y: 1 - (y - top) / height, distance: max, row: node };
        },
      };
    },
  };
}
