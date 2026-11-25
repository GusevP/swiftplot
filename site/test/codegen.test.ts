import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import { code, defaults, frameworks, signature, siteColors } from '../src/codegen/index';
import { kinds, text } from '../src/codegen/tokens';
import { example, type EasyExample, type Example } from '../src/examples/define';
import { examples } from '../src/examples/index';
import { reference } from '../src/reference/index';
import { easyCombo, easyData, easyLine, easyLive, easyTree } from './plot-definitions';
import tokens from '../src/styles/tokens.css?raw';

const lineDefaults = defaults(reference.lineChart);
const lineZoom = examples.get('line-zoom')!;
const show = (fw: keyof typeof frameworks, state = {}) => text(code(fw, lineZoom, state, lineDefaults));

const colors = "['#0891b2', '#2563eb', '#9333ea']";
const js = (props: string) => `import { lineChart } from 'swiftplot/charts';
import rows from './requests.json';

const el = document.getElementById('chart');
if (el) {
  lineChart(el, {
    data: rows,
${props}    colors: ${colors},
  });
}
`;
const react = (attrs: string) => `import { LineChart } from '@swiftplot/react';
import rows from './requests.json';

export function Chart() {
  return <LineChart data={rows}${attrs} colors={${colors}} />;
}
`;
const vue = (attrs: string) => `<script setup lang="ts">
import { LineChart } from '@swiftplot/vue';
import rows from './requests.json';
</script>

<template>
  <LineChart :data="rows"${attrs} :colors="${colors}" />
</template>
`;

describe('line-zoom', () => {
  test('the starting state prints zoom, which is off by default, and nothing else', () => {
    expect(show('js')).toBe(js('    zoom: true,\n'));
    expect(show('react')).toBe(react(' zoom'));
    expect(show('vue')).toBe(vue(' zoom'));
  });

  test('zoom off is the default, so it is left out', () => {
    expect(show('js', { zoom: false })).toBe(js(''));
    expect(show('react', { zoom: false })).toBe(react(''));
    expect(show('vue', { zoom: false })).toBe(vue(''));
  });

  test('legend off prints false', () => {
    expect(show('js', { legend: false })).toBe(js('    zoom: true,\n    legend: false,\n'));
    expect(show('react', { legend: false })).toBe(react(' zoom legend={false}'));
    expect(show('vue', { legend: false })).toBe(vue(' zoom :legend="false"'));
  });

  test('tooltip off prints false', () => {
    expect(show('js', { tooltip: false })).toBe(js('    zoom: true,\n    tooltip: false,\n'));
    expect(show('react', { tooltip: false })).toBe(react(' zoom tooltip={false}'));
    expect(show('vue', { tooltip: false })).toBe(vue(' zoom :tooltip="false"'));
  });

  test('a curve other than linear prints as a string', () => {
    expect(show('js', { curve: 'smooth' })).toBe(js("    zoom: true,\n    curve: 'smooth',\n"));
    expect(show('react', { curve: 'smooth' })).toBe(react(' zoom curve="smooth"'));
    expect(show('vue', { curve: 'smooth' })).toBe(vue(' zoom curve="smooth"'));
  });
});

test("the site colours are the light theme's --c1, --c2 and --c3", () => {
  const light = /:root \{([^}]*)\}/.exec(tokens)![1]!;
  expect(['--c1', '--c2', '--c3'].map(c => new RegExp(`${c}: (#[0-9a-f]{6});`).exec(light)?.[1])).toEqual(
    siteColors,
  );
});

test('the file name and install line of each framework', () => {
  expect(frameworks).toEqual({
    js: { file: 'chart.js', install: 'npm i swiftplot' },
    react: { file: 'Chart.tsx', install: 'npm i swiftplot @swiftplot/react' },
    vue: { file: 'Chart.vue', install: 'npm i swiftplot @swiftplot/vue' },
  });
});

test('the signature of a chart in each framework', () => {
  expect(text(signature('js', 'areaChart'))).toBe(`import { areaChart } from 'swiftplot/charts';

const chart = areaChart(el, props);
chart.update(partialProps);
chart.destroy();
`);
  expect(text(signature('react', 'areaChart'))).toBe(`import { AreaChart } from '@swiftplot/react';

<AreaChart data={rows} {...props} />
`);
  expect(text(signature('vue', 'areaChart'))).toBe(`<script setup lang="ts">
import { AreaChart } from '@swiftplot/vue';
import rows from './rows.json';
</script>

<template>
  <AreaChart :data="rows" />
</template>
`);
});

describe('values', () => {
  const tricky = 'a\'b"c\\d<e>f&g';
  const fixture = example({
    ...(lineZoom as EasyExample),
    id: 'values',
    props: {
      height: 240,
      y: ['api', 'web'],
      xAxis: { label: tricky, utc: true },
      description: tricky,
    },
    switches: [],
  });
  const shown = (fw: keyof typeof frameworks) => text(code(fw, fixture, {}, lineDefaults));

  test('numbers, arrays and nested objects in each form; nested defaults are left out', () => {
    expect(shown('js')).toContain("    height: 240,\n    y: ['api', 'web'],\n    xAxis: { label: ");
    expect(shown('js')).not.toContain('utc');
    expect(shown('react')).toContain(" height={240} y={['api', 'web']} xAxis={{ label: ");
    expect(shown('vue')).toContain(' :height="240" :y="[\'api\', \'web\']" :xAxis="{ label: ');
  });

  const stringIn = (source: string, path: (node: ts.Node) => ts.Node | undefined) => {
    const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found: string | undefined;
    const visit = (node: ts.Node): void => {
      const hit = path(node);
      if (hit && ts.isStringLiteral(hit)) found ??= hit.text;
      ts.forEachChild(node, visit);
    };
    visit(file);
    const { diagnostics } = ts.transpileModule(source, { fileName: 'x.tsx', reportDiagnostics: true });
    expect(diagnostics).toEqual([]);
    return found;
  };

  test('a string with a quote, a backslash, <, > and & survives a JS string', () => {
    const source = shown('js');
    expect(source).toContain(`description: 'a\\'b"c\\\\d<e>f&g'`);
    const prop = (n: ts.Node) =>
      ts.isPropertyAssignment(n) && n.name.getText() === 'description' ? n.initializer : undefined;
    expect(stringIn(source, prop)).toBe(tricky);
  });

  test('… and a JSX attribute', () => {
    const source = shown('react');
    expect(source).toContain(`description={'a\\'b"c\\\\d<e>f&g'}`);
    const attr = (n: ts.Node) =>
      ts.isJsxAttribute(n) &&
      n.name.getText() === 'description' &&
      n.initializer &&
      ts.isJsxExpression(n.initializer)
        ? n.initializer.expression
        : undefined;
    expect(stringIn(source, attr)).toBe(tricky);
  });

  test('… and a Vue attribute, static or bound', () => {
    const source = shown('vue');
    expect(source).toContain(`description="a'b&quot;c\\d&lt;e&gt;f&amp;g"`);
    const { descriptor, errors } = parse(source);
    expect(errors).toEqual([]);
    const chart = descriptor.template!.ast!.children.find(n => n.type === 1)!;
    const attrs = 'props' in chart ? chart.props : [];
    const description = attrs.find(p => p.type === 6 && p.name === 'description');
    expect(description && 'value' in description && description.value?.content).toBe(tricky);
    const xAxis = attrs.find(p => p.type === 7 && p.rawName === ':xAxis');
    const expression =
      xAxis && 'exp' in xAxis && xAxis.exp && 'content' in xAxis.exp ? xAxis.exp.content : '';
    const label = (n: ts.Node) =>
      ts.isPropertyAssignment(n) && n.name.getText() === 'label' ? n.initializer : undefined;
    expect(stringIn(`(${expression})`, label)).toBe(tricky);
  });
});

describe('easy examples of the new charts', () => {
  const print = (fw: keyof typeof frameworks, e: Example, state = {}) => text(code(fw, e, state, {}));

  test('fn and call nodes print as source with the swiftplot import, a list of objects one to a line', () => {
    expect(print('js', easyLine)).toBe(`import { lineChart } from 'swiftplot/charts';
import { gradient } from 'swiftplot';
import rows from './test-days.json';

const el = document.getElementById('chart');
if (el) {
  lineChart(el, {
    data: rows,
    yAxis: { format: v => (v > 0 && v < 2 ? \`low \${v}\` : \`\${v}\`) },
    rules: [
      { y: 2, color: '#9333ea', text: '#9333ea' },
    ],
    fill: gradient('#2563eb', 0),
    colors: ${colors},
  });
}
`);
    expect(print('react', easyLine)).toBe(`import { LineChart } from '@swiftplot/react';
import { gradient } from 'swiftplot';
import rows from './test-days.json';

export function Chart() {
  return <LineChart data={rows} yAxis={{ format: v => (v > 0 && v < 2 ? \`low \${v}\` : \`\${v}\`) }} rules={[
    { y: 2, color: '#9333ea', text: '#9333ea' },
  ]} fill={gradient('#2563eb', 0)} colors={${colors}} />;
}
`);
    expect(print('vue', easyLine)).toBe(`<script setup lang="ts">
import { LineChart } from '@swiftplot/vue';
import { gradient } from 'swiftplot';
import rows from './test-days.json';
</script>

<template>
  <LineChart :data="rows" :yAxis="{ format: v => (v > 0 && v < 2 ? \`low \${v}\` : \`\${v}\`) }" :rules="[
    { y: 2, color: '#9333ea', text: '#9333ea' },
  ]" :fill="gradient('#2563eb', 0)" :colors="${colors}" />
</template>
`);
  });

  test('a bound Vue attribute reaches the template compiler as the source it prints', () => {
    const { descriptor, errors } = parse(print('vue', easyLine));
    expect(errors).toEqual([]);
    const chart = descriptor.template!.ast!.children.find(n => n.type === 1)!;
    const attrs = 'props' in chart ? chart.props : [];
    const yAxis = attrs.find(p => p.type === 7 && p.rawName === ':yAxis');
    expect(yAxis && 'exp' in yAxis && yAxis.exp && 'content' in yAxis.exp && yAxis.exp.content).toBe(
      '{ format: v => (v > 0 && v < 2 ? `low ${v}` : `${v}`) }',
    );
  });

  test('a put of omit prints neither the prop nor the import of its helper', () => {
    for (const fw of ['js', 'react', 'vue'] as const) {
      expect(print(fw, easyLine, { fill: 'none' })).not.toMatch(/fill|gradient|from 'swiftplot';/);
    }
  });

  test('a sets switch prints both props it changes and not the one it omits', () => {
    expect(print('react', easyCombo, { y2: false })).toContain(
      `<ComboChart data={rows} lines="v" yAxis={{ label: 'v and n' }} bars="n" colors=`,
    );
  });

  test('JSON data is imported as data, and palette leaves colors to the chart', () => {
    expect(print('js', easyTree)).toBe(`import { treemapChart } from 'swiftplot/charts';
import data from './test-tree.json';

const el = document.getElementById('chart');
if (el) {
  treemapChart(el, {
    data,
  });
}
`);
    expect(print('react', easyTree)).toBe(`import { TreemapChart } from '@swiftplot/react';
import data from './test-tree.json';

export function Chart() {
  return <TreemapChart data={data} />;
}
`);
    expect(print('vue', easyTree)).toBe(`<script setup lang="ts">
import { TreemapChart } from '@swiftplot/vue';
import data from './test-tree.json';
</script>

<template>
  <TreemapChart :data="data" />
</template>
`);
    expect(print('react', easyTree, { colors: 'site' })).toContain(
      " colors={['#0891b2', '#2563eb', '#9333ea', '#d97706']} />",
    );
  });

  test('the converted part-to-whole examples print their chart in each framework', () => {
    const print = (id: string, state = {}) => {
      const e = examples.get(id) as EasyExample;
      return (['js', 'react', 'vue'] as const).map(fw =>
        text(code(fw, e, state, defaults(reference[e.chart]))),
      );
    };
    expect(print('pie-donut')).toEqual([
      `import { pieChart } from 'swiftplot/charts';
import rows from './traffic.json';

const el = document.getElementById('chart');
if (el) {
  pieChart(el, {
    data: rows,
  });
}
`,
      `import { PieChart } from '@swiftplot/react';
import rows from './traffic.json';

export function Chart() {
  return <PieChart data={rows} />;
}
`,
      `<script setup lang="ts">
import { PieChart } from '@swiftplot/vue';
import rows from './traffic.json';
</script>

<template>
  <PieChart :data="rows" />
</template>
`,
    ]);
    expect(print('pie-donut', { inner: '0.6', text: false })).toEqual([
      expect.stringContaining('    inner: 0.6,\n    text: false,\n'),
      expect.stringContaining('<PieChart data={rows} inner={0.6} text={false} />'),
      expect.stringContaining('<PieChart :data="rows" :inner="0.6" :text="false" />'),
    ]);
    expect(print('funnel')[1]).toContain('<FunnelChart data={rows} legend={false} />');
    expect(print('funnel', { fill: true })).toEqual([
      expect.stringContaining("    fill: gradient('#0891b2', '#9333ea'),\n"),
      expect.stringContaining(
        "<FunnelChart data={rows} legend={false} fill={gradient('#0891b2', '#9333ea')} />",
      ),
      expect.stringContaining(
        `<FunnelChart :data="rows" :legend="false" :fill="gradient('#0891b2', '#9333ea')" />`,
      ),
    ]);
    expect(print('radial-bars')[1]).toContain('<RadialBarChart data={rows} max={100} legend={false} />');
    expect(print('radial-bars', { sweep: true })).toEqual([
      expect.stringContaining('    max: 100,\n    legend: false,\n    sweep: 0.35,\n'),
      expect.stringContaining('<RadialBarChart data={rows} max={100} legend={false} sweep={0.35} />'),
      expect.stringContaining('<RadialBarChart :data="rows" :max="100" :legend="false" :sweep="0.35" />'),
    ]);
  });

  test('the converted radar, heatmap, histogram and box plot print their chart in each framework', () => {
    const print = (id: string, state = {}) => {
      const e = examples.get(id) as EasyExample;
      return (['js', 'react', 'vue'] as const).map(fw =>
        text(code(fw, e, state, defaults(reference[e.chart]))),
      );
    };
    const colors = `colors: ['#0891b2', '#2563eb', '#9333ea'],`;
    expect(print('radar')).toEqual([
      `import { radarChart } from 'swiftplot/charts';
import rows from './ratings.json';

const el = document.getElementById('chart');
if (el) {
  radarChart(el, {
    data: rows,
    max: 10,
    ${colors}
  });
}
`,
      expect.stringContaining(
        "<RadarChart data={rows} max={10} colors={['#0891b2', '#2563eb', '#9333ea']} />",
      ),
      expect.stringContaining(
        `<RadarChart :data="rows" :max="10" :colors="['#0891b2', '#2563eb', '#9333ea']" />`,
      ),
    ]);
    expect(print('radar', { legend: false, fill: false })).toEqual([
      expect.stringContaining('    max: 10,\n    legend: false,\n    fill: 0,\n'),
      expect.stringContaining('max={10} legend={false} fill={0}'),
      expect.stringContaining(':max="10" :legend="false" :fill="0"'),
    ]);

    expect(print('heatmap')).toEqual([
      `import { heatmapChart } from 'swiftplot/charts';
import rows from './hourly.json';

const el = document.getElementById('chart');
if (el) {
  heatmapChart(el, {
    data: rows,
    x: 'hour',
    y: 'day',
    xAxis: { label: 'Hour' },
    yAxis: { label: '' },
  });
}
`,
      expect.stringContaining('<HeatmapChart'),
      expect.stringContaining('<HeatmapChart'),
    ]);
    expect(print('heatmap', { legend: false })[0]).toContain('    legend: false,\n');

    expect(print('histogram')).toEqual([
      `import { histogramChart } from 'swiftplot/charts';
import rows from './loads.json';

const el = document.getElementById('chart');
if (el) {
  histogramChart(el, {
    data: rows,
    xAxis: { label: 'Load time (ms)' },
    yAxis: { label: 'Pages' },
    colors: ['#2563eb'],
    bins: 20,
  });
}
`,
      expect.stringContaining('bins={20}'),
      expect.stringContaining(':bins="20"'),
    ]);
    expect(print('histogram', { bins: '40' })[0]).toContain('    bins: 40,\n');

    expect(print('box-plot')).toEqual([
      `import { boxPlotChart } from 'swiftplot/charts';
import rows from './commute.json';

const el = document.getElementById('chart');
if (el) {
  boxPlotChart(el, {
    data: rows,
    xAxis: { label: '' },
    yAxis: { label: '' },
    colors: ['#2563eb'],
  });
}
`,
      expect.stringContaining('<BoxPlotChart'),
      expect.stringContaining('<BoxPlotChart'),
    ]);
    expect(print('box-plot', { fill: true })).toEqual([
      expect.stringContaining('    fill: gradient(0.6, 0.05),\n'),
      expect.stringContaining('fill={gradient(0.6, 0.05)}'),
      expect.stringContaining(':fill="gradient(0.6, 0.05)"'),
    ]);
  });

  test('the converted candlesticks, sankey, treemap and sunburst print their chart in each framework', () => {
    const print = (id: string, state = {}) => {
      const e = examples.get(id) as EasyExample;
      return (['js', 'react', 'vue'] as const).map(fw =>
        text(code(fw, e, state, defaults(reference[e.chart]))),
      );
    };
    expect(print('candlesticks')).toEqual([
      `import { candlestickChart } from 'swiftplot/charts';
import rows from './prices.json';

const el = document.getElementById('chart');
if (el) {
  candlestickChart(el, {
    data: rows,
    xAxis: { label: '' },
    colors: ['#0891b2'],
    down: '#9333ea',
  });
}
`,
      expect.stringContaining('down="#9333ea"'),
      expect.stringContaining('down="#9333ea"'),
    ]);
    for (const source of print('candlesticks', { down: false })) {
      expect(source).toContain('#0891b2');
      expect(source).not.toContain('down');
    }

    expect(print('sankey')).toEqual([
      `import { sankeyChart } from 'swiftplot/charts';
import rows from './budget.json';

const el = document.getElementById('chart');
if (el) {
  sankeyChart(el, {
    data: rows,
  });
}
`,
      expect.stringContaining('<SankeyChart data={rows} />'),
      expect.stringContaining('<SankeyChart :data="rows" />'),
    ]);
    expect(print('sankey', { blend: true })).toEqual([
      expect.stringContaining('    blend: true,\n'),
      expect.stringContaining('<SankeyChart data={rows} blend />'),
      expect.stringContaining('<SankeyChart :data="rows" blend />'),
    ]);

    for (const [id, component, shade] of [
      ['treemap', 'TreemapChart', '0.4'],
      ['sunburst', 'SunburstChart', '0.3'],
    ] as const) {
      expect(print(id)).toEqual([
        `import { ${id}Chart } from 'swiftplot/charts';
import data from './disk.json';

const el = document.getElementById('chart');
if (el) {
  ${id}Chart(el, {
    data,
  });
}
`,
        expect.stringContaining(`<${component} data={data} />`),
        expect.stringContaining(`<${component} :data="data" />`),
      ]);
      const site = "['#0891b2', '#2563eb', '#9333ea', '#d97706']";
      expect(print(id, { shade, colors: 'site' })).toEqual([
        expect.stringContaining(`    shade: ${shade},\n    colors: ${site},\n`),
        expect.stringMatching(new RegExp(`shade=\\{${shade}\\}\\s+colors=\\{`)),
        expect.stringMatching(new RegExp(`:shade="${shade}"\\s+:colors="`)),
      ]);
    }
  });

  test('the converted error bars and bubbles print their chart in each framework', () => {
    const print = (id: string, state = {}) => {
      const e = examples.get(id) as EasyExample;
      return (['js', 'react', 'vue'] as const).map(fw =>
        text(code(fw, e, state, defaults(reference[e.chart]))),
      );
    };
    expect(print('error-bars')).toEqual([
      `import { scatterChart } from 'swiftplot/charts';
import rows from './doses.json';

const el = document.getElementById('chart');
if (el) {
  scatterChart(el, {
    data: rows,
    x: 'dose',
    errorBars: { low: 'low', high: 'high' },
    xAxis: { label: 'Caffeine' },
    yAxis: { label: '' },
    colors: ['#0891b2'],
  });
}
`,
      expect.stringContaining("errorBars={{ low: 'low', high: 'high' }}"),
      expect.stringContaining(`:errorBars="{ low: 'low', high: 'high' }"`),
    ]);
    for (const source of print('error-bars', { 'errorBars.cap': false }))
      expect(source).toContain("{ low: 'low', high: 'high', cap: 0 }");

    expect(print('bubbles')).toEqual([
      `import { scatterChart } from 'swiftplot/charts';
import rows from './cafes.json';

const el = document.getElementById('chart');
if (el) {
  scatterChart(el, {
    data: rows,
    r: 'r',
    alpha: 0.7,
    xAxis: { label: 'Seats' },
    yAxis: { label: 'Cups a day' },
    colors: ['#0891b2'],
  });
}
`,
      expect.stringContaining('alpha={0.7}'),
      expect.stringContaining(':alpha="0.7"'),
    ]);
    expect(print('bubbles', { ring: true })).toEqual([
      expect.stringContaining('    ring: 2,\n'),
      expect.stringContaining('ring={2}'),
      expect.stringContaining(':ring="2"'),
    ]);
  });

  test('the converted two axes, log, annotated, brush, live and strip plots print their chart in each framework', () => {
    const print = (id: string, state = {}) => {
      const e = examples.get(id) as EasyExample;
      return (['js', 'react', 'vue'] as const).map(fw =>
        text(code(fw, e, state, defaults(reference[e.chart]))),
      );
    };
    expect(print('two-y-axes')).toEqual([
      `import { comboChart } from 'swiftplot/charts';
import rows from './weather.json';

const el = document.getElementById('chart');
if (el) {
  comboChart(el, {
    data: rows,
    lines: 'temperature',
    y2Bars: 'rain',
    xAxis: { label: '' },
    yAxis: { label: 'Temperature (°C)' },
    y2Axis: { label: 'Rain (mm)' },
    colors: ['#0891b2', '#2563eb'],
  });
}
`,
      expect.stringContaining('y2Bars="rain"'),
      expect.stringContaining('y2Bars="rain"'),
    ]);
    const oneAxis = print('two-y-axes', { y2: false });
    expect(oneAxis[0]).toContain(`    lines: 'temperature',
    xAxis: { label: '' },
    yAxis: { label: '°C and mm' },
    colors: ['#0891b2', '#2563eb'],
    bars: 'rain',
`);
    for (const source of oneAxis) expect(source).not.toContain('y2');

    expect(print('line-log')).toEqual([
      `import { lineChart } from 'swiftplot/charts';
import rows from './growth.json';

const el = document.getElementById('chart');
if (el) {
  lineChart(el, {
    data: rows,
    xAxis: { label: 'Week', domain: [0, 51] },
    yAxis: { label: 'Weekly users', scale: 'log', format: v => v.toLocaleString('en') },
    colors: ['#0891b2'],
  });
}
`,
      expect.stringContaining("scale: 'log', format: v => v.toLocaleString('en')"),
      expect.stringContaining("scale: 'log', format: v => v.toLocaleString('en')"),
    ]);
    for (const source of print('line-log', { 'yAxis.scale': 'linear' }))
      expect(source).not.toMatch(/scale|log/);

    expect(print('line-annotated')).toEqual([
      `import { lineChart } from 'swiftplot/charts';
import { gradient } from 'swiftplot';
import rows from './cpu.json';

const el = document.getElementById('chart');
if (el) {
  lineChart(el, {
    data: rows,
    rules: [
      { y: 80, color: '#9333ea', dashed: true, text: 'Alert at 80%' },
    ],
    zones: [
      { x: [9, 17], color: '#2563eb', text: 'Working hours' },
    ],
    xAxis: { label: 'Hour of the day', domain: [0, 23.5] },
    yAxis: { label: 'CPU load (%)', domain: [0, 100] },
    colors: ['#0891b2'],
    fill: gradient(0.4, 0),
  });
}
`,
      expect.stringContaining('fill={gradient(0.4, 0)}'),
      expect.stringContaining(':fill="gradient(0.4, 0)"'),
    ]);
    for (const source of print('line-annotated', { fill: false }))
      expect(source).not.toMatch(/fill|gradient/);

    expect(print('line-brush')).toEqual([
      `import { lineChart } from 'swiftplot/charts';
import rows from './requests.json';

const el = document.getElementById('chart');
if (el) {
  lineChart(el, {
    data: rows,
    y: 'api',
    xAxis: { label: '' },
    yAxis: { label: 'Requests' },
    colors: ['#0891b2'],
    brush: true,
    zoom: true,
  });
}
`,
      expect.stringMatching(/ brush\s+zoom /),
      expect.stringMatching(/ brush\s+zoom /),
    ]);
    for (const axes of ['y', 'xy'])
      expect(print('line-brush', { axes })).toEqual([
        expect.stringContaining(`    brush: { axes: '${axes}' },\n    zoom: { axes: '${axes}' },\n`),
        expect.stringMatching(
          new RegExp(`brush=\\{\\{ axes: '${axes}' \\}\\}\\s+zoom=\\{\\{ axes: '${axes}' \\}\\}`),
        ),
        expect.stringMatching(
          new RegExp(`:brush="\\{ axes: '${axes}' \\}"\\s+:zoom="\\{ axes: '${axes}' \\}"`),
        ),
      ]);

    for (const [on, source] of [true, false].flatMap(on =>
      print('line-live', { animate: on }).map(source => [on, source] as const),
    )) {
      expect(source).toContain('r.s + rows.length');
      expect(source).toContain('setInterval');
      expect(source).toContain('clearInterval(timer)');
      expect(source.includes('animate')).toBe(!on);
    }
    expect(print('line-live')[0]).toContain(`  const chart = lineChart(el, {
    data,
    xAxis: { label: 'Seconds', domain: 'data' },
    yAxis: { label: 'Reading', domain: [0, 100] },
    colors: ['#0891b2'],
  });`);

    expect(print('strip-plot')).toEqual([
      `import { scatterChart } from 'swiftplot/charts';
import rows from './deliveries.json';

const el = document.getElementById('chart');
if (el) {
  scatterChart(el, {
    data: rows,
    x: 'minutes',
    y: 'courier',
    shape: 'tick',
    alpha: 0.6,
    xAxis: { label: 'Minutes' },
    yAxis: { label: '' },
    colors: ['#0891b2'],
    r: 10,
  });
}
`,
      expect.stringContaining('r={10}'),
      expect.stringContaining(':r="10"'),
    ]);
    expect(print('strip-plot', { r: '16' })[0]).toContain('    r: 16,\n');
  });

  test('data a switch or a prop puts is printed in place of the file import', () => {
    const other = [{ day: '2026-01-02', v: 2 }];
    const fixed = example({ ...easyData, props: { data: other }, switches: [] });
    const at = (by: string) => `[
${by}  { day: '2026-01-02', v: 2 },
${by}]`;
    const printed = {
      js: `import { lineChart } from 'swiftplot/charts';

const el = document.getElementById('chart');
if (el) {
  lineChart(el, {
    data: ${at('    ')},
    colors: ${colors},
  });
}
`,
      react: `import { LineChart } from '@swiftplot/react';

export function Chart() {
  return <LineChart data={${at('  ')}} colors={${colors}} />;
}
`,
      vue: `<script setup lang="ts">
import { LineChart } from '@swiftplot/vue';
</script>

<template>
  <LineChart :data="${at('  ')}" :colors="${colors}" />
</template>
`,
    };
    for (const fw of ['js', 'react', 'vue'] as const) {
      expect(print(fw, easyData, { data: 'other' })).toBe(printed[fw]);
      expect(print(fw, fixed)).toBe(printed[fw]);
      expect(print(fw, easyData)).toContain("import rows from './test-days.json';");
      expect(print(fw, easyData)).not.toContain('2026-11-01');
      const live = example({ ...easyLive, props: { data: other } });
      expect(print(fw, live)).toContain("import rows from './test-live.json';");
      expect(print(fw, live)).not.toContain('2026-01-02');
    }
  });

  test('a colors switch prints its value in place of the site colours', () => {
    const switched = example({ ...easyLine, id: 'test-colors-switch', switches: easyTree.switches });
    const four = "['#0891b2', '#2563eb', '#9333ea', '#d97706']";
    const printed = {
      js: [`colors: ${four}`, `colors: ${colors}`],
      react: [` colors={${four}}`, ` colors={${colors}}`],
      vue: [` :colors="${four}"`, ` :colors="${colors}"`],
    };
    for (const fw of ['js', 'react', 'vue'] as const) {
      const [site, fallback] = printed[fw] as [string, string];
      for (const [value, expected] of [
        ['site', site],
        ['palette', fallback],
      ] as const) {
        const out = print(fw, switched, { colors: value });
        expect(out).toContain(expected);
        expect(out.match(/colors/g)).toHaveLength(1);
      }
    }
  });

  test('a live block: one timer per mount, cleared when the chart goes, in each framework', () => {
    const step = 'rows => [...rows.slice(1), ...rows.slice(0, 1)]';
    expect(print('js', easyLive)).toBe(`import { lineChart } from 'swiftplot/charts';
import rows from './test-live.json';

/** @type {(data: typeof rows) => typeof rows} */
const step = ${step};

/** @param {HTMLElement} el */
function mount(el) {
  let data = rows;
  const chart = lineChart(el, {
    data,
    animate: true,
    colors: ${colors},
  });
  const timer = setInterval(() => {
    data = step(data);
    chart.update({ data });
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
    expect(print('react', easyLive)).toBe(`import { useEffect, useState } from 'react';
import { LineChart } from '@swiftplot/react';
import rows from './test-live.json';

const step: (data: typeof rows) => typeof rows = ${step};

export function Chart() {
  const [data, setData] = useState(rows);
  useEffect(() => {
    const timer = setInterval(() => setData(step), 1000);
    return () => clearInterval(timer);
  }, []);
  return <LineChart data={data} animate colors={${colors}} />;
}
`);
    expect(print('vue', easyLive)).toBe(`<script setup lang="ts">
import { LineChart } from '@swiftplot/vue';
import { onMounted, onUnmounted, shallowRef } from 'vue';
import rows from './test-live.json';

const step: (data: typeof rows) => typeof rows = ${step};

const data = shallowRef(rows);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    data.value = step(data.value);
  }, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <LineChart :data="data" animate :colors="${colors}" />
</template>
`);
  });
});

describe('tokens', () => {
  test('text(tokens) is the code exactly, and every kind is from the closed set', () => {
    const expected = {
      js: js("    zoom: true,\n    legend: false,\n    curve: 'step',\n"),
      react: react(' zoom legend={false} curve="step"'),
      vue: vue(' zoom :legend="false" curve="step"'),
    };
    for (const fw of Object.keys(frameworks) as (keyof typeof frameworks)[]) {
      const tokens = code(fw, lineZoom, { legend: false, curve: 'step' }, lineDefaults);
      expect(text(tokens)).toBe(expected[fw]);
      for (const t of tokens) {
        expect(t.text).not.toBe('');
        expect(kinds).toContain(t.kind);
      }
    }
  });

  test('keywords, strings and literals carry their kind', () => {
    const tokens = code('js', lineZoom, { curve: 'step' }, lineDefaults);
    const of = (kind: string) => tokens.filter(t => t.kind === kind).map(t => t.text);
    expect(of('keyword')).toEqual(['import', 'from', 'import', 'from', 'const', 'if', 'true']);
    expect(of('string')).toEqual([
      "'swiftplot/charts'",
      "'./requests.json'",
      "'chart'",
      "'step'",
      "'#0891b2'",
      "'#2563eb'",
      "'#9333ea'",
    ]);
  });
});
