import { seeded } from './seeded';

const noise = seeded(44);

export const forecast = Array.from({ length: 30 }, (_, i) => {
  const mean = Math.round((12 + 6 * Math.sin(i / 5) + noise() * 1.5) * 10) / 10;
  const spread = Math.round((1.5 + i * 0.12) * 10) / 10;
  return {
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    low: Math.round((mean - spread) * 10) / 10,
    mean,
    high: Math.round((mean + spread) * 10) / 10,
  };
});
