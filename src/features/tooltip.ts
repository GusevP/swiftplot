import type { Feature, Mark } from '../types.js';

export type TooltipOptions =
  /** One row per labelled mark that can be sampled at the pointer's x, with a crosshair. */
  | { mode: 'x'; title: (x: number) => string; value: (y: number) => string }
  /** x and y are where the mark says it was hit; row is its row there, to look up anything else. */
  | { mode: 'nearest'; text: (label: string, x: number, y: number, row?: number) => string };

type Row = { text: string; color?: string };
/** What a tip showed: the mark and row it was found on, and the points where to look for them again. */
type Held = { mark?: Mark; row?: number; points: () => [number, number][] };

const NEAREST_PX = 20;
const FOCUS_PX = 30;

export function tooltip(t: TooltipOptions): Feature {
  return chart => {
    const { root } = chart;
    const cross = chart.layer('div', 'display:none;border-left:1px dashed #888');
    const tip = chart.layer(
      'div',
      'display:none;left:0;top:0;background:#fff;border:1px solid #ccc;padding:4px 8px;box-sizing:border-box;width:max-content;max-width:100%;max-height:100%;overflow:hidden;white-space:normal;overflow-wrap:anywhere;z-index:100',
    );
    let at: [number, number] | null = null;
    // A lifted finger is held to what its tip showed, found again after a resize or a new domain
    // and let go once it is not.
    let last: Held | null = null;
    let held: Held | null = null;
    const yValue = (py: number) => (py - chart.yPx(0)) / (chart.yPx(1) - chart.yPx(0));
    // A polar mark is drawn round the plot's centre at half its shorter side, so a point on it is
    // also held in those terms: the plot's fractions move it when the plot's shape changes.
    const round = () => {
      const [x0, x1, y0, y1] = [chart.xPx(0), chart.xPx(1), chart.yPx(0), chart.yPx(1)];
      return [(x0 + x1) / 2, (y0 + y1) / 2, Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2] as const;
    };
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
      const points = held
        ? held.points()
        : [
            [((at[0] - box.left) * width) / box.width, ((at[1] - box.top) * height) / box.height] as [
              number,
              number,
            ],
          ];
      const [px, py] = points[0]!;
      const miss = () => (held ? leave() : hide());
      last = null;
      if (t.mode === 'nearest') {
        const [found, hit] =
          points
            .map(p => [p, chart.hit(p[0], p[1], NEAREST_PX)] as const)
            .find(([, h]) => h && (!held || (h.mark === held.mark && h.row === held.row))) ?? [];
        if (!found || !hit) return miss();
        chart.focus(
          hit.mark.group ?? null,
          hit.row === undefined ? undefined : { mark: hit.mark, row: hit.row },
        );
        // A mark made of named parts, such as slices, is spoken for by the part that was hit.
        const part = hit.row === undefined ? undefined : hit.mark.entries?.[hit.row];
        const { label = '', color } = part ?? hit.mark;
        const text = t.text(label, hit.x, hit.y, hit.row);
        const [vx, vy] = [chart.xValue(found[0]), yValue(found[1])];
        const [cx, cy, r] = round();
        const [ux, uy] = [(found[0] - cx) / r, (found[1] - cy) / r];
        const { x, y } = hit;
        last = {
          mark: hit.mark,
          row: hit.row,
          points: () => {
            const [cx, cy, r] = round();
            return [
              [chart.xPx(x), chart.yPx(y)],
              [chart.xPx(vx), chart.yPx(vy)],
              [cx + ux * r, cy + uy * r],
            ];
          },
        };
        if (held) held = last;
        show(chart.xPx(hit.x), chart.yPx(hit.y), [{ text, color: hit.color ?? color }]);
        return;
      }
      const m = chart.margin();
      if (px < m.left || px > width - m.right) return miss();
      if (!held && (py < m.top || py > height - m.bottom)) return hide();
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
      const vy = yValue(py);
      last = { points: () => [[chart.xPx(v), chart.yPx(vy)]] };
      if (held) held = last;
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
