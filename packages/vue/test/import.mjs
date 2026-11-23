// Runs in Node, which has no DOM, against the built package.
import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

strictEqual(typeof document, 'undefined', 'no DOM');
const lib = await import('../dist/index.js');

deepStrictEqual(
  Object.keys(lib).sort(),
  ['AreaChart', 'BarChart', 'LineChart', 'Plot', 'ScatterChart'],
  'exports',
);

const rows = [
  { date: '2026-11-01', api: 1 },
  { date: '2026-11-02', api: 3 },
];
strictEqual(
  await renderToString(
    createSSRApp({ render: () => h(lib.LineChart, { data: rows, width: 400, height: 200 }) }),
  ),
  '<div class="" style="width:400px;height:200px;"></div>',
);
