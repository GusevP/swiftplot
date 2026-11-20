import type { Axis, Resolved } from '../types.js';

export type BandAxis = Axis & { categories: readonly string[] };

// ponytail: at most about twenty labels whatever the axis length; they can still overlap when long.
function resolve({ categories }: BandAxis): Resolved {
  const n = categories.length;
  const ticks = [];
  for (let value = 0; value < n; value += Math.ceil(n / 20)) ticks.push({ value, label: categories[value]! });
  return { lo: -0.5, hi: Math.max(n, 1) - 0.5, ticks };
}

/** Category i sits at x = i and owns the band from i - 0.5 to i + 0.5. */
export const band = (o: { label: string; categories: readonly string[] }): BandAxis => ({
  domain: 'data',
  ...o,
  scale: resolve,
});
