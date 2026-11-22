import { rgba } from './gl.js';

/**
 * Eight colours for eight series, to be given out in this order: the order is what keeps
 * neighbours apart for colour-blind readers, and each has a contrast of 3:1 on white.
 */
export const palette = [
  '#0891b2',
  '#7c3aed',
  '#db2777',
  '#2563eb',
  '#d97706',
  '#c026d3',
  '#059669',
  '#4f46e5',
];

/** The same eight hues in the same order, each with a contrast of 3:1 on `dark.surface`. */
export const paletteDark = [
  '#0891b2',
  '#8b5cf6',
  '#ec4899',
  '#3b82f6',
  '#d97706',
  '#d946ef',
  '#059669',
  '#6366f1',
];

/** A stop is a CSS colour, or a number for the mark's own colour at that opacity. */
export type Gradient = {
  from: string | number;
  to: string | number;
  toward: 'down' | 'up' | 'right' | 'left';
};
/** What a shape is filled or a line drawn with: a CSS colour, or two blended across the mark. */
export type Paint = string | Gradient;

/** A blend of two stops in a direction on the screen: gradient(0.4, 0) fades a mark's own colour out downwards. */
export const gradient = (
  from: string | number,
  to: string | number,
  toward: Gradient['toward'] = 'down',
): Gradient => ({ from, to, toward });

/** The brand's blend, cyan to violet, left to right. */
export const brand = gradient('#06b6d4', '#8b5cf6', 'right');

/**
 * The two stops as red, green, blue and opacity from 0 to 1, in the order the direction runs on
 * screen; `based` keeps them as given, for a blend that runs to a baseline whichever way that lies.
 */
export function stops(ctx: CanvasRenderingContext2D, g: Gradient, color: string, based = false) {
  const own = rgba(ctx, color);
  const both = [g.from, g.to].map(stop =>
    typeof stop === 'number' ? [own[0]!, own[1]!, own[2]!, (own[3] ?? 1) * stop] : rgba(ctx, stop),
  );
  return !based && (g.toward === 'up' || g.toward === 'left') ? both.reverse() : both;
}

/**
 * What to fill or stroke with on the canvas, given a box of device pixels: left, top, right and
 * bottom. With `turn`, the level of a baseline, an upright blend starts at the box's far end, or
 * at both ends when the baseline is between them, and reaches its second stop at the baseline.
 */
export function painter(ctx: CanvasRenderingContext2D, paint: Paint | undefined, color: string) {
  if (paint === undefined || typeof paint === 'string') return () => paint ?? color;
  const upright = paint.toward === 'down' || paint.toward === 'up';
  const [plain, based] = [false, true].map(given =>
    stops(ctx, paint, color, given).map(
      ([red, green, blue, a]) =>
        `rgba(${Math.round(red! * 255)},${Math.round(green! * 255)},${Math.round(blue! * 255)},${a})`,
    ),
  );
  return ([l, t, r, b]: number[], turn?: number) => {
    // A box that is not a number, such as a bar at zero on a log axis, draws nothing, and a gradient for it would throw.
    if (!Number.isFinite(upright ? t! + b! : l! + r!)) return plain![0]!;
    const made = upright ? ctx.createLinearGradient(0, t!, 0, b!) : ctx.createLinearGradient(l!, 0, r!, 0);
    if (upright && turn !== undefined) {
      made.addColorStop(0, based![0]!);
      made.addColorStop(Math.min(1, Math.max(0, (turn - t!) / (b! - t! || 1))), based![1]!);
      made.addColorStop(1, based![0]!);
    } else {
      made.addColorStop(0, plain![0]!);
      made.addColorStop(1, plain![1]!);
    }
    return made;
  };
}
