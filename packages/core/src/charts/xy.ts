import { brush } from '../features/brush.js';
import { area } from '../marks/area.js';
import { bar } from '../marks/bar.js';
import { upTo } from '../marks/common.js';
import { dots } from '../marks/dots.js';
import { errorBars } from '../marks/errorBars.js';
import { line } from '../marks/line.js';
import { rule, zone } from '../marks/rule.js';
import { ticks } from '../marks/ticks.js';
import { band } from '../scales/band.js';
import { log, type LogAxis } from '../scales/log.js';
import { bands } from '../transforms.js';
import type { Theme } from '../theme.js';
import type { Axis, Col, Mark } from '../types.js';
import { dates, defined, easyChart, featuresOf, install, linear, on, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { bandTitle, colorsFor, DAY, formatNumber, namesOf, spacing, timeTitle } from './defaults.js';
import { assign, list, type Assigned, type Field, type FieldProps, type Series } from './fields.js';
import { source } from './source.js';
import type {
  Axes,
  Base,
  ErrorBars,
  LineProps,
  Overlays,
  ScaledAxes,
  ScatterProps,
  SecondAxis,
  XValue,
} from './types.js';

type XyProps = Axes &
  SecondAxis &
  ScaledAxes &
  Overlays &
  Base &
  FieldProps<never> & {
    data?: unknown;
    curve?: LineProps<undefined>['curve'];
    join?: boolean;
    fill?: LineProps<undefined>['fill'];
    stack?: boolean;
    errorBars?: ErrorBars<Field<never>>;
    alpha?: number;
    ring?: number;
    shape?: ScatterProps<undefined>['shape'];
    /** On a combo, which fields of y and then of y2 are bars. */
    barred?: readonly boolean[];
  };
type Text = {
  x: (x: number) => string;
  title: (x: number) => string;
  snap: (x: number) => number;
  value: (y: number, axis: 'y' | 'y2', observed: () => number[]) => string;
  around: (x: number, axis: 'y' | 'y2') => number[];
  at: (label: string, row?: number) => number[];
  axis: (label: string) => 'y' | 'y2';
  onBrush: Overlays['onBrush'];
};

const ascending = (x: Col) => {
  for (let i = 1; i < x.length; i++) if (x[i]! < x[i - 1]!) return false;
  return true;
};

const columns = (s: Series, cut: (c: Col) => Col) => ({
  y: cut(s.y),
  ...(s.low && { low: cut(s.low) }),
  ...(s.high && { high: cut(s.high) }),
});

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
    return { ...s, x: xs.get(s.x)!, ...columns(s, c => Float64Array.from(o, i => c[i]!)) };
  });
}

/** Each series' values at the slot of its x in order, NaN where it has no row, the last row winning. */
function laid(ys: Series[], order: ArrayLike<number>, x: Col): Series[] {
  const at = new Map(Array.from(order, (v, i) => [v, i]));
  return ys.map(s => {
    const slots = Array.from(s.x, v => at.get(v)!);
    const lay = (c: Col) => {
      const out = new Float64Array(order.length).fill(Number.NaN);
      for (let i = 0; i < slots.length; i++) out[slots[i]!] = c[i]!;
      return out;
    };
    return { ...s, x, ...columns(s, lay) };
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
): { categories: string[]; ys: Series[]; slots: ArrayLike<number> } {
  const name = namesOf(
    ax.kind,
    ax.categories,
    ys.map(s => s.x),
    utc,
  );
  if (!long) {
    const xs = ys[0]?.x ?? [];
    const index = Float64Array.from(xs, (_, i) => i);
    return { categories: Array.from(xs, name), ys: ys.map(s => ({ ...s, x: index })), slots: xs };
  }
  const order = seen ?? [];
  return {
    slots: order,
    categories: order.map(name),
    ys: laid(
      ys,
      order,
      Float64Array.from(order, (_, i) => i),
    ),
  };
}

/** A series with the rows left out put back as missing, so that its rows are those of the data again. */
function whole(s: Series, rows: number[] | undefined, length: number): { x: Col; y: Col } {
  if (!rows) return s;
  // A row without a y draws nothing; its x stays finite, as bars on WebGL measure from the first one.
  const x = new Float64Array(length).fill(s.x[0] ?? Number.NaN);
  const y = new Float64Array(length).fill(Number.NaN);
  rows.forEach((row, i) => {
    x[row] = s.x[i]!;
    y[row] = s.y[i]!;
  });
  return { x, y };
}

function overlays(
  p: Overlays,
  name: string,
  theme: Theme,
  y: Axis,
  xAt: (v: XValue) => number,
  onBand: boolean,
): { under: Mark[]; over: Mark[] } {
  const neither = (what: string): never => {
    throw new Error(`${name}: ${what} takes x or y`);
  };
  const yAt = (v: number) => (y.to ? y.to(v, y) : v);
  const edge = (v: number) => (y.to && v <= 0 ? -Infinity : yAt(v));
  return {
    under: (p.zones ?? []).map((z, i) => {
      const o = { key: `zone:${i}`, text: z.text, color: z.color ?? theme.muted };
      if (z.x) {
        const [a, b] = [xAt(z.x[0]), xAt(z.x[1])];
        const half = onBand ? 0.5 : 0;
        return zone(defined({ ...o, x1: Math.min(a, b) - half, x2: Math.max(a, b) + half }));
      }
      if (z.y) return zone(defined({ ...o, y1: edge(z.y[0]), y2: edge(z.y[1]) }));
      return neither(`zones[${i}]`);
    }),
    over: (p.rules ?? []).map((r, i) => {
      const o = { key: `rule:${i}`, text: r.text, dashed: r.dashed, color: r.color ?? theme.text };
      if (r.x !== undefined) return rule(defined({ ...o, x: xAt(r.x) }));
      if (r.y !== undefined) return rule(defined({ ...o, y: yAt(r.y) }));
      return neither(`rules[${i}]`);
    }),
  };
}

type Upright = { key: string; group: string; x: Col; y1: Col; y2: Col; color: string };

/** Error bars that stand where bar() puts the dodged bars of the same series. */
const dodged = (o: Upright): Mark => ({
  ...errorBars(o),
  arrange: {
    key: 'errorBars:dodge',
    lay: members =>
      members.map(({ options }, slot) => {
        const own = options as Upright;
        const [from, to] = bands(own.x, { slot, of: members.length });
        return errorBars({ ...own, x: from.map((v, i) => (v + to[i]!) / 2) });
      }),
  },
});

/** The row whose x is nearest, the last of equal ones; -1 where there is none. x ascends. */
function nearest(x: Col, v: number): number {
  const after = upTo(x, v);
  const next = x[after];
  if (next === undefined) return after - 1;
  return after && v - x[after - 1]! <= next - v ? after - 1 : upTo(x, next) - 1;
}

/** Bars that answer an x with the value of their nearest row; the columns are theirs with x ascending. */
function sampled(m: Mark, { x, y }: { x: Col; y: Col }): Mark {
  const { arrange } = m;
  return {
    ...m,
    sampleAtX: v => {
      const at = y[nearest(x, v)];
      return Number.isFinite(at) ? at : undefined;
    },
    ...(arrange && {
      arrange: {
        ...arrange,
        lay: members =>
          arrange.lay(members).map((d, i) => ({ ...d, sampleAtX: v => members[i]!.sampleAtX!(v) })),
      },
    }),
  };
}

export function xy(
  name: string,
  kind: 'line' | 'area' | 'bar' | 'scatter' | 'combo' = 'line',
): Build<XyProps> {
  return (p, { source: s, theme, memo }) => {
    const utc = kind === 'bar' || (p.xAxis?.utc ?? true);
    const scatter = kind === 'scatter';
    const rField = typeof p.r === 'number' ? undefined : p.r;
    const ticked = scatter && p.shape === 'tick';
    for (const [prop, on] of [
      ['a field of r', rField !== undefined],
      ['ring', p.ring !== undefined],
    ] as const)
      if (ticked && on) throw new Error(`${name}: ${prop} does not apply to shape 'tick'`);
    const barred = (i: number) => kind === 'bar' || !!p.barred?.[i];
    const combo = kind === 'combo';
    const spread = kind === 'area' ? undefined : p.errorBars;
    const assigned = memo(
      'fields',
      [s, p.x, ...list(p.y), p.series, rField, utc, spread?.low, spread?.high, ...list(p.y2)],
      () =>
        assign(
          s,
          { ...p, errorBars: spread, xAxis: { utc } },
          scatter ? 'scatter' : 'xy',
          name,
          kind === 'bar',
        ),
    );
    const stacked = kind !== 'line' && !scatter && !!p.stack;
    if (spread && stacked && assigned.ys.length > 1)
      throw new Error(`${name}: errorBars do not apply to stacked bars. Leave out stack or errorBars.`);
    if (stacked && new Set(assigned.ys.filter((_, i) => barred(i)).map(r => r.yAxis)).size > 1)
      throw new Error(
        `${name}: stack does not apply to bars on both y and y2. Leave out stack or ${kind === 'bar' ? 'y2' : 'y2Bars'}.`,
      );
    const bars =
      kind === 'bar' || (combo && assigned.x.kind === 'text')
        ? memo('bars', [assigned], () => categorical(assigned, utc, p.series !== undefined))
        : undefined;
    const placed =
      bars?.ys ??
      (scatter ? assigned.ys : undefined) ??
      memo('sorted', [assigned, stacked], () =>
        stacked && p.series !== undefined ? aligned(assigned.ys) : sorted(assigned.ys),
      );
    const { x: ax, y: ay } = assigned;
    const room =
      p.barred?.includes(true) && !bars
        ? memo('spacing', [placed], () => spacing(placed[0]?.x ?? [], ax.kind === 'time' ? DAY : 1))
        : undefined;
    const given = p.xAxis ?? {};
    const xa = room?.lone && !Array.isArray(given.domain) ? { ...given, domain: room.lone } : given;
    const ya = p.yAxis ?? {};
    const label = xa.label ?? ax.label;
    const categories = bars?.categories ?? ax.categories ?? [];
    const banded = !!bars || ax.kind === 'text';
    const x: Axis = banded
      ? band({ label, categories })
      : ax.kind === 'time'
        ? dates(xa, ax.label, utc)
        : linear(xa, ax.label);
    const scaled = (role: 'yAxis' | 'y2Axis', own: string): Axis & { col?: LogAxis['col'] } => {
      const a = p[role];
      if (a?.scale !== 'log') return linear(a, own);
      const owner = kind === 'area' ? 'area' : 'bar';
      const onY = list(p.y).length;
      const barsOn = role === 'yAxis' ? p.barred?.slice(0, onY) : p.barred?.slice(onY);
      if (kind === 'area' || kind === 'bar' || barsOn?.includes(true))
        throw new Error(
          `${name}: ${role}.scale 'log' does not apply, as ${owner}s start at zero, which it cannot show`,
        );
      if (a.step !== undefined) throw new Error(`${name}: ${role}.step does not apply to a log scale`);
      if (role === 'yAxis' && ay.categories)
        throw new Error(`${name}: yAxis.scale 'log' does not apply to a text y`);
      const { domain } = a;
      if (Array.isArray(domain) && !domain.every(v => v > 0 && v < Infinity))
        throw new Error(`${name}: ${role}.domain must be above zero and finite on a log scale`);
      return log(defined({ label: a.label ?? own, domain, format: a.format, fit: a.fit }));
    };
    const numeric = scaled('yAxis', ay.label);
    const y: typeof numeric = ay.categories
      ? band({ label: ya.label ?? ay.label, categories: ay.categories })
      : numeric;
    const y2 = assigned.y2 && scaled('y2Axis', assigned.y2.label);
    const ys = memo('ys', [placed, !!y.col, !!y2?.col], () =>
      placed.map(r => {
        const a = r.yAxis ? y2! : y;
        return a.col ? { ...r, ...columns(r, c => a.col!(c)) } : r;
      }),
    );
    const xAt = (v: XValue): number => {
      const bySlot = <T>(n: T, slots: ArrayLike<T>) => {
        const i = Array.prototype.indexOf.call(slots, n);
        return i < 0 ? Number.NaN : i;
      };
      if (typeof v === 'string' && ax.kind === 'text') return bySlot(v, categories);
      const c = source([{ v }]).column('v', { utc });
      const at = c.kind === 'text' ? Number.NaN : c.values[0]!;
      return bars ? bySlot(at, bars.slots) : at;
    };
    const { under, over } = overlays(p, name, theme, y, xAt, banded);

    const colors = colorsFor(theme, p.colors, ys.length);
    const radius = typeof p.r === 'number' ? p.r : 4;
    const radii =
      scatter && !ticked
        ? memo('radii', [ys, radius], () => ys.map(r => r.r ?? new Float64Array(r.x.length).fill(radius)))
        : undefined;
    const { cap, width } = spread ?? {};
    const deps = [
      ys,
      stacked,
      p.curve,
      p.join,
      p.fill,
      ticked ? radius : radii,
      p.alpha,
      p.ring,
      p.shape,
      cap,
      width,
      bars && theme.text,
      room?.width,
      ...colors,
      ...ys.map((_, i) => barred(i)),
    ];
    const marks = memo('marks', deps, () => {
      const drawn = ys.map((r, i) => {
        if (scatter) {
          const at = {
            key: `series:${r.name}`,
            label: r.name,
            x: r.x,
            y: r.y,
            yAxis: r.yAxis,
            color: colors[i]!,
            alpha: p.alpha,
          };
          return ticked
            ? ticks(defined({ ...at, size: radius }))
            : dots(defined({ ...at, r: radii![i]!, ring: p.ring }));
        }
        const o = {
          key: `series:${r.name}`,
          label: r.name,
          x: r.x,
          y: r.y,
          color: colors[i]!,
          curve: p.curve,
          join: p.join,
          ...(r.yAxis && { yAxis: r.yAxis }),
        };
        if (barred(i)) {
          // Clicks and `selected` number a bar by its row in the data.
          const own = combo ? whole(bars ? r : assigned.ys[i]!, assigned.rows, s.length) : r;
          const drawn = bar({
            key: `series:${r.name}`,
            label: r.name,
            x: own.x,
            y: own.y,
            color: colors[i]!,
            ...(r.yAxis && { yAxis: r.yAxis }),
            ...(room && { width: room.width }),
            ...(stacked ? { stack: 'stack' } : { dodge: 'dodge' }),
          });
          return combo ? sampled(drawn, r) : drawn;
        }
        if (combo || kind === 'line') return line(defined({ ...o, fill: p.fill }));
        return area(
          defined({
            ...o,
            stack: stacked ? 'stack' : undefined,
            alpha: (!stacked || assigned.y2) && ys.length >= 2 ? 0.5 : undefined,
          }),
        );
      });
      const errors = ys.flatMap((r, i) => {
        if (!r.low || !r.high) return [];
        const o = defined({
          key: `errorBars:${r.name}`,
          group: r.name,
          x: r.x,
          y1: r.low,
          y2: r.high,
          color: bars ? theme.text : colors[i]!,
          cap,
          width,
        });
        return [bars && ys.length > 1 ? dodged(o) : errorBars(o)];
      });
      if (combo) drawn.sort((a, b) => +(b.type === 'bar') - +(a.type === 'bar'));
      return bars ? [...drawn, ...errors] : [...errors, ...drawn];
    });

    const titled =
      !bars && ax.kind === 'time' && p.tooltip !== false
        ? memo('timeTitle', [ys, utc], () => timeTitle([...new Set(ys.map(r => r.x))], utc))
        : formatNumber;
    const text: Text = {
      x: (v: number) => (!banded && xa.format ? xa.format : text.title)(v),
      title: banded ? v => bandTitle(categories, v) : titled,
      snap: v => {
        const x = ys[0]?.x ?? [];
        return x[nearest(x, v)] ?? v;
      },
      value: (v, axis, observed) => {
        if (axis === 'y' && ay.categories) return bandTitle(ay.categories, v);
        const a = axis === 'y2' ? p.y2Axis : ya;
        const format = a?.format ?? formatNumber;
        if (a?.scale !== 'log') return format(v);
        const on = axis === 'y2' ? y2! : y;
        // A value back from its logarithm is off by a few ulps, so a row's own value is looked up.
        let best: number | undefined;
        let least = Math.abs(v) * 1e-12;
        for (const own of observed()) {
          const off = Math.abs(on.from!(on.to!(own, on), on) - v);
          if (off < least) [best, least] = [own, off];
        }
        return format(best ?? +v.toPrecision(13));
      },
      around: (x, axis) =>
        placed.flatMap(r => {
          if ((r.yAxis ?? 'y') !== axis) return [];
          const after = upTo(r.x, x);
          const rows = r.x[after - 1] === x ? [after - 1] : [after - 1, after];
          return rows.flatMap(i => r.y[i] ?? []);
        }),
      at: (label, row) => {
        const own = placed.find(r => r.name === label)?.y[row ?? -1];
        return own === undefined ? [] : [own];
      },
      axis: label => ys.find(r => r.name === label)?.yAxis ?? 'y',
      onBrush: p.onBrush,
    };
    const ref = memo<{ current?: Text }>('tooltip', [], () => ({}));

    const features = { ...featuresOf(p, ys.length), brush: on(p.brush) };
    ref.current = text;
    let shownX = Number.NaN;
    const own = (label: string, v: number, row?: number) =>
      ref.current!.value(v, ref.current!.axis(label), () => ref.current!.at(label, row));
    return {
      options: {
        ...sizeOf(p),
        theme,
        x,
        y,
        ...(y2 && { y2 }),
        marks: under.length || over.length ? [...under, ...marks, ...over] : marks,
      },
      features,
      use: () => {
        ref.current = text;
        const drawn = install(
          features,
          scatter
            ? {
                mode: 'nearest',
                text: (label, x, y, row) => `${label}: ${ref.current!.x(x)}, ${own(label, y, row)}`,
              }
            : kind === 'bar'
              ? {
                  mode: 'nearest',
                  text: (label, _x, v, row) => `${ref.current!.title(row!)} · ${label}: ${own(label, v)}`,
                }
              : {
                  mode: 'x',
                  ...(combo && { snap: (v: number) => ref.current!.snap(v) }),
                  title: v => ref.current!.title((shownX = v)),
                  value: (v, axis) => ref.current!.value(v, axis, () => ref.current!.around(shownX, axis)),
                },
        );
        if (features.brush)
          drawn.push(
            brush({
              ...features.brush,
              zoom: !!features.zoom,
              onSelect: range => ref.current!.onBrush?.(range),
            }),
          );
        return drawn;
      },
    };
  };
}

export const lineChart = easyChart<'line'>(xy('lineChart'));
export const areaChart = easyChart<'area'>(xy('areaChart', 'area'));
export const barChart = easyChart<'bar'>(xy('barChart', 'bar'));
export const scatterChart = easyChart<'scatter'>(xy('scatterChart', 'scatter'));
