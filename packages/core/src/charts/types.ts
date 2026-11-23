import type { AnimateOptions } from '../features/animate.js';
import type { LegendOptions } from '../features/legend.js';
import type { ZoomOptions } from '../features/zoom.js';
import type { LineOptions } from '../marks/line.js';
import type { TimeOptions } from '../scales/time.js';
import type { Theme } from '../theme.js';
import type { Axis, Options } from '../types.js';
import type { Accessor, Data } from './source.js';

export type YAxisProps = {
  label?: string;
  domain?: Axis['domain'];
  step?: number;
  format?: (v: number) => string;
  fit?: Axis['fit'];
};
export type XAxisProps = YAxisProps & { utc?: boolean; unit?: TimeOptions['unit']; every?: number };

export type Base = {
  dataVersion?: number;
  xAxis?: XAxisProps;
  yAxis?: YAxisProps;
  colors?: readonly string[];
  theme?: 'auto' | 'light' | 'dark' | Theme;
  tooltip?: boolean;
  legend?: boolean | LegendOptions;
  zoom?: boolean | ZoomOptions;
  animate?: boolean | AnimateOptions;
  width?: number;
  height?: number;
  margin?: Options['margin'];
  description?: string;
  view?: Options['view'];
  onViewChange?: Options['onViewChange'];
  hidden?: string[];
  onHiddenChange?: Options['onHiddenChange'];
  selected?: Options['selected'];
  onClick?: Options['onClick'];
  pointer?: Options['pointer'];
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
  data?: readonly R[] | null;
  x?: Field<R>;
  y?: OneOrMore<YField<R>>;
  series?: Field<R>;
};
export type ColumnProps<C> = Base & {
  data?: C | null;
  x?: Name<C>;
  y?: OneOrMore<NumberColumn<C>>;
  series?: Name<C>;
};
type Positional = { x?: never; y?: never; series?: never };
export type NumberProps = Base & Positional & { data?: ArrayLike<number | null | undefined> | null };
export type PairProps = Base & Positional & { data?: readonly (readonly unknown[])[] | null };
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

type Curve = { curve?: LineOptions['curve']; join?: boolean };
export type LineProps<D> = Props<D> & Curve;
export type AreaProps<D> = Props<D> & Curve & { stack?: boolean };
export type BarProps<D> = Props<D> & { stack?: boolean };
export type ScatterProps<D> = Props<D> & {
  y?: Exclude<Props<D>['y'], readonly unknown[]>;
  r?: number | NonNullable<Exclude<Props<D>['y'], readonly unknown[]>>;
};
