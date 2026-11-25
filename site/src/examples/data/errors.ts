import { seeded } from './seeded';

const noise = seeded(5);

export const errors = Array.from({ length: 28 }, (_, i) => ({
  date: `2026-11-${String(i + 1).padStart(2, '0')}`,
  failed: Math.round((0.18 + 0.12 * Math.sin(i / 4) + noise() * 0.05 + (i === 19 ? 0.3 : 0)) * 1000) / 1000,
}));
