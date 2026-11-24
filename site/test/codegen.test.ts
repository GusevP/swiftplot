import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import { code, defaults, frameworks, signature, siteColors } from '../src/codegen/index';
import { kinds, text } from '../src/codegen/tokens';
import { example, type EasyExample } from '../src/examples/define';
import { examples } from '../src/examples/index';
import { reference } from '../src/reference/index';
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
  <AreaChart :data="rows" v-bind="props" />
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
