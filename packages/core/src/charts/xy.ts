import { animate } from '../features/animate.js';
import { legend } from '../features/legend.js';
import { tooltip } from '../features/tooltip.js';
import { zoom } from '../features/zoom.js';
import { area } from '../marks/area.js';
import { bar } from '../marks/bar.js';
import { dots } from '../marks/dots.js';
import { line } from '../marks/line.js';
import { band } from '../scales/band.js';
import { time, type TimeOptions } from '../scales/time.js';
import { dark, light, type Theme } from '../theme.js';
import type { Axis, Col, Feature, Options } from '../types.js';
import { create, PASSED, type Build, type Context, type EasyChart } from './controller.js';
import { bandTitle, colorsFor, formatNumber, timeTitle } from './defaults.js';
import { assign, type Assigned, type FieldProps, type Series } from './fields.js';
import { source, type Data, type Source } from './source.js';
import type { AreaProps, BarProps, Base, Input, LineProps, ScatterProps } from './types.js';

type XyProps = Base &
  FieldProps<never> & {
    data?: unknown;
    curve?: LineProps<undefined>['curve'];
    join?: boolean;
    stack?: boolean;
  };
type Text = { x: (x: number) => string; title: (x: number) => string; value: (y: number) => string };

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const on = <T extends object>(v: boolean | T | undefined): T | false => (v === true ? ({} as T) : v || false);

const ascending = (x: Col) => {
  for (let i = 1; i < x.length; i++) if (x[i]! < x[i - 1]!) return false;
  return true;
};

/** Line and area need ascending x; equal x keep their order. */
function sorted(ys: Series[]): Series[] {
  const orders = new Map<Col, number[] | undefined>();
  const order = (x: Col) => {
    if (!orders.has(x))
      orders.set(
        x,
        ascending(x) ? undefined : Array.from(x, (_, i) => i).sort((a, b) => x[a]! - x[b]! || a - b),
      );
    return orders.get(x);
  };
  const xs = new Map<Col, Col>();
  return ys.map(s => {
    const o = order(s.x);
    if (!o) return s;
    if (!xs.has(s.x))
      xs.set(
        s.x,
        Float64Array.from(o, i => s.x[i]!),
      );
    return { ...s, x: xs.get(s.x)!, y: Float64Array.from(o, i => s.y[i]!) };
  });
}

/** Each series' y at the slot of its x in order, NaN where it has no row, the last row winning. */
function laid(ys: Series[], order: ArrayLike<number>, x: Col): Series[] {
  const at = new Map(Array.from(order, (v, i) => [v, i]));
  return ys.map(s => {
    const y = new Float64Array(order.length).fill(Number.NaN);
    for (let i = 0; i < s.x.length; i++) y[at.get(s.x[i]!)!] = s.y[i]!;
    return { ...s, x, y };
  });
}

/** The core stacks row by row, so long series are laid over the sorted union of their x. */
function aligned(ys: Series[]): Series[] {
  const x = Float64Array.from(new Set(ys.flatMap(s => Array.from(s.x)))).sort();
  return laid(ys, x, x);
}

/** Wide data is one category per row; long data one per distinct x in order of first appearance, the last row winning. */
function categorical(
  { x: ax, ys, order: seen }: Assigned,
  utc: boolean,
  long: boolean,
): { categories: string[]; ys: Series[] } {
  const name =
    ax.kind === 'text'
      ? (v: number) => ax.categories![v]!
      : ax.kind === 'time'
        ? timeTitle(
            ys.map(s => s.x),
            utc,
          )
        : String;
  if (!long) {
    const xs = ys[0]?.x ?? [];
    const index = Float64Array.from(xs, (_, i) => i);
    return { categories: Array.from(xs, name), ys: ys.map(s => ({ ...s, x: index })) };
  }
  const order = seen ?? [];
  return {
    categories: order.map(name),
    ys: laid(
      ys,
      order,
      Float64Array.from(order, (_, i) => i),
    ),
  };
}

export function xy(name: string, kind: 'line' | 'area' | 'bar' | 'scatter' = 'line'): Build<XyProps> {
  return (p, { source: s, theme, memo }) => {
    const utc = kind === 'bar' || (p.xAxis?.utc ?? true);
    const scatter = kind === 'scatter';
    const rField = typeof p.r === 'number' ? undefined : p.r;
    const assigned = memo('fields', [s, p.x, ...[p.y ?? []].flat(), p.series, rField, utc], () =>
      assign(s, { ...p, xAxis: { utc } }, scatter ? 'scatter' : 'xy', name, kind === 'bar'),
    );
    const stacked = kind !== 'line' && !scatter && !!p.stack;
    const bars =
      kind === 'bar'
        ? memo('bars', [assigned], () => categorical(assigned, utc, p.series !== undefined))
        : undefined;
    const ys =
      bars?.ys ??
      (scatter ? assigned.ys : undefined) ??
      memo('sorted', [assigned, stacked], () =>
        stacked && p.series !== undefined ? aligned(assigned.ys) : sorted(assigned.ys),
      );
    const { x: ax, y: ay } = assigned;
    const xa = p.xAxis ?? {};
    const ya = p.yAxis ?? {};
    const label = xa.label ?? ax.label;
    const categories = ax.categories ?? [];
    const x: Axis = bars
      ? band({ label, categories: bars.categories })
      : ax.kind === 'text'
        ? band({ label, categories })
        : ax.kind === 'time'
          ? time({
              label,
              utc,
              format: xa.format,
              fit: xa.fit,
              ...(Array.isArray(xa.domain) && { domain: xa.domain }),
              ...(xa.unit && { unit: xa.unit, every: xa.every }),
            } as TimeOptions)
          : defined({ domain: xa.domain ?? 'nice', label, step: xa.step, format: xa.format, fit: xa.fit });
    const y: Axis = defined({
      domain: ya.domain ?? 'nice',
      label: ya.label ?? ay.label,
      step: ya.step,
      format: ya.format,
      fit: ya.fit,
    });

    const colors = colorsFor(theme, p.colors, ys.length);
    const radius = typeof p.r === 'number' ? p.r : 4;
    const radii = scatter
      ? memo('radii', [ys, radius], () => ys.map(r => r.r ?? new Float64Array(r.x.length).fill(radius)))
      : undefined;
    const marks = memo('marks', [ys, stacked, p.curve, p.join, radii, ...colors], () =>
      ys.map((r, i) => {
        if (scatter)
          return dots({ key: r.name, label: r.name, x: r.x, y: r.y, r: radii![i]!, color: colors[i]! });
        const o = {
          key: r.name,
          label: r.name,
          x: r.x,
          y: r.y,
          color: colors[i]!,
          curve: p.curve,
          join: p.join,
        };
        if (kind === 'line') return line(o);
        if (kind === 'bar')
          return bar({
            key: r.name,
            label: r.name,
            x: r.x,
            y: r.y,
            color: colors[i]!,
            ...(stacked ? { stack: 'stack' } : { dodge: 'dodge' }),
          });
        return area(
          defined({
            ...o,
            stack: stacked ? 'stack' : undefined,
            alpha: !stacked && ys.length >= 2 ? 0.5 : undefined,
          }),
        );
      }),
    );

    const text: Text = {
      x: (v: number) => (!bars && ax.kind !== 'text' && xa.format ? xa.format : text.title)(v),
      title: bars
        ? v => bandTitle(bars.categories, v)
        : ax.kind === 'text'
          ? v => bandTitle(categories, v)
          : ax.kind === 'time' && p.tooltip !== false
            ? memo('timeTitle', [ys, utc], () => timeTitle([...new Set(ys.map(r => r.x))], utc))
            : formatNumber,
      value: ya.format ?? formatNumber,
    };
    const ref = memo<{ current?: Text }>('tooltip', [], () => ({}));

    const showLegend = p.legend !== false && ys.length >= 2;
    const features = {
      tooltip: p.tooltip !== false,
      legend: showLegend && (typeof p.legend === 'object' ? p.legend : {}),
      zoom: on(p.zoom),
      animate: on(p.animate),
    };
    ref.current = text;
    return {
      options: {
        ...defined({ width: p.width, height: p.height, margin: p.margin, description: p.description }),
        theme,
        x,
        y,
        marks,
      },
      features,
      use: () => {
        ref.current = text;
        return [
          features.tooltip &&
            tooltip(
              scatter
                ? {
                    mode: 'nearest',
                    text: (label, x, y) => `${label}: ${ref.current!.x(x)}, ${ref.current!.value(y)}`,
                  }
                : bars
                  ? {
                      mode: 'nearest',
                      text: (label, _x, v, row) =>
                        `${ref.current!.title(row!)} · ${label}: ${ref.current!.value(v)}`,
                    }
                  : { mode: 'x', title: v => ref.current!.title(v), value: v => ref.current!.value(v) },
            ),
          features.legend && legend(features.legend),
          features.zoom && zoom(features.zoom),
          features.animate && animate(features.animate),
        ].filter((f): f is Feature => !!f);
      },
    };
  };
}

const themeFor = (t: XyProps['theme']): Theme | undefined =>
  t === 'light' ? light : t === 'dark' ? dark : t === 'auto' ? undefined : t;

/** The options plot() would get, without an element: a theme of 'auto' gives no theme and the light palette. */
function specOf(build: Build<XyProps>, p: XyProps): Options {
  const context: Context = {
    source: source(p.data as Data | null | undefined) as Source<never>,
    theme: themeFor(p.theme)!,
    memo: (_name, _deps, make) => make(),
  };
  const b = build(p, context);
  const passed = Object.fromEntries(
    [...PASSED].filter(k => p[k as keyof XyProps] !== undefined).map(k => [k, p[k as keyof XyProps]]),
  );
  return defined({ ...b.options, ...passed, use: b.use() }) as Options;
}

type Kinds<D> = { line: LineProps<D>; area: AreaProps<D>; bar: BarProps<D>; scatter: ScatterProps<D> };
type Later<K extends keyof Kinds<never>> = Omit<EasyChart<never>, 'update'> & {
  update<D extends Input | undefined = undefined>(props: Partial<Kinds<D>[K]> & { data?: D | null }): void;
};
type ChartOf<K extends keyof Kinds<never>, D> = [D] extends [undefined | readonly never[]]
  ? Later<K>
  : EasyChart<Kinds<D>[K]>;

function easyChart<K extends keyof Kinds<never>>(build: Build<XyProps>) {
  return Object.assign(
    <D extends Input | undefined = undefined>(el: HTMLElement, props: Kinds<D>[K]): ChartOf<K, D> =>
      create(el, props as XyProps, build) as unknown as ChartOf<K, D>,
    {
      spec: <D extends Input | undefined = undefined>(props: Kinds<D>[K]) => specOf(build, props as XyProps),
    },
  );
}

export const lineChart = easyChart<'line'>(xy('lineChart'));
export const areaChart = easyChart<'area'>(xy('areaChart', 'area'));
export const barChart = easyChart<'bar'>(xy('barChart', 'bar'));
export const scatterChart = easyChart<'scatter'>(xy('scatterChart', 'scatter'));
