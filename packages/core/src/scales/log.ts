import { fits, scale as linear, spaced } from '../scale.js';
import type { Axis, Col, Resolved, Room, Span, Tick } from '../types.js';

export type LogAxis = Axis & {
  base: number;
  to(real: number, axis: Axis): number;
  from(v: number, axis: Axis): number;
  /** The values in the axis's space, to give a mark; one at or below zero becomes NaN, a gap. */
  col(values: readonly number[]): number[];
  col(values: ArrayBufferView & Col): Float64Array;
  col(values: Col): number[] | Float64Array;
};
export type LogOptions = {
  label: string;
  base?: number;
  /** Real values, both above zero; 'nice' widens the extent of the data to whole powers of the base. */
  domain?: Span | 'nice' | 'data';
  format?: Axis['format'];
  fit?: Axis['fit'];
};

// log10 and log2 are exact at their own powers; another base's division can land a hair off one.
const lg = (v: number, base: number) => {
  if (base === 10) return Math.log10(v);
  if (base === 2) return Math.log2(v);
  const r = Math.log(v) / Math.log(base);
  return base ** Math.round(r) === v ? Math.round(r) : r;
};
const baseOf = (axis: Axis) => (axis as LogAxis).base;
const to = (v: number, axis: Axis) => (v > 0 ? lg(v, baseOf(axis)) : NaN);
const from = (v: number, axis: Axis) => baseOf(axis) ** v;
function col(this: LogAxis, values: Col): number[] | Float64Array {
  return Array.isArray(values) ? values.map(v => to(v, this)) : Float64Array.from(values, v => to(v, this));
}

function resolve(axis: Axis, extent: () => Span, room?: Room): Resolved {
  const base = baseOf(axis);
  const format = axis.format ?? String;
  let [lo, hi] = typeof axis.domain === 'string' ? extent() : axis.domain;
  if (lo === hi) [lo, hi] = [lo - 0.5, hi + 0.5];
  const up = lo <= hi;
  if (axis.domain === 'nice')
    [lo, hi] = up ? [Math.floor(lo), Math.ceil(hi)] : [Math.ceil(lo), Math.floor(hi)];
  // A base below 1, or a reversed domain, runs downward in log space; the ticks are found over it upward.
  const [a, b] = up ? [lo, hi] : [hi, lo];
  const tick = (k: number, times = 1): Tick => {
    const v = +(times * base ** k).toPrecision(15);
    return { value: times === 1 ? k : lg(v, base), label: format(v) };
  };
  const powers: Tick[] = [];
  const all: Tick[] = [];
  const stride = Math.max(1, Math.ceil((b - a) / 3000));
  const first = Math.floor(a + 1e-9);
  const count = Math.min(3002, Math.floor((b + 1e-9 - first) / stride) + 1);
  for (let i = 0, last = NaN; i < count; i++) {
    const k = first + i * stride;
    if (k === last) continue;
    last = k;
    for (const times of base === 10 && stride === 1 ? [1, 2, 5] : [1]) {
      const t = tick(k, times);
      if (t.value < a - 1e-9 || t.value > b + 1e-9) continue;
      all.push(t);
      if (times === 1) powers.push(t);
    }
  }
  const widest = (ts: Tick[]) => ts.reduce((w, t) => Math.max(w, t.label.length), 0);
  const ordered = (ticks: Tick[]) => ({
    lo,
    hi,
    ticks: ticks.sort((p, q) => (up ? p.value - q.value : q.value - p.value)),
  });
  if (room && all.length > powers.length && all.length > 1 && fits(all.length, widest(all), room))
    return ordered(all);
  if (powers.length > 1) return ordered(spaced(powers, widest(powers), room));
  // A window inside one power of the base offers its power, its 1-2-5 ticks, then the linear ticks of its
  // real values, and keeps each whose label clears those already kept where they sit in log space.
  const real = linear(
    [Math.min(base ** a, base ** b), Math.max(base ** a, base ** b)],
    [0, 1],
    undefined,
    axis,
  );
  const offered = [
    ...powers,
    ...all,
    ...real.ticks.flatMap(v => (v > 0 ? [{ value: lg(v, base), label: format(v) }] : [])),
  ];
  const gap = room
    ? ((room.horizontal ? widest(offered) * 7 + 16 : 22) / Math.max(room.length, 1)) * (b - a)
    : 1e-9;
  const kept: Tick[] = [];
  for (const t of offered) if (kept.every(k => Math.abs(k.value - t.value) >= gap)) kept.push(t);
  return ordered(kept);
}

/** An axis whose marks are given columns in log space: `y.col(values)`, or `y.to(v, y)` for one value. */
export function log({ label, base = 10, domain = 'nice', format, fit }: LogOptions): LogAxis {
  if (!(base > 0 && base !== 1 && Number.isFinite(base)))
    throw new RangeError(`log() base ${base} must be above zero and not 1`);
  if (typeof domain !== 'string')
    for (const bound of domain)
      if (!(bound > 0 && bound < Infinity))
        throw new RangeError(`log() domain bound ${bound} must be above zero`);
  return {
    domain: typeof domain === 'string' ? domain : [lg(domain[0], base), lg(domain[1], base)],
    label,
    base,
    format,
    fit,
    to,
    from,
    col: col as LogAxis['col'],
    scale: resolve,
  };
}
