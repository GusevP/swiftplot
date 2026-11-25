import type { Options } from 'swiftplot';
import {
  areaChart,
  barChart,
  boxPlotChart,
  candlestickChart,
  comboChart,
  funnelChart,
  heatmapChart,
  histogramChart,
  lineChart,
  mount,
  pieChart,
  radarChart,
  radialBarChart,
  sankeyChart,
  scatterChart,
  sunburstChart,
  treemapChart,
  type AreaChartProps as AreaProps,
  type BarChartProps as BarProps,
  type BoxPlotChartProps as BoxPlotProps,
  type CandlestickChartProps as CandlestickProps,
  type ComboChartProps as ComboProps,
  type FunnelChartProps as FunnelProps,
  type HeatmapChartProps as HeatmapProps,
  type HistogramChartProps as HistogramProps,
  type LineChartProps as LineProps,
  type PieChartProps as PieProps,
  type RadarChartProps as RadarProps,
  type RadialBarChartProps as RadialBarProps,
  type SankeyChartProps as SankeyProps,
  type ScatterChartProps as ScatterProps,
  type SunburstChartProps as SunburstProps,
  type TreemapChartProps as TreemapProps,
} from 'swiftplot/charts';
import type { AllowedComponentProps, VNode, VNodeProps } from 'vue';

import { bind, type Mount, type OverlaySlot } from './bind.js';

/** The chart's change callbacks arrive as Vue listeners: `@click`, `@layout`, `@hover`, `@error` and `v-model:view`, `:hidden`, `:pointer`. */
export type Listeners = {
  onClick?: Options['onClick'];
  onLayout?: Options['onLayout'];
  onHover?: Options['onHover'];
  onError?: (error: unknown) => void;
  'onUpdate:view'?: Options['onViewChange'];
  'onUpdate:hidden'?: Options['onHiddenChange'];
  'onUpdate:pointer'?: Options['onPointerChange'];
  onViewChange?: never;
  onHiddenChange?: never;
  onPointerChange?: never;
};
/** The listeners of a chart whose axes do not move, so that has no view. */
export type StillListeners = Omit<Listeners, 'onUpdate:view'>;
export type LineChartProps<D = undefined> = LineProps<D> & Listeners;
export type AreaChartProps<D = undefined> = AreaProps<D> & Listeners;
export type BarChartProps<D = undefined> = BarProps<D> & Listeners;
export type ScatterChartProps<D = undefined> = ScatterProps<D> & Listeners;
export type PieChartProps<D = undefined> = PieProps<D> & StillListeners;
export type FunnelChartProps<D = undefined> = FunnelProps<D> & StillListeners;
export type RadialBarChartProps<D = undefined> = RadialBarProps<D> & StillListeners;
export type RadarChartProps<D = undefined> = RadarProps<D> & StillListeners;
export type HeatmapChartProps<D = undefined> = HeatmapProps<D> & StillListeners;
export type HistogramChartProps<D = undefined> = HistogramProps<D> & Listeners;
export type BoxPlotChartProps<D = undefined> = BoxPlotProps<D> & StillListeners;
export type CandlestickChartProps<D = undefined> = CandlestickProps<D> & Listeners;
export type ComboChartProps<D = undefined> = ComboProps<D> & Listeners;
export type SankeyChartProps<D = undefined> = SankeyProps<D> & StillListeners;
export type TreemapChartProps = TreemapProps & StillListeners;
export type SunburstChartProps = SunburstProps & StillListeners;
export type PlotProps = Options & Listeners;

type Host = AllowedComponentProps & VNodeProps & { id?: string };
type Context = { slots: { default?: OverlaySlot } };

const flag = { type: [Boolean, Object], default: undefined };
const bool = { type: Boolean, default: undefined };
const base = {
  data: null,
  dataVersion: null,
  colors: null,
  theme: null,
  tooltip: bool,
  legend: flag,
  animate: flag,
  dim: { type: [Number, Boolean], default: undefined },
  width: null,
  height: null,
  margin: null,
  description: null,
  hidden: null,
  selected: null,
  pointer: null,
};
const axes = { xAxis: null, yAxis: null, zoom: flag, view: null };
const overlays = { rules: null, zones: null, brush: flag };
const xy = { ...base, ...axes, ...overlays, x: null, y: null, y2: null, series: null, y2Axis: null };

export const LineChart = bind(lineChart as Mount<LineProps<unknown>>, {
  ...xy,
  curve: null,
  fill: flag,
  errorBars: null,
  join: bool,
}) as unknown as <D = undefined>(props: LineChartProps<D> & Host, ctx?: Context) => VNode;
export const AreaChart = bind(areaChart as Mount<AreaProps<unknown>>, {
  ...xy,
  curve: null,
  join: bool,
  stack: bool,
}) as unknown as <D = undefined>(props: AreaChartProps<D> & Host, ctx?: Context) => VNode;
export const BarChart = bind(barChart as Mount<BarProps<unknown>>, {
  ...xy,
  stack: bool,
  errorBars: null,
}) as unknown as <D = undefined>(props: BarChartProps<D> & Host, ctx?: Context) => VNode;
export const ScatterChart = bind(scatterChart as Mount<ScatterProps<unknown>>, {
  ...xy,
  r: null,
  alpha: null,
  ring: null,
  shape: null,
  errorBars: null,
}) as unknown as <D = undefined>(props: ScatterChartProps<D> & Host, ctx?: Context) => VNode;
export const PieChart = bind(pieChart as Mount<PieProps<unknown>>, {
  ...base,
  label: null,
  value: null,
  inner: null,
  text: bool,
  sweep: null,
}) as unknown as <D = undefined>(props: PieChartProps<D> & Host, ctx?: Context) => VNode;
export const FunnelChart = bind(funnelChart as Mount<FunnelProps<unknown>>, {
  ...base,
  label: null,
  value: null,
  text: bool,
  fill: null,
}) as unknown as <D = undefined>(props: FunnelChartProps<D> & Host, ctx?: Context) => VNode;
export const RadialBarChart = bind(radialBarChart as Mount<RadialBarProps<unknown>>, {
  ...base,
  label: null,
  value: null,
  max: null,
  sweep: null,
  inner: null,
}) as unknown as <D = undefined>(props: RadialBarChartProps<D> & Host, ctx?: Context) => VNode;
export const RadarChart = bind(radarChart as Mount<RadarProps<unknown>>, {
  ...base,
  x: null,
  y: null,
  max: null,
  fill: null,
}) as unknown as <D = undefined>(props: RadarChartProps<D> & Host, ctx?: Context) => VNode;
export const HeatmapChart = bind(heatmapChart as Mount<HeatmapProps<unknown>>, {
  ...base,
  x: null,
  y: null,
  value: null,
  color: null,
  xAxis: null,
  yAxis: null,
}) as unknown as <D = undefined>(props: HeatmapChartProps<D> & Host, ctx?: Context) => VNode;
export const HistogramChart = bind(histogramChart as Mount<HistogramProps<unknown>>, {
  ...base,
  ...axes,
  x: null,
  bins: null,
}) as unknown as <D = undefined>(props: HistogramChartProps<D> & Host, ctx?: Context) => VNode;
export const BoxPlotChart = bind(boxPlotChart as Mount<BoxPlotProps<unknown>>, {
  ...base,
  x: null,
  y: null,
  fill: null,
  xAxis: null,
  yAxis: null,
}) as unknown as <D = undefined>(props: BoxPlotChartProps<D> & Host, ctx?: Context) => VNode;
export const CandlestickChart = bind(candlestickChart as Mount<CandlestickProps<unknown>>, {
  ...base,
  ...axes,
  x: null,
  open: null,
  high: null,
  low: null,
  close: null,
  up: null,
  down: null,
}) as unknown as <D = undefined>(props: CandlestickChartProps<D> & Host, ctx?: Context) => VNode;
export const ComboChart = bind(comboChart as Mount<ComboProps<unknown>>, {
  ...base,
  ...axes,
  ...overlays,
  y2Axis: null,
  x: null,
  lines: null,
  bars: null,
  y2Lines: null,
  y2Bars: null,
  stack: bool,
}) as unknown as <D = undefined>(props: ComboChartProps<D> & Host, ctx?: Context) => VNode;
export const SankeyChart = bind(sankeyChart as Mount<SankeyProps<unknown>>, {
  ...base,
  source: null,
  target: null,
  value: null,
  blend: bool,
  text: bool,
}) as unknown as <D = undefined>(props: SankeyChartProps<D> & Host, ctx?: Context) => VNode;
export const TreemapChart = bind(treemapChart as Mount<TreemapProps>, {
  ...base,
  text: bool,
  shade: null,
}) as unknown as (props: TreemapChartProps & Host, ctx?: Context) => VNode;
export const SunburstChart = bind(sunburstChart as Mount<SunburstProps>, {
  ...base,
  text: bool,
  shade: null,
}) as unknown as (props: SunburstChartProps & Host, ctx?: Context) => VNode;
export const Plot = bind(mount, {
  width: null,
  height: null,
  margin: null,
  x: null,
  y: null,
  y2: null,
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
}) as unknown as (props: PlotProps & Host, ctx?: Context) => VNode;
