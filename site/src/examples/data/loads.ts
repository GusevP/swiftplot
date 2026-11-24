import { normal, seeded } from './seeded';

const gauss = normal(seeded(3918));

export const loads = Array.from({ length: 400 }, () => ({ ms: Math.round(Math.exp(6.2 + gauss() * 0.35)) }));
