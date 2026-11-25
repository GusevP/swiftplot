import type { Col } from '../types.js';

/**
 * A hierarchy in columns, one row per node. A node with children is as large as they are together,
 * so a parent's own share needs a child of its own.
 */
export type TreeColumns = {
  /** The nodes' names. */
  nodes: string[];
  /** The place in `nodes` of each node's parent, negative for a root. */
  parent: Col;
  /** Counts only for a node without children; one negative or not a number counts as 0. */
  value: Col;
};

/** A node of a tree, with its children inside it. */
export type Nested = {
  /** The node's name. */
  name: string;
  /** The node's size; only a node without children counts. @default 0 */
  value?: number;
  /** The nodes under this one. */
  children?: Nested[];
};

/**
 * The columns of a nested tree, or of several. Nodes that share a name stay separate nodes.
 * @param tree A root, or a list of roots.
 */
export function fromTree(tree: Nested | Nested[]) {
  const [nodes, parent, value]: [string[], number[], number[]] = [[], [], []];
  // An object met again under itself would never end; the same object in two branches is fine.
  const under = new Set<Nested>();
  const todo: [Nested, number, leave?: true][] = [tree]
    .flat()
    .map((root): [Nested, number] => [root, -1])
    .reverse();
  for (let next = todo.pop(); next; next = todo.pop()) {
    const [node, above, leave] = next;
    if (leave) {
      under.delete(node);
      continue;
    }
    if (under.has(node)) throw new Error(`fromTree: ${node.name} is among its own children`);
    under.add(node);
    const at = nodes.push(node.name) - 1;
    parent.push(above);
    value.push(node.value ?? 0);
    todo.push([node, above, true]);
    for (const child of [...(node.children ?? [])].reverse()) todo.push([child, at]);
  }
  return { nodes, parent, value };
}

/** The `count` first of `list` in the order `before` gives, without sorting all of it. */
export function first(list: number[], count: number, before: (a: number, b: number) => number) {
  const best: number[] = [];
  for (const i of list) {
    if (best.length === count && before(i, best[count - 1]!) > 0) continue;
    let [at, end] = [0, best.length];
    while (at < end) {
      const mid = (at + end) >> 1;
      if (before(i, best[mid]!) < 0) end = mid;
      else at = mid + 1;
    }
    best.splice(at, 0, i);
    if (best.length > count) best.pop();
  }
  return best;
}

/**
 * What both tree marks lay out. Sizes are shares of the largest value, so that sums of them
 * cannot overflow. `tint` numbers the branches that get a colour each: the roots, or the
 * children of a single root, which itself has -1 unless it is the only node. Nothing here recurses, so a tree may be as
 * deep as it likes. A parent out of range, a node that is its own parent and a cycle throw.
 */
export function grow({ nodes, parent, value }: TreeColumns, who: string) {
  const n = nodes.length;
  const named = (i: number) => nodes[i] ?? `#${i}`;
  const kids = nodes.map((): number[] => []);
  const roots: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = parent[i]!;
    if (p < 0) roots.push(i);
    else if (!Number.isInteger(p) || p >= n)
      throw new Error(`${who}: ${named(i)} has parent ${p}, and there are ${n} nodes`);
    else if (p === i) throw new Error(`${who}: ${named(i)} is its own parent`);
    else kids[p]!.push(i);
  }
  const depth = new Int32Array(n);
  const tint = new Int32Array(n);
  const order = [...roots];
  roots.forEach((root, k) => (tint[root] = roots.length === 1 && n > 1 ? -1 : k));
  for (let done = 0; done < order.length; done++) {
    const node = order[done]!;
    kids[node]!.forEach((kid, k) => {
      depth[kid] = depth[node]! + 1;
      tint[kid] = tint[node]! < 0 ? k : tint[node]!;
      order.push(kid);
    });
  }
  if (order.length < n) {
    // A node no root leads to has a parent no root leads to; walking up must come round.
    const reached = new Set(order);
    const seen = new Set<number>();
    let node = parent.length ? Array.from({ length: n }, (_, i) => i).find(i => !reached.has(i))! : 0;
    while (!seen.has(node)) {
      seen.add(node);
      node = parent[node]!;
    }
    const circle = [node];
    for (let next = parent[node]!; next !== node; next = parent[next]!) circle.unshift(next);
    throw new Error(`${who}: the parents go round in a circle through ${circle.map(named).join(', ')}`);
  }
  const worth = (i: number) => (value[i]! > 0 && Number.isFinite(value[i]) ? value[i]! : 0);
  let most = 0;
  for (let i = 0; i < n; i++) if (!kids[i]!.length) most = Math.max(most, worth(i));
  const size = new Float64Array(n);
  for (let k = n - 1; k >= 0; k--) {
    const node = order[k]!;
    if (!kids[node]!.length) size[node] = worth(node) / (most || 1);
    if (parent[node]! >= 0) size[parent[node]!]! += size[node]!;
  }
  return { n, kids, roots, order, depth, tint, size, named };
}
