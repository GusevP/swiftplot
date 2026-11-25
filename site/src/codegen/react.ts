import { binding, dataImport, fromSwiftplot, importOf, literal, packages, step } from './js';
import type { Extra, From, Live, Prop } from './js';
import { indented, keyword, plain, string, type Token } from './tokens';

export const UNSAFE = /["&\\<>\n\r\u2028\u2029]/;

function attribute([name, value, code]: Prop): Token[] {
  if (value === true) return [plain(` ${name}`)];
  if (typeof value === 'string' && !UNSAFE.test(value)) return [plain(` ${name}=`), string(`"${value}"`)];
  return [plain(` ${name}={`), ...indented(code, '  '), plain('}')];
}

export const hooks = importOf('{ useEffect, useState }', 'react');
export const timer = (live: Live): Token[] => [
  plain('  '),
  keyword('const'),
  plain(' [data, setData] = useState(rows);\n  useEffect(() => {\n    '),
  keyword('const'),
  plain(' timer = setInterval(() => setData(step), '),
  ...literal(live.every),
  plain(');\n    '),
  keyword('return'),
  plain(' () => clearInterval(timer);\n  }, []);\n'),
];

export function react(
  component: string,
  data: From | undefined,
  props: readonly Prop[],
  { imports, live }: Extra,
): Token[] {
  return [
    ...(live ? hooks : []),
    ...importOf(`{ ${component} }`, packages.react),
    ...fromSwiftplot(imports),
    ...dataImport(data),
    plain('\n'),
    ...(live ? step(live, true) : []),
    keyword('export'),
    plain(' '),
    keyword('function'),
    plain(' Chart() {\n'),
    ...(live ? timer(live) : []),
    plain('  '),
    keyword('return'),
    plain(` <${component}`),
    ...(data ? [plain(` data={${live ? 'data' : binding(data)}}`)] : []),
    ...props.flatMap(attribute),
    plain(' />;\n}\n'),
  ];
}
