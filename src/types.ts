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
export type Hit = { x: number; y: number; distance: number };

export type Prepared = {
  paint(alpha: number): void;
  /** px, py and max are CSS pixels relative to the chart. */
  hit?(px: number, py: number, max: number): Hit | null;
};

export type GlLayer = {
  gl: WebGL2RenderingContext;
  clear(): void;
  /** Scales everything drawn so far by k, so a focused group can be drawn on top at full strength. */
  fade(k: number): void;
  destroy(): void;
};

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
  /** Called once per view change; the result is kept and repainted. */
  prepare(view: View): Prepared;
  /**
   * Used instead of prepare() once the marks sharing the chart's layer hold enough points.
   * The first such mark's `layer` makes the chart's layer; a mark with another `layer` stays on canvas.
   */
  gl?: {
    layer: (canvas: HTMLCanvasElement) => GlLayer | null;
    prepare: (view: View, layer: GlLayer) => Prepared;
  };
  /** y of the sample that applies at x, undefined before the first one. */
  sampleAtX?(x: number): number | undefined;
  /** A chart has dropped the mark; `layer` is that chart's, so only what was made for it is freed. */
  release?(layer: GlLayer | null): void;
};

export type Axis = { domain: [number, number] | 'nice'; label: string };
export type Margin = { top: number; right: number; bottom: number; left: number };

export type Options = {
  /** CSS pixels; when omitted the chart follows its container. */
  width?: number;
  height?: number;
  margin: Margin;
  x: Axis;
  y: Axis;
  marks: Mark[];
  /** Read once, when the chart is created. */
  use?: Feature[];
  /** Opacity multiplier for every other group while one is focused. */
  dim?: number;
};

export type Chart = {
  update(options: Partial<Omit<Options, 'use'>>): void;
  destroy(): void;
};

/** What a feature works with. Pixel values are CSS pixels relative to the chart. */
export type Internals = {
  root: HTMLElement;
  layer<K extends keyof HTMLElementTagNameMap>(tag: K, css?: string): HTMLElementTagNameMap[K];
  marks(): readonly Mark[];
  size(): { width: number; height: number };
  margin(): Margin;
  xPx(x: number): number;
  yPx(y: number): number;
  xValue(px: number): number;
  hit(px: number, py: number, max: number): (Hit & { mark: Mark }) | null;
  focus(group: string | null): void;
};

/** update() runs after the chart changed under a resting pointer: new options or a new size. */
export type Feature = (chart: Internals) => { update?(): void; destroy(): void };
