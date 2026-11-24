import { seeded } from './seeded';

const noise = seeded(13);
const regions = [
  ['eu', 80],
  ['us', 95],
  ['asia', 130],
] as const;

export const latency = Array.from({ length: 30 }, (_, i) =>
  regions.map(([region, base], k) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    region,
    ms: Math.round(base + 15 * Math.sin(i / (3 + k)) + noise() * 12),
  })),
).flat();
