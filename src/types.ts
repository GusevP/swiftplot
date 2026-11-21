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
};

/** A data point and its distance from the pointer in CSS pixels. */
export type Hit = {
  x: number;
  y: number;
  distance: number;
  /** Which row of the mark was hit, when it draws one shape per row. */
  row?: number;
  /** The colour of what was hit, where the rows of a mark differ in colour and are not its entries. */
  color?: string;
};

/**
 * Text a mark asks to have drawn at a point of the canvas, in device pixels like the rest of what
 * a mark computes. The chart draws it as DOM, leaves out what would run off the chart or onto a
 * label of higher priority (judged at 7 px a character), and shows it as a reveal uncovers it.
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
  /**
   * With a row, that row is drawn at `alpha` and the mark's other rows at `alpha * rest`.
   * A mark that does not draw one shape per row ignores both.
   */
  paint(alpha: number, row?: number, rest?: number): void;
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

export type Sample = { value: number; y1: number; y2: number };

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
   */
  sampleAtX?(x: number): number | Sample | undefined;
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
};

/** The rough length of an axis in CSS pixels, and whether its labels run along it (x) or across it (y). */
export type Room = { length: number; horizontal: boolean };

export type Tick = { value: number; label: string };
export type Resolved = { lo: number; hi: number; ticks: Tick[] };

export type Axis = {
  /** 'nice' widens the extent of the marks' columns to whole steps; 'data' keeps it exact. */
  domain: [number, number] | 'nice' | 'data';
  label: string;
  /**
   * Replaces the built-in linear scale. It receives the axis itself, so one function serves every
   * axis of its kind and two axes with equal fields compare as equal across update(); a function
   * giving the extent of the marks' columns on this axis, which scans them the first time it is
   * called; and the room there is for ticks. It runs again whenever that room may have changed.
   */
  scale?(axis: Axis, extent: () => [number, number], room?: Room): Resolved;
};
export type Margin = { top: number; right: number; bottom: number; left: number };

export type Options = {
  /** CSS pixels; when omitted the chart follows its container. */
  width?: number;
  height?: number;
  /** CSS pixels around the plot area for ticks and labels. A side left out is sized from the labels. */
  margin?: Partial<Margin>;
  /** Each axis is `{ domain: 'nice', label: '' }` when left out. */
  x?: Axis;
  y?: Axis;
  /**
   * 'polar' and 'blank' have no axes: a mark is given the plot rectangle only, and reports a hit
   * as fractions of it, x from the left and y from the bottom. 'polar' is for marks drawn round
   * a centre, such as arcs(); it differs from 'blank' in how a reveal uncovers it.
   */
  frame?: 'axes' | 'polar' | 'blank';
  marks: Mark[];
  /** Read once, when the chart is created. */
  use?: Feature[];
  /**
   * What assistive technology reads for the chart; by default the axis labels and the names of
   * the labelled marks. The data itself is not exposed.
   */
  description?: string;
  /** Opacity multiplier for every other group while one is focused. */
  dim?: number;
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
 * up before the first paint: the pixel helpers and hit() work from that paint on.
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
  marks(): readonly Mark[];
  size(): { width: number; height: number };
  margin(): Margin;
  xPx(x: number): number;
  yPx(y: number): number;
  xValue(px: number): number;
  hit(px: number, py: number, max: number): (Hit & { mark: Mark }) | null;
  /**
   * Dims everything outside the group. When the chart holds no second group to dim, a row focuses
   * that one row of its mark instead and dims the mark's other rows.
   */
  focus(group: string | null, row?: { mark: Mark; row: number }): void;
};

/**
 * update() runs after the chart changed under a resting pointer: new options or a new size.
 * letGo() runs before the chart repaints for either, so a focus dropped there does not cut a data animation short.
 */
export type Feature = (chart: Internals) => { update?(): void; letGo?(): void; destroy(): void };
