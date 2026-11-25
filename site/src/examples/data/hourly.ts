import { seeded } from './seeded';

const noise = seeded(21);

const days = ['Sun', 'Sat', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon'];
const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));

export const hourly = days.flatMap(day =>
  hours.map((hour, h) => ({
    day,
    hour,
    requests: Math.round(
      (day === 'Sat' || day === 'Sun' ? 0.45 : 1) *
        (20 + 180 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 16))) +
        noise() * 15,
    ),
  })),
);
