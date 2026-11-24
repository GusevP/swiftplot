import { siteColors } from '../src/codegen/index';
import { example } from '../src/examples/define';
import {
  axis,
  call,
  col,
  dataset,
  feature,
  fn,
  mark,
  omit,
  param,
  ref,
  spread,
  type Tree,
} from '../src/examples/tree';

const page = { title: 'Test', summary: 'A test.', group: 'Test', tags: [], notes: [] };
const rows = [
  { day: '2026-11-01', v: 1 },
  { day: '2026-11-02', v: 3 },
  { day: '2026-11-03', v: 2 },
];

const faded = {
  frame: {
    x: axis('x', 'time', { label: 'Day' }),
    y: axis('y', 'linear', { label: 'Value', domain: 'nice' }),
  },
  marks: [mark('v', 'line', { x: col('day', 'time'), y: col('v'), color: siteColors[0]!, label: 'v' })],
  use: [feature('tip', 'tooltip', { mode: 'nearest', text: fn('l => `${l}!`', (l: string) => `${l}!`) })],
} satisfies Tree;

export const withHelper = example({
  ...page,
  kind: 'plot',
  id: 'test-with-helper',
  tree: faded,
  data: { kind: 'rows', file: 'test-days.json', rows },
  switches: [
    {
      id: 'fill',
      label: 'Fill',
      target: 'v.fill',
      kind: 'boolean',
      value: true,
      puts: { on: call('gradient', [0.4, 0]), off: omit },
    },
    { id: 'tooltip', label: 'Tooltip', target: 'tip.on', kind: 'boolean', value: true },
  ],
});

const nested = {
  frame: { frame: 'blank' },
  marks: [mark('map', 'treemap', spread(call('fromTree', [dataset()])), { colors: ref('palette') })],
} satisfies Tree;

export const overTree = example({
  ...page,
  kind: 'plot',
  id: 'test-over-tree',
  tree: nested,
  data: {
    kind: 'json',
    file: 'test-tree.json',
    value: {
      name: 'all',
      children: [
        { name: 'a', value: 2 },
        { name: 'b', value: 3 },
      ],
    },
  },
  switches: [
    {
      id: 'shade',
      label: 'Shade',
      target: 'map.shade',
      kind: 'choice',
      values: ['none', '0.7'],
      value: 'none',
      puts: { none: omit, '0.7': 0.7 },
    },
  ],
});

const linear = axis('y', 'linear', { label: 'Count', domain: 'nice' });
const binned = {
  frame: { y: linear },
  marks: [mark('bars', 'bar', spread(call('bin', [col('v'), param('bins', 20)])), { color: siteColors[1]! })],
} satisfies Tree;

export const histogram = example({
  ...page,
  kind: 'plot',
  id: 'test-histogram',
  tree: binned,
  data: { kind: 'rows', file: 'test-values.json', rows },
  switches: [
    {
      id: 'bins',
      label: 'Bins',
      target: 'params.bins',
      kind: 'choice',
      values: ['10', '20'],
      value: '20',
      puts: { '10': 10, '20': 20 },
    },
    {
      id: 'scale',
      label: 'Scale',
      target: 'y',
      kind: 'choice',
      values: ['linear', 'log'],
      value: 'linear',
      puts: { linear, log: axis('y', 'log', { label: 'Count' }) },
    },
  ],
});

export const live = example({
  ...page,
  kind: 'plot',
  id: 'test-live',
  tree: {
    marks: [mark('v', 'line', { x: col('day', 'time'), y: col('v'), color: siteColors[2]! })],
    live: {
      every: 1000,
      step: fn('rows => [...rows.slice(1), ...rows.slice(0, 1)]', (r: readonly Record<string, unknown>[]) => [
        ...r.slice(1),
        ...r.slice(0, 1),
      ]),
    },
  } satisfies Tree,
  data: { kind: 'rows', file: 'test-live.json', rows },
  switches: [],
});

export const mixed = example({
  ...page,
  kind: 'plot',
  id: 'test-mixed',
  tree: {
    marks: [
      mark('d', 'dots', { x: col('t', 'time'), y: col('n'), r: col('Number'), color: siteColors[0]! }),
      mark('f', 'funnel', { values: col('n'), labels: col('stage', 'text'), colors: ref('palette') }),
    ],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-mixed.json',
    rows: [
      { t: 1762041600000, stage: 'a', n: 1, Number: '2' },
      { t: '2026-11-02', stage: 2, n: '3', Number: '4' },
    ],
  },
  switches: [],
});

const tenfold = axis('y', 'linear', { label: 'Value', domain: [0, 10] });
export const lineDots = example({
  ...page,
  kind: 'plot',
  id: 'test-line-dots',
  tree: {
    frame: { x: axis('x', 'time', { label: 'Day' }) },
    marks: [
      mark('v', 'line', { x: col('day', 'time'), y: col('v'), color: siteColors[0]!, label: 'Line' }),
      mark('d', 'dots', {
        x: col('day', 'time'),
        y: col('v'),
        r: col('r'),
        color: siteColors[1]!,
        label: 'Dots',
      }),
    ],
    use: [feature('legend', 'legend')],
  } satisfies Tree,
  data: { kind: 'rows', file: 'test-line-dots.json', rows: rows.map(r => ({ ...r, r: 5 })) },
  switches: [
    { id: 'legend', label: 'Legend', target: 'legend.on', kind: 'boolean', value: true },
    {
      id: 'width',
      label: 'Line width',
      target: 'v.width',
      kind: 'choice',
      values: ['1.5', '6'],
      value: '1.5',
      puts: { '1.5': 1.5, '6': 6 },
    },
    {
      id: 'range',
      label: 'Y range',
      target: 'frame.y',
      kind: 'choice',
      values: ['auto', '0-10'],
      value: 'auto',
      puts: { auto: omit, '0-10': tenfold },
    },
  ],
});

export const definitions = [withHelper, overTree, histogram, live, mixed, lineDots];
