import type { Feature } from '../types.js';

const ROW = 20;
const SWATCH = 16;
const GAP = 14;

/** What an entry focuses: a group, or one row of the mark at this place in the list of marks. */
type Entry = {
  label: string;
  color: string;
  id?: string;
  group?: string;
  part?: [mark: number, row: number];
};

/** The two ends of a domain to as few digits as tell them apart, and at least three. */
function ends(lo: number, hi: number) {
  for (let digits = 3; ; digits++) {
    const said = [lo, hi].map(v => String(+v.toPrecision(digits)));
    if (said[0] !== said[1] || lo === hi || digits > 16) return said;
  }
}

export type LegendOptions = {
  /** Whether a click, Enter or Space on an entry hides or shows its series; true when left out. */
  toggle?: boolean;
  /** Caps the rows of entries, by default at what fits in a third of the chart's height. */
  rows?: number;
};

/**
 * One entry per group of labelled marks, in rows above the plot; pointing at one focuses its group,
 * and with `toggle` (the default) a click or Enter or Space hides or shows it.
 * ponytail: entry widths are estimated at 7 px a character, because measuring text (DOM or canvas)
 * costs about 16 ms at 4x CPU slowdown before the first paint. A row that turns out wider is cut off,
 * and a label wider than the plot ends in an ellipsis, titled once layout shows it cut.
 */
export function legend({ toggle = true, rows: cap }: LegendOptions = {}): Feature {
  return chart => {
    const { root } = chart;
    const toggles = (e: Entry) => toggle && !e.part;
    const off = (e: Entry) => e.id !== undefined && chart.hidden().includes(e.id);
    const box = chart.layer('div', `color:${chart.theme().text}`);
    const shown = new Map<HTMLElement, Entry>();
    const cut = new ResizeObserver(seen => {
      for (const { target: t } of seen) {
        if (t.scrollWidth > t.clientWidth) t.setAttribute('title', t.textContent!);
        else t.removeAttribute('title');
      }
    });
    let built = '';
    let hovered: string | undefined;
    let at: [number, number] | undefined;
    let held = false;
    let current: Entry | undefined;

    chart.reserve((left, width) => {
      // One pass over the marks. A mark's own entries come before its strip of colours, and a
      // mark with either is not also listed by its label.
      const entries: Entry[] = [];
      const ramps: { label?: string; table: Uint32Array; lo: number; hi: number }[] = [];
      const listed = new Set<string>();
      const hidden = chart.hidden();
      chart.listed().forEach((k, at) => {
        const id = k.group ?? k.label;
        k.entries?.forEach((e, row) => entries.push({ ...e, id, part: [at, row] }));
        if (k.ramp && (id === undefined || !hidden.includes(id))) ramps.push({ label: k.label, ...k.ramp() });
        if (k.entries || k.ramp || k.label === undefined || id === undefined || listed.has(id)) return;
        listed.add(id);
        entries.push({ label: k.label, color: k.color, id, group: k.group });
      });
      // By default entries and strips share one budget of rows; a strip left out goes behind "+N more",
      // which needs a row of entries to sit in.
      const budget = Math.max(1, Math.floor((chart.size().height / 3 - 4) / ROW) || 1);
      const kept =
        cap === undefined
          ? Math.min(ramps.length, budget - (entries.length || ramps.length > budget ? 1 : 0))
          : ramps.length;
      const rows: Entry[][] = [[]];
      const most = Math.max(1, Math.floor(cap ?? budget - kept) || 1);
      const wide = (e: Entry) => SWATCH + e.label.length * 7;
      const more = (n: number) => `+${n} more`;
      let used = 0;
      let rest: Entry[] = [];
      for (const [i, e] of entries.entries()) {
        if (used && used + GAP + wide(e) > width) {
          if (rows.length === most) {
            rest = entries.slice(i);
            break;
          }
          rows.push([]);
          used = 0;
        }
        rows.at(-1)!.push(e);
        used += (used && GAP) + wide(e);
      }
      // A strip is described by a few of its colours, which is also all the page is given of them.
      const strips = ramps.map(r => ({
        label: r.label,
        ends: ends(r.lo, r.hi),
        colors: [0, 51, 102, 153, 204, 255].map(i => {
          const p = r.table[i]!;
          return `rgb(${p & 255},${(p >> 8) & 255},${(p >> 16) & 255})`;
        }),
      }));
      const unlisted = [
        ...rest.map(e => e.label),
        ...strips.splice(kept).map(s => s.label ?? s.ends.join('–')),
      ];
      const last = rows.at(-1)!;
      while (unlisted.length && last.length > 1 && used + GAP + more(unlisted.length).length * 7 > width) {
        const out = last.pop()!;
        unlisted.unshift(out.label);
        used -= GAP + wide(out);
      }
      if (!entries.length && !unlisted.length) rows.length = 0;
      box.style.left = `${left}px`;
      box.style.top = '4px';
      box.style.width = `${width}px`;
      const key = JSON.stringify([rows, unlisted, strips]);
      if (key !== built) {
        built = key;
        const doc = root.getRootNode() as Document | ShadowRoot;
        const focused = [...shown].find(([item]) => item.contains(doc.activeElement))?.[1].id;
        shown.clear();
        cut.disconnect();
        box.replaceChildren(
          ...rows.map((row, r) => {
            const line = document.createElement('div');
            line.style.cssText = `display:flex;gap:${GAP}px;height:${ROW}px;align-items:center;white-space:nowrap;overflow:hidden`;
            const capped = r === rows.length - 1 && unlisted.length > 0;
            for (const e of row) {
              const item = line.appendChild(document.createElement('span'));
              // Only the entries take the pointer: the rest of the strip stays the chart's.
              item.style.cssText = `pointer-events:auto;${capped ? 'flex:0 1 auto;min-width:0' : 'flex:none;max-width:100%'};overflow:hidden;text-overflow:ellipsis`;
              const swatch = item.appendChild(document.createElement('span'));
              swatch.style.cssText =
                'display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px';
              swatch.style.backgroundColor = e.color;
              item.append(e.label);
              cut.observe(item);
              if (toggles(e)) {
                item.setAttribute('role', 'button');
                item.tabIndex = 0;
              }
              if (e.group !== undefined || e.part || toggles(e)) shown.set(item, e);
            }
            if (capped) {
              const item = line.appendChild(document.createElement('span'));
              item.style.cssText = 'pointer-events:auto;flex:none';
              item.textContent = more(unlisted.length);
              item.title = unlisted.join(', ');
            }
            return line;
          }),
          ...strips.map(s => {
            const line = document.createElement('div');
            line.style.cssText = `display:flex;gap:6px;height:${ROW}px;align-items:center;white-space:nowrap;overflow:hidden`;
            const strip = document.createElement('span');
            strip.style.cssText = 'display:inline-block;width:120px;height:10px;border-radius:2px';
            strip.style.backgroundImage = `linear-gradient(to right,${s.colors.join()})`;
            line.append(...(s.label ? [s.label, ' '] : []), s.ends[0]!, strip, s.ends[1]!);
            return line;
          }),
        );
        if (focused !== undefined) [...shown].find(([, e]) => toggles(e) && e.id === focused)?.[0].focus();
      }
      for (const [item, e] of shown) {
        item.style.opacity = off(e) ? '0.4' : '';
        if (toggles(e)) item.setAttribute('aria-pressed', String(!off(e)));
      }
      const lines = rows.length + strips.length;
      return lines ? lines * ROW + 4 : 0;
    });

    // The mark is looked up when pointed at: after an update that kept the entries as they were,
    // the list is not rebuilt, but the mark at that place is a new one.
    const point = (e: Entry | undefined) => {
      const id = e && JSON.stringify([e.group, e.part]);
      if (id === hovered) return;
      hovered = id;
      current = e;
      const mark = e?.part && chart.listed()[e.part[0]];
      chart.focus(e?.group ?? null, mark && { mark, row: e.part![1] });
    };
    // One listener on the chart, not enter and leave on each entry: an entry rebuilt or removed
    // under the pointer never gets its leave. Capturing, so a tooltip sets its own focus after.
    const entryAt = (target: EventTarget | null) => {
      const item = [...shown.keys()].find(i => i.contains(target as Node | null));
      return [item, item && shown.get(item)] as const;
    };
    const over = (target: Node | null) => {
      const [item, e] = entryAt(target);
      point(e && !off(e) ? e : undefined);
      return item;
    };
    const move = (e: PointerEvent) => {
      held = false;
      at = over(e.target as Node) && [e.clientX, e.clientY];
    };
    const leave = () => {
      held = false;
      at = undefined;
      point(undefined);
    };
    const lift = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || (current && toggles(current))) leave();
      else held = true;
    };
    const flip = (target: EventTarget | null) => {
      const [, e] = entryAt(target);
      if (!e || !toggles(e)) return false;
      // Let go first: hide() repaints at once, and a pointer still recorded would focus the entry again.
      at = undefined;
      point(undefined);
      const ids = chart.hidden();
      chart.hide(ids.includes(e.id!) ? ids.filter(i => i !== e.id) : [...ids, e.id!]);
      return true;
    };
    box.addEventListener('click', e => flip(e.target));
    box.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && flip(e.target)) e.preventDefault();
    });
    root.addEventListener('pointerdown', move, true);
    root.addEventListener('pointermove', move, true);
    root.addEventListener('pointerleave', lift);
    root.addEventListener('pointercancel', leave);
    document.addEventListener('pointerdown', leave, true);

    return {
      // The entries may have moved under a pointer at rest, so what it is over is looked up again.
      update() {
        box.style.color = chart.theme().text;
        const doc = root.isConnected && (root.getRootNode() as Document | ShadowRoot);
        if (at && !over(doc ? doc.elementFromPoint(...at) : null)) at = undefined;
      },
      letGo: () => held && leave(),
      destroy() {
        root.removeEventListener('pointerdown', move, true);
        root.removeEventListener('pointermove', move, true);
        root.removeEventListener('pointerleave', lift);
        root.removeEventListener('pointercancel', leave);
        document.removeEventListener('pointerdown', leave, true);
        cut.disconnect();
        box.remove();
      },
    };
  };
}
