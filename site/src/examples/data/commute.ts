import { normal, seeded } from './seeded';

const gauss = normal(seeded(5));

export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const commute = [34, 31, 30, 32, 27].map((typical, d) =>
  Array.from({ length: 40 }, () => Math.round(Math.max(18, typical + gauss() * (4 + d)))),
);
