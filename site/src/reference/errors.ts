import guide from '../../../llms-full.txt?raw';
import type { ChartName } from '../examples/define';

export type ErrorRow = { messages: string[]; cause: string; fix: string };

const spans = (cell: string) => cell.split('`').filter((_, i) => i % 2);

const cellsOf = (heading: string) =>
  (guide.split(`### ${heading}\n`)[1]?.split('\n### ')[0] ?? '')
    .split('\n')
    .filter(l => l.startsWith('| '))
    .slice(1)
    .map(l =>
      l
        .slice(1, -1)
        .split(' | ')
        .map(c => c.trim()),
    );

export const table = cellsOf('Errors and their fixes').map(
  ([message = '', cause = '', fix = '']): ErrorRow => ({
    messages: spans(message),
    cause,
    fix,
  }),
);

const parts: readonly ChartName[] = ['pieChart', 'funnelChart', 'radialBarChart'];
const trees: readonly ChartName[] = ['treemapChart', 'sunburstChart'];
const rows: readonly ChartName[] = [
  ...parts,
  'radarChart',
  'heatmapChart',
  'histogramChart',
  'boxPlotChart',
  'candlestickChart',
  'sankeyChart',
  'comboChart',
];

const charts: Readonly<Record<string, readonly ChartName[]>> = {
  line: ['lineChart'],
  area: ['areaChart'],
  bar: ['barChart'],
  scatter: ['scatterChart'],
  pie: ['pieChart'],
  funnel: ['funnelChart'],
  'radial bars': ['radialBarChart'],
  radar: ['radarChart'],
  heatmap: ['heatmapChart'],
  histogram: ['histogramChart'],
  'box plot': ['boxPlotChart'],
  candlestick: ['candlestickChart'],
  sankey: ['sankeyChart'],
  treemap: ['treemapChart'],
  sunburst: ['sunburstChart'],
  combo: ['comboChart'],
  'charts without axes': [...parts, 'radarChart', 'sankeyChart', ...trees],
};

const chartsOf = (name: string) => {
  if (!charts[name]) throw new Error(`llms-full.txt: no chart is called "${name}"`);
  return charts[name];
};

export const byChart = cellsOf('More errors, by chart').map(
  ([on = '', message = '', cause = '', fix = '']) => ({
    on: on.split(', ').flatMap(chartsOf),
    messages: spans(message),
    cause,
    fix,
  }),
);

export const xyOnly = [
  'there is no field of numbers for y',
  '"<name>" is text, so the rows look like long data',
  'with series there is one y',
];

const first: readonly ChartName[] = ['lineChart', 'areaChart', 'barChart', 'scatterChart'];

const shared: Readonly<Record<string, readonly ChartName[]>> = {
  'there is no field of numbers for y': ['radarChart', 'boxPlotChart'],
  'there is no field "<name>"': rows,
  '"<name>" is text, not numbers': rows,
  'Row N is not an [x, y] pair': [...parts, 'radarChart', 'boxPlotChart'],
  'Columns differ in length': rows,
  'Accessors work on row objects only': rows,
};

export function errorsFor(chart: ChartName): ErrorRow[] {
  const applies = (m: string) => {
    if (!first.includes(chart)) return !!shared[m]?.includes(chart);
    return chart === 'scatterChart' ? !xyOnly.includes(m) : !m.includes('a scatter chart');
  };
  return [
    ...table
      .map(row => ({ ...row, messages: row.messages.filter(applies) }))
      .filter(row => row.messages.length),
    ...byChart
      .filter(r => r.on.includes(chart))
      .map(({ messages, cause, fix }) => ({ messages, cause, fix })),
  ];
}
