import { seeded } from './seeded';

const noise = seeded(17);
const names = [
  'api',
  'auth',
  'billing',
  'search',
  'uploads',
  'notifications',
  'reports',
  'payments',
  'sessions',
  'images',
  'exports',
  'webhooks',
];

export const services = Array.from({ length: 14 }, (_, i) =>
  names.map((service, k) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    service,
    requests: Math.round(40 + k * 14 + 10 * Math.sin((i + k) / 2) + noise() * 6),
  })),
).flat();
