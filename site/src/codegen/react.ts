import { imports, literal, packages, type Prop } from './js';
import { keyword, plain, string, type Token } from './tokens';

export const UNSAFE = /["&\\<>\n\r\u2028\u2029]/;

function attribute([name, value]: Prop): Token[] {
  if (value === true) return [plain(` ${name}`)];
  if (typeof value === 'string' && !UNSAFE.test(value)) return [plain(` ${name}=`), string(`"${value}"`)];
  return [plain(` ${name}={`), ...literal(value), plain('}')];
}

export function react(component: string, file: string, props: readonly Prop[]): Token[] {
  return [
    ...imports(component, packages.react, file),
    plain('\n'),
    keyword('export'),
    plain(' '),
    keyword('function'),
    plain(' Chart() {\n  '),
    keyword('return'),
    plain(` <${component} data={rows}`),
    ...props.flatMap(attribute),
    plain(' />;\n}\n'),
  ];
}
