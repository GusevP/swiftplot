import type { Feature } from '../types.js';

// A move falls back to the cross-fade when one repaint of the chart takes longer than this, in ms.
const REPAINT_BUDGET = 6;

export type AnimateOptions = {
  /** Milliseconds; nothing animates when it is 0 or not finite. @default 300 */
  duration?: number;
  /**
   * How marks appear on the first paint: uncovered (the default), from the left, from the top where a
   * mark asks for it, or round the clock in a polar frame; or all at once from transparent.
   */
  enter?: 'reveal' | 'fade';
};

/**
 * Marks are uncovered (or fade in) on the first paint. When the data changes they
 * move to their new shape if every changed mark can (bars, row for row) and cross-fade otherwise.
 * The entrance and the cross-fade blend two pictures of the chart, so a frame costs the same
 * whatever the data size; a move repaints the chart each frame.
 * Nothing animates for a resize or a focus change, with reduced motion, in a hidden tab, or
 * while updates arrive less than `duration` ms apart.
 * ponytail: marks on WebGL take part in the entrance, but swap at once when the data changes.
 */
export function animate({ duration = 300, enter = 'reveal' }: AnimateOptions = {}): Feature {
  if (!Number.isFinite(duration) || duration <= 0) return () => ({ destroy() {} });
  return chart => {
    const { canvas, win } = chart;
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const ctx = canvas.getContext('2d')!;
    const from = new OffscreenCanvas(0, 0);
    const to = new OffscreenCanvas(0, 0);
    let frame = 0;
    let last = -Infinity;
    let entered = false;
    let entering = false;
    let shown: (() => void) | undefined;

    const keep = (picture: OffscreenCanvas) => {
      picture.width = canvas.width;
      picture.height = canvas.height;
      picture.getContext('2d')!.drawImage(canvas, 0, 0);
    };
    const stop = () => {
      win.cancelAnimationFrame(frame);
      frame = 0;
      entering = false;
      shown = undefined;
      from.width = to.width = 0;
      chart.morph(1);
    };
    const run = (step: (t: number) => void, drawn = false) => {
      const start = win.performance.now();
      const show = (e: number) => {
        step(e);
        shown = () => step(e);
      };
      const tick = (now: number) => {
        const t = motion.matches ? 1 : Math.min(1, Math.max(0, (now - start) / duration));
        show(1 - (1 - t) ** 3);
        if (t < 1) frame = win.requestAnimationFrame(tick);
        else stop();
      };
      if (!drawn) show(0);
      frame = win.requestAnimationFrame(tick);
    };
    // 'copy' replaces the canvas with what is drawn, so the pictures need no clearing first.
    const blend = (mix: (t: number) => void) => (t: number) => {
      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      mix(t);
      ctx.restore();
    };
    // Additive, so a pixel that is the same in both pictures keeps its value throughout.
    const fade = blend(t => {
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(from, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t;
      ctx.drawImage(to, 0, 0);
    });
    // The chart says what a reveal has uncovered; here it becomes the clip for the canvas.
    const reveal = blend(t => {
      const scale = canvas.width / chart.size().width;
      ctx.drawImage(from, 0, 0);
      ctx.beginPath();
      for (const [x, y] of chart.revealed(t)) ctx.lineTo(x * scale, y * scale);
      ctx.clip();
      ctx.drawImage(to, 0, 0);
    });

    chart.onPaint((draw, why) => {
      // A focus change lands while the entrance runs: it goes into both pictures, which may have a new layout.
      if (why === 'focus' && entering && shown) {
        draw(0);
        keep(from);
        draw();
        keep(to);
        return shown();
      }
      const now = performance.now();
      const still =
        why !== 'data' || frame !== 0 || now - last < duration || chart.doc.hidden || motion.matches;
      stop();
      if (why === 'data') last = now;
      const first = !entered;
      entered = true;
      if (still) return draw();

      if (first) draw(0);
      keep(from);
      if (!first && chart.morph(0)) {
        draw();
        if (performance.now() - now < REPAINT_BUDGET) return run(t => (chart.morph(t), draw()), true);
        chart.morph(1);
      }
      draw();
      keep(to);
      if (!first) return run(fade);
      entering = true;
      run(enter === 'fade' ? t => (chart.reveal(1, t), fade(t)) : t => (chart.reveal(t), reveal(t)));
    });

    return { destroy: stop };
  };
}
