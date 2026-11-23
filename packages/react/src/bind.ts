import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type FunctionComponent,
} from 'react';
import { equal, plain } from 'swiftplot/charts';

export type Mount<P> = (el: HTMLElement, props: P) => { update(partial: Partial<P>): void; destroy(): void };
export type HostProps = {
  className?: string;
  style?: CSSProperties;
  id?: string;
  /** Without it, a failed render throws to the nearest error boundary. */
  onError?: (error: unknown) => void;
};
type Sized = { width?: number; height?: number };
type Props = Record<string, unknown>;
type Bound<P> = {
  chart?: ReturnType<Mount<P>>;
  applied?: Props;
  attempted?: Props;
  sizing?: unknown[];
};
type Key = [error: unknown, data: unknown, rest: unknown];

const list = (v: unknown): v is ArrayLike<unknown> =>
  typeof v === 'object' && v !== null && typeof (v as ArrayLike<unknown>).length === 'number';

function strip(v: unknown, seen: Map<object, unknown>): unknown {
  if (list(v) && !Array.isArray(v)) return { length: v.length };
  if (!plain(v)) return v;
  if (seen.has(v)) return seen.get(v);
  const out: Props = Array.isArray(v) ? ([] as unknown as Props) : {};
  seen.set(v, out);
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(v)))
    if (d.enumerable && 'value' in d && typeof d.value !== 'function') out[k] = strip(d.value, seen);
  return out;
}

/** Data rebuilt during render (`rows.map(…)`, `{ x: xs }`) is the same failure while its lengths hold; a row is never read. */
const shape = (d: unknown) =>
  list(d)
    ? d.length
    : plain(d)
      ? Object.entries(Object.getOwnPropertyDescriptors(d)).map(([k, { value }]) => [
          k,
          list(value) ? value.length : value,
        ])
      : d;
const keyOf = (e: unknown, { data, ...rest }: Props): Key => [
  e instanceof Error ? String(e) : e,
  shape(data),
  strip(rest, new Map()),
];
const callback = (k: string) => /^on[A-Z]/.test(k);

const changed = (was: Props, now: Props) =>
  [...new Set([...Object.keys(was), ...Object.keys(now)])].filter(k => !Object.is(was[k], now[k]));

const useLayout = typeof document === 'undefined' ? useEffect : useLayoutEffect;

const FALLBACK = 'data-swiftplot-fallback';
const LAYER = 'data-swiftplot-fallback-layer';
const styles = new WeakMap<Node, HTMLStyleElement>();
let detached: ResizeObserver | undefined;

/**
 * Lowest priority: with no height from the app, fill a parent that has one, else 300 px. A rule in the
 * first cascade layer of the host's document or shadow root rather than an inline height, so a height
 * the app's CSS gives later (a media query, a layered utility class) wins. A detached host falls back
 * once it is laid out.
 */
function fallback(el: HTMLElement) {
  if (!el.isConnected) {
    (detached ??= new ResizeObserver(entries => {
      for (const { target } of entries) if (target.isConnected) fallback(target as HTMLElement);
    })).observe(el);
    return;
  }
  detached?.unobserve(el);
  const contain = el.style.contain;
  el.removeAttribute(FALLBACK);
  el.style.contain = 'size';
  const cs = getComputedStyle(el);
  for (const h of ['fill', 'fixed']) {
    if (el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) > 0) break;
    sheet(el);
    el.setAttribute(FALLBACK, h);
  }
  el.style.contain = contain;
}

function sheet(el: HTMLElement) {
  const doc = el.ownerDocument;
  const root = el.getRootNode();
  // A <style> rather than an adopted sheet: adopted sheets come after the document's, so their layer would be last.
  const parent = root === doc ? doc.head : (root as ShadowRoot);
  if (styles.get(root)?.parentNode === parent) return;
  // Another copy of a wrapper (React and Vue on one page, two versions) shares its style rather than fight over first place.
  const shared = [...parent.children].find(c => c.localName === 'style' && c.hasAttribute(LAYER));
  if (shared) {
    styles.set(root, shared as HTMLStyleElement);
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(LAYER, '');
  style.textContent = `@layer swiftplot { :where([${FALLBACK}=fill]) { height: 100% } :where([${FALLBACK}=fixed]) { height: 300px } }`;
  parent.prepend(style);
  styles.set(root, style);
  // A sheet put first later (React 19 does so with its first precedence sheet) would declare its layers ahead of ours.
  // A script that also keeps its node first would move it back forever, so a burst of moves ends the watch.
  let moves = 0;
  let since = 0;
  const first = new MutationObserver(() => {
    if (style.parentNode !== parent) return first.disconnect();
    const head = parent.firstChild;
    if (head?.nodeName === 'STYLE' && (head as Element).hasAttribute(LAYER)) return;
    const now = performance.now();
    if (now - since > 1000) [moves, since] = [0, now];
    if (++moves > 5) return first.disconnect();
    parent.prepend(style);
  });
  first.observe(parent, { childList: true });
}

export function bind<P extends Sized>(chart: Mount<P>): FunctionComponent<P & HostProps> {
  return function Chart(all) {
    // width and height size the host only: the core measures it on both axes, so its ResizeObserver
    // follows whatever else resizes the host (min-/max-, !important, a parent, a media query).
    const {
      className,
      style,
      id,
      onError,
      ref: _,
      width,
      height,
      ...rest
    } = all as P & HostProps & { ref?: unknown };
    const props: Props = rest;
    const host = useRef<HTMLDivElement>(null);
    const bound = useRef<Bound<P>>({});
    const reported = useRef<Key>(undefined);

    useLayout(() => {
      const el = host.current!;
      const sizing = [width, height, className, id, style];
      const b = bound.current;
      if ((!b.chart || !equal(sizing, b.sizing)) && style?.height === undefined && height === undefined)
        fallback(el);
      b.sizing = sizing;
      const failed = b.attempted && b.attempted !== b.applied;
      // After a failure only a change to a prop other than a callback is tried again; callbacks reach the last good chart.
      const held = failed && onError && !changed(b.attempted!, props).some(k => !callback(k));
      b.attempted = props;
      if (held && !b.chart) return;
      const callbacks = () => {
        const diff: Props = {};
        for (const k of changed(b.applied!, props)) if (callback(k)) diff[k] = props[k];
        if (!Object.keys(diff).length) return;
        b.chart!.update(diff as Partial<P>);
        b.applied = { ...b.applied, ...diff };
      };
      try {
        if (!b.chart) {
          b.chart = chart(el, props as P);
        } else if (held) {
          callbacks();
          return;
        } else {
          const diff: Props = {};
          for (const k of changed(b.applied!, props)) diff[k] = props[k];
          if (failed || Object.keys(diff).length) b.chart.update(diff as Partial<P>);
        }
      } catch (e) {
        if (b.chart) callbacks();
        if (!onError) throw e;
        const key = keyOf(e, props);
        if (equal(reported.current, key)) return;
        reported.current = key;
        onError(e);
        return;
      }
      b.applied = props;
      reported.current = undefined;
    });
    useLayout(() => {
      const el = host.current!;
      return () => {
        detached?.unobserve(el);
        bound.current.chart?.destroy();
        bound.current = {};
      };
    }, []);

    return createElement('div', {
      ref: host,
      className,
      id,
      style: { ...style, width: style?.width ?? width, height: style?.height ?? height },
    });
  };
}
