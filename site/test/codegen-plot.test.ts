import * as core from 'swiftplot';
import { describe, expect, test, vi } from 'vitest';
import { code, signature } from '../src/codegen/index';
import { kinds, text } from '../src/codegen/tokens';
import type { Framework } from '../src/scripts/preferences';
import { example, type PlotExample, type State } from '../src/examples/define';
import { col, evaluate, feature, mark, param } from '../src/examples/tree';
import { errorBars, histogram, lineLog, live, mixed, overTree, radar, withHelper } from './plot-definitions';

vi.mock('swiftplot', async original => ({
  ...(await original<object>()),
  dots: (o: object) => ({ dots: o }),
  funnel: (o: object) => ({ funnel: o }),
}));

/** Runs a JS snippet as a module body over the definition's rows, with `plot` and `document` given. */
function run(definition: PlotExample, scope: object) {
  const body = show('js', definition)
    .replace(/^import .*\n/gm, '')
    .replace(/^export /gm, '');
  const names = { ...core, ...scope, rows: definition.data.kind === 'rows' && definition.data.rows };
  const ids = Object.keys(names).filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
  // oxlint-disable-next-line no-implied-eval -- runs the exact snippet a reader copies
  return new Function(...ids, `${body}\nreturn typeof chart === 'undefined' ? undefined : chart;`)(
    ...ids.map(n => names[n as keyof typeof names]),
  ) as unknown;
}

const show = (fw: Framework, definition: PlotExample, state: State = {}) =>
  text(code(fw, definition, state, {}));

const vue = (imports: string, script: string, plot = '<Plot v-bind="options" />') => `<script setup lang="ts">
import { Plot, type PlotProps } from '@swiftplot/vue';
${imports}
${script}</script>

<template>
  ${plot}
</template>
`;

describe('a mark with a helper and a feature switch', () => {
  const columns = `const day = Float64Array.from(rows, r => Date.parse(r.day));
const v = Float64Array.from(rows, r => r.v);
`;
  const line = (fill: boolean) =>
    `line({ x: day, y: v, color: '#0891b2', label: 'v'${fill ? ', fill: gradient(0.4, 0)' : ''} }),`;
  const tooltip = "tooltip({ mode: 'nearest', text: l => `${l}!` }),";
  const js = (names: string, body: string) => `import { ${names} } from 'swiftplot';
import rows from './test-days.json';

${columns}
const el = document.getElementById('chart');
if (el) {
  plot(el, {
    x: time({ label: 'Day' }),
    y: { label: 'Value', domain: 'nice' },
${body}  });
}
`;
  const react = (names: string, key: string, body: string) => `import { Plot } from '@swiftplot/react';
import { ${names} } from 'swiftplot';
import rows from './test-days.json';

${columns}
export function Chart() {
  return (
    <Plot
      key="${key}"
      x={time({ label: 'Day' })}
      y={{ label: 'Value', domain: 'nice' }}
${body}    />
  );
}
`;
  const script = (body: string) => `${columns}
const options: PlotProps = {
  x: time({ label: 'Day' }),
  y: { label: 'Value', domain: 'nice' },
${body}};
`;

  test('at its defaults: the helper and the function node print as code, with the site colour and a key', () => {
    expect(show('js', withHelper)).toBe(
      js(
        'gradient, line, plot, time, tooltip',
        `    marks: [\n      ${line(true)}\n    ],\n    use: [\n      ${tooltip}\n    ],\n`,
      ),
    );
    expect(show('react', withHelper)).toBe(
      react(
        'gradient, line, time, tooltip',
        'tooltip-on',
        `      marks={[\n        ${line(true)}\n      ]}\n      use={[\n        ${tooltip}\n      ]}\n`,
      ),
    );
    expect(show('vue', withHelper)).toBe(
      vue(
        "import { gradient, line, time, tooltip } from 'swiftplot';\nimport rows from './test-days.json';\n",
        script(`  marks: [\n    ${line(true)}\n  ],\n  use: [\n    ${tooltip}\n  ],\n`),
        '<Plot key="tooltip-on" v-bind="options" />',
      ),
    );
  });

  test('the fill left out and the tooltip off: neither is printed or imported, and the key changes', () => {
    const state = { fill: false, tooltip: false };
    expect(show('js', withHelper, state)).toBe(
      js('line, plot, time', `    marks: [\n      ${line(false)}\n    ],\n`),
    );
    expect(show('react', withHelper, state)).toBe(
      react('line, time', 'tooltip-off', `      marks={[\n        ${line(false)}\n      ]}\n`),
    );
    expect(show('vue', withHelper, state)).toBe(
      vue(
        "import { line, time } from 'swiftplot';\nimport rows from './test-days.json';\n",
        script(`  marks: [\n    ${line(false)}\n  ],\n`),
        '<Plot key="tooltip-off" v-bind="options" />',
      ),
    );
  });
});

describe('a nested tree through fromTree(dataset())', () => {
  const treemap = (shade: string) => `treemap({ ...fromTree(data), colors: palette${shade} }),`;
  const js = (shade: string) => `import { fromTree, palette, plot, treemap } from 'swiftplot';
import data from './test-tree.json';

const el = document.getElementById('chart');
if (el) {
  plot(el, {
    frame: 'blank',
    marks: [
      ${treemap(shade)}
    ],
  });
}
`;
  const react = (shade: string) => `import { Plot } from '@swiftplot/react';
import { fromTree, palette, treemap } from 'swiftplot';
import data from './test-tree.json';

export function Chart() {
  return (
    <Plot
      frame="blank"
      marks={[
        ${treemap(shade)}
      ]}
    />
  );
}
`;
  const script = (shade: string) =>
    vue(
      "import { fromTree, palette, treemap } from 'swiftplot';\nimport data from './test-tree.json';\n",
      `const options: PlotProps = {\n  frame: 'blank',\n  marks: [\n    ${treemap(shade)}\n  ],\n};\n`,
    );

  test('at its defaults: the JSON is imported as data and the shade is left out', () => {
    expect(show('js', overTree)).toBe(js(''));
    expect(show('react', overTree)).toBe(react(''));
    expect(show('vue', overTree)).toBe(script(''));
  });

  test('a numeric choice puts its number', () => {
    expect(show('js', overTree, { shade: '0.7' })).toBe(js(', shade: 0.7'));
    expect(show('react', overTree, { shade: '0.7' })).toBe(react(', shade: 0.7'));
    expect(show('vue', overTree, { shade: '0.7' })).toBe(script(', shade: 0.7'));
  });
});

describe('a binned mark with a bin-count param and a log / linear axis', () => {
  const y = (log: boolean) => (log ? "log({ label: 'Count' })" : "{ label: 'Count', domain: 'nice' }");
  const bar = (bins: number) => `bar({ ...bin(v, ${bins}), color: '#2563eb' }),`;
  const names = (log: boolean, more: string[] = []) =>
    ['bar', 'bin', ...(log ? ['log'] : []), ...more].join(', ');
  const head = `import rows from './test-values.json';

const v = Float64Array.from(rows, r => r.v);
`;
  const js = (log: boolean, bins: number) => `import { ${names(log, ['plot'])} } from 'swiftplot';
${head}
const el = document.getElementById('chart');
if (el) {
  plot(el, {
    y: ${y(log)},
    marks: [
      ${bar(bins)}
    ],
  });
}
`;
  const react = (log: boolean, bins: number) => `import { Plot } from '@swiftplot/react';
import { ${names(log)} } from 'swiftplot';
${head}
export function Chart() {
  return (
    <Plot
      y={${y(log)}}
      marks={[
        ${bar(bins)}
      ]}
    />
  );
}
`;
  const script = (log: boolean, bins: number) =>
    vue(
      `import { ${names(log)} } from 'swiftplot';\n${head}`,
      `const options: PlotProps = {\n  y: ${y(log)},\n  marks: [\n    ${bar(bins)}\n  ],\n};\n`,
    );

  test('at its defaults: the spread prints the column and the param', () => {
    expect(show('js', histogram)).toBe(js(false, 20));
    expect(show('react', histogram)).toBe(react(false, 20));
    expect(show('vue', histogram)).toBe(script(false, 20));
  });

  test('ten bins on a log axis', () => {
    const state = { bins: '10', scale: 'log' };
    expect(show('js', histogram, state)).toBe(js(true, 10));
    expect(show('react', histogram, state)).toBe(react(true, 10));
    expect(show('vue', histogram, state)).toBe(script(true, 10));
  });
});

test('a live block: one timer per mount, cleared when the chart goes, in each framework', () => {
  const step = 'rows => [...rows.slice(1), ...rows.slice(0, 1)]';
  const columns = (rows: string, indent: string) =>
    `${indent}const day = Float64Array.from(${rows}, r => Date.parse(r.day));
${indent}const v = Float64Array.from(${rows}, r => r.v);
`;
  const line = "line({ x: day, y: v, color: '#9333ea' }),";
  expect(show('js', live)).toBe(`import { line, plot } from 'swiftplot';
import rows from './test-live.json';

/** @type {(data: typeof rows) => typeof rows} */
const step = ${step};

/**
 * @param {typeof rows} data
 * @returns {import('swiftplot').Options}
 */
function options(data) {
${columns('data', '  ')}  return {
    marks: [
      ${line}
    ],
  };
}

/** @param {HTMLElement} el */
function mount(el) {
  let data = rows;
  const chart = plot(el, options(data));
  const timer = setInterval(() => {
    data = step(data);
    chart.update(options(data));
  }, 1000);
  return {
    destroy() {
      clearInterval(timer);
      chart.destroy();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
`);
  expect(show('react', live)).toBe(`import { useEffect, useState } from 'react';
import { Plot } from '@swiftplot/react';
import { line } from 'swiftplot';
import rows from './test-live.json';

const step: (data: typeof rows) => typeof rows = ${step};

export function Chart() {
  const [data, setData] = useState(rows);
  useEffect(() => {
    const timer = setInterval(() => setData(step), 1000);
    return () => clearInterval(timer);
  }, []);
${columns('data', '  ')}  return (
    <Plot
      marks={[
        ${line}
      ]}
    />
  );
}
`);
  expect(show('vue', live)).toBe(
    vue(
      "import { line } from 'swiftplot';\nimport { computed, onMounted, onUnmounted, shallowRef } from 'vue';\nimport rows from './test-live.json';\n",
      `const step: (data: typeof rows) => typeof rows = ${step};

const data = shallowRef(rows);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    data.value = step(data.value);
  }, 1000);
});
onUnmounted(() => clearInterval(timer));

const options = computed((): PlotProps => {
${columns('data.value', '  ')}  return {
    marks: [
      ${line}
    ],
  };
});
`,
    ),
  );
});

test('a column mixing value types reads each row as the live chart does', () => {
  expect(show('js', mixed)).toContain(
    `const t = Float64Array.from(rows, r => typeof r.t === 'string' ? Date.parse(r.t) : Number(r.t));
const n = Float64Array.from(rows, r => Number(r.n));
const Number2 = Float64Array.from(rows, r => Number(r.Number));
const stage = rows.map(r => String(r.stage));
`,
  );
  let options: unknown;
  run(mixed, { plot: (_: unknown, o: unknown) => (options = o), document: { getElementById: () => ({}) } });
  expect(options).toEqual(evaluate(mixed.tree, mixed.data, mixed.id));
});

test('the live JS module mounts once on #chart, and its exported chart clears the timer', () => {
  vi.useFakeTimers();
  try {
    const chart = { update: vi.fn(), destroy: vi.fn() };
    const plot = vi.fn(() => chart);
    const mounted = run(live, { plot, document: { getElementById: () => ({}) } }) as { destroy(): void };
    expect(plot).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(chart.update).toHaveBeenCalledTimes(1);
    mounted.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(chart.destroy).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

test('every token of a plot snippet is non-empty and of a known kind', () => {
  for (const fw of ['js', 'react', 'vue'] as const)
    for (const t of code(fw, live, {}, {})) {
      expect(t.text).not.toBe('');
      expect(kinds).toContain(t.kind);
    }
});

test('the signature of plot() in each framework', () => {
  expect(text(signature('js', 'plot'))).toBe(`import { plot } from 'swiftplot';

const chart = plot(el, options);
chart.update(partialOptions);
chart.destroy();
`);
  expect(text(signature('react', 'plot'))).toBe(`import { Plot } from '@swiftplot/react';

<Plot {...options} />
`);
  expect(text(signature('vue', 'plot'))).toBe(`<script setup lang="ts">
import { Plot } from '@swiftplot/vue';
</script>

<template>
  <Plot v-bind="options" />
</template>
`);
});

test('a params switch whose param sits in a feature changes the key', () => {
  const zoomed = example({
    id: 'param-zoom',
    title: 'Test',
    summary: 'A test.',
    group: 'Test',
    tags: [],
    notes: [],
    kind: 'plot',
    tree: {
      marks: [mark('v', 'line', { x: col('day', 'time'), y: col('v'), color: '#0891b2' })],
      use: [feature('z', 'zoom', { axes: param('axes', 'x') })],
    },
    data: { kind: 'rows', file: 'days.json', rows: [{ day: '2026-11-01', v: 1 }] },
    switches: [
      { id: 'axes', label: 'Axes', target: 'params.axes', kind: 'choice', values: ['x', 'xy'], value: 'x' },
    ],
  });
  for (const fw of ['react', 'vue'] as const) {
    expect(show(fw, zoomed)).toContain('key="axes-x"');
    expect(show(fw, zoomed, { axes: 'xy' })).toContain('key="axes-xy"');
  }
});

test('an array of objects puts one object to a line, indented under its mark', () => {
  expect(show('vue', radar)).toContain(`  marks: [
    ...radar({
      axes: feature,
      series: [
        { values: phoneA, color: '#0891b2', label: 'Phone A' },
        { values: phoneB, color: '#9333ea', label: 'Phone B' },
      ],
      max: 10,
    }),
  ],
`);
});

test('a switch with several puts: the error bars lying down', () => {
  expect(show('js', errorBars, { bars: 'lying down' }))
    .toBe(`import { band, dots, errorBars, plot } from 'swiftplot';
import rows from './test-doses.json';

const low = Float64Array.from(rows, r => r.low);
const high = Float64Array.from(rows, r => r.high);
const mean = Float64Array.from(rows, r => r.mean);

const el = document.getElementById('chart');
if (el) {
  plot(el, {
    y: band({ label: 'Caffeine', categories: ['0 mg', '50 mg', '100 mg'] }),
    marks: [
      errorBars({ color: '#2563eb', label: 'Spread', y: [0, 1, 2], x1: low, x2: high }),
      dots({ x: mean, y: [0, 1, 2], r: [4, 4, 4], color: '#0891b2', label: 'Mean' }),
    ],
  });
}
`);
});

describe('a column through a log axis', () => {
  const head = (names: string) => `import { ${names} } from 'swiftplot';
import rows from './test-growth.json';
`;
  const format = "format: v => v.toLocaleString('en')";
  const consts = (
    log: boolean,
  ) => `${log ? `const y = log({ label: 'Weekly users', ${format} });\n` : ''}const week = Float64Array.from(rows, r => r.week);
const users = Float64Array.from(rows, r => r.users);
`;
  const y = (log: boolean) => (log ? 'y' : `{ label: 'Weekly users', domain: 'nice', ${format} }`);
  const marks = (log: boolean, indent: string) => `${indent}marks: [
${indent}  line({ x: week, y: ${log ? 'y.col(users)' : 'users'}, color: '#0891b2', label: 'Users' }),
${indent}],
`;

  test.each([true, false])('the axis named once and its col() given to the mark, on log: %s', log => {
    const state = { scale: log ? 'log' : 'linear' };
    expect(show('js', lineLog, state)).toBe(`${head(log ? 'line, log, plot' : 'line, plot')}
${consts(log)}
const el = document.getElementById('chart');
if (el) {
  plot(el, {
    x: { label: 'Week', domain: [0, 2] },
    ${log ? 'y,' : `y: ${y(log)},`}
${marks(log, '    ')}  });
}
`);
    expect(show('react', lineLog, state)).toBe(`import { Plot } from '@swiftplot/react';
${head(log ? 'line, log' : 'line')}
${consts(log)}
export function Chart() {
  return (
    <Plot
      x={{ label: 'Week', domain: [0, 2] }}
      y={${y(log)}}
      marks={[
        line({ x: week, y: ${log ? 'y.col(users)' : 'users'}, color: '#0891b2', label: 'Users' }),
      ]}
    />
  );
}
`);
    expect(show('vue', lineLog, state)).toBe(
      vue(
        `${head(log ? 'line, log' : 'line')}`,
        `${consts(log)}\nconst options: PlotProps = {\n  x: { label: 'Week', domain: [0, 2] },\n  ${log ? 'y,' : `y: ${y(log)},`}\n${marks(log, '  ')}};\n`,
      ),
    );
  });
});
