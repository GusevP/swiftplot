import { seeded } from './seeded';

const noise = seeded(52);

let users = 40;
export const growth = Array.from({ length: 52 }, (_, week) => {
  if (week) users *= 1 + 0.3 * (1 - week / 60) + (noise() - 0.5) * 0.06;
  return { week, users: Math.round(users) };
});
