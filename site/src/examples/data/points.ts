import { normal, seeded } from './seeded';

const gauss = normal(seeded(3));
const round = (v: number) => Math.round(v * 1000) / 1000;

export const points = Array.from({ length: 40_000 }, () => {
  const x = gauss();
  return { x: round(x), y: round(gauss() * 0.6 + x * 0.45) };
});
