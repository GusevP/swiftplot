// Runs in Node, which has no DOM, against the built library that ships.
import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as charts from '../dist/charts/index.js';
import * as lib from '../dist/index.js';

deepStrictEqual(
  Object.keys(lib).sort(),
  [
    'animate',
    'arcs',
    'area',
    'band',
    'bands',
    'bar',
    'bare',
    'bin',
    'box',
    'candlestick',
    'brand',
    'brush',
    'dark',
    'dots',
    'errorBars',
    'fiveNumbers',
    'fromLinks',
    'fromTree',
    'funnel',
    'gradient',
    'heatmap',
    'legend',
    'light',
    'line',
    'log',
    'palette',
    'paletteDark',
    'plot',
    'radar',
    'radialBars',
    'rule',
    'sankey',
    'sequential',
    'stack',
    'sunburst',
    'ticks',
    'time',
    'tooltip',
    'treemap',
    'zone',
    'zoom',
  ].sort(),
  'exports',
);

const binned = lib.bin([1, 2, 3, 4, 5, 6, 7, 8]);
deepStrictEqual([...binned.y2], [2, 2, 2, 2], 'bin');
const [low, high] = lib.stack([
  [1, -2],
  [3, 4],
]);
deepStrictEqual(
  [[...low.y1], [...low.y2], [...high.y1], [...high.y2]],
  [
    [0, 0],
    [1, -2],
    [1, 0],
    [4, 4],
  ],
  'stack',
);
const stats = lib.fiveNumbers([[5, 1, 3, 2, 4, NaN]]);
deepStrictEqual(
  [stats.min[0], stats.q1[0], stats.median[0], stats.q3[0], stats.max[0]],
  [1, 2, 3, 4, 5],
  'fiveNumbers',
);
const tree = lib.fromTree({
  name: 'all',
  children: [
    { name: 'a', value: 2 },
    { name: 'b', value: 3 },
  ],
});
deepStrictEqual(tree, { nodes: ['all', 'a', 'b'], parent: [-1, 0, 0], value: [0, 2, 3] }, 'fromTree');
const flows = lib.fromLinks([
  { source: 'a', target: 'b', value: 2 },
  { source: 'b', target: 'c', value: 1 },
]);
deepStrictEqual(
  flows,
  { nodes: ['a', 'b', 'c'], source: [0, 1], target: [1, 2], value: [2, 1] },
  'fromLinks',
);

const ly = lib.log({ label: 'y' });
const logged = ly.col(new Float64Array([1, 100, 0, -1, NaN]));
deepStrictEqual([logged instanceof Float64Array, ...logged], [true, 0, 2, NaN, NaN, NaN], 'log col typed');
deepStrictEqual(ly.col([1000, 0]), [3, NaN], 'log col plain');
deepStrictEqual(+ly.from(ly.to(123.456, ly), ly).toPrecision(12), 123.456, 'log round trip');

const [x, y, colors, color] = [[0, 1, 2], [1, 3, 2], ['#e15759', '#4e79a7'], '#4e79a7'];
const marks = [
  lib.line({ x, y, color, fill: lib.gradient(0.4, 0) }),
  lib.area({ x: [0, 1], ...low, color }),
  lib.bar({ ...binned, color }),
  lib.dots({ x, y, color, r: [2, 3, 4] }),
  lib.ticks({ x, y, color, size: 4 }),
  lib.zone({ y1: 1, y2: 2, color }),
  lib.rule({ y: [1, 2], color, text: 'goal' }),
  lib.errorBars({ x: [0, 1], y1: low.y1, y2: low.y2, color }),
  lib.box({ x: [0], ...stats, color }),
  lib.heatmap({ values: [1, 2, 3, 4], columns: 2 }),
  lib.arcs({ values: [1, 2], colors }),
  lib.funnel({ values: [3, 1], colors }),
  lib.radialBars({ values: [1, 2], colors }),
  ...lib.radar({ axes: ['a', 'b', 'c'], series: [{ values: y, color: colors[0] }] }),
  lib.sankey({ ...flows, colors }),
  lib.treemap({ ...tree, colors }),
  lib.sunburst({ ...tree, colors }),
];
for (const [i, mark] of marks.entries()) {
  deepStrictEqual(typeof mark.prepare, 'function', `marks[${i}].prepare`);
}

deepStrictEqual(
  Object.keys(charts).sort(),
  ['areaChart', 'barChart', 'equal', 'lineChart', 'mount', 'plain', 'scatterChart'],
  'charts exports',
);
strictEqual(await import('swiftplot/charts'), charts, 'swiftplot/charts');
const rows = [
  { date: '2026-11-01', api: 1, web: 2 },
  { date: '2026-11-02', api: 3, web: 4 },
];
strictEqual(charts.lineChart.spec({ data: rows }).marks.length, 2, 'lineChart.spec');

const reached = new Set();
const walk = url => {
  if (reached.has(url.href)) return;
  reached.add(url.href);
  for (const [, path] of readFileSync(url, 'utf8').matchAll(/from '(\.[^']+)'/g)) walk(new URL(path, url));
};
walk(new URL('../dist/index.js', import.meta.url));
const chartsDir = new URL('../dist/charts/', import.meta.url).href;
deepStrictEqual(
  [...reached].filter(href => href.startsWith(chartsDir)),
  [],
  'core entry imports no charts',
);
