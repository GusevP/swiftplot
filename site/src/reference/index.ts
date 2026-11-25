import types from '../../../packages/core/src/charts/types.ts?raw';
import { chartNames, referencePath, type ChartName } from '../examples/define';
import { featureNames, markNames } from '../examples/tree';
import { extract, extractApi, type Entry } from './extract';

export const reference = extract(types);

export const intros: Record<ChartName, string> = {
  lineChart:
    'Draws a line for each series from data. Fields, axes, colours, the tooltip and the legend have defaults.',
  areaChart: 'Draws a filled area for each series from data, overlapping or stacked with stack.',
  barChart: 'Draws bars from data, side by side for each x or stacked with stack.',
  scatterChart: 'Draws a dot for each row from data, with a fixed radius or one read from a field.',
  pieChart: 'Draws a pie, or a donut with inner, from rows of a label and a value, a slice each.',
  funnelChart: 'Draws a funnel from rows of a label and a value, a stage each from the top down.',
  radialBarChart: 'Draws bars round a circle, one ring for each row of a label and a value.',
  radarChart: 'Draws a shape for each field of numbers, across a spoke for each row.',
  heatmapChart:
    'Draws a grid of cells coloured by a value, from rows that name the column and the row of each.',
  histogramChart: 'Counts a field of numbers into bins and draws a bar for each.',
  boxPlotChart: 'Draws a box for each group of values: its median, quartiles and extremes.',
  candlestickChart: 'Draws a candle for each row of open, high, low and close prices.',
  sankeyChart: 'Draws flows between nodes, from rows of a source, a target and a value.',
  treemapChart: 'Draws a tree of { name, value, children } as rectangles inside rectangles, sized by value.',
  sunburstChart:
    'Draws a tree of { name, value, children } as rings, each node inside the angle of its parent.',
  comboChart: 'Draws bars and lines together over one x, on one or two y axes.',
};

const core = import.meta.glob<string>(
  ['../../../packages/core/src/*.ts', '../../../packages/core/src/{marks,features,scales}/*.ts'],
  { query: '?raw', import: 'default', eager: true },
);

export const scaleNames = ['Axis', 'time', 'log', 'band', 'bare', 'sequential'] as const;
export const helperNames = [
  'gradient',
  'bin',
  'stack',
  'bands',
  'fiveNumbers',
  'fromTree',
  'fromLinks',
] as const;
export const coreFiles = Object.fromEntries(
  Object.entries(core).map(([path, text]) => [path.split('/core/src/')[1]!, text]),
);
export const api = extractApi(coreFiles, [
  'plot',
  ...markNames,
  ...featureNames,
  ...scaleNames,
  ...helperNames,
]);

export const scalesIntro =
  'The axes plot() takes as x, y and y2, the colour scale a heatmap takes, and the helpers that turn data into the columns a mark takes.';

/** The entries of each page an example's options can link to: the easy charts, plot, each mark and each feature. */
export const pages: Readonly<Record<string, readonly Entry[]>> = {
  ...reference,
  ...Object.fromEntries(['plot', ...markNames, ...featureNames].map(n => [n, api[n]!.entries])),
};

const links = (names: readonly string[]) => names.map(n => ({ href: referencePath(n), label: n }));
export const sidebar = [
  { label: 'Charts from data', links: links(chartNames) },
  { label: 'Explicit API', links: links(['plot', 'scales', ...markNames]) },
  { label: 'Features', links: links(featureNames) },
];
