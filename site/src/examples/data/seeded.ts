export const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
export const normal = (random: () => number) => () =>
  Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random());
