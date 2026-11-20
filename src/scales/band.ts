import type { Axis, Resolved, Room } from '../types.js';

export type BandAxis = Axis & { categories: readonly string[] };

function resolve({ categories }: BandAxis, _extent: unknown, room?: Room): Resolved {
  const n = categories.length;
  // Every category is labelled when they fit; otherwise every second, third and so on.
  let every = Math.ceil(n / 20) || 1;
  if (room) {
    const each = room.horizontal ? categories.reduce((w, c) => Math.max(w, c.length), 0) * 7 + 16 : 22;
    every = Math.ceil(n / Math.max(1, Math.floor(room.length / each))) || 1;
  }
  const ticks = [];
  for (let value = 0; value < n; value += every) ticks.push({ value, label: categories[value]! });
  return { lo: -0.5, hi: Math.max(n, 1) - 0.5, ticks };
}

/** Category i sits at x = i and owns the band from i - 0.5 to i + 0.5. */
export const band = (o: { label: string; categories: readonly string[] }): BandAxis => ({
  domain: 'data',
  ...o,
  scale: resolve,
});
