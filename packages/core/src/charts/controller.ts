import { plot } from '../chart.js';
import { equal } from '../equal.js';
import type { Theme } from '../theme.js';
import type { Chart, Feature, Hover, Internals, Layout, Mark, Options, Span } from '../types.js';
import { themeOf } from './defaults.js';
import { source, type Data, type Source } from './source.js';
import type { Axes, Base } from './types.js';

export type ControllerProps = Base & Pick<Axes, 'view' | 'onViewChange'> & { data?: unknown };
export type Context = {
  source: Source<never>;
  theme: Theme;
  /** make() runs again only when deps differ, element by element, from the last call under this name. */
  memo: <T>(name: string, deps: readonly unknown[], make: () => T) => T;
};
type Passed =
  | 'view'
  | 'hidden'
  | 'selected'
  | 'pointer'
  | 'onViewChange'
  | 'onHiddenChange'
  | 'onClick'
  | 'onPointerChange'
  | 'onLayout'
  | 'onHover';
export type Built = {
  options: Omit<Options, 'use' | Passed>;
  /** Compared by value across updates: a change recreates the chart. */
  features: unknown;
  use(): Feature[];
};
export type Build<P> = (props: P, context: Context) => Built;
export type EasyChart<P> = {
  update(props: Partial<P>): void;
  destroy(): void;
  readonly chart: Chart;
  /** The chart's own overlay, the same element with its children when the chart is made again. */
  readonly overlay: HTMLElement;
};

const STATE = ['view', 'hidden', 'selected', 'pointer'] as const;
const CALLBACKS = ['onHiddenChange', 'onClick', 'onPointerChange'] as const;
export const PASSED = new Set<string>([...STATE, ...CALLBACKS, 'onViewChange', 'onLayout', 'onHover']);

/** As the core keeps a mark: by key, type and options. */
const sameMarks = (a: readonly Mark[], b: readonly Mark[]) =>
  a.length === b.length &&
  a.every((m, i) => m.key === b[i]!.key && m.type === b[i]!.type && equal(m.options, b[i]!.options));

const lengthsOf = (d: unknown) =>
  d == null
    ? []
    : typeof (d as ArrayLike<unknown>).length === 'number'
      ? [(d as ArrayLike<unknown>).length]
      : Object.values(d).map(c => (c as ArrayLike<unknown> | undefined)?.length);

type Read = { data: unknown; lengths: unknown[]; version: number | undefined; source: Source<never> };

export function create<P extends ControllerProps>(
  el: HTMLElement,
  initial: P,
  build: Build<P>,
): EasyChart<P> {
  let props = initial;
  let read: Read | undefined;
  const readSource = (p: P): Read => {
    const lengths = lengthsOf(p.data);
    const bumped = read && read.version !== p.dataVersion;
    if (read && !bumped && read.data === p.data && equal(read.lengths, lengths)) return read;
    return {
      data: p.data,
      lengths,
      version: p.dataVersion,
      source: source(
        p.data as Data | null | undefined,
        !!bumped || (!!read && !equal(read.lengths, lengths)),
      ) as Source<never>,
    };
  };

  const memos = new Map<string, { deps: readonly unknown[]; value: unknown }>();
  const memo = <T>(name: string, deps: readonly unknown[], make: () => T): T => {
    const hit = memos.get(name);
    if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => Object.is(d, deps[i])))
      return hit.value as T;
    const value = make();
    memos.set(name, { deps, value });
    return value;
  };

  let internals: Internals | undefined;
  let overlay: HTMLElement | undefined;
  const keep: Feature = c => {
    overlay ??= internals?.overlay;
    if (overlay) c.overlay = overlay;
    internals = c;
    return { destroy() {} };
  };
  const windowed: { x?: Span; y?: Span; y2?: Span } = {};
  const remember = (v: { x?: Span; y?: Span; y2?: Span }) => {
    const whole = internals!.domain();
    for (const k of ['x', 'y', 'y2'] as const) {
      const side = v[k];
      const all = whole[k]?.map(e => internals!.real(k, e));
      if (side && String(side) !== String(all)) windowed[k] = [...side];
      else delete windowed[k];
    }
  };
  const onViewChange = (v: { x: Span; y?: Span; y2?: Span }) => {
    remember(v);
    props.onViewChange?.(v);
  };

  // The app may update the chart from onLayout or onHover, which must not run inside an update still being applied.
  let applying = false;
  let pending: { layout?: Layout; hover?: Hover | null } = {};
  let hovered = false;
  const tell = (hover: Hover | null) => {
    hovered = !!hover;
    props.onHover?.(hover);
  };
  const onLayout = (layout: Layout) => {
    if (applying) pending.layout = layout;
    else props.onLayout?.(layout);
  };
  const onHover = (hover: Hover | null) => {
    if (applying) pending.hover = hover;
    else tell(hover);
  };
  // The hover is read after onLayout, as an update made from it reports a newer one itself.
  const flush = () => {
    const { layout } = pending;
    delete pending.layout;
    try {
      if (layout) props.onLayout?.(layout);
    } finally {
      const { hover } = pending;
      delete pending.hover;
      if (hover !== undefined && !destroyed) tell(hover);
    }
  };

  const wanted = (p: P, b: Built): Record<string, unknown> => {
    const w: Record<string, unknown> = {
      ...b.options,
      onViewChange,
      onLayout: p.onLayout && onLayout,
      onHover: p.onHover && onHover,
    };
    for (const k of CALLBACKS) w[k] = p[k];
    for (const k of STATE) if (p[k] !== undefined) w[k] = p[k];
    return w;
  };

  let theme: Theme;
  const onTheme = (t: Theme) => {
    theme = t;
    apply(props, read);
  };
  let themed = themeOf(el, props.theme, onTheme);
  theme = themed.theme;
  let built: Built;
  let sent: Record<string, unknown>;
  let chart: Chart;
  try {
    built = build(props, { source: (read = readSource(props)).source, theme, memo });
    sent = wanted(props, built);
    chart = plot(el, { ...(sent as Options), use: [...built.use(), keep] });
  } catch (e) {
    themed.dispose();
    throw e;
  }
  if (props.view) remember(props.view);
  let destroyed = false;
  let live = true;
  let held: readonly string[] = [];

  function apply(next: P, r?: Read) {
    applying = true;
    try {
      change(next, r);
    } finally {
      applying = false;
      flush();
    }
  }

  /** With r, the options are built again from it; without, only passed props changed. */
  function change(next: P, r?: Read) {
    let b = built;
    let t = themed;
    let th = theme;
    let uses: Feature[] | undefined;
    if (r) {
      if (next.theme !== props.theme) th = (t = themeOf(el, next.theme, onTheme)).theme;
      try {
        b = build(next, { source: r.source, theme: th, memo });
        if (!equal(b.features, built.features)) uses = b.use();
      } catch (e) {
        if (t !== themed) t.dispose();
        throw e;
      }
    }
    const want = wanted(next, b);
    const hidden = live ? internals!.hidden() : held;
    const carried = (p: P) => ({
      ...(p.view === undefined && Object.keys(windowed).length && { view: { ...windowed } }),
      ...(p.hidden === undefined && hidden.length && { hidden: [...hidden] }),
    });
    const fail = (e: unknown): never => {
      if (t !== themed) t.dispose();
      pending = hovered ? { hover: null } : {};
      held = hidden;
      try {
        chart = plot(el, { ...sent, ...carried(props), use: [...built.use(), keep] } as Options);
        live = true;
      } catch {}
      throw e;
    };
    const drop = () => {
      if (!live) return;
      live = false;
      if (hovered) pending.hover = null;
      chart.destroy();
    };
    const commit = (s: Record<string, unknown>) => {
      props = next;
      if (r) read = r;
      built = b;
      theme = th;
      if (t !== themed) {
        themed.dispose();
        themed = t;
      }
      sent = s;
    };
    if (!live) uses ??= b.use();
    if (uses) {
      try {
        drop();
        chart = plot(el, { ...want, ...carried(next), use: [...uses, keep] } as Options);
        live = true;
      } catch (e) {
        fail(e);
      }
      commit(want);
      if (next.view) remember(next.view);
      return;
    }
    // view and hidden come back from the live chart through carried(); selected and pointer only from sent.
    const kept = { ...sent };
    for (const k of ['view', 'hidden'] as const) if (!(k in want)) delete kept[k];
    const partial: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(kept), ...Object.keys(want)])) {
      if (!(k in want) && (STATE as readonly string[]).includes(k)) continue;
      const [was, now] = [kept[k], want[k]];
      // A theme replaced by an equal one is how an app asks for changed CSS variables to be read again.
      const same =
        k === 'theme'
          ? was === now
          : k === 'marks'
            ? sameMarks(was as Mark[], now as Mark[])
            : equal(was, now);
      if (!same) partial[k] = now;
    }
    if (Object.keys(partial).length) {
      try {
        chart.update(partial);
      } catch (e) {
        try {
          drop();
        } catch {}
        fail(e);
      }
    }
    commit(Object.assign(kept, partial));
    if (partial.view) remember(partial.view as { x?: Span; y?: Span });
  }

  return {
    get chart() {
      return chart;
    },
    get overlay() {
      return (overlay ??= chart.overlay);
    },
    update(partial) {
      if (destroyed) return;
      const next = { ...props, ...partial };
      const changed = Object.keys(partial).some(
        k => !PASSED.has(k) && props[k as keyof P] !== next[k as keyof P],
      );
      const r = readSource(next);
      apply(next, changed || r !== read ? r : undefined);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      themed.dispose();
      if (live) chart.destroy();
    },
  };
}
