import type { Col, Label, Mark } from '../types.js';

/**
 * Stages of a funnel from top to bottom, for a blank frame. All stages are equally tall and each
 * is as wide as its value against the largest; it narrows to the width of the stage below. A
 * value that is negative or not a number counts as 0. Colours repeat when there are fewer than
 * stages. `labels` name the stages for a legend.
 */
export type FunnelOptions = {
  values: Col;
  colors: string[];
  labels?: string[];
  /**
   * Text on each stage: true for its name and its share of the first stage, or your own. It is
   * written inside the stage in white, or beside it where it does not fit.
   */
  text?: true | ((row: number, share: number) => string);
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

export function funnel(o: FunnelOptions): Mark {
  const { values, colors, alpha = 1 } = o;
  const n = values.length;
  const worth = (i: number) => (values[i]! > 0 && Number.isFinite(values[i]) ? values[i]! : 0);
  let most = 0;
  for (let i = 0; i < n; i++) most = Math.max(most, worth(i));
  // Each stage's width as a share of the widest, and its value as a share of the first stage's.
  const wide = Float64Array.from({ length: n }, (_, i) => worth(i) / (most || 1));
  const share = (i: number) => (worth(0) ? worth(i) / worth(0) : 0);
  const shade = (i: number) => colors[i % colors.length] ?? '#888';
  const said =
    o.text === true
      ? (i: number, s: number) => `${o.labels?.[i] ?? ''} ${Math.round(s * 100)}%`.trim()
      : o.text;
  return {
    type: 'funnel',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: shade(0),
    options: o,
    points: n,
    channels: { x: [], y: [] },
    reveal: 'down',
    entries: o.labels?.slice(0, n).map((label, i) => ({ label, color: shade(i) })),
    prepare({ ctx, dpr, left, top, width, height }) {
      const cx = left + width / 2;
      const tall = height / (n || 1);
      // A pixel of space under each stage but the last.
      const gap = Math.min(dpr, tall / 4);
      const half = (i: number) => (wide[Math.min(i, n - 1)]! * width) / 2;
      // The sides are one smooth curve through the stage widths that never bulges past them:
      // its lean where two stages meet is the harmonic mean of the leans either side, and
      // upright where the widths turn. A stage runs from the top of its band to the gap under
      // it. Paint, hit and the room for text all read this.
      const drop = (i: number) => (i < 0 || i >= n ? 0 : half(i + 1) - half(i));
      const lean = (i: number): number => {
        const [a, b] = [drop(i - 1), drop(i)];
        if (!i) return (3 * b - lean(1)) / 2;
        return a * b > 0 ? (2 * a * b) / (a + b) : 0;
      };
      const span = (i: number) => [top + i * tall, top + (i + 1) * tall - (i < n - 1 ? gap : 0)] as const;
      const reach = (i: number, y: number) => {
        const [y0, y1] = span(i);
        const u = Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1)));
        const [uu, back] = [u * u, 1 - u];
        return (
          half(i) * (1 + 2 * u) * back * back +
          lean(i) * u * back * back +
          half(i + 1) * uu * (3 - 2 * u) -
          lean(i + 1) * uu * back
        );
      };
      // Stages less than a device pixel tall are drawn several to a straight-sided band a pixel
      // tall, in its first stage's colour: more shapes than pixels cost time and show nothing.
      const per = tall && tall < 1 ? Math.ceil(1 / tall) : 1;
      const stages: { path: Path2D; from: number; to: number }[] = [];
      for (let i = 0; i < n; i += per) {
        const to = Math.min(i + per, n);
        const [y0, y1] = [span(i)[0], span(to - 1)[1]];
        const path = new Path2D();
        stages.push({ path, from: i, to });
        path.moveTo(cx - half(i), y0);
        path.lineTo(cx + half(i), y0);
        if (per > 1) {
          path.lineTo(cx + half(to), y1);
          path.lineTo(cx - half(to), y1);
          continue;
        }
        // Control points a third and two thirds of the way down make the curve exactly reach().
        const [a, b] = [y0 + (y1 - y0) / 3, y1 - (y1 - y0) / 3];
        const [out, into] = [half(i) + lean(i) / 3, half(i + 1) - lean(i + 1) / 3];
        path.bezierCurveTo(cx + out, a, cx + into, b, cx + half(i + 1), y1);
        path.lineTo(cx - half(i + 1), y1);
        path.bezierCurveTo(cx - into, b, cx - out, a, cx - half(i), y0);
        path.closePath();
      }
      const labels: Label[] = [];
      for (let i = 0; said && i < n && most; i++) {
        const [y0, y1] = span(i);
        const y = (y0 + y1) / 2;
        if (y1 - y0 < 16 * dpr) continue;
        const text = said(i, share(i));
        if (!text) continue;
        // The stage's half-width at the top and at the bottom of the text. Inside where even the
        // narrower leaves room; otherwise to the right of the wider, clear of the slanted side.
        const [above, below] = [reach(i, y - 8 * dpr), reach(i, y + 8 * dpr)];
        if (text.length * 7 * dpr <= 2 * Math.min(above, below) * 0.9) {
          labels.push({ x: cx, y, text, color: '#fff', priority: n - i });
        } else {
          labels.push({ x: cx + Math.max(above, below) + 8 * dpr, y, text, align: 'start', priority: n - i });
        }
      }
      return {
        labels,
        paint(k, row, rest = 1) {
          for (const { path, from, to } of stages) {
            ctx.globalAlpha = alpha * k * (row === undefined || (row >= from && row < to) ? 1 : rest);
            ctx.fillStyle = shade(from);
            ctx.fill(path);
          }
        },
        // The stage whose band the pointer is in, if it is within the stage's slanted sides.
        hit(px, py, max) {
          const [hx, hy] = [px * dpr, py * dpr];
          const row = Math.floor((hy - top) / tall);
          if (!(row >= 0 && row < n) || !most || hy >= span(row)[1]) return null;
          const across = reach(row, hy);
          if (Math.abs(hx - cx) > across || !across) return null;
          return { x: 0.5, y: 1 - (row + 0.5) / n, distance: max, row };
        },
      };
    },
  };
}
