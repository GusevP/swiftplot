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
