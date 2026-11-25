import * as core from 'swiftplot';
import { plain as isObject } from 'swiftplot/charts';
import { checkedStates, resolve, type PlotExample, type State } from '../examples/define';
import { isNode, useOf, type AxisNode, type Data, type FeatureNode, type MarkNode } from '../examples/tree';
import type { Framework } from '../scripts/preferences';
import {
  binding,
  dataImport,
  element,
  fromSwiftplot,
  IDENTIFIER,
  importOf,
  literal,
  liveModule,
  packages,
  quote,
  step,
} from './js';
import { hooks, timer as reactTimer, UNSAFE } from './react';
import { BREAK, indented, keyword, plain, string, text, type Token } from './tokens';
import { escape, setup, timer as vueTimer } from './vue';

type Line = Token[];

const words = (list: string) => new Set(list.split(/\s+/));
const TAKEN = words(`rows data el step options chart timer mount Chart Plot PlotProps
  useEffect useState setData computed onMounted onUnmounted shallowRef
  Float64Array Number String Date NaN Infinity undefined setInterval clearInterval document
  Math JSON Intl Array Object Boolean Symbol BigInt RegExp Error Map Set isNaN isFinite parseInt parseFloat`);
const RESERVED =
  words(`await break case catch class const continue debugger default delete do else enum export
  extends false finally for function if implements import in instanceof interface let new null package private
  protected public return static super switch this throw true try typeof var void while with yield arguments eval`);

const join = (items: readonly Token[][], by = ', ') =>
  items.flatMap((item, i) => (i ? [plain(by), ...item] : item));

const broken = (open: string, items: readonly Token[][], close: string): Token[] => [
  plain(open),
  ...items.flatMap(item => [BREAK, plain('  '), ...indented(item, '  '), plain(',')]),
  BREAK,
  plain(close),
];

/** The ids of the axes a `scaled` node reads, which the code names as constants. */
function scaledAxes(v: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(v)) for (const x of v) scaledAxes(x, found);
  else if (isObject(v)) {
    if (v.node === 'scaled') found.add(v.axis as string);
    for (const x of Object.values(v)) scaledAxes(x, found);
  }
  return found;
}

/** Prints the resolved tree's values, collecting the imports and the column and axis lines they need. */
export function printer(data: Data, rows: string = binding(data), hoisted: ReadonlySet<string> = new Set()) {
  const imports = new Set<string>();
  const columns = new Map<string, { name: string; line: Line }>();
  const taken = new Set(TAKEN);
  const unique = (base: string) => {
    let name = base;
    for (let i = 2; taken.has(name) || name in core; i++) name = `${base}${i}`;
    taken.add(name);
    return name;
  };
  const axisNames = new Map(
    [...hoisted].map(id => [id, unique(IDENTIFIER.test(id) && !RESERVED.has(id) ? id : 'axis')]),
  );

  const column = (key: string, as: string) => {
    const id = `${as}:${key}`;
    const known = columns.get(id);
    if (known) return known.name;
    const name = unique(IDENTIFIER.test(key) && !RESERVED.has(key) ? key : 'column');
    const field = IDENTIFIER.test(key) ? `r.${key}` : `r[${quote(key)}]`;
    const all = (type: string) => data.kind !== 'json' && data.rows.every(r => typeof r[key] === type);
    const number = all('number') ? field : `Number(${field})`;
    const read =
      as === 'text'
        ? `${rows}.map(r => ${all('string') ? field : `String(${field})`})`
        : `Float64Array.from(${rows}, r => ${
            as !== 'time' || all('number')
              ? number
              : all('string')
                ? `Date.parse(${field})`
                : `typeof ${field} === 'string' ? Date.parse(${field}) : ${number}`
          })`;
    columns.set(id, { name, line: [keyword('const'), plain(` ${name} = ${read};`)] });
    return name;
  };

  const object = (entries: readonly (readonly [string, unknown])[], spread?: Token[]): Token[] => {
    const parts = [
      ...(spread ? [[plain('...'), ...spread]] : []),
      ...entries
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [IDENTIFIER.test(k) ? plain(k) : string(quote(k)), plain(': '), ...value(v)]),
    ];
    if (parts.some(p => p.includes(BREAK))) return broken('{', parts, '}');
    return parts.length ? [plain('{ '), ...join(parts), plain(' }')] : [plain('{}')];
  };

  const call = (name: string, args: readonly unknown[]): Token[] => {
    imports.add(name);
    return [plain(`${name}(`), ...join(args.map(value)), plain(')')];
  };

  const value = (v: unknown): Token[] => {
    if (!isNode(v)) {
      if (Array.isArray(v)) {
        const items = v.map(value);
        return v.some(x => !Array.isArray(x) && !isNode(x) && isObject(x))
          ? broken('[', items, ']')
          : [plain('['), ...join(items), plain(']')];
      }
      return isObject(v) ? object(Object.entries(v)) : literal(v);
    }
    switch (v.node) {
      case 'col':
        return [plain(column(v.name, v.as))];
      case 'dataset':
        return [plain(rows)];
      case 'ref':
        imports.add(v.name);
        return [plain(v.name)];
      case 'call':
        return call(v.name, v.args);
      case 'param':
        return value(v.value);
      case 'fn':
        return [plain(v.source)];
      case 'scaled':
        return [plain(`${axisNames.get(v.axis)}.col(`), ...value(v.of), plain(')')];
      default:
        throw new Error(`codegen: a ${v.node} node cannot stand as a value`);
    }
  };

  const args = (a: unknown) => (a === undefined ? [] : [a]);
  const mark = (m: MarkNode): Token[] => {
    imports.add(m.mark);
    return [
      plain(`${m.mark === 'radar' ? '...' : ''}${m.mark}(`),
      ...object(Object.entries(m.args as object), m.spread && value(m.spread.call)),
      plain(')'),
    ];
  };
  const feature = (f: FeatureNode) => call(f.feature, args(f.args));
  const axis = (a: AxisNode): Token[] => {
    const printed = a.scale === 'linear' ? value(a.args) : call(a.scale, args(a.args));
    const name = axisNames.get(a.id);
    if (name === undefined) return printed;
    columns.set(`axis:${a.id}`, {
      name,
      line: [keyword('const'), plain(` ${name} = `), ...printed, plain(';')],
    });
    return [plain(name)];
  };

  return { imports, columns: () => [...columns.values()].map(c => c.line), value, mark, feature, axis };
}

type Entry = { name: string; value: Token[]; items?: Token[][]; raw?: unknown; attribute?: Token[] };

function entries(definition: PlotExample, state: State, rows: string) {
  const tree = resolve(definition, state);
  const print = printer(definition.data, rows, scaledAxes([tree.marks, tree.use]));
  const list: Entry[] = Object.entries(tree.frame ?? {}).map(([name, v]) => ({
    name,
    raw: v,
    value: ['x', 'y', 'y2'].includes(name) ? print.axis(v as AxisNode) : print.value(v),
  }));
  list.push({ name: 'marks', value: [], items: tree.marks.map(print.mark) });
  const on = (tree.use ?? []).filter(f => f.on);
  if (on.length) list.push({ name: 'use', value: [], items: on.map(print.feature) });
  return { print, list };
}

/** Prints each entry as `open(name)`, its value and `end`; a list puts its items one to a line. */
function lines(list: readonly Entry[], indent: string, open: (name: string) => string, end: string): Token[] {
  return list.flatMap(e =>
    e.attribute
      ? [plain(`${indent}${e.name}=`), ...e.attribute, plain('\n')]
      : e.items
        ? [
            plain(`${indent}${open(e.name)}[\n`),
            ...e.items.flatMap(item => [
              plain(`${indent}  `),
              ...indented(item, `${indent}  `),
              plain(',\n'),
            ]),
            plain(`${indent}]${end}`),
          ]
        : [plain(`${indent}${open(e.name)}`), ...indented(e.value, indent), plain(end)],
  );
}
const objectLines = (list: readonly Entry[], indent: string) =>
  list.flatMap(e =>
    !e.items && text(e.value) === e.name
      ? [plain(`${indent}${e.name},\n`)]
      : lines([e], indent, n => `${n}: `, ',\n'),
  );
const block = (code: readonly Line[], indent: string) =>
  code.flatMap(line => [plain(indent), ...indented(line, indent), plain('\n')]);

/** For a switch that changes `use`, which the wrappers read only on mount: a key that differs per `use`. */
function key(definition: PlotExample, state: State): string | undefined {
  const use = (s: State) => useOf(resolve(definition, s));
  const states = checkedStates(definition.switches);
  const current = use(state);
  const shown = states.find(s => use(s) === current) ?? state;
  const parts = definition.switches
    .filter(s => {
      const values: readonly unknown[] = s.kind === 'boolean' ? [true, false] : s.values;
      return states.some(base => new Set(values.map(v => use({ ...base, [s.id]: v }))).size > 1);
    })
    .map(s => {
      const v = Object.hasOwn(shown, s.id) ? shown[s.id] : s.value;
      return `${s.id}-${typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v)}`;
    });
  return parts.length ? parts.join(' ') : undefined;
}

function js(definition: PlotExample, state: State): Token[] {
  const live = definition.tree.live;
  const { print, list } = entries(definition, state, live ? 'data' : binding(definition.data));
  const imports = fromSwiftplot([...print.imports, 'plot']);
  const head = [...imports, ...dataImport(definition.data), plain('\n')];
  if (!live) {
    const columns = print.columns();
    return [
      ...head,
      ...block(columns, ''),
      ...(columns.length ? [plain('\n')] : []),
      ...element,
      keyword('if'),
      plain(' (el) {\n  plot(el, {\n'),
      ...objectLines(list, '    '),
      plain('  });\n}\n'),
    ];
  }
  return [
    ...head,
    ...step(live, false),
    plain("/**\n * @param {typeof rows} data\n * @returns {import('swiftplot').Options}\n */\n"),
    keyword('function'),
    plain(' options(data) {\n'),
    ...block(print.columns(), '  '),
    plain('  '),
    keyword('return'),
    plain(' {\n'),
    ...objectLines(list, '    '),
    plain('  };\n}\n\n'),
    ...liveModule(live, [plain('plot(el, options(data))')], 'options(data)'),
  ];
}

function react(definition: PlotExample, state: State): Token[] {
  const live = definition.tree.live;
  const { print, list } = entries(definition, state, live ? 'data' : binding(definition.data));
  const k = key(definition, state);
  const props = [
    ...lines(
      [...(k === undefined ? [] : [{ name: 'key', raw: k, value: literal(k) }]), ...list].map(e =>
        typeof e.raw === 'string' && !UNSAFE.test(e.raw) ? { ...e, attribute: [string(`"${e.raw}"`)] } : e,
      ),
      '      ',
      n => `${n}={`,
      '}\n',
    ),
  ];
  const columns = print.columns();
  const head = [
    ...(live ? hooks : []),
    ...importOf('{ Plot }', packages.react),
    ...fromSwiftplot(print.imports),
    ...dataImport(definition.data),
    plain('\n'),
  ];
  const view = [
    plain('  '),
    keyword('return'),
    plain(' (\n    <Plot\n'),
    ...props,
    plain('    />\n  );\n}\n'),
  ];
  const component = [keyword('export'), plain(' '), keyword('function'), plain(' Chart() {\n')];
  if (!live)
    return [...head, ...block(columns, ''), ...(columns.length ? [plain('\n')] : []), ...component, ...view];
  return [...head, ...step(live, true), ...component, ...reactTimer(live), ...block(columns, '  '), ...view];
}

function vue(definition: PlotExample, state: State): Token[] {
  const live = definition.tree.live;
  const { print, list } = entries(definition, state, live ? 'data.value' : binding(definition.data));
  const k = key(definition, state);
  const columns = print.columns();
  const head = [
    ...setup,
    ...importOf('{ Plot, type PlotProps }', packages.vue),
    ...fromSwiftplot(print.imports),
    ...(live ? importOf('{ computed, onMounted, onUnmounted, shallowRef }', 'vue') : []),
    ...dataImport(definition.data),
    plain('\n'),
  ];
  const template = plain(
    `</script>\n\n<template>\n  <Plot${k ? ` key="${escape(k)}"` : ''} v-bind="options" />\n</template>\n`,
  );
  if (!live)
    return [
      ...head,
      ...block(columns, ''),
      ...(columns.length ? [plain('\n')] : []),
      keyword('const'),
      plain(' options: PlotProps = {\n'),
      ...objectLines(list, '  '),
      plain('};\n'),
      template,
    ];
  return [
    ...head,
    ...step(live, true),
    ...vueTimer(live),
    plain('\n'),
    keyword('const'),
    plain(' options = computed((): PlotProps => {\n'),
    ...block(columns, '  '),
    plain('  '),
    keyword('return'),
    plain(' {\n'),
    ...objectLines(list, '    '),
    plain('  };\n});\n'),
    template,
  ];
}

export function plotCode(framework: Framework, definition: PlotExample, state: State): Token[] {
  if (framework === 'react') return react(definition, state);
  if (framework === 'vue') return vue(definition, state);
  return js(definition, state);
}
