import { light } from './theme.js';

/** The window an element is in, or this one for an element of a document that has none. */
export const windowOf = (el: Node): Window & typeof globalThis =>
  (el.ownerDocument?.defaultView ?? globalThis) as Window & typeof globalThis;

/**
 * CSS variables in a colour, resolved where the chart stands: anything but a string naming one comes
 * back as it is. A colour with no value becomes `muted`, with one warning. What was read is kept
 * until forget() or reread().
 */
export function resolver(root: HTMLElement, muted: () => string) {
  const known = new Map<string, string>();
  const warned = new Set<string>();
  const read = (css: string) => {
    const probe = root.ownerDocument.createElement('div');
    // The root's own values, against a page's rules for its children and properties that do not inherit.
    // Every word is taken, as CSS escapes can spell even a name's dashes.
    const names = css.match(/(?:\\[\da-f]{1,6}(?:\r\n|\s)?|\\.|[\w-]|[^\0-\x7f])+/gi) ?? [];
    probe.style.cssText =
      'display:none;' + ['color', 'color-scheme', ...names].map(k => `${k}:inherit!important`).join(';');
    // Two properties that take any colour, are not inherited and start out black and white: without a
    // value each keeps its own, so they differ.
    probe.style.setProperty('flood-color', css, 'important');
    probe.style.setProperty('lighting-color', css, 'important');
    (root.isConnected ? root : root.ownerDocument.body).append(probe);
    const { floodColor, lightingColor } = windowOf(root).getComputedStyle(probe);
    probe.remove();
    return floodColor === lightingColor ? floodColor : undefined;
  };
  const color = <T>(css: T): T | string => {
    if (typeof css !== 'string' || !css.includes('var(')) return css;
    let found = known.get(css);
    if (found !== undefined) return found;
    found = read(css);
    if (found === undefined) {
      if (!warned.has(css)) console.warn(`swiftplot: the colour "${css}" has no value; drawn in muted`);
      warned.add(css);
      found = css === muted() ? light.muted : color(muted());
    }
    known.set(css, found);
    return found;
  };
  /** Reads the colours known again; whether any has changed. */
  const reread = () => {
    const was = [...known];
    known.clear();
    return was.some(([css, v]) => color(css) !== v);
  };
  return { color, forget: () => known.clear(), reread };
}

/** Lets a context's fillStyle and strokeStyle take what `color` resolves. */
export function extend(ctx: CanvasRenderingContext2D, color: (css: unknown) => unknown) {
  for (const k of ['fillStyle', 'strokeStyle'] as const) {
    const native = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, k)!;
    Object.defineProperty(ctx, k, {
      ...native,
      set(v: unknown) {
        native.set!.call(ctx, color(v));
      },
    });
  }
}
