import { dark, light, plot, type Chart, type Options } from 'swiftplot';
import { areaChart, barChart, lineChart, plain, scatterChart, type EasyChart } from 'swiftplot/charts';
import { siteColors } from '../codegen/index';
import { resolve, type ChartName, type Example, type PlotExample, type State } from '../examples/define';
import { fixtures } from '../examples/fixtures';
import { evaluate, isNode, useOf, type Rows, type Tree } from '../examples/tree';

type Props = Record<string, unknown>;
const charts = { lineChart, areaChart, barChart, scatterChart } as unknown as Record<
  ChartName,
  (el: HTMLElement, props: Props) => EasyChart<Props>
>;

const root = document.documentElement;

const modules = import.meta.glob<{ default: Example }>([
  '../examples/*.ts',
  '!../examples/{define,fixtures,index,tree}.ts',
]);

export async function load(id: string): Promise<Example> {
  const module = modules[`../examples/${id}.ts`];
  if (module) return (await module()).default;
  const fixture = fixtures.find(d => d.id === id);
  if (fixture) return fixture;
  throw new Error(`no example module for "${id}"`);
}

function look() {
  const style = getComputedStyle(root);
  return {
    theme: root.dataset.theme === 'dark' ? ('dark' as const) : ('light' as const),
    colors: ['--c1', '--c2', '--c3'].map(name => style.getPropertyValue(name).trim()),
  };
}

const PAINT = new Set(['color', 'colors', 'fill', 'stroke', 'up', 'down', 'stops']);

/** The tree in the page's theme: the site's light colours where core takes a colour become the current ones, and `palette` its dark twin. */
function themed(v: unknown, colors: readonly string[], isDark: boolean, paint = false): unknown {
  if (typeof v === 'string') return paint ? (colors[siteColors.indexOf(v)] ?? v) : v;
  if (Array.isArray(v)) return v.map(x => themed(x, colors, isDark, paint));
  if (!plain(v)) return v;
  if (isNode(v)) {
    if (v.node === 'ref' && v.name === 'palette' && isDark) return { ...v, name: 'paletteDark' };
    if (v.node === 'param') return { ...v, value: themed(v.value, colors, isDark, paint) };
    if (v.node === 'call') return { ...v, args: themed(v.args, colors, isDark, paint) };
    if (v.node === 'col' || v.node === 'fn' || v.node === 'ref') return v;
  }
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, themed(x, colors, isDark, paint || PAINT.has(k))]),
  );
}

export type Mounted = { update(state: State): void; destroy(): void };

function mountPlot(el: HTMLElement, definition: PlotExample, state: State, legend: boolean): Mounted {
  const live = definition.tree.live;
  const resolved = (state: State): Tree => {
    const tree = resolve(definition, state);
    return legend || !tree.use ? tree : { ...tree, use: tree.use.filter(f => f.feature !== 'legend') };
  };
  let tree = resolved(state);
  let data = definition.data;
  let chart: Chart;
  let shown: Options;
  let timer: ReturnType<typeof setInterval> | undefined;
  const options = (): Options => {
    const { theme, colors } = look();
    const options = evaluate(themed(tree, colors, theme === 'dark') as Tree, data, definition.id);
    return { ...options, theme: theme === 'dark' ? dark : light };
  };
  const redraw = () => {
    const next = options();
    const { use: _, ...partial }: Record<string, unknown> = next;
    for (const key of Object.keys(shown)) if (!Object.hasOwn(next, key)) partial[key] = undefined;
    shown = next;
    chart.update(partial);
  };
  const start = () => {
    shown = options();
    chart = plot(el, shown);
    if (live)
      timer = setInterval(() => {
        if (data.kind === 'json') return;
        data = { ...data, rows: (live.step.impl as (rows: Rows) => Rows)(data.rows) };
        redraw();
      }, live.every);
  };
  const stop = () => {
    clearInterval(timer);
    chart.destroy();
  };
  start();
  const watch = new MutationObserver(redraw);
  watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return {
    update(next) {
      const was = useOf(tree);
      tree = resolved(next);
      if (useOf(tree) === was) return redraw();
      stop();
      start();
    },
    destroy() {
      watch.disconnect();
      stop();
    },
  };
}

export function mountExample(
  el: HTMLElement,
  definition: Example,
  state: State,
  { legend = true }: { legend?: boolean } = {},
): Mounted {
  if (definition.kind === 'plot') return mountPlot(el, definition, state, legend);
  const props = (state: State) => ({
    ...resolve(definition, state),
    ...look(),
    ...(!legend && { legend: false }),
  });
  const chart = charts[definition.chart](el, props(state));
  const watch = new MutationObserver(() => chart.update(look()));
  watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return {
    update: next => chart.update(props(next)),
    destroy() {
      watch.disconnect();
      chart.destroy();
    },
  };
}
