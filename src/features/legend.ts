import type { Feature } from '../types.js';

const ROW = 20;
const SWATCH = 16;
const GAP = 14;

/** What an entry focuses: a group, or one row of the mark at this place in the list of marks. */
type Entry = { label: string; color: string; group?: string; part?: [mark: number, row: number] };

/**
 * One entry per group of labelled marks, in rows above the plot; pointing at one focuses its group.
 * ponytail: entry widths are estimated at 7 px a character, because measuring text (DOM or canvas)
 * costs about 16 ms at 4x CPU slowdown before the first paint. A row that turns out wider is cut off.
 */
/** The two ends of a domain to as few digits as tell them apart, and at least three. */
function ends(lo: number, hi: number) {
  for (let digits = 3; ; digits++) {
    const said = [lo, hi].map(v => String(+v.toPrecision(digits)));
    if (said[0] !== said[1] || lo === hi || digits > 16) return said;
  }
}

export function legend(): Feature {
  return chart => {
    const { root } = chart;
    const box = chart.layer('div', 'color:#444');
    const shown = new Map<Element, Entry>();
    let built = '';
    let hovered: string | undefined;
    let at: [number, number] | undefined;

    chart.reserve((left, width) => {
      // One pass over the marks. A mark's own entries come before its strip of colours, and a
      // mark with either is not also listed by its label.
      const entries: Entry[] = [];
      const ramps: { label?: string; table: Uint32Array; lo: number; hi: number }[] = [];
      const listed = new Set<string>();
      chart.marks().forEach((k, at) => {
        k.entries?.forEach((e, row) => entries.push({ ...e, part: [at, row] }));
        if (k.ramp) ramps.push({ label: k.label, ...k.ramp() });
        const id = k.group ?? k.label;
        if (k.entries || k.ramp || k.label === undefined || id === undefined || listed.has(id)) return;
        listed.add(id);
        entries.push({ label: k.label, color: k.color, group: k.group });
      });
      const rows: Entry[][] = [[]];
      let used = 0;
      for (const e of entries) {
        const w = SWATCH + e.label.length * 7;
        if (used && used + GAP + w > width) {
          rows.push([]);
          used = 0;
        }
        rows.at(-1)!.push(e);
        used += (used && GAP) + w;
      }
      if (!entries.length) rows.length = 0;
      // A strip is described by a few of its colours, which is also all the page is given of them.
      const strips = ramps.map(r => ({
        label: r.label,
        ends: ends(r.lo, r.hi),
        colors: [0, 51, 102, 153, 204, 255].map(i => {
          const p = r.table[i]!;
          return `rgb(${p & 255},${(p >> 8) & 255},${(p >> 16) & 255})`;
        }),
      }));
      const key = JSON.stringify([left, width, rows, strips]);
      if (key !== built) {
        built = key;
        shown.clear();
        box.style.left = `${left}px`;
        box.style.top = '4px';
        box.style.width = `${width}px`;
        box.replaceChildren(
          ...rows.map(row => {
            const line = document.createElement('div');
            line.style.cssText = `display:flex;gap:${GAP}px;height:${ROW}px;align-items:center;white-space:nowrap;overflow:hidden`;
            for (const e of row) {
              const item = line.appendChild(document.createElement('span'));
              // Only the entries take the pointer: the rest of the strip stays the chart's.
              item.style.pointerEvents = 'auto';
              const swatch = item.appendChild(document.createElement('span'));
              swatch.style.cssText =
                'display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px';
              swatch.style.backgroundColor = e.color;
              item.append(e.label);
              if (e.group !== undefined || e.part) shown.set(item, e);
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
      const mark = e?.part && chart.marks()[e.part[0]];
      chart.focus(e?.group ?? null, mark && { mark, row: e.part![1] });
    };
    // One listener on the chart, not enter and leave on each entry: an entry rebuilt or removed
    // under the pointer never gets its leave. Capturing, so a tooltip sets its own focus after.
    const over = (target: Node | null) => {
      const item = [...shown.keys()].find(i => i.contains(target));
      point(item && shown.get(item));
      return item;
    };
    const move = (e: PointerEvent) => {
      at = over(e.target as Node) && [e.clientX, e.clientY];
    };
    const leave = () => {
      at = undefined;
      point(undefined);
    };
    const lift = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') leave();
    };
    root.addEventListener('pointerdown', move, true);
    root.addEventListener('pointermove', move, true);
    root.addEventListener('pointerleave', lift);
    root.addEventListener('pointercancel', leave);
    document.addEventListener('pointerdown', leave, true);

    return {
      // The entries may have moved under a pointer at rest, so what it is over is looked up again.
      update() {
        const doc = root.isConnected && (root.getRootNode() as Document | ShadowRoot);
        if (at && !over(doc ? doc.elementFromPoint(...at) : null)) at = undefined;
      },
      destroy() {
        root.removeEventListener('pointerdown', move, true);
        root.removeEventListener('pointermove', move, true);
        root.removeEventListener('pointerleave', lift);
        root.removeEventListener('pointercancel', leave);
        document.removeEventListener('pointerdown', leave, true);
        box.remove();
      },
    };
  };
}
