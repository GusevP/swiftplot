import type { Feature } from '../types.js';

export type TooltipOptions =
  /** One row per labelled mark that can be sampled at the pointer's x, with a crosshair. */
  | { mode: 'x'; title: (x: number) => string; value: (y: number) => string }
  /** x and y are where the mark says it was hit; row is its row there, to look up anything else. */
  | { mode: 'nearest'; text: (label: string, x: number, y: number, row?: number) => string };

type Row = { text: string; color?: string };

const NEAREST_PX = 20;
const FOCUS_PX = 30;

export function tooltip(t: TooltipOptions): Feature {
  return chart => {
    const { root } = chart;
    const cross = chart.layer('div', 'display:none;border-left:1px dashed #888');
    const tip = chart.layer(
      'div',
      'display:none;left:0;top:0;background:#fff;border:1px solid #ccc;padding:4px 8px;box-sizing:border-box;width:max-content;max-width:100%;white-space:normal;overflow-wrap:anywhere;z-index:100',
    );
    let at: [number, number] | null = null;
    // A lifted finger is held to what its tip showed, found again after a resize or a new domain.
    let last: (() => [number, number]) | null = null;
    let held: (() => [number, number]) | null = null;
    const hide = () => {
      cross.style.display = tip.style.display = 'none';
      chart.focus(null);
    };
    const show = (x: number, y: number, rows: Row[]) => {
      const { width, height } = chart.size();
      tip.replaceChildren(
        ...rows.map(r => {
          const e = document.createElement('div');
          e.textContent = r.text;
          if (r.color) e.style.color = r.color;
          return e;
        }),
      );
      const fx = x > width / 2;
      const fy = y > height / 2;
      tip.style.display = '';
      const left = fx ? `${x - 12}px - 100%` : `${x + 12}px`;
      const top = fy ? `${y - 12}px - 100%` : `${y + 12}px`;
      tip.style.transform = `translate(clamp(0px, ${left}, ${width}px - 100%), clamp(0px, ${top}, ${height}px - 100%))`;
    };
    const place = () => {
      if (!at) return;
      const { width, height } = chart.size();
      const box = root.getBoundingClientRect();
      const [px, py] = held
        ? held()
        : [((at[0] - box.left) * width) / box.width, ((at[1] - box.top) * height) / box.height];
      last = null;
      if (t.mode === 'nearest') {
        const hit = chart.hit(px, py, NEAREST_PX);
        if (!hit) return hide();
        chart.focus(
          hit.mark.group ?? null,
          hit.row === undefined ? undefined : { mark: hit.mark, row: hit.row },
        );
        // A mark made of named parts, such as slices, is spoken for by the part that was hit.
        const part = hit.row === undefined ? undefined : hit.mark.entries?.[hit.row];
        const { label = '', color } = part ?? hit.mark;
        const text = t.text(label, hit.x, hit.y, hit.row);
        last = () => [chart.xPx(hit.x), chart.yPx(hit.y)];
        show(chart.xPx(hit.x), chart.yPx(hit.y), [{ text, color: hit.color ?? color }]);
        return;
      }
      const m = chart.margin();
      if (px < m.left || px > width - m.right || py < m.top || py > height - m.bottom) return hide();
      const v = chart.xValue(px);
      const rows: Row[] = [{ text: t.title(v) }];
      // A line within reach of the pointer is focused before the filled mark the pointer is in,
      // and of several filled marks the one drawn last.
      let near = FOCUS_PX;
      let line: string | undefined;
      let fill: string | undefined;
      for (const k of chart.marks()) {
        if (!k.sampleAtX) continue;
        const s = k.sampleAtX(v);
        const value = typeof s === 'number' ? s : s?.value;
        if (k.label !== undefined) {
          rows.push({ text: `${k.label}: ${value === undefined ? '–' : t.value(value)}`, color: k.color });
        }
        if (s === undefined || k.group === undefined) continue;
        if (typeof s === 'number') {
          const gap = Math.abs(chart.yPx(s) - py);
          if (gap < near) [near, line] = [gap, k.group];
        } else {
          const a = chart.yPx(s.y1);
          const b = chart.yPx(s.y2);
          if (a !== b && py >= Math.min(a, b) && py <= Math.max(a, b)) fill = k.group;
        }
      }
      const group = line ?? fill ?? null;
      last = () => [chart.xPx(v), py];
      cross.style.display = '';
      cross.style.left = `${px}px`;
      cross.style.top = `${m.top}px`;
      cross.style.height = `${height - m.top - m.bottom}px`;
      show(px, m.top, rows);
      chart.focus(group);
    };
    const move = (e: PointerEvent) => {
      // Over another feature's layer, such as a legend, the focus is that feature's to set.
      if (e.target !== root) {
        at = null;
        cross.style.display = tip.style.display = 'none';
        return;
      }
      at = [e.clientX, e.clientY];
      held = null;
      place();
    };
    const leave = () => {
      at = null;
      held = null;
      hide();
    };
    // A lifted finger leaves the chart, and a tapped tip is meant to stay until a tap elsewhere.
    const lift = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !last) leave();
      else held = last;
    };
    // Capturing, so a control that stops the tap still dismisses, and a tap on the chart sets its own state after.
    const away = () => {
      if (at) leave();
    };
    root.addEventListener('pointerdown', move);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', lift);
    root.addEventListener('pointercancel', leave);
    document.addEventListener('pointerdown', away, true);
    return {
      update: place,
      destroy() {
        root.removeEventListener('pointerdown', move);
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', lift);
        root.removeEventListener('pointercancel', leave);
        document.removeEventListener('pointerdown', away, true);
        cross.remove();
        tip.remove();
      },
    };
  };
}
