import type { Internals } from '../types.js';

export const SLOP_PX = 4;

export const unselect = (e: Event) => e.preventDefault();

/** Clears `drag.active` after the click the browser sends for this release, which a drag must not count as one. */
export const settle = (chart: Internals) =>
  chart.win.setTimeout(() => {
    chart.drag.active = false;
    chart.sync();
  }, 0);

/** Where a point of the page is on the chart in CSS pixels, and whether it is inside the plot rectangle. */
export function position(chart: Internals, clientX: number, clientY: number) {
  const { width, height } = chart.size();
  const m = chart.margin();
  const box = chart.root.getBoundingClientRect();
  const px = ((clientX - box.left) * width) / box.width;
  const py = ((clientY - box.top) * height) / box.height;
  const [w, h] = [width - m.left - m.right, height - m.top - m.bottom];
  const inside = px >= m.left && px <= m.left + w && py >= m.top && py <= m.top + h;
  return { px, py, inside, w, h, at: { x: (px - m.left) / w, y: 1 - (py - m.top) / h } };
}

/**
 * The presses on each overlay's children by pointer id, false once released with the click still to come, and what
 * the live chart does when they change: by overlay, which a chart made again takes over.
 */
export const presses = new WeakMap<HTMLElement, { held: Map<number, boolean>; changed(): void }>();

/** Whether this is the release of a press on an overlay child by a pointer that goes on hovering. */
export const released = ({ overlay }: Internals, e: PointerEvent) =>
  e.pointerType !== 'touch' && !!overlay && presses.get(overlay)?.held.get(e.pointerId) === false;

/**
 * Whether a click or a double click on the root ends a press that began on an overlay child and was released off it: the
 * browser sends it to the common ancestor of the two ends.
 */
export const strayed = ({ overlay }: Internals, e: MouseEvent) => {
  const held = overlay && presses.get(overlay)?.held;
  // Some browsers send a click as a MouseEvent, which does not name its pointer, and so are double clicks.
  const id = (e as Partial<PointerEvent>).pointerId;
  return !!held && (id === undefined ? held.size > 0 : held.has(id));
};

/** Whether a hover is the chart's own: on it or on the app's DOM over it, and not on a control such as a legend's. */
export const owns = (chart: Internals, target: EventTarget | null) =>
  target === chart.root || !!chart.overlay?.contains(target as Node | null);

/** Where a pointer event is in CSS pixels, and whether it is on the plot of a chart with axes itself, and not on the app's DOM over it. */
export function locate(chart: Internals, e: MouseEvent) {
  const { inside, ...where } = position(chart, e.clientX, e.clientY);
  return { ...where, over: inside && chart.frame() === 'axes' && e.target === chart.root };
}
