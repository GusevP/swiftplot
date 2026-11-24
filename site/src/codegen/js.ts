import { plain as isObject } from 'swiftplot/charts';
import type { Framework } from '../scripts/preferences';
import { keyword, number, plain, string, type Token } from './tokens';

export type Prop = readonly [name: string, value: unknown];

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
  const list = (items: Token[][]) => items.flatMap((item, i) => (i ? [plain(', '), ...item] : item));
  if (Array.isArray(value)) return [plain('['), ...list(value.map(literal)), plain(']')];
  if (isObject(value))
    return [
      plain('{ '),
      ...list(
        Object.entries(value).map(([k, v]) => [
          IDENTIFIER.test(k) ? plain(k) : string(quote(k)),
          plain(': '),
          ...literal(v),
        ]),
      ),
      plain(' }'),
    ];
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

export const imports = (name: string, from: string, file: string): Token[] => [
  ...importOf(`{ ${name} }`, from),
  ...importOf('rows', `./${file}`),
];

export function js(chart: string, file: string, props: readonly Prop[]): Token[] {
  return [
    ...imports(chart, packages.js, file),
    plain('\n'),
    keyword('const'),
    plain(' el = document.getElementById('),
    string("'chart'"),
    plain(');\n'),
    keyword('if'),
    plain(` (el) {\n  ${chart}(el, {\n    data: rows,\n`),
    ...props.flatMap(([name, value]) => [plain(`    ${name}: `), ...literal(value), plain(',\n')]),
    plain('  });\n}\n'),
  ];
}
