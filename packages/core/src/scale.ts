import { textWidth, widest as widestOf } from './text.js';
import type { Axis, Col, Room } from './types.js';

/** The 1, 2 or 5 times a power of ten that cuts the span into at most `max` steps. */
export function niceStep(span: number, max = 10) {
  const mag = 10 ** Math.floor(Math.log10(span / max));
  return mag * ([1, 2, 5].find(k => span / (mag * k) <= max) ?? 10);
}

export function extent(cols: Col[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of cols) {
    for (let i = 0; i < c.length; i++) {
      // NaN fails both comparisons; an infinite value must not become a bound either.
      const v = c[i]!;
      if (v < lo && v !== -Infinity) lo = v;
      if (v > hi && v !== Infinity) hi = v;
    }
  }
  return lo > hi ? [0, 1] : [lo, hi];
}

/** Whether this many labels, the widest so many CSS pixels wide, fit side by side (x) or stacked (y) along the axis. */
export const fits = (count: number, widest: number, room: Room) =>
  count * (room.horizontal ? widest + 16 : 22) <= Math.max(room.length, 1);

/** At most the ticks whose labels fit: when even two collide, only the first is kept. */
export const thin = <T>(ticks: T[], widest: number, room?: Room) =>
  room && ticks.length > 1 && !fits(ticks.length, widest, room) ? ticks.slice(0, 1) : ticks;

/** The ticks `keep` picks for the least k whose labels fit, every k-th by default; the first when it picks none. */
export const spaced = <T>(
  ticks: T[],
  widest: number,
  room?: Room,
  keep: (t: T, i: number, k: number) => boolean = (_, i, k) => i % k === 0,
) => {
  let k = 1;
  while (room && k < ticks.length && !fits(Math.ceil(ticks.length / k), widest, room)) k++;
  const kept = ticks.filter((t, i) => keep(t, i, k));
  return kept.length ? kept : ticks.slice(0, 1);
};

/** `of` is the extent of the data, used when the domain is 'nice' or 'data'. */
export function scale(
  domain: Axis['domain'],
  of: [number, number],
  room?: Room,
  { step: given, format = String }: Pick<Axis, 'step' | 'format'> = {},
) {
  let [lo, hi] = typeof domain === 'string' ? of : domain;
  if (lo === hi) {
    const pad = Math.abs(lo) / 2 || 0.5;
    lo -= pad;
    hi += pad;
  }
  // The bounds are rounded to this step whatever the room, so they hold still when the chart is resized.
  // A span too small to divide is its own step, and a bound rounded past the largest number stays on it.
  // A step too fine for the 1000 ticks counted below would leave ticks at the low end only.
  const fixed = Number.isFinite(given) && given! > 0 && (hi - lo) / given! < 990;
  const step = fixed ? given! : niceStep(hi - lo) || hi - lo;
  const held = (v: number) => Math.max(-Number.MAX_VALUE, Math.min(Number.MAX_VALUE, v));
  // Cleaning to 15 digits is undone where it moves a value by more than float error, so it never merges multiples.
  const clean = (v: number, tick: number) => {
    const c = +v.toPrecision(15);
    return Math.abs(c - v) <= tick * 1e-9 ? c : v;
  };
  // The nearest multiple, or the next one outward when it falls inside v: the quotient's own rounding can
  // land either side, so only the cleaned bound is tested. Where no multiple is representable, v is kept.
  const multiple = (v: number, out: 1 | -1) => {
    const n = Math.round(v / step);
    for (const k of [n, n + out]) {
      const b = clean(held(k * step), step);
      if ((b - v) * out >= 0) return b;
    }
    return v;
  };
  if (domain === 'nice') [lo, hi] = [multiple(lo, -1), multiple(hi, 1)];
  const at = (tick: number) => {
    const digits = Math.max(0, -Math.floor(Math.log10(tick)));
    const first = Math.ceil(lo / tick - 1e-9);
    const ticks: number[] = [];
    // Counted, not run until past hi: beyond 2^53 a step no longer changes the value, and a loop
    // on the value would never end. Equal neighbours are what such a step leaves behind.
    for (let k = 0; k < 1000 && (first + k) * tick <= hi + tick * 1e-9; k++) {
      // toFixed takes at most 100 decimals; a smaller tick is cleaned to 15 significant digits.
      const v =
        fixed || digits > 100 ? clean((first + k) * tick, tick) : +((first + k) * tick).toFixed(digits);
      if (v !== ticks.at(-1)) ticks.push(v);
    }
    return ticks;
  };
  const widest = () => widestOf(ticks.map(format), room?.horizontal ? textWidth : () => 0);
  let ticks = at(step);
  if (fixed)
    return {
      lo,
      hi,
      ticks: spaced(ticks, ticks.length ? widest() : 0, room, (v, _, k) => Math.round(v / step) % k === 0),
    };
  // Only the ticks thin out, to as few as it takes for their labels not to collide.
  for (let max = 9; room && max > 0 && ticks.length > 1 && !fits(ticks.length, widest(), room); max--) {
    // A coarser step can fall between the bounds and hit nothing; the last ticks found are kept.
    const coarser = at(Math.max(step, niceStep(hi - lo, max)));
    if (!coarser.length) break;
    ticks = coarser;
  }
  return { lo, hi, ticks: thin(ticks, ticks.length ? widest() : 0, room) };
}
