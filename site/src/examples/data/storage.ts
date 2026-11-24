import { seeded } from './seeded';

const noise = seeded(21);
const week = (i: number) => new Date(Date.UTC(2026, 5, 1 + i * 7)).toISOString().slice(0, 10);

export const storage = Array.from({ length: 26 }, (_, i) => ({
  week: week(i),
  images: Math.round(40 + i * 2.5 + 6 * Math.sin(i / 3) + noise() * 4),
  video: Math.round(25 + i * 1.2 + 8 * Math.cos(i / 4) + noise() * 5),
  backups: Math.round(30 + 10 * Math.sin(i / 5) + noise() * 3),
}));
