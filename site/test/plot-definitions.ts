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
  scaled,
  spread,
  type Rows,
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

const tree = {
  kind: 'json' as const,
  file: 'test-tree.json',
  value: {
    name: 'all',
    children: [
      { name: 'a', value: 2 },
      { name: 'b', value: 3 },
    ],
  },
};
const nested = {
  frame: { frame: 'blank' },
  marks: [mark('map', 'treemap', spread(call('fromTree', [dataset()])), { colors: ref('palette') })],
} satisfies Tree;

export const overTree = example({
  ...page,
  kind: 'plot',
  id: 'test-over-tree',
  tree: nested,
  data: tree,
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

const band = [0, 1, 2];
const dose = axis('dose', 'band', { label: 'Caffeine', categories: ['0 mg', '50 mg', '100 mg'] });

export const errorBars = example({
  ...page,
  kind: 'plot',
  id: 'test-error-bars',
  tree: {
    frame: { x: dose },
    marks: [
      mark('bars', 'errorBars', {
        x: band,
        y1: col('low'),
        y2: col('high'),
        color: siteColors[1]!,
        label: 'Spread',
      }),
      mark('means', 'dots', { x: band, y: col('mean'), r: [4, 4, 4], color: siteColors[0]!, label: 'Mean' }),
    ],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-doses.json',
    rows: [
      { mean: 412, low: 384, high: 440 },
      { mean: 398, low: 373, high: 423 },
      { mean: 371, low: 349, high: 393 },
    ],
  },
  switches: [
    {
      id: 'bars',
      label: 'Bars',
      kind: 'choice',
      values: ['upright', 'lying down'],
      value: 'upright',
      sets: {
        upright: [],
        'lying down': [
          { target: 'frame.x', value: omit },
          { target: 'frame.y', value: dose },
          { target: 'bars.x', value: omit },
          { target: 'bars.y1', value: omit },
          { target: 'bars.y2', value: omit },
          { target: 'bars.y', value: band },
          { target: 'bars.x1', value: col('low') },
          { target: 'bars.x2', value: col('high') },
          { target: 'means.x', value: col('mean') },
          { target: 'means.y', value: band },
        ],
      },
    },
  ],
});

export const tickFormat = fn("v => v.toLocaleString('en')", (v: number) => v.toLocaleString('en'));

export const lineLog = example({
  ...page,
  kind: 'plot',
  id: 'test-line-log',
  tree: {
    frame: {
      x: axis('x', 'linear', { label: 'Week', domain: [0, 2] }),
      y: axis('y', 'log', { label: 'Weekly users', format: tickFormat }),
    },
    marks: [
      mark('users', 'line', {
        x: col('week'),
        y: scaled('y', col('users')),
        color: siteColors[0]!,
        label: 'Users',
      }),
    ],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-growth.json',
    rows: [40, 2000, 100_000].map((users, week) => ({ week, users })),
  },
  switches: [
    {
      id: 'scale',
      label: 'Scale',
      kind: 'choice',
      values: ['log', 'linear'],
      value: 'log',
      sets: {
        log: [],
        linear: [
          {
            target: 'y',
            value: axis('y', 'linear', { label: 'Weekly users', domain: 'nice', format: tickFormat }),
          },
          { target: 'users.y', value: col('users') },
        ],
      },
    },
  ],
});

export const closing = fn(
  '(label, x, y) => `${new Date(x).toISOString().slice(0, 10)}: closed at ${y.toFixed(2)}`',
  (_label: string, x: number, y: number) =>
    `${new Date(x).toISOString().slice(0, 10)}: closed at ${y.toFixed(2)}`,
);

export const candlesticks = example({
  ...page,
  kind: 'plot',
  id: 'test-candlesticks',
  tree: {
    frame: { x: axis('x', 'time', { label: '' }) },
    marks: [
      mark('candles', 'candlestick', {
        x: col('date', 'time'),
        open: col('open'),
        high: col('high'),
        low: col('low'),
        close: col('close'),
        width: 51_840_000,
        color: siteColors[0]!,
        down: siteColors[2]!,
        label: 'Price',
      }),
    ],
    use: [feature('tip', 'tooltip', { mode: 'nearest', text: closing })],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-prices.json',
    rows: Array.from({ length: 30 }, (_, i) => {
      const [open, close] = [100 + 4 * Math.sin(i), 100 + 4 * Math.sin(i + 1)];
      return {
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        open,
        high: Math.max(open, close) + 1,
        low: Math.min(open, close) - 1,
        close,
      };
    }),
  },
  switches: [],
});

export const twoAxes = example({
  ...page,
  kind: 'plot',
  id: 'test-two-axes',
  tree: {
    frame: {
      x: axis('x', 'band', { label: '', categories: ['Jan', 'Feb', 'Mar'] }),
      y: axis('y', 'linear', { label: 'Temperature', domain: 'nice' }),
      y2: axis('y2', 'linear', { label: 'Rain', domain: 'nice' }),
    },
    marks: [
      mark('rain', 'bar', {
        x: col('at'),
        y: col('rain'),
        dodge: 'rain',
        yAxis: 'y2',
        color: siteColors[1]!,
        label: 'Rain',
      }),
      mark('temperature', 'line', {
        x: col('at'),
        y: col('temperature'),
        color: siteColors[0]!,
        label: 'Temperature',
      }),
    ],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-weather.json',
    rows: [
      { at: 0, temperature: 3, rain: 78 },
      { at: 1, temperature: 4, rain: 61 },
      { at: 2, temperature: 7, rain: 55 },
    ],
  },
  switches: [],
});

export const radar = example({
  ...page,
  kind: 'plot',
  id: 'test-radar',
  tree: {
    frame: { frame: 'polar' },
    marks: [
      mark('radar', 'radar', {
        axes: col('feature', 'text'),
        series: [
          { values: col('phoneA'), color: siteColors[0]!, label: 'Phone A' },
          { values: col('phoneB'), color: siteColors[2]!, label: 'Phone B' },
        ],
        max: 10,
      }),
    ],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-ratings.json',
    rows: [
      { feature: 'Speed', phoneA: 8, phoneB: 6 },
      { feature: 'Battery', phoneA: 5, phoneB: 9 },
      { feature: 'Camera', phoneA: 9, phoneB: 6 },
    ],
  },
  switches: [],
});

export const boxPlot = example({
  ...page,
  kind: 'plot',
  id: 'test-box-plot',
  tree: {
    frame: { x: axis('x', 'band', { label: '', categories: ['Mon', 'Tue'] }) },
    marks: [
      mark('box', 'box', spread(call('fiveNumbers', [dataset()])), {
        x: [0, 1],
        color: siteColors[1]!,
        label: 'Minutes',
      }),
    ],
  } satisfies Tree,
  data: {
    kind: 'json',
    file: 'test-commute.json',
    value: [
      [28, 31, 34, 37, 45],
      [24, 29, 31, 33, 40],
    ],
  },
  switches: [],
});

export const sankey = example({
  ...page,
  kind: 'plot',
  id: 'test-sankey',
  tree: {
    frame: { frame: 'blank' },
    marks: [mark('flow', 'sankey', spread(call('fromLinks', [dataset()])), { colors: ref('palette') })],
  } satisfies Tree,
  data: {
    kind: 'json',
    file: 'test-links.json',
    value: [
      { source: 'Salary', target: 'Budget', value: 4200 },
      { source: 'Budget', target: 'Home', value: 1900 },
      { source: 'Budget', target: 'Savings', value: 2300 },
    ],
  },
  switches: [],
});

export const sunburst = example({
  ...page,
  kind: 'plot',
  id: 'test-sunburst',
  tree: {
    frame: { frame: 'polar' },
    marks: [mark('rings', 'sunburst', spread(call('fromTree', [dataset()])), { colors: ref('palette') })],
  } satisfies Tree,
  data: tree,
  switches: [],
});

export const brush = example({
  ...page,
  kind: 'plot',
  id: 'test-brush',
  tree: {
    frame: {
      x: axis('x', 'time', { label: '' }),
      y: axis('y', 'linear', { label: 'Requests', domain: 'nice' }),
    },
    marks: [
      mark('api', 'line', { x: col('date', 'time'), y: col('api'), color: siteColors[0]!, label: 'API' }),
    ],
    use: [feature('brush', 'brush', { zoom: true, axes: 'x' }), feature('zoom', 'zoom', { axes: 'x' })],
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-requests.json',
    rows: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      api: Math.round(120 + i * 3 + 30 * Math.sin(i / 3)),
    })),
  },
  switches: [
    {
      id: 'axes',
      label: 'Brushed axes',
      kind: 'choice',
      values: ['x', 'y', 'xy'],
      value: 'x',
      sets: {
        x: [],
        y: [
          { target: 'brush.axes', value: 'y' },
          { target: 'zoom.axes', value: 'y' },
        ],
        xy: [
          { target: 'brush.axes', value: 'xy' },
          { target: 'zoom.axes', value: 'xy' },
        ],
      },
    },
  ],
});

export const step = fn(
  'rows => [...rows.slice(1), ...rows.slice(0, 1).map(r => ({ ...r, s: r.s + rows.length }))]',
  (rows: Rows) => [
    ...rows.slice(1),
    ...rows.slice(0, 1).map(r => ({ ...r, s: (r.s as number) + rows.length })),
  ],
);

export const animatedLive = example({
  ...page,
  kind: 'plot',
  id: 'test-animated-live',
  tree: {
    frame: {
      x: axis('x', 'linear', { label: 'Seconds', domain: 'data' }),
      y: axis('y', 'linear', { label: 'Reading', domain: [0, 100] }),
    },
    marks: [mark('reading', 'line', { x: col('s'), y: col('v'), color: siteColors[0]!, label: 'Reading' })],
    use: [feature('animate', 'animate')],
    live: { every: 1000, step },
  } satisfies Tree,
  data: {
    kind: 'rows',
    file: 'test-pulse.json',
    rows: Array.from({ length: 60 }, (_, s) => ({
      s,
      v: 50 + Math.round(30 * Math.sin((Math.PI * s) / 30)),
    })),
  },
  switches: [{ id: 'animate', label: 'Animate', target: 'animate.on', kind: 'boolean', value: true }],
});

export const easyLine = example({
  ...page,
  id: 'test-easy-line',
  chart: 'lineChart',
  data: { file: 'test-days.json', rows },
  props: {
    yAxis: {
      format: fn('v => (v > 0 && v < 2 ? `low ${v}` : `${v}`)', (v: number) =>
        v > 0 && v < 2 ? `low ${v}` : `${v}`,
      ),
    },
    rules: [{ y: 2, color: siteColors[2]!, text: siteColors[2]! }],
  },
  switches: [
    {
      prop: 'fill',
      label: 'Fill',
      kind: 'choice',
      values: ['none', 'faded'],
      value: 'faded',
      puts: { none: omit, faded: call('gradient', [siteColors[1]!, 0]) },
    },
  ],
});

export const easyData = example({
  ...page,
  id: 'test-easy-data',
  chart: 'lineChart',
  data: { file: 'test-days.json', rows },
  props: {},
  switches: [
    {
      prop: 'data',
      label: 'Rows',
      kind: 'choice',
      values: ['file', 'other', 'none'],
      value: 'file',
      puts: { file: rows, other: [{ day: '2026-01-02', v: 2 }], none: [] },
    },
  ],
});

export const easyCombo = example({
  ...page,
  id: 'test-easy-combo',
  chart: 'comboChart',
  data: { file: 'test-combo.json', rows: rows.map(r => ({ ...r, n: 10 * r.v })) },
  props: { lines: 'v', y2Bars: 'n', yAxis: { label: 'v' } },
  switches: [
    {
      id: 'y2',
      label: 'Second axis',
      kind: 'boolean',
      value: true,
      sets: {
        on: [],
        off: [
          { prop: 'y2Bars', value: omit },
          { prop: 'bars', value: 'n' },
          { prop: 'yAxis.label', value: 'v and n' },
        ],
      },
    },
  ],
});

export const easyTree = example({
  ...page,
  id: 'test-easy-tree',
  chart: 'treemapChart',
  palette: true,
  data: tree,
  props: {},
  switches: [
    {
      prop: 'colors',
      label: 'Colours',
      kind: 'choice',
      values: ['palette', 'site'],
      value: 'palette',
      puts: { palette: omit, site: [...siteColors, '#d97706'] },
    },
  ],
});

export const easyLive = example({
  ...page,
  id: 'test-easy-live',
  chart: 'lineChart',
  data: { file: 'test-live.json', rows },
  props: {},
  live: live.tree.live!,
  switches: [{ prop: 'animate', label: 'Animate', kind: 'boolean', value: true }],
});

export const definitions = [
  withHelper,
  overTree,
  histogram,
  live,
  mixed,
  lineDots,
  errorBars,
  lineLog,
  candlesticks,
  twoAxes,
  radar,
  boxPlot,
  sankey,
  sunburst,
  brush,
  animatedLive,
  easyLine,
  easyData,
  easyCombo,
  easyTree,
  easyLive,
];
