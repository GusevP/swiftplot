// Runs in Node, which has no DOM, against the built package.
import { deepStrictEqual, match, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';

strictEqual(typeof document, 'undefined', 'no DOM');
const lib = await import('../dist/index.js');

deepStrictEqual(
  Object.keys(lib).sort(),
  [
    'AreaChart',
    'BarChart',
    'BoxPlotChart',
    'CandlestickChart',
    'ComboChart',
    'FunnelChart',
    'HeatmapChart',
    'HistogramChart',
    'LineChart',
    'PieChart',
    'Plot',
    'RadarChart',
    'RadialBarChart',
    'SankeyChart',
    'ScatterChart',
    'SunburstChart',
    'TreemapChart',
  ],
  'exports',
);
match(readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'), /^'use client';\n/, 'use client');

const rows = [
  { date: '2026-11-01', api: 1 },
  { date: '2026-11-02', api: 3 },
];
for (const name of Object.keys(lib).filter(name => name !== 'Plot')) {
  strictEqual(
    renderToString(h(lib[name], { data: rows, width: 400, height: 200 })),
    '<div style="width:400px;height:200px"></div>',
    name,
  );
}
strictEqual(renderToString(h(lib.Plot, { marks: [] })), '<div></div>', 'Plot');
