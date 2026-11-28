import type { Hover, Layout } from 'swiftplot';
import { equal, plain } from 'swiftplot/charts';
import {
  defineComponent,
  Fragment,
  h,
  normalizeStyle,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  Teleport,
  toHandlerKey,
  toRaw,
  watch,
  withMemo,
  type Component,
  type ComponentObjectPropsOptions,
  type Prop,
  type Slot,
  type VNode,
} from 'vue';

export type Mount<P> = (
  el: HTMLElement,
  props: P,
) => { update(partial: Partial<P>): void; destroy(): void; readonly overlay: HTMLElement };
/** Rendered over the chart, in its overlay, from its layout and what the pointer is over. */
export type OverlaySlot = (props: Shown) => unknown;
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
  onBrush: 'brush',
  onLayout: 'layout',
  onHover: 'hover',
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
const detached = new WeakMap<Window, ResizeObserver>();
const windowOf = (el: Node) => (el.ownerDocument?.defaultView ?? globalThis) as Window & typeof globalThis;

/**
 * Lowest priority: with no height from the app, fill a parent that has one, else 300 px. A rule in the
 * first cascade layer of the host's document or shadow root rather than an inline height, so a height
 * the app's CSS gives later (a media query, a layered utility class) wins. A detached host falls back
 * once it is laid out.
 */
function fallback(el: HTMLElement) {
  const win = windowOf(el);
  let observer = detached.get(win);
  if (!el.isConnected) {
    if (!observer) {
      observer = new win.ResizeObserver(entries => {
        for (const { target } of entries) if (target.isConnected) fallback(target as HTMLElement);
      });
      detached.set(win, observer);
    }
    observer.observe(el);
    return;
  }
  observer?.unobserve(el);
  const contain = el.style.contain;
  el.removeAttribute(FALLBACK);
  el.style.contain = 'size';
  const cs = win.getComputedStyle(el);
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
  const first = new (windowOf(el).MutationObserver)(() => {
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

type Shown = { layout: Layout; hover: Hover | null };

const Overlay = defineComponent({
  props: ['shown', 'stale', 'slot'],
  setup(props: { shown: () => Shown | undefined; stale: (was: Shown) => boolean; slot: Slot }) {
    const drawn: VNode[] = [];
    let was: Shown | undefined;
    return () => {
      const shown = props.shown();
      if (shown) {
        drawn.length = 0;
        was = shown;
        withMemo([], () => h(Fragment, null, props.slot(shown)), drawn, 0);
      } else if (was && props.stale(was)) drawn.length = 0;
      return drawn[0];
    };
  },
});

export function bind<P extends Sized, T extends Declared<P> = Declared<P>>(
  chart: Mount<P>,
  declared: () => T & Record<Exclude<keyof T, keyof Declared<P>>, never>,
): Component {
  return defineComponent({
    inheritAttrs: false,
    props: {
      ...(declared() as ComponentObjectPropsOptions),
      onError: null,
      ...Object.fromEntries(Object.values(LISTENERS).map(e => [toHandlerKey(e), null])),
    },
    setup(props: Props, { attrs, emit, slots }) {
      const host = ref<HTMLElement>();
      let bound: ReturnType<Mount<P>> | undefined;
      let slotted = false;
      const overlay = shallowRef<HTMLElement>();
      const layout = shallowRef<Layout>();
      const hover = shallowRef<Hover | null>(null);
      const applied = shallowRef<Props>();
      const attempted = shallowRef<Props>();
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
      const forward: Props = Object.fromEntries(
        Object.entries(LISTENERS).map(([k, e]) => [
          k,
          (...args: unknown[]) => {
            if (e === 'layout') layout.value = args[0] as Layout;
            else if (e === 'hover') hover.value = args[0] as Hover | null;
            send(e, ...args);
          },
        ]),
      );
      const chartProps = () => {
        const now: Props = {};
        for (const [k, v] of Object.entries(props))
          if (v !== undefined && !HOST_ONLY.has(k)) now[k] = toRaw(v);
        return now;
      };
      // A compiled slot reads the app's state as it is now, so one called before the chart has taken that state, or
      // while it cannot, meets a hover that names a row the new data lacks, or another frame's layout.
      const shown = (): Shown | undefined => {
        if (!layout.value || !applied.value || attempted.value !== applied.value) return;
        if (changed(applied.value, chartProps()).some(k => !callback(k))) return;
        // A chart with no room takes props without reporting their layout, and the core hides its root for as long.
        if (overlay.value!.parentElement!.style.visibility === 'hidden') return;
        return { layout: layout.value, hover: hover.value };
      };
      const stale = (was: Shown) =>
        attempted.value !== applied.value &&
        // A failed update may make the last good chart again, which reports the same layout as a new object.
        (JSON.stringify(was.layout) !== JSON.stringify(layout.value) ||
          (!!was.hover && was.hover !== hover.value));

      const sync = () => {
        const el = host.value!;
        const style = hostStyle(attrs.style);
        const next = [props.width, props.height, attrs.class, attrs.id, style];
        if ((!bound || !equal(next, sizing)) && style.height === undefined && props.height === undefined)
          fallback(el);
        sizing = next;
        // width and height size the host only: the core measures it on both axes, so its ResizeObserver
        // follows whatever else resizes the host (min-/max-, !important, a parent, a media query).
        const now = chartProps();
        slotted = !!slots.default;
        for (const [k, e] of Object.entries(LISTENERS))
          if (listens(e) || (slotted && (e === 'layout' || e === 'hover'))) now[k] = forward[k];
        if (!now.onLayout) layout.value = undefined;
        if (!now.onHover) hover.value = null;

        const failed = attempted.value && attempted.value !== applied.value;
        // After a failure only a change to a prop other than a listener is tried again; listeners reach the last good chart.
        const held = failed && listens('error') && !changed(attempted.value!, now).some(k => !callback(k));
        attempted.value = now;
        if (held && !bound) return;
        const callbacks = () => {
          const diff: Props = {};
          for (const k of changed(applied.value!, now)) if (callback(k)) diff[k] = now[k];
          if (!Object.keys(diff).length) return;
          bound!.update(diff as Partial<P>);
          applied.value = { ...applied.value, ...diff };
        };
        try {
          if (!bound) bound = chart(el, now as P);
          else if (held) {
            callbacks();
            return;
          } else {
            const diff: Props = {};
            for (const k of changed(applied.value!, now)) diff[k] = now[k];
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
        applied.value = now;
        if (slotted) overlay.value = bound.overlay;
        reported = undefined;
      };

      onMounted(sync);
      // attrs are not props, but reading them through setup's attrs is tracked, so class, style and id changes resize.
      watch(() => [{ ...props }, attrs.class, attrs.style, attrs.id], sync, { flush: 'post' });
      // A slot that appears or goes changes no prop, so the watcher does not see it.
      onUpdated(() => {
        if (slotted !== !!slots.default) sync();
      });
      onBeforeUnmount(() => {
        // A Suspense boundary unmounted while pending never set the ref.
        if (!host.value) return;
        detached.get(windowOf(host.value))?.unobserve(host.value);
        bound?.destroy();
        bound = undefined;
      });

      return () =>
        h(
          'div',
          {
            ref: host,
            class: attrs.class,
            id: attrs.id,
            style: {
              ...(props.width !== undefined && { width: `${props.width as number}px` }),
              ...(props.height !== undefined && { height: `${props.height as number}px` }),
              ...hostStyle(attrs.style),
            },
          },
          // A child of the host rather than a second root, so $el, v-show and scoped styles keep meaning the host.
          slots.default && overlay.value
            ? [h(Teleport, { to: overlay.value }, [h(Overlay, { shown, stale, slot: slots.default })])]
            : undefined,
        );
    },
  });
}
