import { niceStep, thin } from '../scale.js';
import type { Axis, Resolved, Room } from '../types.js';

export type TimeAxis = Axis & { utc: boolean };
export type TimeOptions = {
  label: string;
  /** Millisecond timestamps; the extent of the data when omitted. */
  domain?: [number, number];
  /** Tick boundaries and labels in UTC (the default) or in the browser's zone. */
  utc?: boolean;
};

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const S = 1e3;
const MIN = 6e4;
const H = 36e5;
const D = 864e5;
const Y = 365 * D;
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
const make = ([y, mo, d, h, mi, s]: number[], utc: boolean) => {
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

// ponytail: English month names and a 24-hour clock; a format option when someone needs a locale.
function label([y, mo, d, h, mi, s]: number[], field: number) {
  const day = `${MONTHS[mo!]} ${d}`;
  if (field === 0) return String(y);
  if (field === 1) return mo ? MONTHS[mo]! : String(y);
  if (field === 2) return day;
  if (field === 5) return `${pad(h!)}:${pad(mi!)}:${pad(s!)}`;
  return h || mi ? `${pad(h!)}:${pad(mi!)}` : day;
}

function resolve(axis: TimeAxis, extent: () => [number, number], room?: Room): Resolved {
  const { lo, hi, ticks } = stepped(axis, typeof axis.domain === 'string' ? extent() : axis.domain, room);
  const widest = ticks.reduce((w, t) => Math.max(w, t.label.length), 0);
  return { lo, hi, ticks: thin(ticks, widest, room) };
}

function stepped(axis: TimeAxis, [lo, hi]: [number, number], room?: Room): Resolved {
  if (lo === hi) [lo, hi] = [lo - S, hi + S];
  const span = hi - lo;
  // A time label is about seven characters, so one fits every 64 px along x.
  const max = room ? Math.max(1, Math.min(10, Math.floor(room.length / (room.horizontal ? 64 : 22)))) : 10;
  const [field, count] = STEPS.find(s => span / s[2] <= max) ?? [0, Math.max(1, niceStep(span / Y, max))];

  const { utc } = axis;
  const ticks = [];
  const floor = (p: number[]) => {
    for (let i = field + 1; i < 6; i++) p[i] = i === 2 ? 1 : 0;
    const from = field === 2 ? 1 : 0;
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
      if (t >= lo && aligned(here)) ticks.push({ value: t, label: label(here, field) });
      const p = read(t + step, utc);
      let next = aligned(p) ? t + step : make(floor(p), utc);
      if (next <= t) {
        p[field]! += count;
        next = make(p, utc);
      }
      t = next;
    }
    return { lo, hi, ticks };
  }

  // Each step goes through Date, which is what keeps months and leap years right.
  let p = floor(read(lo, utc));
  for (let t = make(p, utc), n = 0; t <= hi && n < 1000; n++) {
    if (t >= lo) ticks.push({ value: t, label: label(p, field) });
    const month = p[1];
    p[field]! += count;
    p = read(make(p, utc), utc);
    // Where a zone skips midnight the boundary lands at 01:00; the next one must not inherit that hour.
    p[3] = p[4] = p[5] = 0;
    // Day steps restart with each month, so they stay on the same days of the month.
    if (field === 2 && count > 1 && p[1] !== month) p[2] = 1;
    t = make(p, utc);
  }
  return { lo, hi, ticks };
}

export const time = ({ label, domain, utc = true }: TimeOptions): TimeAxis => ({
  domain: domain ?? 'data',
  label,
  utc,
  scale: resolve,
});
