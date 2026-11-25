import { binding, dataImport, fromSwiftplot, importOf, literal, packages, step } from './js';
import type { Extra, From, Live, Prop } from './js';
import { indented, keyword, plain, string, type Token } from './tokens';

const ENTITIES: Record<string, string> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
export const escape = (s: string) => s.replace(/[&"<>]/g, c => ENTITIES[c]!);
/** For a bound expression, which vue-tsc reads without decoding it: only what would end it or be decoded by Vue. */
const bound = (s: string) => s.replace(/"|&(?=#|[a-z])/gi, c => ENTITIES[c]!);

function attribute([name, value, code]: Prop): Token[] {
  if (value === true) return [plain(` ${name}`)];
  if (typeof value === 'string') return [plain(` ${name}=`), string(`"${escape(value)}"`)];
  return [
    plain(` :${name}="`),
    ...indented(code, '  ').map(t => ({ ...t, text: bound(t.text) })),
    plain('"'),
  ];
}

export const setup = [plain('<script setup lang='), string('"ts"'), plain('>\n')];

export const timer = (live: Live): Token[] => [
  keyword('const'),
  plain(' data = shallowRef(rows);\n'),
  keyword('let'),
  plain(' timer: ReturnType<'),
  keyword('typeof'),
  plain(
    ' setInterval> | undefined;\nonMounted(() => {\n  timer = setInterval(() => {\n    data.value = step(data.value);\n  }, ',
  ),
  ...literal(live.every),
  plain(');\n});\nonUnmounted(() => clearInterval(timer));\n'),
];

export function vue(
  component: string,
  data: From | undefined,
  props: readonly Prop[],
  { imports, live }: Extra = {},
): Token[] {
  return [
    ...setup,
    ...importOf(`{ ${component} }`, packages.vue),
    ...fromSwiftplot(imports),
    ...(live ? importOf('{ onMounted, onUnmounted, shallowRef }', 'vue') : []),
    ...dataImport(data),
    ...(live ? [plain('\n'), ...step(live, true), ...timer(live)] : []),
    plain(`</script>\n\n<template>\n  <${component}`),
    ...(data ? [plain(` :data="${live ? 'data' : binding(data)}"`)] : []),
    ...props.flatMap(attribute),
    plain(' />\n</template>\n'),
  ];
}
