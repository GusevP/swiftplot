// Runs in Node, which has no DOM, against the built library that ships.
import { deepStrictEqual } from 'node:assert/strict';
import * as lib from '../dist/index.js';

const failures = [];
const check = (what, actual, expected) => {
  try {
    deepStrictEqual(actual, expected);
  } catch (e) {
    failures.push(`${what}: ${e.message}`);
  }
};

check(
  'exports',
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
    'brand',
    'dots',
    'errorBars',
    'fiveNumbers',
    'fromLinks',
    'fromTree',
    'funnel',
    'gradient',
    'heatmap',
    'legend',
    'line',
    'palette',
    'plot',
    'radar',
    'radialBars',
    'sankey',
    'sequential',
    'stack',
    'sunburst',
    'ticks',
    'time',
    'tooltip',
    'treemap',
  ].sort(),
);

const binned = lib.bin([1, 2, 3, 4, 5, 6, 7, 8]);
check('bin', [...binned.y2], [2, 2, 2, 2]);
const [low, high] = lib.stack([
  [1, -2],
  [3, 4],
]);
check(
  'stack',
  [[...low.y1], [...low.y2], [...high.y1], [...high.y2]],
  [
    [0, 0],
    [1, -2],
    [1, 0],
    [4, 4],
  ],
);
const stats = lib.fiveNumbers([[5, 1, 3, 2, 4, NaN]]);
check(
  'fiveNumbers',
  [stats.min[0], stats.q1[0], stats.median[0], stats.q3[0], stats.max[0]],
  [1, 2, 3, 4, 5],
);
const tree = lib.fromTree({
  name: 'all',
  children: [
    { name: 'a', value: 2 },
    { name: 'b', value: 3 },
  ],
});
check('fromTree', tree, { nodes: ['all', 'a', 'b'], parent: [-1, 0, 0], value: [0, 2, 3] });
const flows = lib.fromLinks([
  { source: 'a', target: 'b', value: 2 },
  { source: 'b', target: 'c', value: 1 },
]);
check('fromLinks', flows, { nodes: ['a', 'b', 'c'], source: [0, 1], target: [1, 2], value: [2, 1] });

const [x, y, colors, color] = [[0, 1, 2], [1, 3, 2], ['#e15759', '#4e79a7'], '#4e79a7'];
const marks = [
  lib.line({ x, y, color, fill: lib.gradient(0.4, 0) }),
  lib.area({ x: [0, 1], ...low, color }),
  lib.bar({ ...binned, color }),
  lib.dots({ x, y, color, r: [2, 3, 4] }),
  lib.ticks({ x, y, color, size: 4 }),
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
check(
  'marks',
  marks.map(m => typeof m.prepare),
  marks.map(() => 'function'),
);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
