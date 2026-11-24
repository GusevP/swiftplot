import { seeded } from './seeded';

const noise = seeded(41);

export const cpu = Array.from({ length: 48 }, (_, i) => {
  const hour = i / 2;
  const day = Math.max(0, Math.sin(((hour - 7) / 13) * Math.PI));
  const spike = 14 * Math.exp(-((hour - 14.5) ** 2) / 0.6);
  return { hour, cpu: Math.round(16 + 58 * day + spike + (noise() - 0.5) * 8) };
});
