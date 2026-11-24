import { seeded } from './seeded';

const noise = seeded(9);

export const requests = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-11-${String(i + 1).padStart(2, '0')}`,
  api: Math.round(120 + i * 3 + 30 * Math.sin(i / 3) + noise() * 14),
  web: Math.round(80 + i * 1.5 + 18 * Math.cos(i / 4) + noise() * 10),
  jobs: Math.round(40 + 12 * Math.sin(i / 2) + i),
}));
