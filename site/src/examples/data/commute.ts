import { normal, seeded } from './seeded';

const gauss = normal(seeded(5));

const typical = { Mon: 34, Tue: 31, Wed: 30, Thu: 32, Fri: 27 };

export const commute = Object.entries(typical).flatMap(([day, minutes], d) =>
  Array.from({ length: 40 }, () => ({ day, minutes: Math.round(Math.max(18, minutes + gauss() * (4 + d))) })),
);
