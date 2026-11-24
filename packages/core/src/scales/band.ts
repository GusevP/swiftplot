import type { Axis, Resolved, Room } from '../types.js';

export type BandAxis = Axis & {
  /** The categories in order; category i sits at i. */
  categories: readonly string[];
};

function resolve({ categories, domain }: BandAxis, _extent: unknown, room?: Room): Resolved {
  const n = categories.length;
  const [first, last] =
    typeof domain === 'string'
      ? [0, n - 1]
      : [Math.max(0, Math.ceil(domain[0])), Math.min(n - 1, Math.floor(domain[1]))];
  const shown = categories.slice(first, last + 1);
  // Every category is labelled when they fit; otherwise every second, third and so on.
  let every = Math.ceil(shown.length / 20) || 1;
  if (room) {
    const each = room.horizontal ? shown.reduce((w, c) => Math.max(w, c.length), 0) * 7 + 16 : 22;
    every = Math.ceil(shown.length / Math.max(1, Math.floor(room.length / each))) || 1;
  }
  const ticks = [];
  for (let value = Math.ceil(first / every) * every; value <= last; value += every)
    ticks.push({ value, label: categories[value]! });
  return { lo: -0.5, hi: Math.max(n, 1) - 0.5, ticks };
}

/** Category i sits at x = i and owns the band from i - 0.5 to i + 0.5. */
export const band = (o: {
  /** The axis title; an empty string shows none. */
  label: string;
  /** The categories in order, each labelled where there is room. */
  categories: readonly string[];
}): BandAxis => ({
  domain: 'data',
  ...o,
  scale: resolve,
});
