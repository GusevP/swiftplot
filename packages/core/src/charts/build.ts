import { animate } from '../features/animate.js';
import { legend } from '../features/legend.js';
import { tooltip, type TooltipOptions } from '../features/tooltip.js';
import { zoom } from '../features/zoom.js';
import { time, type TimeOptions } from '../scales/time.js';
import { dark, light, type Theme } from '../theme.js';
import type { Axis, Feature, Options } from '../types.js';
import {
  create,
  PASSED,
  type Build,
  type Context,
  type ControllerProps,
  type EasyChart,
} from './controller.js';
import { source, type Data, type Source } from './source.js';
import type {
  AreaProps,
  Axes,
  BarProps,
  Base,
  BoxPlotProps,
  CandlestickProps,
  ComboProps,
  FunnelProps,
  HeatmapProps,
  HistogramProps,
  Input,
  LineProps,
  PieProps,
  RadarProps,
  RadialBarProps,
  SankeyProps,
  ScatterProps,
  SunburstProps,
  TreemapProps,
  XAxisProps,
  YAxisProps,
} from './types.js';

export const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export const on = <T extends object>(v: boolean | T | undefined): T | false =>
  v === true ? ({} as T) : v || false;

export const sizeOf = (p: Base) =>
  defined({
    width: p.width,
    height: p.height,
    margin: p.margin,
    description: p.description,
    dim: p.dim === false ? 1 : (p.dim ?? 0.3),
  });

export const featuresOf = (p: Base & Pick<Axes, 'zoom'>, listed: number) => ({
  tooltip: p.tooltip !== false,
  legend: p.legend !== false && listed >= 2 && (typeof p.legend === 'object' ? p.legend : {}),
  zoom: on(p.zoom),
  animate: on(p.animate ?? true),
});

export const install = (f: ReturnType<typeof featuresOf>, tip: TooltipOptions): Feature[] =>
  [
    f.tooltip && tooltip(tip),
    f.legend && legend(f.legend),
    f.zoom && zoom(f.zoom),
    f.animate && animate(f.animate),
  ].filter((x): x is Feature => !!x);

export const linear = (a: YAxisProps | undefined, label: string): Axis =>
  defined({
    domain: a?.domain ?? 'nice',
    label: a?.label ?? label,
    step: a?.step,
    format: a?.format,
    fit: a?.fit,
  });

export const dates = (a: XAxisProps | undefined, label: string, utc: boolean): Axis =>
  time({
    label: a?.label ?? label,
    utc,
    format: a?.format,
    fit: a?.fit,
    ...(Array.isArray(a?.domain) && { domain: a.domain }),
    ...(a?.unit && { unit: a.unit, every: a.every }),
  } as TimeOptions);

export const given = (p: object, k: string) => (p as Record<string, unknown>)[k] !== undefined;

export function noAxes(p: object, name: string) {
  for (const k of ['xAxis', 'yAxis', 'zoom'])
    if (given(p, k)) throw new Error(`${name}: ${k} does not apply, as there are no axes`);
}

const themeFor = (t: Base['theme']): Theme | undefined =>
  t === 'light' ? light : t === 'dark' ? dark : t === 'auto' ? undefined : t;

/** The options plot() would get, without an element: a theme of 'auto' builds with the light theme and leaves it out. */
function specOf<P extends ControllerProps>(build: Build<P>, p: P): Options {
  const theme = themeFor(p.theme);
  const context: Context = {
    source: source(p.data as Data | null | undefined) as Source<never>,
    theme: theme ?? light,
    memo: (_name, _deps, make) => make(),
  };
  const b = build(p, context);
  const passed = Object.fromEntries(
    [...PASSED].filter(k => p[k as keyof P] !== undefined).map(k => [k, p[k as keyof P]]),
  );
  const given = !theme && b.options.theme === light ? undefined : b.options.theme;
  return defined({ ...b.options, theme: given, ...passed, use: b.use() }) as Options;
}

type Kinds<D> = {
  line: LineProps<D>;
  area: AreaProps<D>;
  bar: BarProps<D>;
  scatter: ScatterProps<D>;
  pie: PieProps<D>;
  funnel: FunnelProps<D>;
  radialBar: RadialBarProps<D>;
  radar: RadarProps<D>;
  heatmap: HeatmapProps<D>;
  histogram: HistogramProps<D>;
  boxPlot: BoxPlotProps<D>;
  candlestick: CandlestickProps<D>;
  combo: ComboProps<D>;
  sankey: SankeyProps<D>;
  treemap: TreemapProps;
  sunburst: SunburstProps;
};
type Supplied<K extends keyof Kinds<never>, D = Input | undefined> = D extends unknown ? Kinds<D>[K] : never;
type Later<K extends keyof Kinds<never>> = Omit<EasyChart<never>, 'update'> & {
  update<D extends Input | undefined = undefined>(props: Partial<Kinds<D>[K]> & { data?: D | null }): void;
};
type ChartOf<K extends keyof Kinds<never>, D> = [D] extends [undefined | readonly never[]]
  ? K extends 'treemap' | 'sunburst'
    ? EasyChart<Kinds<D>[K]>
    : Later<K>
  : EasyChart<Kinds<D>[K]>;

export function easyChart<K extends keyof Kinds<never>>(build: Build<Supplied<K>>) {
  return Object.assign(
    <D extends Input | undefined = undefined>(el: HTMLElement, props: Kinds<D>[K]): ChartOf<K, D> =>
      create(el, props as never, build as Build<never>) as unknown as ChartOf<K, D>,
    {
      spec: <D extends Input | undefined = undefined>(props: Kinds<D>[K]) =>
        specOf(build as Build<never>, props as never),
    },
  );
}
