import { seeded } from './seeded';

const random = seeded(21);

export const cafes = Array.from({ length: 24 }, (_, i) => {
  const seats = Math.round(12 + random() * 68);
  const staff = Math.max(2, Math.round(seats / 8 + random() * 4 - 2));
  return {
    cafe: `Café ${i + 1}`,
    seats,
    cups: Math.round(seats * (4 + random() * 5)),
    staff,
    r: Math.round(Math.sqrt(staff) * 50) / 10,
  };
});
