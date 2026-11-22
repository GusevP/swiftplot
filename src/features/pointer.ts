import type { Internals } from '../types.js';

export const SLOP_PX = 4;

export const unselect = (e: Event) => e.preventDefault();

/** Clears `drag.active` after the click the browser sends for this release, which a drag must not count as one. */
export const settle = (chart: Internals) =>
  setTimeout(() => {
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

/** Where a pointer event is in CSS pixels, and whether it is over the plot of a chart with axes. */
export function locate(chart: Internals, e: MouseEvent) {
  const { inside, ...where } = position(chart, e.clientX, e.clientY);
  return { ...where, over: inside && chart.frame() === 'axes' && e.target === chart.root };
}
