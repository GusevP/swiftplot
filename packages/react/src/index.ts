'use client';
import type { ReactElement } from 'react';
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

import { bind, type HostProps, type Mount } from './bind.js';

export type { HostProps };
export type LineChartProps<D = undefined> = LineProps<D> & HostProps;
export type AreaChartProps<D = undefined> = AreaProps<D> & HostProps;
export type BarChartProps<D = undefined> = BarProps<D> & HostProps;
export type ScatterChartProps<D = undefined> = ScatterProps<D> & HostProps;
export type PieChartProps<D = undefined> = PieProps<D> & HostProps;
export type FunnelChartProps<D = undefined> = FunnelProps<D> & HostProps;
export type RadialBarChartProps<D = undefined> = RadialBarProps<D> & HostProps;
export type RadarChartProps<D = undefined> = RadarProps<D> & HostProps;
export type HeatmapChartProps<D = undefined> = HeatmapProps<D> & HostProps;
export type HistogramChartProps<D = undefined> = HistogramProps<D> & HostProps;
export type BoxPlotChartProps<D = undefined> = BoxPlotProps<D> & HostProps;
export type CandlestickChartProps<D = undefined> = CandlestickProps<D> & HostProps;
export type ComboChartProps<D = undefined> = ComboProps<D> & HostProps;
export type SankeyChartProps<D = undefined> = SankeyProps<D> & HostProps;
export type TreemapChartProps = TreemapProps & HostProps;
export type SunburstChartProps = SunburstProps & HostProps;
export type PlotProps = Options & HostProps;

export const LineChart = /*#__PURE__*/ bind(lineChart as Mount<LineProps<unknown>>) as <D = undefined>(
  props: LineChartProps<D>,
) => ReactElement;
export const AreaChart = /*#__PURE__*/ bind(areaChart as Mount<AreaProps<unknown>>) as <D = undefined>(
  props: AreaChartProps<D>,
) => ReactElement;
export const BarChart = /*#__PURE__*/ bind(barChart as Mount<BarProps<unknown>>) as <D = undefined>(
  props: BarChartProps<D>,
) => ReactElement;
export const ScatterChart = /*#__PURE__*/ bind(scatterChart as Mount<ScatterProps<unknown>>) as <
  D = undefined,
>(
  props: ScatterChartProps<D>,
) => ReactElement;
export const PieChart = /*#__PURE__*/ bind(pieChart as Mount<PieProps<unknown>>) as <D = undefined>(
  props: PieChartProps<D>,
) => ReactElement;
export const FunnelChart = /*#__PURE__*/ bind(funnelChart as Mount<FunnelProps<unknown>>) as <D = undefined>(
  props: FunnelChartProps<D>,
) => ReactElement;
export const RadialBarChart = /*#__PURE__*/ bind(radialBarChart as Mount<RadialBarProps<unknown>>) as <
  D = undefined,
>(
  props: RadialBarChartProps<D>,
) => ReactElement;
export const RadarChart = /*#__PURE__*/ bind(radarChart as Mount<RadarProps<unknown>>) as <D = undefined>(
  props: RadarChartProps<D>,
) => ReactElement;
export const HeatmapChart = /*#__PURE__*/ bind(heatmapChart as Mount<HeatmapProps<unknown>>) as <
  D = undefined,
>(
  props: HeatmapChartProps<D>,
) => ReactElement;
export const HistogramChart = /*#__PURE__*/ bind(histogramChart as Mount<HistogramProps<unknown>>) as <
  D = undefined,
>(
  props: HistogramChartProps<D>,
) => ReactElement;
export const BoxPlotChart = /*#__PURE__*/ bind(boxPlotChart as Mount<BoxPlotProps<unknown>>) as <
  D = undefined,
>(
  props: BoxPlotChartProps<D>,
) => ReactElement;
export const CandlestickChart = /*#__PURE__*/ bind(candlestickChart as Mount<CandlestickProps<unknown>>) as <
  D = undefined,
>(
  props: CandlestickChartProps<D>,
) => ReactElement;
export const ComboChart = /*#__PURE__*/ bind(comboChart as Mount<ComboProps<unknown>>) as <D = undefined>(
  props: ComboChartProps<D>,
) => ReactElement;
export const SankeyChart = /*#__PURE__*/ bind(sankeyChart as Mount<SankeyProps<unknown>>) as <D = undefined>(
  props: SankeyChartProps<D>,
) => ReactElement;
export const TreemapChart = /*#__PURE__*/ bind(treemapChart as Mount<TreemapProps>) as (
  props: TreemapChartProps,
) => ReactElement;
export const SunburstChart = /*#__PURE__*/ bind(sunburstChart as Mount<SunburstProps>) as (
  props: SunburstChartProps,
) => ReactElement;
export const Plot = /*#__PURE__*/ bind(mount) as (props: PlotProps) => ReactElement;
