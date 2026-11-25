import type { AnimateOptions } from '../features/animate.js';
import type { BrushOptions } from '../features/brush.js';
import type { LegendOptions } from '../features/legend.js';
import type { ZoomOptions } from '../features/zoom.js';
import type { LineOptions } from '../marks/line.js';
import type { Nested } from '../marks/tree.js';
import type { Gradient, Paint } from '../paint.js';
import type { ColorScale } from '../scales/color.js';
import type { TimeOptions } from '../scales/time.js';
import type { Theme } from '../theme.js';
import type { Axis, Col, Options } from '../types.js';
import type { Accessor, Data } from './source.js';

type AxisProps = {
  /** The axis title; the field's name by default, none for the row index, an accessor or several y fields. */
  label?: string;
};
export type YAxisProps = AxisProps & {
  /** Ticks at the multiples of this, thinned to every k-th when their labels do not fit. */
  step?: number;
  /** The text of each tick, and of the values in the tooltip. */
  format?: (v: number) => string;
  /** Which series the automatic extent covers: those shown, all of them, or those inside the x window. @default 'shown' */
  fit?: Axis['fit'];
  /** 'nice' widens the extent to whole steps, 'data' keeps it exact. @default 'nice' */
  domain?: Axis['domain'];
};
export type XAxisProps = AxisProps & {
  /** On numbers, ticks at the multiples of this, thinned to every k-th when their labels do not fit; dates, text and bars ignore it. */
  step?: number;
  /** On numbers and dates, the text of each tick and of x in a scatter's or histogram's tooltip; text and bars ignore it. */
  format?: (v: number) => string;
  /** On numbers and dates, which series the automatic extent covers: those shown or all of them; text and bars ignore it. @default 'shown' */
  fit?: Axis['fit'];
  /** On numbers 'nice' (the default) widens to whole steps and 'data' keeps it exact; dates fit the data unless given `[from, to]` in ms; text and bars ignore it. */
  domain?: Axis['domain'];
  /** Reads dates without a zone, and labels the axis, in UTC; `false` uses local time, except on bars, which are always UTC. @default true */
  utc?: boolean;
  /** Puts date ticks on the boundaries of this unit; left out, the step is chosen for the span shown. */
  unit?: TimeOptions['unit'];
  /** With `unit`, a tick every this many units. @default 1 */
  every?: number;
};

export type Axes = {
  /** Settings for the x axis; which apply depends on whether x is numbers, dates or text. */
  xAxis?: XAxisProps;
  /** Settings for the y axis. */
  yAxis?: YAxisProps;
  /** Zoom and pan, or their options. @default false */
  zoom?: boolean | ZoomOptions;
  /** The part of each axis shown, in its values; kept by the chart unless given. */
  view?: Options['view'];
  /** Called with the window shown once zoom or pan has moved it; never for update(). */
  onViewChange?: Options['onViewChange'];
};

type ScaledYAxisProps = YAxisProps & {
  /** 'log' spaces equal ratios equally; a value at or below zero is then a gap, and `step` does not apply. @default 'linear' */
  scale?: 'linear' | 'log';
};
export type ScaledAxes = {
  /** Settings for the y axis. */
  yAxis?: ScaledYAxisProps;
  /** Settings for the right-hand axis of `y2`, which is drawn only with it. */
  y2Axis?: ScaledYAxisProps;
};

/** A date, as a Date, in ms or as an ISO string, a number, or a category: whichever the x axis shows. */
export type XValue = number | string | Date;
type Rule = {
  /** Written beside the line, where it fits. */
  text?: string;
  /** Draws the line dashed. @default false */
  dashed?: boolean;
  /** A CSS colour; the theme's text colour when left out. */
  color?: string;
} & (
  | {
      /** Where the line stands on the x axis; one not on it is not drawn. */
      x: XValue;
      y?: never;
    }
  | {
      /** Where the line lies on the y axis. */
      y: number;
      x?: never;
    }
);
type Zone = {
  /** Written in the band's top left corner, where it fits. */
  text?: string;
  /** A CSS colour, drawn faint; the theme's muted colour when left out. */
  color?: string;
} & (
  | {
      /** The band's two edges on the x axis; two categories cover both in full. */
      x: readonly [XValue, XValue];
      y?: never;
    }
  | {
      /** The band's two edges on the y axis. */
      y: readonly [number, number];
      x?: never;
    }
);
type Brush = {
  /** The axes a drag marks out a range on. @default 'x' */
  axes?: BrushOptions['axes'];
};
export type Overlays = {
  /** Lines across the plot over the data, each `{ x }` or `{ y }` with an optional `text`, `dashed` and `color`. */
  rules?: readonly Rule[];
  /** Shaded bands under the data, each `{ x: [from, to] }` or `{ y: [from, to] }` with an optional `text` and `color`. */
  zones?: readonly Zone[];
  /** A drag marks out a range, on x unless `{ axes }` says otherwise; with `zoom`, its release shows the range. @default false */
  brush?: boolean | Brush;
  /** Called with the range brushed, in axis values, on release, and with null once a range left standing is cleared. */
  onBrush?: BrushOptions['onSelect'];
};

export type SecondAxis = {
  /** Settings for the right-hand axis of `y2`, which is drawn only with it. */
  y2Axis?: YAxisProps;
};

export type Base = {
  /** Bump after changing the data in place, so that it is converted again. */
  dataVersion?: number;
  /** Series colours in order; `palette`, or `paletteDark` on the dark theme, by default. */
  colors?: readonly string[];
  /** 'auto' follows the CSS `color-scheme` of the chart's element. @default 'auto' */
  theme?: 'auto' | 'light' | 'dark' | Theme;
  /** The hover tooltip, with each value in the format of its axis, else two decimals at most. @default true */
  tooltip?: boolean;
  /** The legend, which hides and shows series, or its options; shown with two or more series. @default true */
  legend?: boolean | LegendOptions;
  /** Animation, or its options. @default false */
  animate?: boolean | AnimateOptions;
  /** Width in CSS pixels; the chart follows its container when it is left out. */
  width?: number;
  /** Height in CSS pixels; the chart follows its container when it is left out. */
  height?: number;
  /** CSS pixels around the plot area; a side left out is sized from the labels. */
  margin?: Options['margin'];
  /** What assistive technology reads for the chart; by default the axis labels and the series names. */
  description?: string;
  /** The series not drawn, by name; kept by the chart unless given. */
  hidden?: string[];
  /** Called with the hidden series once the legend has changed them; never for update(). */
  onHiddenChange?: Options['onHiddenChange'];
  /** Rows the app has picked out: bars and dots outline them, while a line or an area redraws its series. */
  selected?: Options['selected'];
  /** Called for a click on the plot with what is within 20 px of it, or null, and the values there. */
  onClick?: Options['onClick'];
  /** A pointer to show as if the user's were there, such as another chart's. */
  pointer?: Options['pointer'];
  /** Called as the user's pointer moves over the plot, and with null as it leaves; never for update(). */
  onPointerChange?: Options['onPointerChange'];
};

type Name<T> = keyof T & string;
type OneOrMore<T> = T | readonly T[];
type NumberKey<R, N = number> = { [K in Name<R>]: NonNullable<R[K]> extends N ? K : never }[Name<R>];
type NumberColumn<C, N = number> = {
  [K in Name<C>]: C[K] extends ArrayLike<infer V> ? (NonNullable<V> extends N ? K : never) : never;
}[Name<C>];

export type Field<R> = Name<R> | Accessor<R>;
export type YField<R> = NumberKey<R> | Accessor<R>;

/** The pairs tuple lets an array literal of pairs be inferred as tuples rather than as rows. */
export type Input = Data | readonly (readonly [unknown, unknown])[];

export type RowProps<R> = Axes &
  SecondAxis &
  Base & {
    /** Row objects; missing, null or empty draws an empty frame. */
    data?: readonly R[] | null;
    /** The x field, by name or as an accessor `(row, index) => value`; guessed when left out. */
    x?: Field<R>;
    /** The field or fields of numbers drawn, one series each, by name or accessor; guessed when left out. */
    y?: OneOrMore<YField<R>>;
    /** The field or fields of numbers drawn against a right-hand axis, one more series each, by name or accessor; never guessed, and not with `series` or `errorBars`. */
    y2?: OneOrMore<YField<R>>;
    /** For long data, the field whose distinct values each give a series. */
    series?: Field<R>;
  };
export type ColumnProps<C> = Axes &
  SecondAxis &
  Base & {
    /** An object of columns, arrays or typed arrays of one length; missing, null or empty draws an empty frame. */
    data?: C | null;
    /** The x column, by name; guessed when left out. */
    x?: Name<C>;
    /** The column or columns of numbers drawn, one series each; guessed when left out. */
    y?: OneOrMore<NumberColumn<C>>;
    /** The column or columns of numbers drawn against a right-hand axis, one more series each; never guessed, and not with `series` or `errorBars`. */
    y2?: OneOrMore<NumberColumn<C>>;
    /** For long data, the column whose distinct values each give a series. */
    series?: Name<C>;
  };
type Positional = { x?: never; y?: never; y2?: never; y2Axis?: never; series?: never };
export type NumberProps = Axes &
  Base &
  Positional & {
    /** Numbers drawn against their index as the series `value`; missing, null or empty draws an empty frame. */
    data?: ArrayLike<number | null | undefined> | null;
  };
export type PairProps = Axes &
  Base &
  Positional & {
    /** `[x, y]` pairs drawn as the series `y`; a row of any other length throws. */
    data?: readonly (readonly unknown[])[] | null;
  };
/** Before any data is given the fields cannot be checked. */
type LooseProps = Axes &
  SecondAxis &
  Base & {
    data?: null;
    x?: string;
    y?: OneOrMore<string>;
    y2?: OneOrMore<string>;
    series?: string;
  };

export type Props<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseProps
  : [D] extends [ArrayLike<number | null | undefined>]
    ? NumberProps
    : [D] extends [readonly (readonly unknown[])[]]
      ? PairProps
      : [D] extends [readonly (infer R)[]]
        ? RowProps<R>
        : [D] extends [Record<string, ArrayLike<unknown>>]
          ? ColumnProps<D>
          : LooseProps);

type Curve = {
  /** How the points are joined: straight, stepped or smooth. @default 'linear' */
  curve?: LineOptions['curve'];
  /** Draws straight across a missing value instead of leaving a gap. @default false */
  join?: boolean;
};
export type ErrorBars<F> = {
  /** The field of numbers each error bar starts at, as a value on the y axis and not a distance from y; a row without it has no bar. */
  low: F;
  /** The field of numbers each error bar ends at, as a value on the y axis. */
  high: F;
  /** Half the length of the line across each end, in CSS pixels; 0 leaves the bare bar. @default 4 */
  cap?: number;
  /** The width of the lines in CSS pixels. @default 1 */
  width?: number;
};
export type ErrorBarsOn<F> = ErrorBars<F> & {
  /** The axis low and high are values on, the bars running along it. @default 'x' with a text y, else 'y' */
  axis?: 'x' | 'y';
};
export type LineProps<D> = Props<D> &
  ScaledAxes &
  Overlays &
  Curve & {
    /** Shades the area under each line down to the bottom of the plot: `true` for a faint fade of its colour, or a gradient. @default false */
    fill?: boolean | Gradient;
    /** An upright bar from low to high at each x, under the line and in its colour; takes one y, with series or without. */
    errorBars?: ErrorBars<NonNullable<Exclude<Props<D>['y'], readonly unknown[]>>>;
  };
export type AreaProps<D> = Props<D> &
  Overlays &
  Curve & {
    /** Stacks the series of each y axis, a missing value counting as zero; unstacked areas overlap, half transparent. @default false */
    stack?: boolean;
  };
export type BarProps<D> = Props<D> &
  Overlays & {
    /** Stacks the series, not with `y2`; unstacked bars stand side by side. @default false */
    stack?: boolean;
    /** An upright bar from low to high over each bar, in the text colour; takes one y, and no stacked series. */
    errorBars?: ErrorBars<NonNullable<Exclude<Props<D>['y'], readonly unknown[]>>>;
  };
type NotNumbersOrText<D> = [D] extends [readonly (infer R)[]]
  ? Exclude<Name<R>, NumberKey<R, number | string>>
  : [D] extends [Record<string, ArrayLike<unknown>>]
    ? Exclude<Name<D>, NumberColumn<D, number | string>>
    : never;
export type ScatterProps<D> = {
  /** Row objects, an object of columns, numbers or pairs; missing, null or empty draws an empty frame. */
  data?: D | null;
} & Omit<Props<D>, 'y'> &
  ScaledAxes &
  Overlays & {
    /** The one y field, of numbers, or of text for a band per category in order of first appearance, by name or, on rows, an accessor; the next number field when left out. A text y takes only `label` from `yAxis`. */
    y?: Exclude<Props<D>['x'], NotNumbersOrText<D>>;
    /** A tick is an upright line that answers no tooltip, click or selection, and takes no `ring` and no field of `r`. @default 'dot' */
    shape?: 'dot' | 'tick';
    /** The dot radius in CSS pixels, or a field of radii, where a row with a missing r is dropped; how far a tick reaches above and below its point. @default 4 */
    r?: number | NonNullable<Exclude<Props<D>['y'], readonly unknown[]>>;
    /** The dots' opacity, from 0 to 1. @default 1 */
    alpha?: number;
    /** Draws each dot as a ring of its colour this many CSS pixels wide; filled when left out. */
    ring?: number;
    /** A bar from low to high at each dot, under the dots and in their colour: upright, or lying down with `axis: 'x'` or a text y, where low and high are values on the x axis and x is numbers; takes one y, with series or without. */
    errorBars?: ErrorBarsOn<NonNullable<Exclude<Props<D>['y'], readonly unknown[]>>>;
  };

export type PartRowProps<R> = Base & {
  /** Row objects, one part each; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The field that names each part, by name or as an accessor `(row, index) => value`; the first text field when left out. */
  label?: Field<R>;
  /** The field of numbers the parts stand for, by name or accessor; the only number field when left out. */
  value?: YField<R>;
};
export type PartColumnProps<C> = Base & {
  /** An object of columns, arrays or typed arrays of one length, a part per index; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column that names each part; the first text column when left out. */
  label?: Name<C>;
  /** The column of numbers the parts stand for; the only number column when left out. */
  value?: NumberColumn<C>;
};
type PositionalPart = { label?: never; value?: never };
export type PartNumberProps = Base &
  PositionalPart & {
    /** Numbers, one unnamed part each; missing, null or empty draws an empty frame. */
    data?: ArrayLike<number | null | undefined> | null;
  };
export type PartPairProps = Base &
  PositionalPart & {
    /** `[label, value]` pairs, one part each; a row of any other length throws. */
    data?: readonly (readonly unknown[])[] | null;
  };
type LoosePartProps = Base & { data?: null; label?: string; value?: string };

export type PartProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LoosePartProps
  : [D] extends [ArrayLike<number | null | undefined>]
    ? PartNumberProps
    : [D] extends [readonly (readonly unknown[])[]]
      ? PartPairProps
      : [D] extends [readonly (infer R)[]]
        ? PartRowProps<R>
        : [D] extends [Record<string, ArrayLike<unknown>>]
          ? PartColumnProps<D>
          : LoosePartProps);

export type PieProps<D> = PartProps<D> & {
  /** The hole's share of the radius, from 0 to 1; above 0 the pie is a donut. @default 0 */
  inner?: number;
  /** Writes each slice's share on it, where there is room. @default true */
  text?: boolean;
  /** Each slice starts at this opacity, from 0 to 1, and reaches its full colour at its end; solid when left out. */
  sweep?: number;
};
export type FunnelProps<D> = PartProps<D> & {
  /** Writes each stage's name and its share of the first stage. @default true */
  text?: boolean;
  /** One blend over the whole funnel in place of a colour per stage. */
  fill?: Gradient;
};
export type RadialBarProps<D> = PartProps<D> & {
  /** What three quarters of a turn stand for, capping larger values; the largest rounded up when left out. */
  max?: number;
  /** Each bar starts at this opacity, from 0 to 1, and reaches its full colour at its end; solid when left out. */
  sweep?: number;
  /** The share of the radius left empty in the middle. @default 0.3 */
  inner?: number;
};

export type RadarRowProps<R> = Base & {
  /** Row objects, one spoke each; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The field that names each spoke, by name or as an accessor `(row, index) => value`; the first text field when left out. */
  x?: Field<R>;
  /** The field or fields of numbers drawn, one shape each, by name or accessor; every number field left when left out. */
  y?: OneOrMore<YField<R>>;
};
export type RadarColumnProps<C> = Base & {
  /** An object of columns, arrays or typed arrays of one length, a spoke per index; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column that names each spoke; the first text column when left out. */
  x?: Name<C>;
  /** The column or columns of numbers drawn, one shape each; every number column left when left out. */
  y?: OneOrMore<NumberColumn<C>>;
};
type PositionalRadar = { x?: never; y?: never };
export type RadarNumberProps = Base &
  PositionalRadar & {
    /** Numbers, one unnamed spoke each, drawn as the shape `value`; missing, null or empty draws an empty frame. */
    data?: ArrayLike<number | null | undefined> | null;
  };
export type RadarPairProps = Base &
  PositionalRadar & {
    /** `[name, value]` pairs, one spoke each, drawn as the shape `y`; a row of any other length throws. */
    data?: readonly (readonly unknown[])[] | null;
  };
type LooseRadarProps = Base & { data?: null; x?: string; y?: OneOrMore<string> };

export type RadarProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseRadarProps
  : [D] extends [ArrayLike<number | null | undefined>]
    ? RadarNumberProps
    : [D] extends [readonly (readonly unknown[])[]]
      ? RadarPairProps
      : [D] extends [readonly (infer R)[]]
        ? RadarRowProps<R>
        : [D] extends [Record<string, ArrayLike<unknown>>]
          ? RadarColumnProps<D>
          : LooseRadarProps) & {
    /** What the rim stands for, capping larger values; the largest rounded up to a whole step when left out. */
    max?: number;
    /** The opacity of each shape's filling, from 0 to 1; 0 leaves only the outline. @default 0.15 */
    fill?: number;
  };

export type HeatmapRowProps<R> = Base & {
  /** Row objects, one cell each, a later row for the same cell winning; a grid over 10,000,000 cells throws; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The field whose distinct values are the columns, text in order of first appearance, numbers and dates ascending, by name or as an accessor `(row, index) => value`; the first field of text or dates left when left out. */
  x?: Field<R>;
  /** The field whose distinct values are the rows of the grid, from the bottom up, text in order of first appearance, numbers and dates ascending, by name or accessor; the next field of text or dates when left out. */
  y?: Field<R>;
  /** The field of numbers the cells are coloured by, by name or accessor; the only number field left when left out. */
  value?: YField<R>;
};
export type HeatmapColumnProps<C> = Base & {
  /** An object of columns, arrays or typed arrays of one length, a cell per index, a later one for the same cell winning; a grid over 10,000,000 cells throws; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column whose distinct values are the columns of the grid, text in order of first appearance, numbers and dates ascending; the first column of text or dates left when left out. */
  x?: Name<C>;
  /** The column whose distinct values are the rows of the grid, from the bottom up, text in order of first appearance, numbers and dates ascending; the next column of text or dates when left out. */
  y?: Name<C>;
  /** The column of numbers the cells are coloured by; the only number column left when left out. */
  value?: NumberColumn<C>;
};
type LooseHeatmapProps = Base & { data?: readonly never[] | null; x?: string; y?: string; value?: string };

export type HeatmapProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseHeatmapProps
  : [D] extends [ArrayLike<number | null | undefined> | readonly (readonly unknown[])[]]
    ? LooseHeatmapProps
    : [D] extends [readonly (infer R)[]]
      ? HeatmapRowProps<R>
      : [D] extends [Record<string, ArrayLike<unknown>>]
        ? HeatmapColumnProps<D>
        : LooseHeatmapProps) & {
    /** The colours the values run through; from pale to dark blue over the values drawn when left out. */
    color?: ColorScale;
    /** Not used: the cells take their colours from `color`. */
    colors?: readonly string[];
    /** The strip of colours with the lowest and the highest value, or the legend's options. @default true */
    legend?: boolean | LegendOptions;
    /** The x axis, which names every column. */
    xAxis?: AxisProps;
    /** The y axis, which names every row of the grid. */
    yAxis?: AxisProps;
  };

type HistogramBase = Omit<Axes, 'xAxis'> &
  Base & {
    /** Settings for the x axis of the values counted. */
    xAxis?: Omit<XAxisProps, 'utc' | 'unit' | 'every'>;
  };
export type HistogramRowProps<R> = HistogramBase & {
  /** Row objects; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The field of numbers counted, by name or as an accessor `(row, index) => value`; the only number field when left out. */
  x?: YField<R>;
};
export type HistogramColumnProps<C> = HistogramBase & {
  /** An object of columns, arrays or typed arrays of one length; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column of numbers counted; the only number column when left out. */
  x?: NumberColumn<C>;
};
export type HistogramNumberProps = HistogramBase & {
  /** Numbers to count; missing, null or empty draws an empty frame. */
  data?: ArrayLike<number | null | undefined> | null;
  /** Not used: the numbers are the values counted. */
  x?: never;
};
type LooseHistogramProps = HistogramBase & { data?: readonly never[] | null; x?: string };

export type HistogramProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseHistogramProps
  : [D] extends [ArrayLike<number | null | undefined>]
    ? HistogramNumberProps
    : [D] extends [readonly (readonly unknown[])[]]
      ? LooseHistogramProps
      : [D] extends [readonly (infer R)[]]
        ? HistogramRowProps<R>
        : [D] extends [Record<string, ArrayLike<unknown>>]
          ? HistogramColumnProps<D>
          : LooseHistogramProps) & {
    /** How many equal bins span the values, at most 1,000,000, or the bin edges in ascending order; Sturges' rule when left out. */
    bins?: number | Col;
    /** The bars' colour, as the first of a list. */
    colors?: readonly string[];
    /** The y axis of the counts, titled `count` unless given a label. */
    yAxis?: YAxisProps;
  };

type BoxPlotBase = Base & {
  /** What the boxes are filled with: a colour, drawn faint, or a blend down each box; faint in the boxes' colour when left out. */
  fill?: Paint;
  /** The boxes' colour, as the first of a list. */
  colors?: readonly string[];
  /** The x axis, which names every box. */
  xAxis?: AxisProps;
  /** Settings for the y axis. */
  yAxis?: YAxisProps;
};
export type BoxPlotRowProps<R> = BoxPlotBase & {
  /** Row objects, one value each; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The field whose distinct values each give a box, in order of first appearance, by name or as an accessor `(row, index) => value`; the only text field when left out, where its values repeat; one box with no text field, or null. */
  x?: Field<R> | null;
  /** The field of numbers the boxes sum up, by name or accessor; the only number field when left out. */
  y?: YField<R>;
};
export type BoxPlotColumnProps<C> = BoxPlotBase & {
  /** An object of columns, arrays or typed arrays of one length; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column whose distinct values each give a box, in order of first appearance; the only text column when left out, where its values repeat; one box with no text column, or null. */
  x?: Name<C> | null;
  /** The column of numbers the boxes sum up; the only number column when left out. */
  y?: NumberColumn<C>;
};
type PositionalBoxPlot = { x?: never; y?: never };
export type BoxPlotNumberProps = BoxPlotBase &
  PositionalBoxPlot & {
    /** Numbers, drawn as one box; missing, null or empty draws an empty frame. */
    data?: ArrayLike<number | null | undefined> | null;
  };
export type BoxPlotPairProps = BoxPlotBase &
  PositionalBoxPlot & {
    /** `[group, value]` pairs; a row of any other length throws. */
    data?: readonly (readonly unknown[])[] | null;
  };
type LooseBoxPlotProps = BoxPlotBase & { data?: null; x?: string | null; y?: string };

export type BoxPlotProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseBoxPlotProps
  : [D] extends [ArrayLike<number | null | undefined>]
    ? BoxPlotNumberProps
    : [D] extends [readonly (readonly unknown[])[]]
      ? BoxPlotPairProps
      : [D] extends [readonly (infer R)[]]
        ? BoxPlotRowProps<R>
        : [D] extends [Record<string, ArrayLike<unknown>>]
          ? BoxPlotColumnProps<D>
          : LooseBoxPlotProps);

type CandlestickBase = Axes &
  Base & {
    /** The colour of a candle whose close is not below its open; the first of `colors` when left out. */
    up?: string;
    /** The colour of a candle whose close is below its open; the first of `colors` when left out. */
    down?: string;
    /** The candles' colour where `up` or `down` is left out, as the first of a list. */
    colors?: readonly string[];
    /** The x axis: dates, a category per candle for text, or a scale of numbers. */
    xAxis?: XAxisProps;
  };
export type CandlestickRowProps<R> = CandlestickBase & {
  /** Row objects, one candle each; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** Where each candle stands, by name or as an accessor `(row, index) => value`; the first field of dates, else of text, when left out. */
  x?: Field<R>;
  /** The field of prices each candle opens at, by name or accessor; the one called open, in any case, when left out. */
  open?: YField<R>;
  /** The field of highest prices, by name or accessor; the one called high, in any case, when left out. */
  high?: YField<R>;
  /** The field of lowest prices, by name or accessor; the one called low, in any case, when left out. */
  low?: YField<R>;
  /** The field of prices each candle closes at, by name or accessor; the one called close, in any case, when left out. */
  close?: YField<R>;
};
export type CandlestickColumnProps<C> = CandlestickBase & {
  /** An object of columns, arrays or typed arrays of one length, a candle per index; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column of where each candle stands; the first column of dates, else of text, when left out. */
  x?: Name<C>;
  /** The column of prices each candle opens at; the one called open, in any case, when left out. */
  open?: NumberColumn<C>;
  /** The column of highest prices; the one called high, in any case, when left out. */
  high?: NumberColumn<C>;
  /** The column of lowest prices; the one called low, in any case, when left out. */
  low?: NumberColumn<C>;
  /** The column of prices each candle closes at; the one called close, in any case, when left out. */
  close?: NumberColumn<C>;
};
type LooseCandlestickProps = CandlestickBase & {
  data?: readonly never[] | null;
  x?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
};

export type CandlestickProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseCandlestickProps
  : [D] extends [ArrayLike<number | null | undefined> | readonly (readonly unknown[])[]]
    ? LooseCandlestickProps
    : [D] extends [readonly (infer R)[]]
      ? CandlestickRowProps<R>
      : [D] extends [Record<string, ArrayLike<unknown>>]
        ? CandlestickColumnProps<D>
        : LooseCandlestickProps);

type ComboBase = Axes &
  ScaledAxes &
  Overlays &
  Base & {
    /** Series colours in the order `lines`, `bars`, `y2Lines`, `y2Bars`; `palette`, or `paletteDark` on the dark theme, by default. */
    colors?: readonly string[];
    /** Stacks the bars, not with both `bars` and `y2Bars`; unstacked bars stand side by side. @default false */
    stack?: boolean;
    /** Settings for the x axis: a category per row for text, else a scale of dates or numbers, on which the bars of one x take 0.6 of the smallest gap. */
    xAxis?: XAxisProps;
    /** Settings for the y axis; a log scale is for lines alone. */
    yAxis?: ScaledYAxisProps;
    /** Settings for the right-hand axis of `y2Lines` and `y2Bars`, drawn only with one of them; a log scale is for lines alone. */
    y2Axis?: ScaledYAxisProps;
  };
export type ComboRowProps<R> = ComboBase & {
  /** Row objects; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The x field, by name or as an accessor `(row, index) => value`; the first field of dates, else of text, else of numbers left, else the row index, when left out. */
  x?: Field<R>;
  /** The field or fields of numbers drawn as lines, by name or accessor. */
  lines?: OneOrMore<YField<R>>;
  /** The field or fields of numbers drawn as bars, by name or accessor. */
  bars?: OneOrMore<YField<R>>;
  /** The field or fields of numbers drawn as lines against a right-hand axis, by name or accessor. */
  y2Lines?: OneOrMore<YField<R>>;
  /** The field or fields of numbers drawn as bars against a right-hand axis, by name or accessor. */
  y2Bars?: OneOrMore<YField<R>>;
};
export type ComboColumnProps<C> = ComboBase & {
  /** An object of columns, arrays or typed arrays of one length; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The x column; the first column of dates, else of text, else of numbers left, else the row index, when left out. */
  x?: Name<C>;
  /** The column or columns of numbers drawn as lines. */
  lines?: OneOrMore<NumberColumn<C>>;
  /** The column or columns of numbers drawn as bars. */
  bars?: OneOrMore<NumberColumn<C>>;
  /** The column or columns of numbers drawn as lines against a right-hand axis. */
  y2Lines?: OneOrMore<NumberColumn<C>>;
  /** The column or columns of numbers drawn as bars against a right-hand axis. */
  y2Bars?: OneOrMore<NumberColumn<C>>;
};
type LooseComboProps = ComboBase & {
  data?: readonly never[] | null;
  x?: string;
  lines?: OneOrMore<string>;
  bars?: OneOrMore<string>;
  y2Lines?: OneOrMore<string>;
  y2Bars?: OneOrMore<string>;
};

export type ComboProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseComboProps
  : [D] extends [ArrayLike<number | null | undefined> | readonly (readonly unknown[])[]]
    ? LooseComboProps
    : [D] extends [readonly (infer R)[]]
      ? ComboRowProps<R>
      : [D] extends [Record<string, ArrayLike<unknown>>]
        ? ComboColumnProps<D>
        : LooseComboProps);

type SankeyBase = Base & {
  /** The nodes' colours in the order the links first name them, repeated when there are fewer. */
  colors?: readonly string[];
  /** Each ribbon runs from the colour of the node it leaves into the colour of the one it reaches. @default false */
  blend?: boolean;
  /** Writes the node names beside the nodes. @default true */
  text?: boolean;
  /** Not used: the nodes are named on the chart. */
  legend?: boolean | LegendOptions;
};
export type SankeyRowProps<R> = SankeyBase & {
  /** Row objects, one link each, a row without a source or a target dropped; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The field that names the node each link leaves, by name or as an accessor `(row, index) => value`; the first text field left when left out. */
  source?: Field<R>;
  /** The field that names the node each link reaches, by name or accessor; the next text field when left out. */
  target?: Field<R>;
  /** The field of numbers the ribbons are as wide as, by name or accessor; the only number field left when left out. */
  value?: YField<R>;
};
export type SankeyColumnProps<C> = SankeyBase & {
  /** An object of columns, arrays or typed arrays of one length, a link per index, one without a source or a target dropped; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The column that names the node each link leaves; the first text column left when left out. */
  source?: Name<C>;
  /** The column that names the node each link reaches; the next text column when left out. */
  target?: Name<C>;
  /** The column of numbers the ribbons are as wide as; the only number column left when left out. */
  value?: NumberColumn<C>;
};
type LooseSankeyProps = SankeyBase & {
  data?: readonly never[] | null;
  source?: string;
  target?: string;
  value?: string;
};

export type SankeyProps<D> = { data?: D | null } & (0 extends 1 & D
  ? LooseSankeyProps
  : [D] extends [ArrayLike<number | null | undefined> | readonly (readonly unknown[])[]]
    ? LooseSankeyProps
    : [D] extends [readonly (infer R)[]]
      ? SankeyRowProps<R>
      : [D] extends [Record<string, ArrayLike<unknown>>]
        ? SankeyColumnProps<D>
        : LooseSankeyProps);

type TreeProps = Base & {
  /** A root `{ name, value, children }`, or a list of roots, where only a node without children counts by its value; missing, null or empty draws an empty frame. */
  data?: Nested | readonly Nested[] | null;
  /** A colour for each root, or for each child of a single root, repeated when there are fewer. */
  colors?: readonly string[];
  /** Writes each node's name on it, where there is room. @default true */
  text?: boolean;
  /** Not used: the nodes are named on the chart. */
  legend?: boolean | LegendOptions;
};
export type TreemapProps = TreeProps & {
  /** Each branch starts at this opacity, from 0 to 1, at its top and reaches its full colour at the bottom; solid when left out. */
  shade?: number;
};
export type SunburstProps = TreeProps & {
  /** Each branch runs smoothly from its full colour at the centre to this opacity at the rim; lighter ring by ring when left out. */
  shade?: number;
};
