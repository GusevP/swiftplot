import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { code, defaults, signature } from '../src/codegen/index';
import { text } from '../src/codegen/tokens';
import {
  chartNames,
  checkedStates,
  example,
  type EasyExample,
  type Example,
  type State,
} from '../src/examples/define';
import { examples, unlisted } from '../src/examples/index';
import { contents } from '../src/examples/tree';
import { reference } from '../src/reference/index';
import type { Framework } from '../src/scripts/preferences';
import { definitions } from './plot-definitions';

const root = fileURLToPath(new URL('../.codegen-check/', import.meta.url));
const guide = readFileSync(new URL('../src/content/guides/getting-started.mdx', import.meta.url), 'utf8');
const bin = createRequire(import.meta.url);
const extensions: Record<Framework, string> = { js: '.js', react: '.react.tsx', vue: '.vue' };

const paths = {
  swiftplot: ['../../packages/core/src/index.ts'],
  'swiftplot/charts': ['../../packages/core/src/charts/index.ts'],
  '@swiftplot/react': ['../../packages/react/src/index.ts'],
  '@swiftplot/vue': ['../../packages/vue/src/index.ts'],
};

const written = new Map<string, string>();
function put(name: string, source: string) {
  expect(written.get(name) ?? source, `two definitions write different ${name}`).toBe(source);
  written.set(name, source);
  writeFileSync(`${root}${name}`, source);
}

function write(definition: Example, name: string, state: State): string[] {
  put(definition.data.file, JSON.stringify(contents(definition.data)));
  const shown = definition.kind === 'plot' ? {} : defaults(reference[definition.chart]);
  return (Object.entries(extensions) as [Framework, string][]).map(([fw, extension]) => {
    const source = text(code(fw, definition, state, shown));
    put(`${name}${extension}`, source);
    return source;
  });
}

function check(script: string, project: string) {
  const run = spawnSync(process.execPath, [bin.resolve(script), '-p', project, '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });
  const output = run.stdout + run.stderr;
  expect({ error: run.error, signal: run.signal, status: run.status }, output).toEqual({
    error: undefined,
    signal: null,
    status: 2,
  });
  const errors = [...output.matchAll(/^(?:(.+?)\((\d+,\d+)\): )?.*\berror TS\d+.*$/gm)];
  return { output, at: errors.map(([line, file, at]) => (file ? `${file}:${at}` : line)) };
}

test(
  'every example snippet typechecks in every checked state, and a wrong prop is reported at that prop',
  { timeout: 120_000 },
  () => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root);
    for (const e of [...examples.values(), ...unlisted, ...definitions])
      checkedStates(e.switches).forEach((state, i) => write(e, `${e.id}--${i}`, state));
    for (const chart of [...chartNames, 'plot'] as const)
      put(`signature--${chart}.vue`, text(signature('vue', chart)));
    put('rows.json', JSON.stringify([{ name: 'a', day: '2026-11-01', value: 1 }]));
    const fences = [...guide.matchAll(/^```(js|tsx|vue)\n([\s\S]*?)^```$/gm)];
    expect(fences.map(([, lang]) => lang)).toEqual(['js', 'tsx', 'vue']);
    for (const [, lang, source] of fences) put(`guide--getting-started.${lang}`, source!);
    const lineZoom = examples.get('line-zoom')!;
    const control = write(
      example({ ...(lineZoom as EasyExample), id: 'control', props: { curve: 'wavy' }, switches: [] }),
      'control',
      {},
    );
    const [js, react, vue] = control.map(source => {
      const lines = source.split('\n');
      const line = lines.findIndex(l => l.includes('wavy'));
      return `${line + 1},${lines[line]!.indexOf('curve') + 1}`;
    });

    const base = { extends: '../../tsconfig.base.json', compilerOptions: { paths, resolveJsonModule: true } };
    writeFileSync(
      `${root}tsconfig.json`,
      JSON.stringify({
        ...base,
        compilerOptions: { ...base.compilerOptions, allowJs: true, checkJs: true, jsx: 'react-jsx' },
        include: ['*.js', '*.tsx'],
      }),
    );
    writeFileSync(`${root}tsconfig.vue.json`, JSON.stringify({ ...base, include: ['*.vue'] }));

    const scripts = check('typescript/bin/tsc', 'tsconfig.json');
    expect(scripts.at, scripts.output).toEqual([`control.js:${js}`, `control.react.tsx:${react}`]);
    const templates = check('vue-tsc/bin/vue-tsc.js', 'tsconfig.vue.json');
    expect(templates.at, templates.output).toEqual([`control.vue:${vue}`]);
  },
);
