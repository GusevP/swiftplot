'use client';
import type { ReactElement } from 'react';
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

import { bind, type HostProps, type Mount } from './bind.js';

export type { HostProps };
export type LineChartProps<D = undefined> = LineProps<D> & HostProps;
export type AreaChartProps<D = undefined> = AreaProps<D> & HostProps;
export type BarChartProps<D = undefined> = BarProps<D> & HostProps;
export type ScatterChartProps<D = undefined> = ScatterProps<D> & HostProps;
export type PlotProps = Options & HostProps;

export const LineChart = bind(lineChart as Mount<LineProps<unknown>>) as <D = undefined>(
  props: LineChartProps<D>,
) => ReactElement;
export const AreaChart = bind(areaChart as Mount<AreaProps<unknown>>) as <D = undefined>(
  props: AreaChartProps<D>,
) => ReactElement;
export const BarChart = bind(barChart as Mount<BarProps<unknown>>) as <D = undefined>(
  props: BarChartProps<D>,
) => ReactElement;
export const ScatterChart = bind(scatterChart as Mount<ScatterProps<unknown>>) as <D = undefined>(
  props: ScatterChartProps<D>,
) => ReactElement;
export const Plot = bind(mount) as (props: PlotProps) => ReactElement;
