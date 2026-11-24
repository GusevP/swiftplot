import { seeded } from './seeded';

const noise = seeded(5);

export const sales = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, i) => ({
  quarter,
  north: Math.round(30 + i * 6 + noise() * 12),
  south: Math.round(22 + i * 3 + noise() * 10),
  west: Math.round(15 + i * 8 + noise() * 8),
}));
