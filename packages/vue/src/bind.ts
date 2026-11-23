import { equal, plain } from 'swiftplot/charts';
import {
  defineComponent,
  h,
  normalizeStyle,
  onBeforeUnmount,
  onMounted,
  ref,
  toHandlerKey,
  toRaw,
  watch,
  type Component,
  type ComponentObjectPropsOptions,
  type Prop,
} from 'vue';

export type Mount<P> = (el: HTMLElement, props: P) => { update(partial: Partial<P>): void; destroy(): void };
/** Every chart prop but the callbacks, which are listeners. */
export type Declared<P> = { [K in Exclude<keyof P, `on${string}`>]-?: Prop<unknown> | null };
type Sized = { width?: number; height?: number };
type Props = Record<string, unknown>;
type Key = [error: unknown, data: unknown, rest: unknown];

/** The controller's callbacks and the events that report them. */
const LISTENERS = {
  onClick: 'click',
  onViewChange: 'update:view',
  onHiddenChange: 'update:hidden',
  onPointerChange: 'update:pointer',
} as const;
const HOST_ONLY = new Set<string>([
  'width',
  'height',
  'onError',
  ...Object.values(LISTENERS).map(toHandlerKey),
]);

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

/** The app's style without unset entries: Vue's patchStyle writes '' for them, which would clear a height the binding set. */
const hostStyle = (style: unknown) =>
  Object.fromEntries(
    Object.entries(normalizeStyle([style]) as Props).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    ),
  );

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

export function bind<P extends Sized>(chart: Mount<P>, declared: Declared<P>): Component {
  return defineComponent({
    inheritAttrs: false,
    props: {
      ...(declared as ComponentObjectPropsOptions),
      onError: null,
      ...Object.fromEntries(Object.values(LISTENERS).map(e => [toHandlerKey(e), null])),
    },
    setup(props: Props, { attrs, emit }) {
      const host = ref<HTMLElement>();
      let bound: ReturnType<Mount<P>> | undefined;
      let applied: Props | undefined;
      let attempted: Props | undefined;
      let reported: Key | undefined;
      let sizing: unknown[] | undefined;
      // emit calls a .once listener (onClickOnce, an attr) on its first emit only, for the life of the component.
      const fired = new Set<string>();
      const listens = (event: string) =>
        !!(props[toHandlerKey(event)] || (attrs[`${toHandlerKey(event)}Once`] && !fired.has(event)));
      const send = (event: string, ...args: unknown[]) => {
        if (attrs[`${toHandlerKey(event)}Once`]) fired.add(event);
        emit(event, ...args);
      };
      const forward = Object.fromEntries(
        Object.entries(LISTENERS).map(([k, e]) => [k, (...args: unknown[]) => send(e, ...args)]),
      );

      const sync = () => {
        const el = host.value!;
        const style = hostStyle(attrs.style);
        const next = [props.width, props.height, attrs.class, attrs.id, style];
        if ((!bound || !equal(next, sizing)) && style.height === undefined && props.height === undefined)
          fallback(el);
        sizing = next;
        // width and height size the host only: the core measures it on both axes, so its ResizeObserver
        // follows whatever else resizes the host (min-/max-, !important, a parent, a media query).
        const now: Props = {};
        for (const [k, v] of Object.entries(props))
          if (v !== undefined && !HOST_ONLY.has(k)) now[k] = toRaw(v);
        for (const [k, e] of Object.entries(LISTENERS)) if (listens(e)) now[k] = forward[k];

        const failed = attempted && attempted !== applied;
        // After a failure only a change to a prop other than a listener is tried again; listeners reach the last good chart.
        const held = failed && listens('error') && !changed(attempted!, now).some(k => !callback(k));
        attempted = now;
        if (held && !bound) return;
        const callbacks = () => {
          const diff: Props = {};
          for (const k of changed(applied!, now)) if (callback(k)) diff[k] = now[k];
          if (!Object.keys(diff).length) return;
          bound!.update(diff as Partial<P>);
          applied = { ...applied, ...diff };
        };
        try {
          if (!bound) bound = chart(el, now as P);
          else if (held) {
            callbacks();
            return;
          } else {
            const diff: Props = {};
            for (const k of changed(applied!, now)) diff[k] = now[k];
            if (failed || Object.keys(diff).length) bound.update(diff as Partial<P>);
          }
        } catch (e) {
          if (bound) callbacks();
          if (!listens('error')) throw e;
          const key = keyOf(e, now);
          if (equal(reported, key)) return;
          reported = key;
          send('error', e);
          return;
        }
        applied = now;
        reported = undefined;
      };

      onMounted(sync);
      // attrs are not props, but reading them through setup's attrs is tracked, so class, style and id changes resize.
      watch(() => [{ ...props }, attrs.class, attrs.style, attrs.id], sync, { flush: 'post' });
      onBeforeUnmount(() => {
        detached?.unobserve(host.value!);
        bound?.destroy();
        bound = undefined;
      });

      return () =>
        h('div', {
          ref: host,
          class: attrs.class,
          id: attrs.id,
          style: {
            ...(props.width !== undefined && { width: `${props.width as number}px` }),
            ...(props.height !== undefined && { height: `${props.height as number}px` }),
            ...hostStyle(attrs.style),
          },
        });
    },
  });
}
