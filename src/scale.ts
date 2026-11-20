import type { Axis, Col } from './types.js';

export function niceStep(span: number) {
  const mag = 10 ** Math.floor(Math.log10(span / 10));
  return mag * ([1, 2, 5].find(k => span / (mag * k) <= 10) ?? 10);
}

export function extent(cols: Col[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of cols) {
    for (let i = 0; i < c.length; i++) {
      const v = c[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return lo > hi ? [0, 1] : [lo, hi];
}

export function scale(domain: Axis['domain'], cols: Col[]) {
  let [lo, hi] = typeof domain === 'string' ? extent(cols) : domain;
  if (lo === hi) {
    const pad = Math.abs(lo) / 2 || 0.5;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo);
  if (domain === 'nice') [lo, hi] = [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let i = Math.ceil(lo / step); i * step <= hi; i++) ticks.push(+(i * step).toFixed(digits));
  return { lo, hi, ticks };
}
