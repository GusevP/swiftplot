import { imports, literal, packages, type Prop } from './js';
import { plain, string, type Token } from './tokens';

const ENTITIES: Record<string, string> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
export const escape = (s: string) => s.replace(/[&"<>]/g, c => ENTITIES[c]!);

function attribute([name, value]: Prop): Token[] {
  if (value === true) return [plain(` ${name}`)];
  if (typeof value === 'string') return [plain(` ${name}=`), string(`"${escape(value)}"`)];
  return [plain(` :${name}="`), ...literal(value).map(t => ({ ...t, text: escape(t.text) })), plain('"')];
}

export const setup = [plain('<script setup lang='), string('"ts"'), plain('>\n')];

export function vue(component: string, file: string, props: readonly Prop[]): Token[] {
  return [
    ...setup,
    ...imports(component, packages.vue, file),
    plain(`</script>\n\n<template>\n  <${component} :data="rows"`),
    ...props.flatMap(attribute),
    plain(' />\n</template>\n'),
  ];
}
