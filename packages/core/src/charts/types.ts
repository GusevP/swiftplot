import type { AnimateOptions } from '../features/animate.js';
import type { LegendOptions } from '../features/legend.js';
import type { ZoomOptions } from '../features/zoom.js';
import type { LineOptions } from '../marks/line.js';
import type { TimeOptions } from '../scales/time.js';
import type { Theme } from '../theme.js';
import type { Axis, Options } from '../types.js';
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
  /** On numbers and dates, the text of each tick and of x in a scatter's tooltip; text and bars ignore it. */
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

export type Base = {
  /** Bump after changing the data in place, so that it is converted again. */
  dataVersion?: number;
  /** Settings for the x axis; which apply depends on whether x is numbers, dates or text. */
  xAxis?: XAxisProps;
  /** Settings for the y axis. */
  yAxis?: YAxisProps;
  /** Series colours in order; `palette`, or `paletteDark` on the dark theme, by default. */
  colors?: readonly string[];
  /** 'auto' follows the CSS `color-scheme` of the chart's element. @default 'auto' */
  theme?: 'auto' | 'light' | 'dark' | Theme;
  /** The hover tooltip, with values in the y axis format, else two decimals at most. @default true */
  tooltip?: boolean;
  /** The legend, which hides and shows series, or its options; shown with two or more series. @default true */
  legend?: boolean | LegendOptions;
  /** Zoom and pan, or their options. @default false */
  zoom?: boolean | ZoomOptions;
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
  /** The part of each axis shown, in its values; kept by the chart unless given. */
  view?: Options['view'];
  /** Called with the window shown once zoom or pan has moved it; never for update(). */
  onViewChange?: Options['onViewChange'];
  /** The series not drawn, by name; kept by the chart unless given. */
  hidden?: string[];
  /** Called with the hidden series once the legend has changed them; never for update(). */
  onHiddenChange?: Options['onHiddenChange'];
  /** Rows the app has picked out: bars and dots outline them, while a line or an area is drawn as before. */
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
type NumberKey<R> = { [K in Name<R>]: NonNullable<R[K]> extends number ? K : never }[Name<R>];
type NumberColumn<C> = {
  [K in Name<C>]: C[K] extends ArrayLike<infer V> ? (NonNullable<V> extends number ? K : never) : never;
}[Name<C>];

export type Field<R> = Name<R> | Accessor<R>;
export type YField<R> = NumberKey<R> | Accessor<R>;

/** The pairs tuple lets an array literal of pairs be inferred as tuples rather than as rows. */
export type Input = Data | readonly (readonly [unknown, unknown])[];

export type RowProps<R> = Base & {
  /** Row objects; missing, null or empty draws an empty frame. */
  data?: readonly R[] | null;
  /** The x field, by name or as an accessor `(row, index) => value`; guessed when left out. */
  x?: Field<R>;
  /** The field or fields of numbers drawn, one series each, by name or accessor; guessed when left out. */
  y?: OneOrMore<YField<R>>;
  /** For long data, the field whose distinct values each give a series. */
  series?: Field<R>;
};
export type ColumnProps<C> = Base & {
  /** An object of columns, arrays or typed arrays of one length; missing, null or empty draws an empty frame. */
  data?: C | null;
  /** The x column, by name; guessed when left out. */
  x?: Name<C>;
  /** The column or columns of numbers drawn, one series each; guessed when left out. */
  y?: OneOrMore<NumberColumn<C>>;
  /** For long data, the column whose distinct values each give a series. */
  series?: Name<C>;
};
type Positional = { x?: never; y?: never; series?: never };
export type NumberProps = Base &
  Positional & {
    /** Numbers drawn against their index as the series `value`; missing, null or empty draws an empty frame. */
    data?: ArrayLike<number | null | undefined> | null;
  };
export type PairProps = Base &
  Positional & {
    /** `[x, y]` pairs drawn as the series `y`; a row of any other length throws. */
    data?: readonly (readonly unknown[])[] | null;
  };
/** Before any data is given the fields cannot be checked. */
type LooseProps = Base & { data?: null; x?: string; y?: OneOrMore<string>; series?: string };

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
export type LineProps<D> = Props<D> & Curve;
export type AreaProps<D> = Props<D> &
  Curve & {
    /** Stacks the series, a missing value counting as zero; unstacked areas overlap, half transparent. @default false */
    stack?: boolean;
  };
export type BarProps<D> = Props<D> & {
  /** Stacks the series; unstacked bars stand side by side. @default false */
  stack?: boolean;
};
export type ScatterProps<D> = Props<D> & {
  /** The one y field, by name or, on rows, an accessor; the next number field when left out. */
  y?: Exclude<Props<D>['y'], readonly unknown[]>;
  /** The dot radius in CSS pixels, or a field of radii; a row with a missing r is dropped. @default 4 */
  r?: number | NonNullable<Exclude<Props<D>['y'], readonly unknown[]>>;
};
