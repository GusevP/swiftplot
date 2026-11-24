import { plain as isObject } from 'swiftplot/charts';
import { resolve, type ChartName, type EasyExample, type Example, type State } from '../examples/define';
import type { Entry } from '../reference/extract';
import type { Framework } from '../scripts/preferences';
import { importOf, js, literal, packages, type Prop } from './js';
import { plotCode } from './plot';
import { react } from './react';
import { keyword, plain, text, type Token } from './tokens';
import { setup, vue } from './vue';

export type Defaults = Readonly<Record<string, string>>;

export const defaults = (entries: readonly Entry[]): Defaults =>
  Object.fromEntries(entries.flatMap(e => (e.default === undefined ? [] : [[e.name, e.default]])));

export const frameworks: Record<Framework, { file: string; install: string }> = {
  js: { file: 'chart.js', install: 'npm i swiftplot' },
  react: { file: 'Chart.tsx', install: 'npm i swiftplot @swiftplot/react' },
  vue: { file: 'Chart.vue', install: 'npm i swiftplot @swiftplot/vue' },
};

const isDefault = (defaults: Defaults, name: string, value: unknown) =>
  ['string', 'number', 'boolean'].includes(typeof value) && defaults[name] === text(literal(value));

/** The light theme's --c1, --c2 and --c3 in tokens.css; a stylesheet cannot be imported where the smoke tests read the examples. */
export const siteColors = ['#0891b2', '#2563eb', '#9333ea'];

export function props(definition: EasyExample, state: State, defaults: Defaults): Prop[] {
  return Object.entries(resolve(definition, state)).flatMap(([name, value]): Prop[] => {
    if (name === 'data' || isDefault(defaults, name, value)) return [];
    if (Array.isArray(value) || !isObject(value)) return [[name, value]];
    const kept = Object.entries(value).filter(([k, v]) => !isDefault(defaults, `${name}.${k}`, v));
    return kept.length || !Object.keys(value).length ? [[name, Object.fromEntries(kept)]] : [];
  });
}

const componentOf = (chart: ChartName) => chart[0]!.toUpperCase() + chart.slice(1);

function plotSignature(framework: Framework): Token[] {
  if (framework === 'vue')
    return [
      ...setup,
      ...importOf('{ Plot }', packages.vue),
      plain('</script>\n\n<template>\n  <Plot v-bind="options" />\n</template>\n'),
    ];
  if (framework === 'react')
    return [...importOf('{ Plot }', packages.react), plain('\n<Plot {...options} />\n')];
  return [
    ...importOf('{ plot }', 'swiftplot'),
    plain('\n'),
    keyword('const'),
    plain(' chart = plot(el, options);\nchart.update(partialOptions);\nchart.destroy();\n'),
  ];
}

export function signature(framework: Framework, chart: ChartName | 'plot'): Token[] {
  if (chart === 'plot') return plotSignature(framework);
  const name = framework === 'js' ? chart : componentOf(chart);
  if (framework === 'vue') return vue(name, 'rows.json', [['v-bind', 'props']]);
  const head = [...importOf(`{ ${name} }`, packages[framework]), plain('\n')];
  if (framework === 'react') return [...head, plain(`<${name} data={rows} {...props} />\n`)];
  return [
    ...head,
    keyword('const'),
    plain(` chart = ${name}(el, props);\nchart.update(partialProps);\nchart.destroy();\n`),
  ];
}

export function code(framework: Framework, definition: Example, state: State, defaults: Defaults): Token[] {
  if (definition.kind === 'plot') return plotCode(framework, definition, state);
  const shown: Prop[] = [...props(definition, state, defaults), ['colors', siteColors]];
  const { chart, data } = definition;
  const component = componentOf(chart);
  if (framework === 'react') return react(component, data.file, shown);
  if (framework === 'vue') return vue(component, data.file, shown);
  return js(chart, data.file, shown);
}
