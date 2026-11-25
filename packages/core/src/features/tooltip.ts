import { NEAREST_PX } from '../chart.js';
import type { Feature } from '../types.js';
import { position } from './pointer.js';

/** A tooltip at the pointer: a row for each visible, labelled line or area at its x, or the text for what is nearest it. */
export type TooltipOptions =
  /** A row for each labelled line or area not hidden, at the pointer's x, with a crosshair; a band gives its thickness. */
  | {
      /** Shows each labelled line and area that is not hidden, at the pointer's x. */
      mode: 'x';
      /** The first line of the tooltip, for the x at the pointer. */
      title: (x: number) => string;
      /** A mark's value as text, after its label, for its y on the axis it is drawn against. */
      value: (y: number, axis: 'y' | 'y2') => string;
      /** The x to read the title and the marks at, such as the nearest row's, from the one at the pointer, both in the marks' space. */
      snap?: (x: number) => number;
    }
  /** x and y are where the mark says it was hit, y being the row's own value where it has one; row is its row there. */
  | {
      /** Shows what is nearest the pointer, within 20 CSS pixels. */
      mode: 'nearest';
      /** The tooltip's text, from the label of the mark or part hit, its x and y, and its row. */
      text: (label: string, x: number, y: number, row?: number) => string;
    };

type Row = { text: string; color?: string };

const FOCUS_PX = 30;

export function tooltip(t: TooltipOptions): Feature {
  return chart => {
    const { root } = chart;
    const cross = chart.layer('div', 'display:none;border-left:1px dashed');
    const tip = chart.layer(
      'div',
      'display:none;left:0;top:0;border:1px solid;padding:4px 8px;box-sizing:border-box;width:max-content;max-width:100%;max-height:100%;overflow:hidden;white-space:normal;overflow-wrap:anywhere;z-index:100',
    );
    const restyle = () => {
      const { text, muted, surface, border } = chart.theme();
      cross.style.borderLeftColor = muted;
      Object.assign(tip.style, { color: text, background: surface, borderColor: border });
    };
    restyle();
    let at: [number, number] | null = null;
    let held = false;
    // The user's pointer is on the chart, maybe over another feature's layer, so the app's is not shown.
    let inside = false;
    let fromApp = false;
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
      const { width, height } = chart.size();
      let px: number;
      let py: number | undefined;
      if (at) {
        fromApp = false;
        ({ px, py } = position(chart, ...at));
      } else {
        const p = inside ? null : chart.pointer();
        if (!p) {
          if (fromApp) {
            fromApp = false;
            hide();
          }
          return;
        }
        fromApp = true;
        ({ x: px, y: py } = p);
      }
      if (chart.drag.active) return hide();
      if (t.mode === 'nearest') {
        if (py === undefined) return hide();
        const hit = chart.hit(px, py, NEAREST_PX);
        if (!hit) return hide();
        chart.focus(
          hit.mark.group ?? null,
          hit.row === undefined ? undefined : { mark: hit.mark, row: hit.row },
        );
        // A mark made of named parts, such as slices, is spoken for by the part that was hit.
        const part = hit.row === undefined ? undefined : hit.mark.entries?.[hit.row];
        const { label = '', color } = part ?? hit.mark;
        const on = chart.yAxis(hit.mark);
        const text = t.text(label, chart.real('x', hit.x), chart.real(on, hit.value ?? hit.y), hit.row);
        show(chart.xPx(hit.x), chart.yPx(hit.y, on), [{ text, color: hit.color ?? color }]);
        return;
      }
      const m = chart.margin();
      const off = py !== undefined && (py < m.top || py > height - m.bottom);
      if (px < m.left || px > width - m.right || off) return hide();
      const under = chart.xValue(px);
      const v = t.snap?.(under) ?? under;
      const rows: Row[] = [{ text: t.title(chart.real('x', v)) }];
      // A line within reach of the pointer is focused before the filled mark the pointer is in, and of
      // several filled marks the thinnest there, so each of overlapping areas has a part that picks it.
      let near = FOCUS_PX;
      let line: string | undefined;
      let fill: string | undefined;
      let thin = Infinity;
      for (const k of chart.marks()) {
        if (!k.sampleAtX) continue;
        const s = k.sampleAtX(v);
        const on = chart.yAxis(k);
        const value =
          typeof s === 'number'
            ? chart.real(on, s)
            : s && (s.band ? chart.real(on, s.y2) - chart.real(on, s.y1) : chart.real(on, s.value ?? s.y2));
        if (k.label !== undefined) {
          rows.push({
            text: `${k.label}: ${value === undefined ? '–' : t.value(value, on)}`,
            color: k.color,
          });
        }
        if (s === undefined || k.group === undefined || py === undefined) continue;
        if (typeof s === 'number') {
          const gap = Math.abs(chart.yPx(s, on) - py);
          if (gap < near) [near, line] = [gap, k.group];
        } else {
          const a = chart.yPx(s.y1, on);
          const b = chart.yPx(s.y2, on);
          const span = Math.abs(a - b);
          if (span && py >= Math.min(a, b) && py <= Math.max(a, b) && span <= thin)
            [thin, fill] = [span, k.group];
        }
      }
      // A mark that answers the pointer where it is, such as a bar, is focused where neither applies.
      const group = line ?? fill ?? (py === undefined ? undefined : chart.hit(px, py, 0)?.mark.group) ?? null;
      cross.style.display = '';
      cross.style.left = `${px}px`;
      cross.style.top = `${m.top}px`;
      cross.style.height = `${height - m.top - m.bottom}px`;
      show(px, m.top, rows);
      chart.focus(group);
    };
    const move = (e: PointerEvent) => {
      inside = true;
      if (chart.drag.active) {
        at = null;
        return hide();
      }
      // Over another feature's layer, such as a legend, the focus is that feature's to set.
      if (e.target !== root) {
        at = null;
        held = false;
        fromApp = false;
        cross.style.display = tip.style.display = 'none';
        return;
      }
      at = [e.clientX, e.clientY];
      held = false;
      place();
    };
    const leave = () => {
      at = null;
      held = false;
      inside = false;
      hide();
    };
    const out = () => {
      leave();
      place();
    };
    // A lifted finger leaves the chart, and a tip it tapped open is meant to stay until a tap elsewhere.
    const lift = (e: PointerEvent) => {
      inside = false;
      if (e.pointerType !== 'touch') return out();
      held = !!at && tip.style.display !== 'none';
      if (held) return;
      at = null;
      place();
    };
    // Capturing, so a control that stops the tap still dismisses, and a tap on the chart sets its own state after.
    const away = () => {
      if (at) out();
    };
    root.addEventListener('pointerdown', move);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', lift);
    root.addEventListener('pointercancel', out);
    document.addEventListener('pointerdown', away, true);
    return {
      update() {
        restyle();
        place();
      },
      // A lifted finger is no longer anywhere on the chart, so what it tapped is let go.
      letGo: () => held && leave(),
      destroy() {
        root.removeEventListener('pointerdown', move);
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', lift);
        root.removeEventListener('pointercancel', out);
        document.removeEventListener('pointerdown', away, true);
        cross.remove();
        tip.remove();
      },
    };
  };
}
