import type { Feature, Span } from '../types.js';
import { locate as where, settle as release, SLOP_PX, unselect } from './pointer.js';

/** Zooms with the wheel (ctrl or cmd held, by default) or a pinch and pans with a drag, on x, y or both; a double-click on the plot shows the whole of each zoomed axis again. */
export type ZoomOptions = {
  /** 'x' when left out. */
  axes?: 'x' | 'y' | 'xy';
  /** 'ctrl' when left out: ctrl or cmd and the wheel zoom, and a plain wheel scrolls the page. */
  wheel?: 'ctrl' | 'plain' | false;
  /**
   * Which drag pans: a plain one, or one with shift held. Left out, a plain drag pans unless a brush
   * is in use. 'pan' takes every mouse drag, so a brush() beside it gets none.
   */
  drag?: 'pan' | 'shift' | false;
};

type Window = { x?: Span; y?: Span; y2?: Span };

// How far a drag that pans both axes must move up or down before it pans y: a hand does not move level.
const LEVEL_PX = 8;

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 20;
const TAP_MS = 500;

export function zoom(z: ZoomOptions = {}): Feature {
  const sides = (['x', 'y'] as const).filter(k => (z.axes ?? 'x').includes(k));
  return chart => {
    const { root, drag } = chart;
    const locate = (e: MouseEvent) => where(chart, e);
    if (z.drag !== false) drag.pan = z.drag === 'pan' ? 'plain' : 'shift';
    let pending: Window | null | undefined;
    const shown = () => chart.fit(pending === undefined ? {} : pending);
    let frame = 0;
    const flush = () => {
      frame = 0;
      const want = pending;
      pending = undefined;
      if (want !== undefined) chart.propose(want);
    };
    const ask = (want: Window | null) => {
      pending = want;
      frame ||= requestAnimationFrame(flush);
    };

    const wheel = (e: WheelEvent) => {
      if (z.wheel === false) return;
      const plain = z.wheel === 'plain';
      if (!plain && !e.ctrlKey && !e.metaKey) return;
      const { over, at } = locate(e);
      if (!over || !e.deltaY) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? chart.size().height : 1;
      const k = Math.exp(e.deltaY * unit * 0.002);
      const base = shown();
      const want: Window = { ...pending };
      for (const s of sides) {
        const [lo, hi] = base[s];
        const a = lo + at[s] * (hi - lo);
        const around = (t: number): Span => [a - (a - lo) * t, a + (hi - a) * t];
        const step = around(k);
        const [flo, fhi] = chart.fit({ [s]: step })[s];
        const t = (fhi - flo) / (hi - lo);
        want[s] =
          k > 1 || Math.abs(fhi - flo) <= Math.abs(step[1] - step[0]) ? step : t < 1 ? around(t) : [lo, hi];
      }
      const next = chart.fit(want);
      const still = sides.every(s => String(next[s]) === String(base[s]));
      if (plain && !e.ctrlKey && !e.metaKey && still) return;
      e.preventDefault();
      if (!still) ask(want);
    };

    type Shown = { x: Span; y: Span; y2?: Span };
    // `lift` is where a drag along both axes left the level: the y spans shown then, and the height it had moved.
    let from:
      | { id: number; x: number; y: number; view: Shown; w: number; h: number; lift?: Shown & { dy: number } }
      | undefined;
    let settling = 0;
    const down = (e: PointerEvent) => {
      if (from || e.pointerType === 'touch' || e.button !== 0 || z.drag === false) return;
      const shift = z.drag === 'shift' || (z.drag === undefined && drag.brush);
      if (shift && !e.shiftKey) return;
      const { px, py, over, w, h } = locate(e);
      if (!over) return;
      from = { id: e.pointerId, x: px, y: py, view: shown(), w, h };
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerup', up, true);
      document.addEventListener('pointercancel', up, true);
      document.addEventListener('selectstart', unselect, true);
    };
    const move = (e: PointerEvent) => {
      if (!from || e.pointerId !== from.id) return;
      const { px, py } = locate(e);
      const [dx, dy] = [px - from.x, py - from.y];
      if (!drag.active && Math.hypot(dx, dy) < SLOP_PX) return;
      drag.active = true;
      const want: Window = {};
      if (sides.includes('x')) {
        const [lo, hi] = from.view.x;
        const shift = (-dx * (hi - lo)) / from.w;
        want.x = [lo + shift, hi + shift];
      }
      if (sides.includes('y')) {
        const both = sides.length === 2;
        // Until then y is left out, so an axis fitted to the x window goes on fitting; from then on only the
        // height beyond the threshold counts, from the spans shown at that moment, both y axes together.
        if (both && !from.lift && Math.abs(dy) >= LEVEL_PX)
          from.lift = { ...shown(), dy: Math.sign(dy) * LEVEL_PX };
        const base = both ? from.lift : { ...from.view, y2: undefined, dy: 0 };
        for (const k of ['y', 'y2'] as const) {
          const s = base?.[k];
          if (!s) continue;
          const shift = ((dy - base!.dy) * (s[1] - s[0])) / from.h;
          want[k] = [s[0] + shift, s[1] + shift];
        }
      }
      ask(want);
    };
    const end = () => {
      from = undefined;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('selectstart', unselect, true);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== from?.id) return;
      end();
      if (drag.active) settle();
    };
    const settle = () => (settling = release(chart));
    const engage = () => {
      clearTimeout(settling);
      drag.active = true;
    };
    const whole = () => ask(sides.length === 2 ? null : { [sides[0]!]: undefined });
    const reset = (e: MouseEvent) => {
      if (locate(e).over) whole();
    };

    type Touch = { px: number; py: number; at: { x: number; y: number } };
    const touches = new Map<number, Touch>();
    let pinch:
      | { a: number; b: number; mid: { x: number; y: number }; d: number; view: { x: Span; y: Span } }
      | undefined;
    let tap: { x: number; y: number; t: number } | undefined;
    let again = false;
    let lastTap: { x: number; y: number; t: number } | undefined;
    const span = (a: Touch, b: Touch) => ({
      mid: { x: (a.at.x + b.at.x) / 2, y: (a.at.y + b.at.y) / 2 },
      d: Math.hypot(a.px - b.px, a.py - b.py),
    });
    const touchDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const { px, py, at, over } = locate(e);
      if (!over || touches.size >= 2) return;
      if (!touches.size) {
        document.addEventListener('pointermove', touchMove, true);
        document.addEventListener('pointerup', touchUp, true);
        document.addEventListener('pointercancel', touchCancel, true);
      }
      touches.set(e.pointerId, { px, py, at });
      if (touches.size === 2) {
        engage();
        tap = lastTap = undefined;
        again = false;
        const [a, b] = [...touches.keys()] as [number, number];
        pinch = { a, b, ...span(touches.get(a)!, touches.get(b)!), view: shown() };
        return;
      }
      again =
        !!lastTap &&
        performance.now() - lastTap.t < DOUBLE_TAP_MS &&
        Math.hypot(px - lastTap.x, py - lastTap.y) < DOUBLE_TAP_PX;
      if (again) engage();
      lastTap = undefined;
      tap = { x: px, y: py, t: performance.now() };
    };
    const touchMove = (e: PointerEvent) => {
      const p = touches.get(e.pointerId);
      if (!p) return;
      const { px, py, at } = locate(e);
      Object.assign(p, { px, py, at });
      if (tap && Math.hypot(p.px - tap.x, p.py - tap.y) >= SLOP_PX) tap = undefined;
      if (!pinch) return;
      const { mid, d } = span(touches.get(pinch.a)!, touches.get(pinch.b)!);
      const k = d && pinch.d ? pinch.d / d : 1;
      const want: Window = {};
      for (const s of sides) {
        const [lo, hi] = pinch.view[s];
        const under = lo + pinch.mid[s] * (hi - lo);
        const [flo, fhi] = chart.fit({ [s]: [lo, lo + (hi - lo) * k] })[s];
        const width = fhi - flo;
        const start = under - mid[s] * width;
        want[s] = [start, start + width];
      }
      ask(want);
    };
    const touchEnd = () => {
      touches.clear();
      pinch = tap = undefined;
      again = false;
      document.removeEventListener('pointermove', touchMove, true);
      document.removeEventListener('pointerup', touchUp, true);
      document.removeEventListener('pointercancel', touchCancel, true);
      if (drag.active) settle();
    };
    const touchUp = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.delete(e.pointerId);
      pinch = undefined;
      if (touches.size) return;
      const t = performance.now();
      if (tap && t - tap.t < TAP_MS) {
        if (again) whole();
        else lastTap = { ...tap, t };
      }
      touchEnd();
    };
    const touchCancel = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      tap = lastTap = undefined;
      touchEnd();
    };
    const touchAction = root.style.touchAction;
    root.style.touchAction = 'pan-x pan-y';

    root.addEventListener('wheel', wheel, { passive: false });
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerdown', touchDown, true);
    root.addEventListener('dblclick', reset);
    return {
      destroy() {
        end();
        touchEnd();
        root.style.touchAction = touchAction;
        root.removeEventListener('pointerdown', touchDown, true);
        cancelAnimationFrame(frame);
        clearTimeout(settling);
        drag.pan = drag.active = false;
        root.removeEventListener('wheel', wheel);
        root.removeEventListener('pointerdown', down);
        root.removeEventListener('dblclick', reset);
      },
    };
  };
}
