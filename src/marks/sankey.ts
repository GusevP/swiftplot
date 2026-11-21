import type { Col, Label, Mark } from '../types.js';

/**
 * Nodes in columns with a ribbon for each link, as wide as the link's value, for a blank frame.
 * `source` and `target` hold the places of nodes in `nodes`; see fromLinks() for links given by
 * name. A node is as tall as the larger of what flows in and what flows out. A link whose value
 * is negative or not a number counts as 0. Rows are the nodes first, then the links, so a hit on
 * link i has the row nodes.length + i. Pointing at a node or a link also picks out all that flows
 * into it and out of it, through links that carry something. A link to an unknown node, a link from a node to itself,
 * and a cycle throw.
 * ponytail: a node sits one column after its furthest source, and each column is ordered by one
 * sweep forwards and one back; more sweeps or a relaxation when crossings matter. A pointer move
 * tests every link, which is fine for hundreds; an index when a diagram has many thousands.
 */
export type SankeyOptions = {
  nodes: string[];
  source: Col;
  target: Col;
  value: Col;
  colors: string[];
  /** Node names beside the nodes; true by default. */
  text?: boolean;
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

/** The columns sankey() takes, from links that name their ends. Nodes are listed as first met. */
export function fromLinks(links: { source: string; target: string; value: number }[]) {
  const place = new Map<string, number>();
  const at = (name: string) => {
    if (!place.has(name)) place.set(name, place.size);
    return place.get(name)!;
  };
  const [source, target, value]: number[][] = [[], [], []];
  for (const link of links) {
    source!.push(at(link.source));
    target!.push(at(link.target));
    value!.push(link.value);
  }
  return { nodes: [...place.keys()], source: source!, target: target!, value: value! };
}

export function sankey(o: SankeyOptions): Mark {
  const { nodes, source, target, colors, alpha = 1 } = o;
  const [n, links] = [nodes.length, source.length];
  const named = (i: number) => nodes[i] ?? `#${i}`;
  for (let i = 0; i < links; i++) {
    for (const end of [source[i]!, target[i]!]) {
      if (!Number.isInteger(end) || end < 0 || end >= n)
        throw new Error(`sankey: link ${i} names node ${end}, and there are ${n}`);
    }
    if (source[i] === target[i]) throw new Error(`sankey: ${named(source[i]!)} links to itself`);
  }
  // Values are taken as shares of the largest, so that sums of them cannot overflow.
  let most = 0;
  const worth = (i: number) => (o.value[i]! > 0 && Number.isFinite(o.value[i]) ? o.value[i]! : 0);
  for (let i = 0; i < links; i++) most = Math.max(most, worth(i));
  const value = Float64Array.from({ length: links }, (_, i) => worth(i) / (most || 1));

  // Each node's links, listed once, so that nothing below looks through all links per node.
  const [into, outOf] = [nodes.map((): number[] => []), nodes.map((): number[] => [])];
  for (let i = 0; i < links; i++) {
    outOf[source[i]!]!.push(i);
    into[target[i]!]!.push(i);
  }
  // A column for each node: one after its furthest source. What is left when no node is free of
  // unplaced sources is fed by a cycle.
  const column = new Int32Array(n);
  const waiting = Int32Array.from(into, list => list.length);
  const ready = Array.from({ length: n }, (_, i) => i).filter(i => !waiting[i]);
  for (let done = 0; done < ready.length; done++) {
    const from = ready[done]!;
    for (const i of outOf[from]!) {
      const to = target[i]!;
      column[to] = Math.max(column[to]!, column[from]! + 1);
      if (!--waiting[to]!) ready.push(to);
    }
  }
  if (ready.length < n) {
    // Every unplaced node has an unplaced source; walking back along those must come round.
    const back = (node: number) => source[into[node]!.find(i => waiting[source[i]!])!]!;
    const seen = new Set<number>();
    let node = waiting.findIndex(w => w > 0);
    while (!seen.has(node)) {
      seen.add(node);
      node = back(node);
    }
    const circle = [node];
    for (let next = back(node); next !== node; next = back(next)) circle.unshift(next);
    throw new Error(`sankey: the links go round in a circle through ${circle.map(named).join(', ')}`);
  }
  const size = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const total = (list: number[]) => list.reduce((sum, link) => sum + value[link]!, 0);
    size[i] = Math.max(total(into[i]!), total(outOf[i]!));
  }
  const columns: number[][] = [];
  for (let i = 0; i < n; i++) (columns[column[i]!] ??= []).push(i);
  // Order within a column: by where a node's neighbours on one side sit, weighted by the flow.
  const place = new Float64Array(n);
  const settle = (c: number[]) => c.forEach((node, k) => (place[node] = k));
  const order = (c: number[], near: number[][], far: Col) => {
    const pull = (node: number) => {
      let [sum, weight] = [0, 0];
      for (const i of near[node]!) {
        sum += place[far[i]!]! * value[i]!;
        weight += value[i]!;
      }
      return weight ? sum / weight : place[node]!;
    };
    const pulls = new Map(c.map(node => [node, pull(node)]));
    c.sort((a, b) => pulls.get(a)! - pulls.get(b)! || a - b);
    settle(c);
  };
  columns.forEach(settle);
  for (const c of columns) order(c, into, source);
  for (const c of [...columns].reverse()) order(c, outOf, target);
  const shade = (i: number) => colors[i % colors.length] ?? '#888';
  // What lights up with a row: all that flows into it and all that flows out of it, however
  // many nodes away. For a link that is what feeds its source and what its target feeds.
  let lit: { row?: number; rows: Set<number> } = { rows: new Set() };
  const along = (row: number) => {
    if (lit.row === row) return lit.rows;
    const rows = new Set([row]);
    const walk = (from: number, near: number[][], far: Col) => {
      const todo = [from];
      rows.add(from);
      for (let node = todo.pop(); node !== undefined; node = todo.pop()) {
        for (const i of near[node]!) {
          if (!value[i]) continue;
          rows.add(n + i);
          if (!rows.has(far[i]!)) todo.push(far[i]!);
          rows.add(far[i]!);
        }
      }
    };
    walk(row < n ? row : source[row - n]!, into, source);
    walk(row < n ? row : target[row - n]!, outOf, target);
    lit = { row, rows };
    return rows;
  };

  return {
    type: 'sankey',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: shade(0),
    options: o,
    points: n + links,
    channels: { x: [], y: [] },
    prepare({ ctx, dpr, left, top, width, height }) {
      // Nodes and the gaps between them give way before they crowd out the flows: a node is at
      // most half its column's share of the width, and the gaps in the fullest column a third
      // of the height.
      const fullest = columns.reduce((most, c) => Math.max(most, c.length), 1);
      const thick = Math.min(12 * dpr, width / (2 * Math.max(columns.length, 1)));
      const gap = Math.min(10 * dpr, height / 3 / Math.max(fullest - 1, 1));
      // One scale for every column: the tightest column decides it.
      let scale = Infinity;
      for (const c of columns) {
        const total = c.reduce((sum, node) => sum + size[node]!, 0);
        if (total) scale = Math.min(scale, Math.max(0, height - gap * (c.length - 1)) / total);
      }
      if (!Number.isFinite(scale)) scale = 0;
      const step = columns.length > 1 ? (width - thick) / (columns.length - 1) : 0;
      const [x, y] = [new Float64Array(n), new Float64Array(n)];
      for (const [k, c] of columns.entries()) {
        const used = c.reduce((sum, node) => sum + size[node]! * scale, 0) + gap * (c.length - 1);
        let at = top + (height - used) / 2;
        for (const node of c) {
          [x[node], y[node]] = [left + k * step, at];
          at += size[node]! * scale + gap;
        }
      }
      // A node's links leave and arrive stacked in the order of the nodes at their other end.
      const [leaves, arrives] = [new Float64Array(n), new Float64Array(n)];
      const byEnds = Array.from({ length: links }, (_, i) => i).sort(
        (a, b) => y[source[a]!]! - y[source[b]!]! || y[target[a]!]! - y[target[b]!]! || a - b,
      );
      const ribbons: (Path2D | undefined)[] = [];
      const middle = new Float64Array(links * 2);
      for (const i of byEnds) {
        const [s, t, h] = [source[i]!, target[i]!, value[i]! * scale];
        const [x0, x1] = [x[s]! + thick, x[t]!];
        const [y0, y1] = [y[s]! + leaves[s]!, y[t]! + arrives[t]!];
        leaves[s]! += h;
        arrives[t]! += h;
        middle.set([(x0 + x1) / 2, (y0 + y1 + h) / 2], i * 2);
        if (!h) continue;
        const bend = (x0 + x1) / 2;
        const path = new Path2D();
        path.moveTo(x0, y0);
        path.bezierCurveTo(bend, y0, bend, y1, x1, y1);
        path.lineTo(x1, y1 + h);
        path.bezierCurveTo(bend, y1 + h, bend, y0 + h, x0, y0 + h);
        path.closePath();
        ribbons[i] = path;
      }
      const labels: Label[] = [];
      for (let i = 0; o.text !== false && i < n; i++) {
        const last = column[i] === columns.length - 1 && columns.length > 1;
        labels.push({
          x: last ? x[i]! - 6 * dpr : x[i]! + thick + 6 * dpr,
          y: y[i]! + (size[i]! * scale) / 2,
          text: named(i),
          align: last ? 'end' : 'start',
          priority: size[i],
        });
      }
      // A node with any flow keeps a pixel of height, and is drawn and hit as the same rectangle.
      const tall = (i: number) => (size[i] ? Math.max(size[i]! * scale, 1) : 0);
      const strength = (k: number, row: number | undefined, rest: number, mine: number) =>
        alpha * k * (row === undefined || along(row).has(mine) ? 1 : rest);
      const frac = (px: number, py: number) => ({ x: (px - left) / width, y: 1 - (py - top) / height });
      return {
        labels,
        paint(k, row, rest = 1) {
          ribbons.forEach((path, i) => {
            ctx.globalAlpha = strength(k, row, rest, n + i) * 0.45;
            ctx.fillStyle = shade(source[i]!);
            ctx.fill(path!);
          });
          for (let i = 0; i < n; i++) {
            ctx.globalAlpha = strength(k, row, rest, i);
            ctx.fillStyle = shade(i);
            ctx.fillRect(x[i]!, y[i]!, thick, tall(i));
          }
        },
        // A node before a link; a link the pointer is in before one it is only near. A thin link
        // answers from 3 px either side, since its true width may be less than a pixel.
        hit(px, py, reach) {
          const [hx, hy] = [px * dpr, py * dpr];
          if (hx < left || hx > left + width || hy < top || hy > top + height) return null;
          for (let i = n - 1; i >= 0; i--) {
            if (hx >= x[i]! && hx < x[i]! + thick && hy >= y[i]! && hy < y[i]! + tall(i)) {
              return {
                ...frac(x[i]! + thick / 2, y[i]! + (size[i]! * scale) / 2),
                distance: reach,
                row: i,
                color: shade(i),
              };
            }
          }
          ctx.lineWidth = 6 * dpr;
          for (const near of [false, true]) {
            for (let i = links - 1; i >= 0; i--) {
              const path = ribbons[i];
              if (!path || !(near ? ctx.isPointInStroke(path, hx, hy) : ctx.isPointInPath(path, hx, hy)))
                continue;
              return {
                ...frac(middle[i * 2]!, middle[i * 2 + 1]!),
                distance: reach,
                row: n + i,
                color: shade(source[i]!),
              };
            }
          }
          return null;
        },
      };
    },
  };
}
