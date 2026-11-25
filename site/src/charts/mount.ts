import { dark, light, plot, type Chart, type Options } from 'swiftplot';
import {
  areaChart,
  barChart,
  boxPlotChart,
  candlestickChart,
  comboChart,
  funnelChart,
  heatmapChart,
  histogramChart,
  lineChart,
  pieChart,
  plain,
  radarChart,
  radialBarChart,
  sankeyChart,
  scatterChart,
  sunburstChart,
  treemapChart,
  type EasyChart,
} from 'swiftplot/charts';
import { siteColors } from '../codegen/index';
import {
  resolve,
  type ChartName,
  type EasyExample,
  type Example,
  type PlotExample,
  type State,
} from '../examples/define';
import { fixtures } from '../examples/fixtures';
import {
  contents,
  evaluate,
  evaluateProps,
  isNode,
  useOf,
  type Data,
  type Rows,
  type Tree,
} from '../examples/tree';

type Props = Record<string, unknown>;
const charts = {
  lineChart,
  areaChart,
  barChart,
  scatterChart,
  pieChart,
  funnelChart,
  radialBarChart,
  radarChart,
  heatmapChart,
  histogramChart,
  boxPlotChart,
  candlestickChart,
  sankeyChart,
  treemapChart,
  sunburstChart,
  comboChart,
} satisfies Record<ChartName, unknown> as unknown as Record<
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

/** The tree or the props in the page's theme: the site's light colours where core takes a colour become the current ones, and `palette` its dark twin. */
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

/** `next` as an update that resets what `was` had and `next` leaves out. */
const replacing = (was: object, next: object): Record<string, unknown> => ({
  ...Object.fromEntries(Object.keys(was).map(key => [key, undefined])),
  ...next,
});

function stepping(live: Tree['live'], data: Data, show: (rows: Rows) => void) {
  if (!live || data.kind === 'json') return undefined;
  let { rows } = data;
  return setInterval(() => show((rows = (live.step.impl as (rows: Rows) => Rows)(rows))), live.every);
}

function mountPlot(el: HTMLElement, definition: PlotExample, state: State, legend: boolean): Mounted {
  const live = definition.tree.live;
  const resolved = (state: State): Tree => {
    const tree = resolve(definition, state);
    return legend || !tree.use ? tree : { ...tree, use: tree.use.filter(f => f.feature !== 'legend') };
  };
  let tree = resolved(state);
  let data: Data = definition.data;
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
    const { use: _, ...partial } = replacing(shown, next);
    shown = next;
    chart.update(partial);
  };
  const start = () => {
    shown = options();
    chart = plot(el, shown);
    timer = stepping(live, data, rows => {
      data = { file: data.file, rows };
      redraw();
    });
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

function mountEasy(el: HTMLElement, definition: EasyExample, state: State, legend: boolean): Mounted {
  let stepped = contents(definition.data);
  const props = (): Props => {
    const { data, ...resolved } = resolve(definition, state);
    const { theme, colors } = look();
    const painted = themed(resolved, colors, theme === 'dark') as Props;
    return {
      ...(!definition.palette && { colors }),
      ...evaluateProps(painted, definition.data, definition.id),
      data: definition.live ? stepped : data,
      theme,
      ...(!legend && { legend: false }),
    };
  };
  let shown = props();
  const chart = charts[definition.chart](el, shown);
  const redraw = () => {
    const was = shown;
    shown = props();
    chart.update(replacing(was, shown));
  };
  const timer = stepping(definition.live, definition.data, rows => chart.update({ data: (stepped = rows) }));
  const watch = new MutationObserver(redraw);
  watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return {
    update(next) {
      state = next;
      redraw();
    },
    destroy() {
      watch.disconnect();
      clearInterval(timer);
      chart.destroy();
    },
  };
}

const scripts = import.meta.glob<{ mount(el: HTMLElement): { destroy(): void } }>(
  '../examples/scripted/*/chart.js',
);

/** A hand-written example: the mount of its chart.js, made again when the theme changes, as its charts follow the page's. */
export async function loadScripted(id: string): Promise<(el: HTMLElement) => { destroy(): void }> {
  const script = await scripts[`../examples/scripted/${id}/chart.js`]!();
  return el => {
    let made = script.mount(el);
    const watch = new MutationObserver(() => {
      made.destroy();
      made = script.mount(el);
    });
    watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return {
      destroy() {
        watch.disconnect();
        made.destroy();
      },
    };
  };
}

export function mountExample(
  el: HTMLElement,
  definition: Example,
  state: State,
  { legend = true }: { legend?: boolean } = {},
): Mounted {
  return definition.kind === 'plot'
    ? mountPlot(el, definition, state, legend)
    : mountEasy(el, definition, state, legend);
}
