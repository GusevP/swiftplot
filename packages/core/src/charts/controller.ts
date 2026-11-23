import { plot } from '../chart.js';
import type { Theme } from '../theme.js';
import type { Chart, Feature, Internals, Mark, Options, Span } from '../types.js';
import { themeOf } from './defaults.js';
import { source, type Data, type Source } from './source.js';
import type { Base } from './types.js';

export type ControllerProps = Base & { data?: unknown };
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
  | 'onPointerChange';
export type Built = {
  options: Omit<Options, 'use' | Passed>;
  /** Compared by value across updates: a change recreates the chart. */
  features: unknown;
  use(): Feature[];
};
export type Build<P> = (props: P, context: Context) => Built;
export type EasyChart<P> = { update(props: Partial<P>): void; destroy(): void; readonly chart: Chart };

const STATE = ['view', 'hidden', 'selected', 'pointer'] as const;
const CALLBACKS = ['onHiddenChange', 'onClick', 'onPointerChange'] as const;
export const PASSED = new Set<string>([...STATE, ...CALLBACKS, 'onViewChange']);

const plain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** Plain objects and arrays by value, anything else (typed arrays, functions, themes) by identity. */
export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!plain(a) || !plain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}

/** As the core keeps a mark: by type and options. */
const sameMarks = (a: readonly Mark[], b: readonly Mark[]) =>
  a.length === b.length && a.every((m, i) => m.type === b[i]!.type && equal(m.options, b[i]!.options));

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
  const keep: Feature = c => ((internals = c), { destroy() {} });
  const windowed: { x?: Span; y?: Span } = {};
  const remember = (v: { x?: Span; y?: Span }) => {
    const whole = internals!.domain();
    for (const k of ['x', 'y'] as const) {
      const side = v[k];
      const all = whole[k].map(e => internals!.real(k, e));
      if (side && String(side) !== String(all)) windowed[k] = [...side];
      else delete windowed[k];
    }
  };
  const onViewChange = (v: { x: Span; y?: Span }) => {
    remember(v);
    props.onViewChange?.(v);
  };

  const wanted = (p: P, b: Built): Record<string, unknown> => {
    const w: Record<string, unknown> = { ...b.options, onViewChange };
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

  /** With r, the options are built again from it; without, only passed props changed. */
  function apply(next: P, r?: Read) {
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
    if (uses) {
      const hidden = internals!.hidden();
      const carried = (p: P) => ({
        ...(p.view === undefined && Object.keys(windowed).length && { view: { ...windowed } }),
        ...(p.hidden === undefined && hidden.length && { hidden: [...hidden] }),
      });
      chart.destroy();
      const last = el.lastChild;
      try {
        chart = plot(el, { ...want, ...carried(next), use: [...uses, keep] } as Options);
      } catch (e) {
        while (el.lastChild !== last) el.lastChild!.remove();
        if (t !== themed) t.dispose();
        try {
          chart = plot(el, { ...sent, ...carried(props), use: [...built.use(), keep] } as Options);
        } catch {
          while (el.lastChild !== last) el.lastChild!.remove();
        }
        throw e;
      }
    }
    props = next;
    if (r) read = r;
    built = b;
    theme = th;
    if (t !== themed) {
      themed.dispose();
      themed = t;
    }
    if (uses) {
      sent = want;
      if (next.view) remember(next.view);
      return;
    }
    for (const k of STATE) if (!(k in want)) delete sent[k];
    const partial: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(sent), ...Object.keys(want)])) {
      const [was, now] = [sent[k], want[k]];
      const same = k === 'marks' ? sameMarks(was as Mark[], now as Mark[]) : equal(was, now);
      if (!same) partial[k] = now;
    }
    if (!Object.keys(partial).length) return;
    sent = { ...sent, ...partial };
    chart.update(partial);
    if (partial.view) remember(partial.view as { x?: Span; y?: Span });
  }

  return {
    get chart() {
      return chart;
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
      chart.destroy();
    },
  };
}
