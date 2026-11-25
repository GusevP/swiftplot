import type { Data, Tree } from '../examples/tree';
import type { Framework } from '../scripts/preferences';
import { indented, keyword, number, plain, string, type Token } from './tokens';

export type Prop = readonly [name: string, value: unknown, code: Token[]];
export type Live = NonNullable<Tree['live']>;
export type From = { kind?: Data['kind']; file: string };
/** The code of an easy chart beside its props: the `swiftplot` imports they need and the timer that steps its rows. */
export type Extra = { imports?: ReadonlySet<string>; live?: Live };

const ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "\\'",
  '\n': '\\n',
  '\r': '\\r',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export const quote = (s: string): string => `'${s.replace(/[\\'\n\r\u2028\u2029]/g, c => ESCAPES[c]!)}'`;

export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function literal(value: unknown): Token[] {
  if (typeof value === 'string') return [string(quote(value))];
  if (typeof value === 'number') return [number(String(value))];
  if (typeof value === 'boolean' || value === null) return [keyword(String(value))];
  throw new Error(`codegen: cannot print ${typeof value}`);
}

export const packages: Record<Framework, string> = {
  js: 'swiftplot/charts',
  react: '@swiftplot/react',
  vue: '@swiftplot/vue',
};

export const importOf = (binding: string, from: string): Token[] => [
  keyword('import'),
  plain(` ${binding} `),
  keyword('from'),
  plain(' '),
  string(quote(from)),
  plain(';\n'),
];

export const fromSwiftplot = (names: Iterable<string> = []): Token[] => {
  const list = [...names].sort();
  return list.length ? importOf(`{ ${list.join(', ')} }`, 'swiftplot') : [];
};

export const binding = (data: From) => (data.kind === 'json' ? 'data' : 'rows');
export const dataImport = (data: From | undefined): Token[] =>
  data ? importOf(binding(data), `./${data.file}`) : [];

const STEP = '(data: typeof rows) => typeof rows';
export const step = (live: Live, typed: boolean): Token[] => [
  ...(typed ? [] : [plain(`/** @type {${STEP}} */\n`)]),
  keyword('const'),
  plain(` step${typed ? `: ${STEP}` : ''} = ${live.step.source};\n\n`),
];

export const element = [
  keyword('const'),
  plain(' el = document.getElementById('),
  string("'chart'"),
  plain(');\n'),
];

/** A module that mounts `chart` once on #chart, with a timer that updates it with `update`. */
export const liveModule = (live: Live, chart: readonly Token[], update: string): Token[] => [
  plain('/** @param {HTMLElement} el */\n'),
  keyword('function'),
  plain(' mount(el) {\n  '),
  keyword('let'),
  plain(' data = rows;\n  '),
  keyword('const'),
  plain(' chart = '),
  ...chart,
  plain(';\n  '),
  keyword('const'),
  plain(` timer = setInterval(() => {\n    data = step(data);\n    chart.update(${update});\n  }, `),
  ...literal(live.every),
  plain(');\n  '),
  keyword('return'),
  plain(' {\n    destroy() {\n      clearInterval(timer);\n      chart.destroy();\n    },\n  };\n}\n\n'),
  ...element,
  keyword('export'),
  plain(' '),
  keyword('const'),
  plain(' chart = el ? mount(el) : undefined;\n'),
];

export function js(
  chart: string,
  data: From | undefined,
  props: readonly Prop[],
  { imports, live }: Extra,
): Token[] {
  const call: Token[] = [
    plain(`${chart}(el, {\n`),
    ...(data ? [plain(`    data${live || data.kind === 'json' ? '' : ': rows'},\n`)] : []),
    ...props.flatMap(([name, , code]) => [plain(`    ${name}: `), ...indented(code, '    '), plain(',\n')]),
    plain('  })'),
  ];
  return [
    ...importOf(`{ ${chart} }`, packages.js),
    ...fromSwiftplot(imports),
    ...dataImport(data),
    plain('\n'),
    ...(live
      ? [...step(live, false), ...liveModule(live, call, '{ data }')]
      : [...element, keyword('if'), plain(' (el) {\n  '), ...call, plain(';\n}\n')]),
  ];
}
