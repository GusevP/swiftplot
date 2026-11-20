import { extent, scale } from './scale.js';
import type {
  Axis,
  Chart,
  GlLayer,
  Hit,
  Internals,
  Margin,
  Mark,
  Options,
  Painter,
  Prepared,
  Resolved,
  Room,
  View,
} from './types.js';

// ponytail: measured crossover is somewhere between 10k and 100k points; tune per device if it matters.
const GL_FROM = 30_000;

const same = (a: object, b: object) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      k => Object.hasOwn(b, k) && (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k],
    )
  );
};

const resolve = (a: Axis, of: () => [number, number], room: Room): Resolved => {
  if (a.scale) return a.scale(a, of, room);
  const s = scale(a.domain, typeof a.domain === 'string' ? of() : a.domain, room);
  return { ...s, ticks: s.ticks.map(value => ({ value, label: String(value) })) };
};
const AUTO: Axis = { domain: 'nice', label: '' };
const NONE: Axis = { domain: [0, 1], label: '', scale: () => ({ lo: 0, hi: 1, ticks: [] }) };
const axisOf = (o: Options, which: 'x' | 'y') => (o.polar ? NONE : (o[which] ?? AUTO));
const sameAxis = (a: Axis, b: Axis) =>
  same({ ...a, domain: String(a.domain) }, { ...b, domain: String(b.domain) });

export function plot(el: HTMLElement, options: Options): Chart {
  let o = options;
  let dpr = devicePixelRatio;
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;font:12px system-ui,sans-serif;pointer-events:auto';
  const layer = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '') => {
    const e = document.createElement(tag);
    e.style.cssText = `position:absolute;pointer-events:none;${css}`;
    return root.appendChild(e);
  };
  const canvas = layer('canvas', 'left:0;top:0');
  const ctx = canvas.getContext('2d')!;
  const axes = layer('div', 'inset:0;color:#444');
  canvas.setAttribute('role', 'img');
  axes.ariaHidden = 'true';
  let glCanvas: HTMLCanvasElement | undefined;
  let gl: GlLayer | null | undefined;
  let makeGl: NonNullable<Mark['gl']>['layer'] | undefined;

  let W = -1;
  let H = -1;
  let marks = o.marks;
  let xs!: Resolved;
  let ys!: Resolved;
  let view!: View;
  let viewKey = '';
  let axesKey = '';
  let cache = new Map<Mark, { p: Prepared; gl: boolean }>();
  let flat: [Mark, Prepared][] = [];
  let onGl: [Mark, Prepared][] = [];
  let focused: string | null = null;
  let m: Margin = { top: 0, right: 0, bottom: 0, left: 0 };
  let above: Parameters<Internals['reserve']>[0] | undefined;
  let replaced = new Map<Mark, Mark>();
  let paired = true;
  let morphs: Prepared[] = [];
  // A kept mark may be part-way through a move that the next list of morphs no longer covers.
  const settle = () => {
    for (const p of morphs) p.morph!(1);
    morphs = [];
  };
  let drawable = false;

  const fit = (c: HTMLCanvasElement) => {
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
  };
  const measure = () => {
    root.style.width = o.width === undefined ? '100%' : `${o.width}px`;
    root.style.height = o.height === undefined ? '100%' : `${o.height}px`;
    const w = o.width ?? root.clientWidth;
    const h = o.height ?? root.clientHeight;
    if (w === W && h === H) return false;
    W = w;
    H = h;
    fit(canvas);
    if (glCanvas) fit(glCanvas);
    return true;
  };

  // The WebGL canvas is clipped to the plot by CSS; an entrance narrows that to the left fraction
  // `shown` or lowers its opacity. Layout calls this with no argument, which must undo neither.
  let shown = 1;
  let faded = 1;
  let clipped = '';
  const clipGl = (reveal = shown, opacity = faded) => {
    shown = reveal;
    if (!glCanvas) return;
    const [w, h] = [W - m.left - m.right, H - m.top - m.bottom];
    let css = `inset(${m.top}px ${m.right + w * (1 - reveal)}px ${m.bottom}px ${m.left}px)`;
    if (o.polar && reveal < 1) {
      // The same sweep as the canvas gets, cut to the plot: the centre, twelve o'clock, each corner
      // of the rectangle the sweep has passed, and where its leading ray leaves the rectangle.
      const [cx, cy] = [m.left + w / 2, m.top + h / 2];
      const ray = (turn: number) => {
        const [dx, dy] = [Math.sin(turn * 2 * Math.PI), -Math.cos(turn * 2 * Math.PI)];
        const far = Math.min(w / 2 / Math.abs(dx || 1e-9), h / 2 / Math.abs(dy || 1e-9));
        return [cx + dx * far, cy + dy * far];
      };
      const corner = Math.atan2(w, h) / (2 * Math.PI);
      const passed = [corner, 0.5 - corner, 0.5 + corner, 1 - corner].filter(turn => turn < reveal);
      css = `polygon(${[[cx, cy], ray(0), ...passed.map(ray), ray(reveal)].map(([x, y]) => `${x}px ${y}px`).join()})`;
    }
    if (css !== clipped) glCanvas.style.clipPath = clipped = css;
    if (opacity !== faded) glCanvas.style.opacity = String((faded = opacity));
  };

  // A column set is scanned at most once per list of marks, and only if its axis asks.
  let extents: { x?: [number, number]; y?: [number, number] } = {};
  // Before the first layout the room is judged from the margins as given; after it, from the real
  // ones, which is what catches a legend or a wide label taking the room away.
  const rescale = (laidOut: boolean) => {
    const g = o.margin ?? {};
    const bottom = g.bottom ?? (axisOf(o, 'x').label ? 44 : 26);
    const [w, h] = laidOut
      ? [W - m.left - m.right, H - m.top - m.bottom]
      : [W - (g.left ?? 44) - (g.right ?? 16), H - (g.top ?? 12) - bottom];
    xs = resolve(axisOf(o, 'x'), () => (extents.x ??= extent(marks.flatMap(k => k.channels.x))), {
      length: w,
      horizontal: true,
    });
    ys = resolve(axisOf(o, 'y'), () => (extents.y ??= extent(marks.flatMap(k => k.channels.y))), {
      length: h,
      horizontal: false,
    });
  };

  const xPx = (v: number) => (view.ox + v * view.kx) / dpr;
  const yPx = (v: number) => (view.oy - v * view.ky) / dpr;

  const layout = () => {
    // ponytail: tick labels are taken as 7 px a character, not measured, because measuring text
    // forces a layout before the first paint. Set the margin when labels are wider than that.
    const [xLabel, yLabel] = [axisOf(o, 'x').label, axisOf(o, 'y').label];
    const given = o.margin ?? {};
    let widest = 0;
    if (given.left === undefined) for (const t of ys.ticks) widest = Math.max(widest, t.label.length);
    m = o.polar
      ? { top: given.top ?? 8, right: given.right ?? 8, bottom: given.bottom ?? 8, left: given.left ?? 8 }
      : {
          top: given.top ?? 12,
          right: given.right ?? 16,
          bottom: given.bottom ?? (xLabel ? 44 : 26),
          left: given.left ?? 14 + widest * 7 + (yLabel ? 20 : 0),
        };
    // x tick labels are centred on their ticks, so the first and the last may reach past the chart.
    // A tick at fraction u of the axis sits at (1 - u) * left + u * (W - right). Each side is first
    // made the least that keeps its own label inside; if growing the right has pushed the first
    // label out again, both bind at once and the two equations are solved together.
    const span = xs.hi - xs.lo || 1;
    const edge = (t: { value: number; label: string } | undefined) =>
      t && { u: (t.value - xs.lo) / span, half: t.label.length * 3.5 + 4 };
    const [a, b] = [edge(xs.ticks[0]), edge(xs.ticks.at(-1))];
    const [freeLeft, freeRight] = [given.left === undefined, given.right === undefined];
    const leftFor = (right: number) => (a && a.u < 1 ? (a.half - a.u * (W - right)) / (1 - a.u) : 0);
    if (freeLeft) m.left = Math.max(m.left, leftFor(m.right));
    if (freeRight && b && b.u > 0) {
      m.right = Math.max(m.right, W - (W - b.half - (1 - b.u) * m.left) / b.u);
      if (freeLeft && a && a.u !== b.u && leftFor(m.right) > m.left) {
        const p = a.half - a.u * W;
        const q = (1 - b.u) * W - b.half;
        m.left = (a.u * q - b.u * p) / (a.u - b.u);
        m.right = ((1 - a.u) * q - (1 - b.u) * p) / (a.u - b.u);
      }
    }
    m.top += above?.(m.left, W - m.left - m.right) ?? 0;
    const left = m.left * dpr;
    const top = m.top * dpr;
    const width = (W - m.left - m.right) * dpr;
    const height = (H - m.top - m.bottom) * dpr;
    const kx = width / (xs.hi - xs.lo);
    const ky = height / (ys.hi - ys.lo);
    view = {
      kx,
      ox: left - xs.lo * kx,
      ky,
      oy: top + height + ys.lo * ky,
      left,
      top,
      width,
      height,
      dpr,
      ctx,
    };
    clipGl();

    const key = JSON.stringify([W, H, m, xs, ys, xLabel, yLabel]);
    if (key !== axesKey) {
      axesKey = key;
      // Axis text is DOM, not fillText: the first text drawn on a canvas cost ~20 ms at 4x CPU slowdown.
      const labels = document.createDocumentFragment();
      const text = (s: string, x: number, y: number, transform: string) => {
        const e = document.createElement('div');
        e.textContent = s;
        e.style.cssText = `position:absolute;white-space:nowrap;left:${x}px;top:${y}px;transform:${transform}`;
        labels.appendChild(e);
      };
      for (const t of xs.ticks) text(t.label, xPx(t.value), H - m.bottom + 8, 'translate(-50%,0)');
      for (const t of ys.ticks) text(t.label, m.left - 8, yPx(t.value), 'translate(-100%,-50%)');
      text(xLabel, m.left + width / dpr / 2, H - 2, 'translate(-50%,-100%)');
      text(yLabel, 10, m.top + height / dpr / 2, 'translate(-50%,-50%) rotate(-90deg)');
      axes.replaceChildren(labels);
    }

    const described = () => {
      const names = [...new Set(marks.flatMap(k => k.label ?? []))].join(', ');
      const axesNamed = yLabel && xLabel ? `${yLabel} by ${xLabel}` : yLabel || xLabel;
      return [axesNamed, names].filter(Boolean).join(': ') || 'Chart';
    };
    canvas.ariaLabel = o.description ?? described();

    viewKey = [kx, view.ox, ky, view.oy, left, top, width, height].join();
  };

  const prepare = (viewChanged: boolean) => {
    const make = makeGl ?? marks.find(k => k.gl)?.gl?.layer;
    const onLayer = (k: Mark) => !!k.gl && k.gl.layer === make;
    let useGl = marks.reduce((n, k) => n + (onLayer(k) ? k.points : 0), 0) >= GL_FROM;
    if (useGl && gl === undefined) {
      makeGl = make!;
      glCanvas = layer('canvas', 'left:0;top:0');
      glCanvas.ariaHidden = 'true';
      canvas.after(glCanvas);
      fit(glCanvas);
      clipGl();
      gl = makeGl(glCanvas);
    }
    useGl &&= !!gl;
    if (glCanvas) glCanvas.style.display = useGl ? '' : 'none';

    const old = cache;
    cache = new Map();
    flat = [];
    onGl = [];
    settle();
    several = new Set(marks.map(k => k.group).filter(g => g !== undefined)).size > 1;
    let all = paired;
    for (const k of marks) {
      const g = useGl && onLayer(k);
      let e = old.get(k);
      const changed = !e;
      if (!e || viewChanged || e.gl !== g) {
        e = { p: g ? k.gl!.prepare(view, gl!) : k.prepare(view, replaced.get(k)), gl: g };
      }
      if (changed && e.p.morph && replaced.has(k)) morphs.push(e.p);
      else if (changed) all = false;
      cache.set(k, e);
      (g ? onGl : flat).push([k, e.p]);
    }
    if (!all) morphs = [];
    replaced.clear();
  };

  const grid = () => {
    const { left, top, width, height, ox, kx, oy, ky } = view;
    ctx.lineWidth = dpr;
    ctx.strokeStyle = '#e5e5e5';
    ctx.beginPath();
    for (const t of ys.ticks) {
      const y = Math.round(oy - t.value * ky) + dpr / 2;
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.beginPath();
    for (const t of xs.ticks) {
      const x = Math.round(ox + t.value * kx) + dpr / 2;
      ctx.moveTo(x, top + height);
      ctx.lineTo(x, top + height + 5 * dpr);
    }
    ctx.stroke();
  };

  let focusedRow: { mark: Mark; row: number } | undefined;
  let several = false;
  // One row is picked out where there is no other series to set the hovered one against, or where
  // the row is a named part of its mark, such as a slice, which is then the thing pointed at.
  const drawnRow = () =>
    (o.dim ?? 1) !== 1 && focusedRow && (!several || focusedRow.mark.entries) ? focusedRow : undefined;
  const drawnFocus = () => ((o.dim ?? 1) === 1 || drawnRow() ? null : focused);

  const render = (reveal = 1) => {
    const dim = o.dim ?? 1;
    const lit = drawnFocus();
    const only = drawnRow();
    clipGl(reveal, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid();
    if (!reveal) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, view.top, view.width * reveal, view.height);
    ctx.clip();
    // Beside a focused row the other marks keep their strength, unless they are other series.
    const others = lit !== null || (only && several) ? dim : 1;
    for (const [k, p] of flat) {
      if (k === only?.mark) p.paint(1, only.row, dim);
      else if (k.group !== lit) p.paint(others);
    }
    for (const [k, p] of flat) if (k.group === lit) p.paint(1);
    ctx.restore();
    if (!onGl.length) return;
    gl!.clear();
    // What is to be dimmed is drawn first and faded as one, then what is focused goes on top.
    for (const [k, p] of onGl) if (k !== only?.mark && k.group !== lit) p.paint(1);
    if (others !== 1) gl!.fade(dim);
    for (const [k, p] of onGl) {
      if (k === only?.mark) p.paint(1, only.row, dim);
      else if (lit !== null && k.group === lit) p.paint(1);
    }
  };

  let painter: Painter | undefined;
  const paint = (why: Parameters<Painter>[1]) => (painter ? painter(render, why) : render());

  const refresh = (data: boolean, also?: 'size' | 'focus') => {
    const before = viewKey;
    rescale(false);
    layout();
    // The scales were resolved for a guessed room; resolved again for the real one, their ticks or
    // bounds may differ, and then so may the margins. Once more is enough to be right in all but contrived cases.
    const guessed = JSON.stringify([xs, ys]);
    rescale(true);
    if (JSON.stringify([xs, ys]) !== guessed) layout();
    const viewChanged = viewKey !== before;
    drawable = W > m.left + m.right && H > m.top + m.bottom;
    root.style.visibility = drawable ? '' : 'hidden';
    // Growing back always changes the view, so marks replaced while hidden are prepared then.
    if (!drawable) {
      flat = [];
      onGl = [];
      settle();
      return false;
    }
    if (data || viewChanged) prepare(viewChanged);
    // A resize has already cleared the canvas, so it is 'size' even when the data changed too.
    if (data || viewChanged || also) paint(also === 'size' || !data ? (also ?? 'size') : 'data');
    return true;
  };

  const focus: Internals['focus'] = (group, row) => {
    const [was, wasRow] = [drawnFocus(), drawnRow()];
    focused = group;
    focusedRow = row && { mark: row.mark, row: row.row };
    // Only what is drawn counts: a new row inside a focused series changes nothing on screen.
    const now = drawnRow();
    if (drawnFocus() === was && now?.mark === wasRow?.mark && now?.row === wasRow?.row) return;
    if (drawable) paint('focus');
  };

  const internals: Internals = {
    root,
    canvas,
    layer,
    onPaint(p) {
      painter = p;
    },
    morph(t) {
      for (const p of morphs) p.morph!(t);
      return morphs.length > 0;
    },
    polar: () => !!o.polar,
    reveal: clipGl,
    reserve(space) {
      above = space;
    },
    marks: () => marks,
    size: () => ({ width: W, height: H }),
    margin: () => m,
    xPx,
    yPx,
    xValue: px => (px * dpr - view.ox) / view.kx,
    // Topmost first, the reverse of render(): a hit that is no nearer never replaces one above it.
    hit(px, py, max) {
      const lit = drawnFocus();
      let best: (Hit & { mark: Mark }) | null = null;
      for (const list of [onGl, flat]) {
        for (const top of [true, false]) {
          for (let i = list.length - 1; i >= 0; i--) {
            const [mark, p] = list[i]!;
            if ((mark.group === lit) !== top) continue;
            const h: Hit | null | undefined = p.hit?.(px, py, best ? best.distance : max);
            if (h && (!best || h.distance < best.distance)) best = { ...h, mark };
          }
        }
      }
      return best;
    },
    focus,
  };

  el.appendChild(root);
  measure();
  const features = (o.use ?? []).map(feature => feature(internals));
  refresh(true);
  const sync = () => {
    for (const f of features) f.update?.();
  };
  const observer = new ResizeObserver(() => refresh(false, measure() ? 'size' : undefined) && sync());
  let observing = false;
  const observe = () => {
    const auto = o.width === undefined || o.height === undefined;
    if (auto === observing) return;
    observing = auto;
    if (auto) observer.observe(root);
    else observer.disconnect();
  };
  observe();
  // A density query matches one value only, so each change is listened for once and asked for again.
  let density: MediaQueryList;
  const redensify = () => {
    dpr = devicePixelRatio;
    fit(canvas);
    if (glCanvas) fit(glCanvas);
    watch();
    if (refresh(false, 'size')) sync();
  };
  const watch = () => {
    density = matchMedia(`(resolution: ${dpr}dppx)`);
    density.addEventListener('change', redensify, { once: true });
  };
  watch();

  return {
    update(partial) {
      const prev = o;
      o = { ...o, ...partial };
      let data = !sameAxis(axisOf(o, 'x'), axisOf(prev, 'x')) || !sameAxis(axisOf(o, 'y'), axisOf(prev, 'y'));
      replaced = new Map();
      paired = true;
      if (partial.marks) {
        const before = marks;
        const byKey = new Map(before.map((k, i) => [k.key ?? i, k]));
        marks = partial.marks.map((k, i) => {
          const was = byKey.get(k.key ?? i);
          if (was?.type !== k.type) return k;
          if (same(was.options, k.options)) return was;
          replaced.set(k, was);
          return k;
        });

        if (marks.length !== before.length || marks.some((k, i) => k !== before[i])) {
          data = true;
          extents = {};
        }
        const kept = new Set(marks);
        // Every old listing must be matched by exactly one new one, kept or paired: a mark may be
        // listed more than once, so this counts listings, not marks.
        const unmatched = new Map<Mark, number>();
        for (const k of before) unmatched.set(k, (unmatched.get(k) ?? 0) + 1);
        for (const k of marks) {
          const was = replaced.get(k) ?? k;
          unmatched.set(was, (unmatched.get(was) ?? 0) - 1);
        }
        paired = [...unmatched.values()].every(n => n === 0);
        for (const k of new Set(before)) {
          if (kept.has(k)) continue;
          // Before any release: finishing a move may still need what release() frees.
          settle();
          cache.delete(k);
          k.release?.(gl ?? null);
        }
      }
      // The focused row follows its mark into the mark that replaced it, so a pointer at rest
      // on a bar asks for no new focus and does not cut the bar's move short.
      for (const [k, was] of replaced) if (was === focusedRow?.mark) focusedRow = { ...focusedRow, mark: k };
      const gone = focusedRow !== undefined && !marks.includes(focusedRow.mark);
      if (gone) focusedRow = undefined;
      const lost = gone || (focused !== null && !marks.some(k => k.group === focused));
      if (lost) focused = null;
      observe();
      const resized = measure();
      if (refresh(data, resized ? 'size' : lost || o.dim !== prev.dim ? 'focus' : undefined)) sync();
    },
    destroy() {
      for (const f of features) f.destroy();
      observer.disconnect();
      density.removeEventListener('change', redensify);
      for (const k of new Set(marks)) k.release?.(gl ?? null);
      gl?.destroy();
      root.remove();
    },
  };
}
