import { seeded } from './seeded';

const noise = seeded(31);

export const orders = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-11-${String(i + 1).padStart(2, '0')}`,
  orders: Math.round(160 + 45 * Math.sin(i / 4) + ((i + 6) % 7 > 4 ? -50 : 0) + noise() * 30),
}));
