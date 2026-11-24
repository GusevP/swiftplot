import { niceStep, spaced, thin } from '../scale.js';
import type { Axis, Resolved, Room } from '../types.js';

const UNITS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;
export type TimeAxis = Axis & {
  /** Whether tick boundaries and labels are in UTC rather than the browser's zone. */
  utc: boolean;
  /** Ticks every this many units. */
  every?: number;
  /** The unit whose boundaries the ticks fall on. */
  unit?: (typeof UNITS)[number];
};
export type TimeOptions = {
  /** The axis title; an empty string shows none. */
  label: string;
  /** Millisecond timestamps; the extent of the data when omitted. */
  domain?: [number, number];
  /** Tick boundaries and labels in UTC (the default) or in the browser's zone. */
  utc?: boolean;
  /** The text of each tick, from its timestamp; English month names and a 24-hour clock when left out. */
  format?: Axis['format'];
  /** Which marks the extent is taken from, as on any axis. @default 'shown' */
  fit?: Axis['fit'];
} & (
  | {
      /**
       * Ticks on the boundaries of this unit. Left out, the step is chosen for the span shown. A unit
       * that would give 990 ticks or more across what is shown gives way to that chosen step.
       */
      unit: (typeof UNITS)[number];
      /** Ticks every this many units, counted from the start of the next larger unit; 1 when left out. */
      every?: number;
    }
  | { unit?: undefined; every?: undefined }
);

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const S = 1e3;
const MIN = 6e4;
const H = 36e5;
const D = 864e5;
const Y = 365 * D;
const UNIT_MS = [Y, 30 * D, D, H, MIN, S];
// [field, count, approximate ms], field indexing [year, month, day, hour, minute, second].
// ponytail: nothing finer than a second.
const STEPS = [
  [5, 1, S],
  [5, 5, 5 * S],
  [5, 15, 15 * S],
  [5, 30, 30 * S],
  [4, 1, MIN],
  [4, 5, 5 * MIN],
  [4, 15, 15 * MIN],
  [4, 30, 30 * MIN],
  [3, 1, H],
  [3, 3, 3 * H],
  [3, 6, 6 * H],
  [3, 12, 12 * H],
  [2, 1, D],
  [2, 2, 2 * D],
  [2, 7, 7 * D],
  [1, 1, 30 * D],
  [1, 3, 91 * D],
  [1, 6, 182 * D],
] as const;

const read = (t: number, utc: boolean) => {
  const d = new Date(t);
  return utc
    ? [
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
      ]
    : [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
};
// Date.UTC and new Date(y, ...) read the years 0 to 99 as 1900 to 1999; the setters do not.
export const make = ([y, mo, d, h, mi, s]: number[], utc: boolean) => {
  const t = new Date(0);
  if (utc) {
    t.setUTCFullYear(y!, mo, d);
    t.setUTCHours(h!, mi, s, 0);
  } else {
    t.setFullYear(y!, mo, d);
    t.setHours(h!, mi, s, 0);
  }
  return t.getTime();
};
const pad = (n: number) => String(n).padStart(2, '0');

// English month names and a 24-hour clock unless the axis has a format.
function label([y, mo, d, h, mi, s]: number[], field: number) {
  const day = `${MONTHS[mo!]} ${d}`;
  if (field === 0) return String(y);
  if (field === 1) return mo ? MONTHS[mo]! : String(y);
  if (field === 2) return day;
  if (field === 5) return `${pad(h!)}:${pad(mi!)}:${pad(s!)}`;
  return h || mi ? `${pad(h!)}:${pad(mi!)}` : day;
}

function resolve(axis: TimeAxis, extent: () => [number, number], room?: Room): Resolved {
  const { lo, hi, ticks, fixed, keep } = stepped(
    axis,
    typeof axis.domain === 'string' ? extent() : axis.domain,
    room,
  );
  const widest = ticks.reduce((w, t) => Math.max(w, t.label.length), 0);
  return {
    lo,
    hi,
    ticks: fixed ? spaced(ticks, widest, room, (t, _, k) => keep(t.value, k)) : thin(ticks, widest, room),
  };
}

function stepped(
  axis: TimeAxis,
  [lo, hi]: [number, number],
  room?: Room,
): Resolved & { fixed: boolean; keep: (t: number, k: number) => boolean } {
  if (lo === hi) [lo, hi] = [lo - S, hi + S];
  const span = hi - lo;
  // A time label is about seven characters, so one fits every 64 px along x.
  const max = room ? Math.max(1, Math.min(10, Math.floor(room.length / (room.horizontal ? 64 : 22)))) : 10;
  const unit = UNITS.indexOf(axis.unit!);
  const n = Math.floor(axis.every ?? 1);
  const every = Number.isSafeInteger(n) && n >= 1 ? n : 1;
  // A unit too fine for the 1000 ticks counted below would leave ticks at the low end only.
  const fixed = unit >= 0 && span / (every * UNIT_MS[unit]!) < 990;
  const [field, count] = fixed
    ? [unit, every]
    : (STEPS.find(s => span / s[2] <= max) ?? [0, Math.max(1, niceStep(span / Y, max))]);
  const text = (p: number[], t: number) => axis.format?.(t) ?? label(p, field);

  const { utc } = axis;
  const ticks = [];
  const from = field === 2 ? 1 : 0;
  // Thinned to every k-th step: within each period of the next larger unit, the multiples of k at least k
  // steps before the next period. When k steps outlast the shortest period, only the first of every m-th
  // period counted from 1970, m periods being at least k steps. Either way the pick depends on the tick alone.
  const shortest = [Infinity, 12, 28, 24, 60, 60][field]!;
  const keep = (t: number, k: number) => {
    if (k === 1) return true;
    const p = read(t, utc);
    const index = (p[field]! - from) / count;
    if (k * count > shortest) {
      const day = make([p[0]!, p[1]!, p[2]!, 0, 0, 0], true) / D;
      const period = [0, p[0]!, p[0]! * 12 + p[1]!, day, day * 24 + p[3]!, (day * 24 + p[3]!) * 60 + p[4]!][
        field
      ]!;
      return index === 0 && period % Math.ceil((k * count) / shortest) === 0;
    }
    const end = [Infinity, 12, read(make([p[0]!, p[1]! + 1, 0, 0, 0, 0], utc), utc)[2]! + 1, 24, 60, 60][
      field
    ]!;
    return index % k === 0 && end - p[field]! >= k * count;
  };
  const floor = (p: number[]) => {
    for (let i = field + 1; i < 6; i++) p[i] = i === 2 ? 1 : 0;
    p[field] = from + Math.floor((p[field]! - from) / count) * count;
    return p;
  };
  if (field > 2) {
    // Fixed steps from a boundary of the local clock, so the hour a clock change repeats keeps both
    // of its occurrences; a step that lands off a boundary has crossed a change and is realigned.
    const step = count * [H, MIN, S][field - 3]!;
    let t = make(floor(read(lo, utc)), utc);
    if (lo - t >= step) t += Math.floor((lo - t) / step) * step;
    const aligned = (p: number[]) => p[field]! % count === 0 && p.every((v, i) => i <= field || !v);
    for (let n = 0; t <= hi && n < 1000; n++) {
      // A boundary the clock skips comes back from make() moved off it, and is not a tick.
      const here = read(t, utc);
      if (t >= lo && aligned(here)) ticks.push({ value: t, label: text(here, t) });
      const p = read(t + step, utc);
      let next = aligned(p) ? t + step : make(floor(p), utc);
      if (next <= t) {
        p[field]! += count;
        next = make(p, utc);
      }
      t = next;
    }
    return { lo, hi, ticks, fixed, keep };
  }

  // Each step goes through Date, which is what keeps months and leap years right.
  let p = floor(read(lo, utc));
  if (field === 2 && count === 7 && !fixed) {
    const d = new Date(make(p, utc));
    p[2]! -= ((utc ? d.getUTCDay() : d.getDay()) + 6) % 7;
    p = read(make(p, utc), utc);
  }
  for (let t = make(p, utc), n = 0; t <= hi && n < 1000; n++) {
    // Steps of days restart with each month and of months with each year, so they stay on the same
    // days and months; a day closer than a step to the next month's first is dropped.
    const monthly = field === 2 && (fixed || count !== 7);
    const [year, month] = p;
    const ahead = [...p];
    ahead[field]! += count;
    const next = make(ahead, utc);
    const first = monthly ? make([year!, month! + 1, 1, 0, 0, 0], utc) : Infinity;
    if (t >= lo && !(p[2] !== 1 && next > first)) ticks.push({ value: t, label: text(p, t) });
    p = read(Math.min(next, first), utc);
    // Where a zone skips midnight the boundary lands at 01:00; the next one must not inherit that hour.
    p[3] = p[4] = p[5] = 0;
    if (field === 1 && p[0] !== year) p[1] = 0;
    t = make(p, utc);
  }
  return { lo, hi, ticks, fixed, keep };
}

/** An axis of millisecond timestamps, ticked on calendar boundaries and labelled as dates and times. */
export const time = ({ label, domain, utc = true, every, unit, format, fit }: TimeOptions): TimeAxis => ({
  domain: domain ?? 'data',
  label,
  utc,
  every,
  unit,
  format,
  fit,
  scale: resolve,
});
