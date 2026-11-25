import { seeded } from './seeded';

const noise = seeded(21);
const lost = new Set([7, 15, 16, 17, 26, 33]);

export const sensor = Array.from({ length: 40 }, (_, i) => ({
  minute: i,
  celsius: lost.has(i) ? null : Math.round((21 + 3 * Math.sin(i / 5) + noise() * 0.8) * 10) / 10,
}));
