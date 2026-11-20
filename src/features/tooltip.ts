import type { Feature } from '../types.js';

export type TooltipOptions =
  /** One row per mark that can be sampled at the pointer's x, with a crosshair. */
  | { mode: 'x'; title: (x: number) => string; value: (y: number) => string }
  | { mode: 'nearest'; text: (label: string, x: number, y: number) => string };

type Row = { text: string; color?: string };

const NEAREST_PX = 20;
const FOCUS_PX = 30;

export function tooltip(t: TooltipOptions): Feature {
  return chart => {
    const { root } = chart;
    const cross = chart.layer('div', 'display:none;border-left:1px dashed #888');
    const tip = chart.layer(
      'div',
      'display:none;background:#fff;border:1px solid #ccc;padding:4px 8px;white-space:nowrap;z-index:100',
    );
    let at: [number, number] | null = null;
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
      tip.style.left = `${x + (fx ? -12 : 12)}px`;
      tip.style.top = `${y + (fy ? -12 : 12)}px`;
      tip.style.transform = `translate(${fx ? -100 : 0}%,${fy ? -100 : 0}%)`;
    };
    const place = () => {
      if (!at) return;
      const box = root.getBoundingClientRect();
      const px = at[0] - box.left;
      const py = at[1] - box.top;
      if (t.mode === 'nearest') {
        const hit = chart.hit(px, py, NEAREST_PX);
        if (!hit) return hide();
        chart.focus(hit.mark.group ?? null);
        show(chart.xPx(hit.x), chart.yPx(hit.y), [
          { text: t.text(hit.mark.label ?? '', hit.x, hit.y), color: hit.mark.color },
        ]);
        return;
      }
      const { width, height } = chart.size();
      const m = chart.margin();
      if (px < m.left || px > width - m.right || py < m.top || py > height - m.bottom) return hide();
      const v = chart.xValue(px);
      const rows: Row[] = [{ text: t.title(v) }];
      let near = FOCUS_PX;
      let group: string | null = null;
      for (const k of chart.marks()) {
        if (!k.sampleAtX) continue;
        const y = k.sampleAtX(v);
        rows.push({ text: `${k.label ?? ''}: ${y === undefined ? '–' : t.value(y)}`, color: k.color });
        const gap = y === undefined ? Infinity : Math.abs(chart.yPx(y) - py);
        if (gap < near && k.group !== undefined) [near, group] = [gap, k.group];
      }
      cross.style.display = '';
      cross.style.left = `${px}px`;
      cross.style.top = `${m.top}px`;
      cross.style.height = `${height - m.top - m.bottom}px`;
      show(px, m.top, rows);
      chart.focus(group);
    };
    const move = (e: MouseEvent) => {
      at = [e.clientX, e.clientY];
      place();
    };
    const leave = () => {
      at = null;
      hide();
    };
    root.addEventListener('mouseleave', leave);
    root.addEventListener('mousemove', move);
    return {
      update: place,
      destroy() {
        root.removeEventListener('mouseleave', leave);
        root.removeEventListener('mousemove', move);
        cross.remove();
        tip.remove();
      },
    };
  };
}
