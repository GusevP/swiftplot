import { normal, seeded } from './seeded';

const gauss = normal(seeded(17));

export const couriers = ['Courier A', 'Courier B', 'Courier C', 'Courier D'];

export const deliveries = couriers.flatMap((courier, at) =>
  Array.from({ length: 50 }, () => ({
    courier,
    at,
    minutes: Math.round(Math.max(8, 28 + at * 5 + gauss() * (5 + at * 2))),
  })),
);
