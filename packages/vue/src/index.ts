import type { Options } from 'swiftplot';
import {
  areaChart,
  barChart,
  lineChart,
  mount,
  scatterChart,
  type AreaChartProps as AreaProps,
  type BarChartProps as BarProps,
  type LineChartProps as LineProps,
  type ScatterChartProps as ScatterProps,
} from 'swiftplot/charts';
import type { AllowedComponentProps, VNode, VNodeProps } from 'vue';

import { bind, type Mount } from './bind.js';

/** The chart's change callbacks arrive as Vue listeners: `@click`, `@error` and `v-model:view`, `:hidden`, `:pointer`. */
export type Listeners = {
  onClick?: Options['onClick'];
  onError?: (error: unknown) => void;
  'onUpdate:view'?: Options['onViewChange'];
  'onUpdate:hidden'?: Options['onHiddenChange'];
  'onUpdate:pointer'?: Options['onPointerChange'];
  onViewChange?: never;
  onHiddenChange?: never;
  onPointerChange?: never;
};
export type LineChartProps<D = undefined> = LineProps<D> & Listeners;
export type AreaChartProps<D = undefined> = AreaProps<D> & Listeners;
export type BarChartProps<D = undefined> = BarProps<D> & Listeners;
export type ScatterChartProps<D = undefined> = ScatterProps<D> & Listeners;
export type PlotProps = Options & Listeners;

type Host = AllowedComponentProps & VNodeProps & { id?: string };

const flag = { type: [Boolean, Object], default: undefined };
const bool = { type: Boolean, default: undefined };
const common = {
  data: null,
  x: null,
  y: null,
  series: null,
  dataVersion: null,
  xAxis: null,
  yAxis: null,
  colors: null,
  theme: null,
  tooltip: bool,
  legend: flag,
  zoom: flag,
  animate: flag,
  width: null,
  height: null,
  margin: null,
  description: null,
  view: null,
  hidden: null,
  selected: null,
  pointer: null,
};

export const LineChart = bind(lineChart as Mount<LineProps<unknown>>, {
  ...common,
  curve: null,
  join: bool,
}) as unknown as <D = undefined>(props: LineChartProps<D> & Host) => VNode;
export const AreaChart = bind(areaChart as Mount<AreaProps<unknown>>, {
  ...common,
  curve: null,
  join: bool,
  stack: bool,
}) as unknown as <D = undefined>(props: AreaChartProps<D> & Host) => VNode;
export const BarChart = bind(barChart as Mount<BarProps<unknown>>, { ...common, stack: bool }) as unknown as <
  D = undefined,
>(
  props: BarChartProps<D> & Host,
) => VNode;
export const ScatterChart = bind(scatterChart as Mount<ScatterProps<unknown>>, {
  ...common,
  r: null,
}) as unknown as <D = undefined>(props: ScatterChartProps<D> & Host) => VNode;
export const Plot = bind(mount, {
  width: null,
  height: null,
  margin: null,
  x: null,
  y: null,
  frame: null,
  marks: null,
  use: null,
  description: null,
  dim: null,
  theme: null,
  view: null,
  hidden: null,
  selected: null,
  pointer: null,
}) as unknown as (props: PlotProps & Host) => VNode;
