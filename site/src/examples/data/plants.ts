import { normal, seeded } from './seeded';

const gauss = normal(seeded(77));
const kinds = [
  ['fern', 22, 9],
  ['ivy', 41, 14],
  ['palm', 63, 26],
] as const;

export const plants = kinds.flatMap(([kind, height, leaf]) =>
  Array.from({ length: 24 }, () => {
    const tall = height + gauss() * 6;
    return {
      kind,
      height: Math.round(tall * 10) / 10,
      leaf: Math.round((leaf + (tall - height) * 0.3 + gauss() * 2) * 10) / 10,
    };
  }),
);
