import type { Col, Label, Mark, Prepared } from '../types.js';

/** A line across the whole plot at each x or each y value, over the data and never a series. */
export type RuleOptions = { key?: string; color: string; width?: number; dashed?: boolean; text?: string } & (
  | { x: number | Col }
  | { y: number | Col }
);

export function rule(o: RuleOptions): Mark {
  const { color, width = 1, dashed = false, text } = o;
  return {
    type: 'rule',
    key: o.key,
    color,
    options: o,
    points: 0,
    channels: { x: [], y: [] },
    // It paints nothing on a canvas: as a backdrop it holds no mark off the WebGL layer and fits no domain.
    backdrop: true,
    prepare({ dpr, ox, kx, oy, ky, left, top, width: w, height: h }) {
      const at = 'x' in o ? o.x : o.y;
      const rules: NonNullable<Prepared['rules']> = [];
      const inPlot = ({ x, y, text, align }: Label) => {
        const len = text.length * 7 * dpr;
        const l = align === 'start' ? x : align === 'end' ? x - len : x - len / 2;
        return l >= left && l + len <= left + w && y - 8 * dpr >= top && y + 8 * dpr <= top + h;
      };
      const labels: Label[] = [];
      const place = (...tries: Label[]) => {
        const fit = tries.find(inPlot);
        if (fit) labels.push(fit);
      };
      for (const v of typeof at === 'number' ? [at] : Array.from(at)) {
        if ('x' in o) {
          const x = ox + v * kx;
          if (!(x >= left && x <= left + w)) continue;
          rules.push({ x, color, width: width * dpr, dashed });
          if (text)
            place(
              { x: x + 4 * dpr, y: top + 10 * dpr, text, align: 'start' },
              { x: x - 4 * dpr, y: top + 10 * dpr, text, align: 'end' },
            );
        } else {
          const y = oy - v * ky;
          if (!(y >= top && y <= top + h)) continue;
          rules.push({ y, color, width: width * dpr, dashed });
          if (text)
            place(
              { x: left + w - 4 * dpr, y: y - 9 * dpr, text, align: 'end' },
              { x: left + w - 4 * dpr, y: y + 9 * dpr, text, align: 'end' },
            );
        }
      }
      return { labels, rules, paint() {} };
    },
  };
}

/** A band across the whole plot between two x or two y values, under the data and never a series. */
export type ZoneOptions = { key?: string; color: string; alpha?: number; text?: string } & (
  | { x1: number; x2: number }
  | { y1: number; y2: number }
);

export function zone(o: ZoneOptions): Mark {
  const { color, alpha = 0.15, text } = o;
  return {
    type: 'zone',
    key: o.key,
    color,
    options: o,
    points: 0,
    channels: { x: [], y: [] },
    backdrop: true,
    prepare({ ctx, dpr, ox, kx, oy, ky, left, top, width, height }) {
      const edges = (a: number, b: number, lo: number, hi: number) => {
        const [p, q] = a < b ? [a, b] : [b, a];
        return [Math.max(Math.round(p), lo), Math.min(Math.round(q), hi)] as const;
      };
      const [l, r] =
        'x1' in o ? edges(ox + o.x1 * kx, ox + o.x2 * kx, left, left + width) : [left, left + width];
      const [t, b] =
        'y1' in o ? edges(oy - o.y1 * ky, oy - o.y2 * ky, top, top + height) : [top, top + height];
      if (!(l < r && t < b)) return { labels: [], paint() {} };
      const [x, y] = [l + 4 * dpr, t + 10 * dpr];
      const fits = x < left + width && y < top + height;
      const labels: Label[] = text && fits ? [{ x, y, text, align: 'start' }] : [];
      return {
        labels,
        paint(k) {
          ctx.globalAlpha = alpha * k;
          ctx.fillStyle = color;
          ctx.fillRect(l, t, r - l, b - t);
        },
      };
    },
  };
}
