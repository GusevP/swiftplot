export const FONT = '12px system-ui,sans-serif';

const PLAIN = /^[\d\s.,:%+−-]*$/;
const widths = new Map<string, number>();
let pen: CanvasRenderingContext2D | null | undefined;

export const estimated = (s: string) => s.length * 7;

/**
 * A label's width in CSS pixels. Plain numbers are estimated, as the first measurement on a page costs
 * about 3 ms (13 ms at 4x CPU slowdown, measured 2026-11-25), which a chart of numbers alone should not pay.
 */
export function textWidth(s: string): number {
  if (PLAIN.test(s)) return estimated(s);
  let w = widths.get(s);
  if (w !== undefined) return w;
  if (pen === undefined) {
    pen = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (pen) pen.font = FONT;
  }
  if (!pen) return estimated(s);
  if (widths.size >= 4096) widths.clear();
  widths.set(s, (w = pen.measureText(s).width));
  return w;
}

export const widest = (labels: Iterable<string>, width = textWidth) => {
  let w = 0;
  for (const l of labels) w = Math.max(w, width(l));
  return w;
};
