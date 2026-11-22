import { stack } from '../transforms.js';
import type { Col, Mark } from '../types.js';
import { painter, type Paint } from '../paint.js';
import { base, chains, columns, extent, joined, reach, sampleAt, smooth, span } from './common.js';
import type { Common, Curve } from './common.js';

/**
 * Filled between 0 and y, or between y1 and y2. x must be ascending. `fill` fills it with
 * something other than its colour. An upright blend runs from the furthest the area reaches to
 * its baseline, on both sides of it and whichever side that is, so gradient(0.4, 0) fades the area
 * out where it meets the axis. Areas given the same `stack` id are stacked by the chart over the shown
 * ones, in the order they are listed; they must share their x. `join` fills it straight across a
 * value that is not finite, where it would otherwise leave a gap.
 */
export type AreaOptions = Common & { x: Col; curve?: Curve; fill?: Paint; join?: boolean } & (
    | { y: Col; stack?: string }
    | { y1: Col; y2: Col }
  );

type Stacked = AreaOptions & { y: Col; stack: string };

const layers = (members: readonly Stacked[]) =>
  stack(members.map(m => m.y)).map((laid, i) => {
    const { y: _, stack: __, ...rest } = members[i]!;
    return area({ ...rest, ...laid });
  });

export function area(o: AreaOptions): Mark {
  if ('y' in o && o.stack !== undefined) {
    return {
      ...layers([o as Stacked])[0]!,
      options: o,
      arrange: {
        key: `area:stack:${o.stack}`,
        lay: members => layers(members.map(k => k.options as Stacked)),
      },
    };
  }
  const { color, curve = 'linear', alpha = 1 } = o;
  const step = curve === 'step';
  const given: [Col] | [Col, Col] = 'y' in o ? [o.y] : [o.y2, o.y1];
  const [[x, y2, y1], cuts] = o.join ? joined(o.x, ...given) : [[o.x, ...given]];
  const outlines = y1 ? [y2, y1] : [y2];
  const ys = o.fill ? extent(outlines) : undefined;
  return {
    ...base('area', o, [o.x], [given[1] ?? (o.x.length ? [0] : []), given[0]]),
    oneShape: true,
    sampleAtX(v, straight) {
      // A step line holds its last value, but the fill ends at the last x.
      if (v > x[x.length - 1]!) return undefined;
      const drawn = straight && curve === 'smooth' ? 'linear' : curve;
      const top = sampleAt(x, y2, v, drawn, y1, cuts);
      const bottom = y1 ? sampleAt(x, y1, v, drawn, y2, cuts) : 0;
      if (top === undefined || bottom === undefined) return undefined;
      return { y1: bottom, y2: top, band: y1 !== undefined };
    },
    prepare({ ctx, ox, kx, oy, ky, left, width }) {
      // Both outlines break where either value is missing, so their runs share their columns.
      // A pixel column's first point can lie up to half a pixel inside the plot, so the area reads one further.
      const rows = span(x, ox, kx, left - 1, left + width + 1, curve === 'smooth' ? 2 : 1);
      const u = columns(x, y2, ox, kx, oy, ky, !step || o.join, y1, rows, cuts);
      const l = y1 && columns(x, y1, ox, kx, oy, ky, !step || o.join, y2, rows, cuts);
      const ux = step ? u.col : u.at;
      const lx = l && (step ? l.col : l.at);
      const path = new Path2D();
      for (const runs of chains(u.runs)) {
        runs.forEach(([a, b, kept], j) => {
          const go = j ? 'lineTo' : 'moveTo';
          if (curve === 'smooth' && kept === b - a) {
            path[go](u.at[a]!, u.first[a]!);
            smooth(path, u.at.subarray(a, b), u.first.subarray(a, b), b - a);
            return;
          }
          for (let i = a; i < b; i++) {
            const px = ux[i]!;
            if (i === a) path[go](px, step && !j ? u.lo[i]! : u.first[i]!);
            else path.lineTo(px, step ? u.last[i - 1]! : u.first[i]!);
            path.lineTo(px, u.lo[i]!);
            path.lineTo(px, u.last[i]!);
          }
        });
        for (const [a, b, kept] of l ? [...runs].reverse() : []) {
          if (curve === 'smooth' && kept === b - a) {
            path.lineTo(l!.at[b - 1]!, l!.first[b - 1]!);
            smooth(path, l!.at.subarray(a, b), l!.first.subarray(a, b), b - a, true);
            continue;
          }
          for (let i = b - 1; i >= a; i--) {
            const px = lx![i]!;
            path.lineTo(px, l!.last[i]!);
            path.lineTo(px, l!.hi[i]!);
            if (!step || i > a) path.lineTo(px, step ? l!.last[i - 1]! : l!.first[i]!);
            else if (a > runs[0]![0]) path.lineTo(px, l!.first[i]!);
          }
        }
        if (!l) {
          path.lineTo(ux[runs[runs.length - 1]![1] - 1]!, oy);
          path.lineTo(ux[runs[0]![0]]!, oy);
        }
        path.closePath();
      }
      let ink: string | CanvasGradient = color;
      if (u.n && o.fill) {
        // How far up and down the whole area reaches, for a blend to run across.
        const [high, low] = reach(ys!, outlines, oy, ky);
        const box = l
          ? [left, high, left + width, low]
          : [left, Math.min(oy, high), left + width, Math.max(oy, low)];
        ink = painter(ctx, o.fill, color)(box, l ? undefined : oy);
      }
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          ctx.fillStyle = ink;
          ctx.fill(path);
        },
      };
    },
  };
}
