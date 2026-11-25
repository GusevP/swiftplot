import type { Theme } from './theme.js';

export type Col = ArrayLike<number>;

/** Device pixels: px = ox + x * kx, py = oy - y * ky. left/top/width/height is the plot rectangle. */
export type View = {
  kx: number;
  ox: number;
  ky: number;
  oy: number;
  left: number;
  top: number;
  width: number;
  height: number;
  dpr: number;
  ctx: CanvasRenderingContext2D;
  theme: Theme;
};

/** A data point and its distance from the pointer in CSS pixels. */
export type Hit = {
  x: number;
  y: number;
  distance: number;
  /** The row's own value where y is not it, such as a stacked bar's, which y places at its top. */
  value?: number;
  /** Which row of the mark was hit, when it draws one shape per row. */
  row?: number;
  /** The colour of what was hit, where the rows of a mark differ in colour and are not its entries. */
  color?: string;
};

/**
 * Text a mark asks to have drawn at a point of the canvas, in device pixels like the rest of what
 * a mark computes. The chart draws it as DOM, leaves out what would run off the chart or onto a
 * label of higher priority, and shows it as a reveal uncovers it.
 */
export type Label = {
  x: number;
  y: number;
  text: string;
  /** Which edge of the text sits at x; 'center' by default. */
  align?: 'start' | 'center' | 'end';
  color?: string;
  /** The higher wins a collision; ties go to the earlier label. */
  priority?: number;
};

export type Prepared = {
  labels?: Label[];
  /** Lines across the whole plot at a device pixel, drawn as DOM over every canvas and never dimmed. */
  rules?: { x?: number; y?: number; color: string; width: number; dashed: boolean }[];
  /**
   * With a row, that row is drawn at `alpha` and the mark's other rows at `alpha * rest`.
   * A mark that does not draw one shape per row ignores both.
   */
  paint(alpha: number, row?: number, rest?: number): void;
  /** Draws these rows again over what paint() drew, at full strength, outlined inside in `outline`. */
  select?(rows: readonly number[], outline: string): void;
  /**
   * Present when the mark can move from the shape of the mark it replaced: sets what paint() draws,
   * from that shape (0) to its own (1). It starts at 1, and hit() always answers for 1.
   */
  morph?(t: number): void;
  /**
   * px, py and max are CSS pixels relative to the chart. A mark hit anywhere on its shape, not
   * at a point, reports `max` as its distance, so a point within reach wins over it.
   */
  hit?(px: number, py: number, max: number): Hit | null;
};

export type GlLayer = {
  gl: WebGL2RenderingContext;
  clear(): void;
  /** Scales everything drawn so far by k, so a focused group can be drawn on top at full strength. */
  fade(k: number): void;
  destroy(): void;
};

/**
 * Where a filled mark lies at an x. Its value is the real distance between the edges for a band,
 * else `value`, else y2.
 */
export type Sample = { y1: number; y2: number; band?: boolean; value?: number };

export type Mark = {
  /** Names the implementation, e.g. 'line'. */
  type: string;
  /** Identity across update(); defaults to the position in `marks`. */
  key?: string;
  label?: string;
  /** Marks of one group are focused and dimmed together. */
  group?: string;
  color: string;
  /**
   * Compared shallowly, with `type`, across update(): an equal mark keeps its prepared geometry.
   * Values written into the same array are not seen; pass a new array or view to redraw.
   */
  options: object;
  /** Which y axis the mark is drawn against and fits; 'y' when left out, and whenever the chart has no `y2`. */
  yAxis?: 'y' | 'y2';
  points: number;
  /** Columns the 'nice' domains are computed from. */
  channels: { x: Col[]; y: Col[] };
  /**
   * Called once per view change; the result is kept and repainted. `previous` is the mark of the
   * same type and key that an update replaced with this one; it has been released by then.
   */
  prepare(view: View, previous?: Mark): Prepared;
  /**
   * Used instead of prepare() once the marks sharing the chart's layer hold enough points.
   * The first such mark's `layer` makes the chart's layer; a mark with another `layer` stays on canvas.
   */
  gl?: {
    layer: (canvas: HTMLCanvasElement) => GlLayer | null;
    prepare: (view: View, layer: GlLayer) => Prepared;
    /** The points at which this mark alone asks for the layer: 10,000 when left out. Marks add up by their shares. */
    from?: number;
    /** The mark belongs under those after it, so it stays on the canvas unless they are all on the layer. */
    under?: true;
  };
  /**
   * What the mark shows at x: a y, or for a filled mark its value and the y range it covers there.
   * A step holds its last sample from there on; a straight line has nothing outside its samples.
   * `straight` asks for a smooth curve as drawn where its rows share a pixel column: straight.
   */
  sampleAtX?(x: number, straight?: boolean): number | Sample | undefined;
  /** A chart has dropped the mark; `layer` is that chart's, so only what was made for it is freed. */
  release?(layer: GlLayer | null): void;
  /**
   * For a mark coloured by value: the colours, as the pixels of a ColorScale's table, and the
   * values that get the first and the last of them. A legend draws it as a strip.
   */
  ramp?(): { table: Uint32Array; lo: number; hi: number };
  /** Drawn at full strength whatever is focused, and always on the canvas: a grid behind other marks, say. */
  backdrop?: true;
  /**
   * How far past the plot area the mark may show, in CSS pixels: a point's radius, half a line's
   * width. Without it a point on the edge of the domain is cut in half.
   */
  overhang?: number;
  /** A reveal uncovers the chart downwards when a mark asks for it; otherwise from the left. */
  reveal?: 'down';
  /**
   * The named parts of a mark that draws several, such as slices, in row order. A legend lists
   * these in place of the mark's own label, and pointing at one focuses that row.
   */
  entries?: { label: string; color: string }[];
  /** paint() draws every row alike, so a focused row focuses the mark's group instead; select() still picks rows out. */
  rowsAlike?: true;
  /** paint() draws the mark as one shape and ignores a row, so selecting any of its rows draws it whole. */
  oneShape?: true;
  /**
   * Laid out by the chart with the other shown marks of the same key, such as a stack: `lay` is
   * given them in listed order and returns the marks drawn in their place.
   */
  arrange?: { key: string; lay(members: readonly Mark[]): Mark[] };
};

/** The rough length of an axis in CSS pixels, and whether its labels run along it (x) or across it (y). */
export type Room = { length: number; horizontal: boolean };

export type Tick = { value: number; label: string };
export type Resolved = { lo: number; hi: number; ticks: Tick[] };

/** What x, y and y2 take: a linear axis unless `scale` replaces it, as the axes time(), log(), band() and bare() return do. */
export type Axis = {
  /** 'nice' widens the extent of the marks' columns to whole steps; 'data' keeps it exact. */
  domain: [number, number] | 'nice' | 'data';
  /** The axis title; an empty string shows none. */
  label: string;
  /**
   * Replaces the built-in linear scale. It receives the axis itself, so one function serves every
   * axis of its kind and two axes with equal fields compare as equal across update(); a function
   * giving the extent of the marks' columns on this axis, which scans them the first time it is
   * called; and the room there is for ticks. It runs again whenever that room may have changed.
   */
  scale?(axis: Axis, extent: () => [number, number], room?: Room): Resolved;
  /**
   * Which marks the extent is taken from: those shown (the default), or all of them, hidden or not.
   * 'window', on a y axis with an automatic domain, takes it from the shown marks inside the x window
   * while there is one and y has no window of its own.
   */
  fit?: 'shown' | 'all' | 'window';
  /**
   * Ticks at the multiples of this, thinned to every k-th when their labels do not fit; 'nice' rounds to it.
   * A step that would give 990 ticks or more across what is shown gives way to the automatic one.
   */
  step?: number;
  /** The text of each tick, on the built-in scale and on time(); define it once, not anew in each update. */
  format?: (value: number) => string;
  /** A transformed axis, such as log(): a real value in the space the marks' columns are in, and back. */
  to?(real: number, axis: Axis): number;
  /** The inverse of `to`: a value in the marks' space back to the real one. */
  from?(v: number, axis: Axis): number;
};
export type Margin = { top: number; right: number; bottom: number; left: number };
export type Span = [number, number];

export type Options = {
  /** The width in CSS pixels; when omitted the chart follows its container. */
  width?: number;
  /** The height in CSS pixels; when omitted the chart follows its container. */
  height?: number;
  /** CSS pixels around the plot area for ticks and labels. A side left out is sized from the labels. */
  margin?: Partial<Margin>;
  /** The horizontal axis; `{ domain: 'nice', label: '' }` when left out. */
  x?: Axis;
  /** The vertical axis; `{ domain: 'nice', label: '' }` when left out. */
  y?: Axis;
  /**
   * A second y axis, drawn on the right, for the marks given `yAxis: 'y2'`: it takes its extent from
   * those marks alone. Grid lines come from `y` only. Left out, there is none and every mark is on `y`.
   */
  y2?: Axis;
  /**
   * 'polar' and 'blank' have no axes: a mark is given the plot rectangle only, and reports a hit
   * as fractions of it, x from the left and y from the bottom. 'polar' is for marks drawn round
   * a centre, such as arcs(); it differs from 'blank' in how a reveal uncovers it.
   * @default 'axes'
   */
  frame?: 'axes' | 'polar' | 'blank';
  /** What the chart draws, made by line(), bar() and the other mark functions. */
  marks: Mark[];
  /** Read once, when the chart is created. */
  use?: Feature[];
  /**
   * What assistive technology reads for the chart; by default the axis labels and the names of
   * the labelled marks. The data itself is not exposed.
   */
  description?: string;
  /** Opacity multiplier for every other group while one is focused. @default 1 */
  dim?: number;
  /** `light` when left out. Replacing it with another object repaints the chart and restyles its text. */
  theme?: Theme;
  /**
   * The part of each axis shown, in its values; a side left out shows the whole domain. It is shown
   * clamped to the domain but kept as given, so it comes back when the domain grows again.
   */
  view?: { x?: Span; y?: Span; y2?: Span };
  /**
   * Called with the window shown once a feature has moved it; never for update(). y is left out
   * when the y axis fits the x window and has no window of its own, and y2 likewise, or when there
   * is no second axis. A gesture on y moves y2 through the same pixels.
   */
  onViewChange?(view: { x: Span; y?: Span; y2?: Span }): void;
  /** The series not drawn, by the id a legend lists a mark under: its `group`, or its `label`. */
  hidden?: string[];
  /** Called with the hidden ids once a feature has changed them; never for update(). */
  onHiddenChange?(hidden: string[]): void;
  /**
   * Rows the app has picked out, by the id `hidden` uses: drawn at full strength, and every other row
   * at `dim`, while nothing is focused. Bars and dots outline them; a mark drawn as one shape, such as
   * a line or an area, is drawn whole, and other marks draw the rows without an outline. Unknown ids
   * and rows are ignored. A translucent row is drawn over its dimmed copy, so it shows a little
   * stronger than when focused.
   */
  selected?: { id: string; rows: number[] }[] | null;
  /**
   * Called for a click on the plot, but not for one that ends a drag: with what is within 20 px of
   * it, or null, and the values at the click, y2 among them when there is a second axis. A hit's y is
   * on its mark's own axis. While it is set, the cursor is a pointer over a hit.
   */
  onClick?(hit: (Hit & { mark: Mark }) | null, at: { x: number; y: number; y2?: number }): void;
  /**
   * A pointer to show as if the user's were there, such as another chart's: a tooltip shows at it
   * while the user's own is not on the chart. Without y, an x tooltip focuses no series and a
   * nearest one shows nothing. The height may be given on the second axis instead, as y2; with both, y2 is used.
   */
  pointer?: { x: number; y?: number; y2?: number } | null;
  /** Called as the user's pointer moves over the plot, and with null once as it leaves or a drag starts; never for update(). */
  onPointerChange?(pointer: { x: number; y: number; y2?: number } | null): void;
};

export type Chart = {
  update(options: Partial<Omit<Options, 'use'>>): void;
  destroy(): void;
};

/**
 * Wraps a repaint. `draw` paints the chart now; `draw(0)` paints it with no marks. `why` says what
 * changed: the data, the size, or only focus and dimming.
 */
export type Painter = (draw: (reveal?: number) => void, why: 'data' | 'size' | 'focus') => void;

/**
 * What a feature works with. Pixel values are CSS pixels relative to the chart. A feature is set
 * up before the first paint: the pixel helpers, hit(), view(), fit() and propose()
 * work from that paint on.
 */
export type Internals = {
  root: HTMLElement;
  /** The 2D canvas holding the grid and every mark that is not on WebGL. */
  canvas: HTMLCanvasElement;
  /** One painter per chart; the last one set wins. */
  onPaint(painter: Painter | undefined): void;
  /**
   * Moves the marks changed by the last update between their previous shape (0) and their own (1).
   * False, and nothing moves, unless every changed mark can morph and none was added or removed.
   */
  morph(t: number): boolean;
  /**
   * The outline, in CSS pixels, of what a reveal has uncovered at this progress: the plot from
   * the left or from the top, or in a polar frame swept round from twelve o'clock.
   */
  revealed(progress: number): [number, number][];
  /**
   * Keeps room above the plot. `space` is asked on every layout, with the plot's left edge and
   * width in CSS pixels, for the height it needs; it must be cheap and measure nothing.
   * ponytail: one caller, and the top only; other sides when a feature needs them.
   */
  reserve(space: (left: number, width: number) => number): void;
  /**
   * Uncovers the WebGL layer and the marks' labels to this progress, at an opacity; the next
   * draw() shows all of them again.
   */
  reveal(progress: number, opacity?: number): void;
  layer<K extends keyof HTMLElementTagNameMap>(tag: K, css?: string): HTMLElementTagNameMap[K];
  /** The marks shown: those listed, less the hidden ones. */
  marks(): readonly Mark[];
  /** Every mark in `marks`, hidden or not. */
  listed(): readonly Mark[];
  hidden(): readonly string[];
  /** Hides these ids, shows the rest, and passes them to onHiddenChange; nothing when they are already hidden. */
  hide(ids: string[]): void;
  size(): { width: number; height: number };
  margin(): Margin;
  theme(): Theme;
  xPx(x: number): number;
  /** On `y` unless the second axis is named; a mark's own is yAxis(mark). */
  yPx(y: number, axis?: 'y' | 'y2'): number;
  xValue(px: number): number;
  yValue(px: number, axis?: 'y' | 'y2'): number;
  /** The y axis a mark is on: 'y2' only when the chart has one and the mark asks for it. */
  yAxis(mark: Mark): 'y' | 'y2';
  /** The window shown on each axis, in the marks' space; y2 only when there is a second axis. */
  view(): { x: Span; y: Span; y2?: Span };
  /** The whole domain on each axis: the widest window propose() shows. */
  domain(): { x: Span; y: Span; y2?: Span };
  /**
   * Shows this window, or with null the whole domain, clamped to the domain, and passes it to
   * onViewChange; a side left out keeps its window, and a side given as undefined shows its whole
   * domain. False, and nothing happens, when what is shown would not change. A y given without a y2
   * takes the second axis with it, through the same pixels. A side given just as it is shown, with no
   * window of its own, is not held: an axis fitted to its marks goes on fitting them.
   */
  propose(view: { x?: Span; y?: Span; y2?: Span } | null): boolean;
  /** The window propose() would show for this view, without showing it. */
  fit(view: { x?: Span; y?: Span; y2?: Span } | null): { x: Span; y: Span; y2?: Span };
  /** A value in the marks' space as the app sees it. */
  real(axis: 'x' | 'y' | 'y2', v: number): number;
  frame(): NonNullable<Options['frame']>;
  /**
   * Which feature a drag over the plot belongs to. `pan` is 'plain' when every drag pans and a brush
   * gets none, and 'shift' when a drag with shift held pans and a brush keeps the plain ones; with no
   * brush a plain drag then pans too, unless zoom() was given `drag: 'shift'`. `active` is set while
   * a drag or a gesture is under way, and until the click after its release has gone by.
   */
  drag: { brush: boolean; pan: 'plain' | 'shift' | false; active: boolean };
  /** Runs every feature's update(), for a change under a resting pointer that the chart cannot see, such as the end of a drag. */
  sync(): void;
  hit(px: number, py: number, max: number): (Hit & { mark: Mark }) | null;
  /** The app's `pointer`, or null when there is none or its x is outside the plot; a y outside the plot is dropped. */
  pointer(): { x: number; y?: number } | null;
  /**
   * Dims everything outside the group. When the chart holds no second group to dim, a row focuses
   * that one row of its mark instead and dims the mark's other rows.
   */
  focus(group: string | null, row?: { mark: Mark; row: number }): void;
};

/**
 * update() runs whenever what is under a resting pointer may have changed: after the first paint, for
 * new options or a new size, a series hidden or shown, a new window, and at the end of a drag.
 * letGo() runs before the repaint for each of these but the first paint, the end of a drag and an
 * update of only `pointer` or callbacks, so a focus dropped there does not cut a data animation short.
 */
export type Feature = (chart: Internals) => { update?(): void; letGo?(): void; destroy(): void };
