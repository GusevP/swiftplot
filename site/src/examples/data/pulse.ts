const turn = (s: number, times: number) => (2 * Math.PI * times * s) / 60;

export const pulse = Array.from({ length: 60 }, (_, s) => ({
  s,
  v:
    Math.round(
      (50 + 18 * Math.sin(turn(s, 1)) + 7 * Math.sin(turn(s, 3) + 1) + 4 * Math.sin(turn(s, 7) + 2)) * 10,
    ) / 10,
}));
