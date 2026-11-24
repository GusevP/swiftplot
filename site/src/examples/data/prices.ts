import { seeded } from './seeded';

const noise = seeded(2);

let last = 100;
export const prices = Array.from({ length: 30 }, (_, i) => {
  const open = last;
  const close = Math.round((open + (noise() - 0.5) * 6) * 100) / 100;
  last = close;
  return {
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    open,
    high: Math.round((Math.max(open, close) + noise() * 2.5) * 100) / 100,
    low: Math.round((Math.min(open, close) - noise() * 2.5) * 100) / 100,
    close,
  };
});
