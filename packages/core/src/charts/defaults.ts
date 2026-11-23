import { palette, paletteDark } from '../paint.js';
import { dark, light, type Theme } from '../theme.js';
import type { Col } from '../types.js';

const DAY = 864e5;

const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatNumber = (v: number) => numbers.format(v);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function timeTitle(columns: readonly Col[], utc: boolean): (t: number) => string {
  const parts = (t: number) => {
    const d = new Date(t);
    return utc
      ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]
      : [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
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
  return t => {
    const [y, mo, day, h, mi] = parts(t) as [number, number, number, number, number];
    const date = `${y < 0 ? '-' : ''}${pad(Math.abs(y), 4)}-${pad(mo)}-${pad(day)}`;
    return dateOnly ? date : `${date} ${pad(h)}:${pad(mi)}`;
  };
}

export const bandTitle = (categories: readonly string[], x: number) =>
  categories[Math.min(Math.max(Math.round(x), 0), categories.length - 1)]!;

export type ThemeProp = 'auto' | 'light' | 'dark' | Theme | undefined;

/** 'auto' reads the element's computed color-scheme; onChange fires when a 'light dark' page flips. */
export function themeOf(
  el: Element,
  prop: ThemeProp,
  onChange: (theme: Theme) => void,
): { theme: Theme; dispose(): void } {
  const none = () => {};
  if (prop === 'light') return { theme: light, dispose: none };
  if (prop === 'dark') return { theme: dark, dispose: none };
  if (prop !== undefined && prop !== 'auto') return { theme: prop, dispose: none };
  const fixed = () => {
    const words = getComputedStyle(el).colorScheme.split(/\s+/);
    if (!words.includes('dark')) return light;
    return words.includes('light') ? undefined : dark;
  };
  const theme = fixed();
  if (theme) return { theme, dispose: none };
  const mq = matchMedia('(prefers-color-scheme: dark)');
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
