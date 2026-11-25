import * as swiftplotReact from '@swiftplot/react';
import * as swiftplotVue from '@swiftplot/vue';
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot, type Root } from 'react-dom/client';
import * as swiftplot from 'swiftplot';
import * as vue from 'vue';
import { contents } from '../../src/examples/tree';
import { animatedLive as live } from '../plot-definitions';

type Framework = 'js' | 'react' | 'vue';
const sources = JSON.parse(document.body.dataset.sources!) as Record<Framework, string>;

const timers = new Set<unknown>();
const { setInterval: set, clearInterval: clear } = globalThis;
globalThis.setInterval = ((...args: Parameters<typeof set>) => {
  const id = set(...args);
  timers.add(id);
  return id;
}) as typeof set;
globalThis.clearInterval = (id => {
  timers.delete(id);
  clear(id);
}) as typeof clear;

const modules: Record<string, unknown> = {
  swiftplot,
  react,
  'react/jsx-runtime': jsxRuntime,
  vue,
  '@swiftplot/react': swiftplotReact,
  '@swiftplot/vue': swiftplotVue,
  [`./${live.data.file}`]: { __esModule: true, default: contents(live.data) },
};

/** A fresh instance of a generated snippet, compiled to CommonJS on the server, with its imports served from here. */
function run(framework: Framework): Record<string, unknown> {
  const exports = {};
  const require = (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error(`the ${framework} snippet imports ${name}`);
    return modules[name];
  };
  // oxlint-disable-next-line typescript/no-implied-eval -- the point of this page is to run the generated code
  new Function('require', 'exports', sources[framework])(require, exports);
  return exports;
}

const element = (id: string) => document.getElementById(id)!;
let chart: { destroy(): void } | undefined;
let root: Root | undefined;
let app: vue.App | undefined;
const hosts: Record<Framework, { mount(): void; unmount(): void }> = {
  js: {
    mount: () => void (chart = run('js').chart as typeof chart),
    unmount: () => chart?.destroy(),
  },
  react: {
    mount() {
      root = createRoot(element('react'));
      root.render(react.createElement(run('react').Chart as react.FC));
    },
    unmount: () => root?.unmount(),
  },
  vue: {
    mount() {
      app = vue.createApp(run('vue').default as vue.Component);
      app.mount(element('vue'));
    },
    unmount: () => app?.unmount(),
  },
};

Object.assign(window, {
  host: {
    mount: (fw: Framework) => hosts[fw].mount(),
    unmount: (fw: Framework) => hosts[fw].unmount(),
    timers: () => timers.size,
  },
});
