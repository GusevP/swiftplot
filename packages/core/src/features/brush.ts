import type { Feature, Span } from '../types.js';
import { locate, settle, SLOP_PX, unselect } from './pointer.js';

export type BrushOptions = {
  /** 'x' when left out: the rectangle spans the plot's height and the range its whole y window. */
  axes?: 'x' | 'y' | 'xy';
  /** Show the range brushed once it is reported, on the brushed axes, and drop the rectangle. */
  zoom?: boolean;
  /** The range brushed, in axis values, on release, with y2 when the chart has a second axis; null once a range reported is cleared. */
  onSelect?(range: { x: Span; y: Span; y2?: Span } | null): void;
};

export function brush(b: BrushOptions = {}): Feature {
  const [bx, by] = (['x', 'y'] as const).map(k => (b.axes ?? 'x').includes(k));
  return chart => {
    const { drag } = chart;
    drag.brush = true;
    const shade = chart.layer('div', 'display:none;opacity:0.2');
    let reported = false;
    let from: { id: number; x: number; y: number; dropped?: true } | undefined;
    let box: { left: number; top: number; right: number; bottom: number } | undefined;
    let settling = 0;
    let gone = false;

    const clear = () => {
      shade.style.display = 'none';
      box = undefined;
      if (!reported) return;
      reported = false;
      b.onSelect?.(null);
    };
    const down = (e: PointerEvent) => {
      if (
        from ||
        e.pointerType === 'touch' ||
        e.button !== 0 ||
        (drag.pan && (drag.pan === 'plain' || e.shiftKey))
      )
        return;
      const { px, py, over } = locate(chart, e);
      if (!over) return;
      from = { id: e.pointerId, x: px, y: py };
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerup', up, true);
      document.addEventListener('pointercancel', cancel, true);
      document.addEventListener('keydown', key, true);
      document.addEventListener('selectstart', unselect, true);
      clear();
    };
    const move = (e: PointerEvent) => {
      if (!from || from.dropped || e.pointerId !== from.id) return;
      const { width, height } = chart.size();
      const m = chart.margin();
      const [l, r, t, btm] = [m.left, width - m.right, m.top, height - m.bottom];
      const { px, py } = locate(chart, e);
      const x = Math.min(Math.max(px, l), r);
      const y = Math.min(Math.max(py, t), btm);
      const [dx, dy] = [bx ? x - from.x : 0, by ? y - from.y : 0];
      if (!box && Math.hypot(dx, dy) < SLOP_PX) return;
      drag.active = true;
      box = {
        left: bx ? Math.min(from.x, x) : l,
        right: bx ? Math.max(from.x, x) : r,
        top: by ? Math.min(from.y, y) : t,
        bottom: by ? Math.max(from.y, y) : btm,
      };
      Object.assign(shade.style, {
        display: '',
        background: chart.theme().muted,
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.right - box.left}px`,
        height: `${box.bottom - box.top}px`,
      });
    };
    const abandon = () => {
      if (from) from.dropped = true;
      clear();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') abandon();
    };
    const end = () => {
      from = undefined;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('selectstart', unselect, true);
      if (drag.active) settling = settle(chart);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== from?.id) return;
      abandon();
      end();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== from?.id) return;
      move(e);
      const kept = !from.dropped && box;
      end();
      if (!kept) return;
      const asc = (p: number, q: number): Span => (p <= q ? [p, q] : [q, p]);
      const span = (k: 'x' | 'y' | 'y2', [p, q]: Span) => asc(chart.real(k, p), chart.real(k, q));
      const view = chart.view();
      const picked = {
        x: bx ? asc(chart.xValue(kept.left), chart.xValue(kept.right)) : view.x,
        y: by ? asc(chart.yValue(kept.bottom), chart.yValue(kept.top)) : view.y,
      };
      const y2 =
        view.y2 && (by ? asc(chart.yValue(kept.bottom, 'y2'), chart.yValue(kept.top, 'y2')) : view.y2);
      reported = !b.zoom;
      b.onSelect?.({ x: span('x', picked.x), y: span('y', picked.y), ...(y2 && { y2: span('y2', y2) }) });
      if (!b.zoom || gone) return;
      clear();
      chart.propose({ ...(bx && { x: picked.x }), ...(by && { y: picked.y }) });
    };

    chart.root.addEventListener('pointerdown', down);
    return {
      letGo: abandon,
      destroy() {
        gone = true;
        from = undefined;
        end();
        clearTimeout(settling);
        drag.brush = drag.active = false;
        chart.root.removeEventListener('pointerdown', down);
        shade.remove();
      },
    };
  };
}
