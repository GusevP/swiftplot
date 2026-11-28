import { windowOf } from '../color.js';
import { palette, paletteDark } from '../paint.js';
import { dark, light, type Theme } from '../theme.js';
import type { Col, Span } from '../types.js';
import type { Kind } from './source.js';

export const DAY = 864e5;

const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatNumber = (v: number) => numbers.format(v);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function timeTitle(columns: readonly Col[], utc: boolean, distinct = false): (t: number) => string {
  const parts = (t: number) => {
    const d = new Date(t);
    return utc
      ? [
          d.getUTCFullYear(),
          d.getUTCMonth() + 1,
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds(),
        ]
      : [
          d.getFullYear(),
          d.getMonth() + 1,
          d.getDate(),
          d.getHours(),
          d.getMinutes(),
          d.getSeconds(),
          d.getMilliseconds(),
        ];
  };
  const midnight = (t: number) => {
    const d = new Date(t);
    return utc
      ? t % DAY === 0
      : d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
  };
  let dateOnly = true;
  for (const xs of columns)
    for (let i = 0; i < xs.length && dateOnly; i++) {
      if (Number.isFinite(xs[i])) dateOnly = midnight(xs[i]!);
    }
  const times = new Set<number>();
  if (distinct && !(dateOnly && utc))
    for (const xs of columns)
      for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) times.add(xs[i]!);
  const collide = (unit: number) => new Set(Array.from(times, t => Math.floor(t / unit))).size < times.size;
  const width = !collide(6e4) ? 5 : !collide(1e3) ? 8 : 12;
  const unit = dateOnly ? DAY : width === 5 ? 6e4 : width === 8 ? 1e3 : 1;
  const walls = new Map<number, number>();
  let zoned = false;
  if (!utc)
    for (const t of times) {
      const offset = new Date(t).getTimezoneOffset();
      const wall = Math.floor((t - offset * 6e4) / unit);
      zoned ||= (walls.get(wall) ?? offset) !== offset;
      walls.set(wall, offset);
    }
  const zone = (t: number) => {
    if (!zoned) return '';
    const offset = -new Date(t).getTimezoneOffset();
    const size = Math.abs(offset);
    return ` UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(size / 60))}:${pad(Math.floor(size % 60))}`;
  };
  return t => {
    const [y, mo, day, h, mi, s, ms] = parts(t) as [number, number, number, number, number, number, number];
    const date = `${y < 0 ? '-' : ''}${pad(Math.abs(y), 4)}-${pad(mo)}-${pad(day)}`;
    const clock = dateOnly ? '' : ` ${`${pad(h)}:${pad(mi)}:${pad(s)}.${pad(ms, 3)}`.slice(0, width)}`;
    return `${date}${clock}${zone(t)}`;
  };
}

export const namesOf = (
  kind: Kind | 'index',
  categories: readonly string[] | undefined,
  columns: readonly Col[],
  utc: boolean,
): ((v: number) => string) =>
  kind === 'text' ? v => categories![v]! : kind === 'time' ? timeTitle(columns, utc, true) : String;

export const bandTitle = (categories: readonly string[], x: number) =>
  categories[Math.min(Math.max(Math.round(x), 0), categories.length - 1)]!;

/** 0.6 of the smallest gap between distinct x, or of fallback where there is none. */
export function spacing(x: Col, fallback: number): { width: number; lone?: Span } {
  const at = Float64Array.from(x).sort();
  let gap = Infinity;
  for (let i = 1; i < at.length; i++) {
    const d = at[i]! - at[i - 1]!;
    if (d > 0 && d < gap) gap = d;
  }
  return gap < Infinity
    ? { width: gap * 0.6 }
    : {
        width: fallback * 0.6,
        // A candle or bar alone would otherwise fill the axis, whose extent is its width.
        ...(at.length &&
          Number.isFinite(at[0]) && { lone: [at[0]! - fallback / 2, at[0]! + fallback / 2] as Span }),
      };
}

export type ThemeProp = 'auto' | 'light' | 'dark' | Theme | undefined;

/** 'auto' reads the element's computed color-scheme; onChange fires when a 'light dark' page flips. */
export function themeOf(
  el: Element,
  prop: ThemeProp,
  onChange: (theme: Theme) => void,
): { theme: Theme; dispose(): void } {
  const none = () => {};
  const win = windowOf(el);
  if (prop === 'light') return { theme: light, dispose: none };
  if (prop === 'dark') return { theme: dark, dispose: none };
  if (prop !== undefined && prop !== 'auto') return { theme: prop, dispose: none };
  const fixed = () => {
    const words = win.getComputedStyle(el).colorScheme.split(/\s+/);
    if (!words.includes('dark')) return light;
    return words.includes('light') ? undefined : dark;
  };
  const theme = fixed();
  if (theme) return { theme, dispose: none };
  const mq = win.matchMedia('(prefers-color-scheme: dark)');
  const resolve = () => fixed() ?? (mq.matches ? dark : light);
  const listen = () => onChange(resolve());
  mq.addEventListener('change', listen);
  return { theme: resolve(), dispose: () => mq.removeEventListener('change', listen) };
}

export function colorsFor(
  theme: Theme | undefined,
  colors: readonly string[] | undefined,
  n: number,
): string[] {
  const list = colors?.length ? colors : theme === dark ? paletteDark : palette;
  return Array.from({ length: n }, (_, i) => list[i % list.length]!);
}
