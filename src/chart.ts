import { scale } from './scale.js';
import type { Chart, GlLayer, Hit, Internals, Mark, Options, Prepared, View } from './types.js';

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

export function plot(el: HTMLElement, options: Options): Chart {
  let o = options;
  // ponytail: read once; a window moved to a screen of another density needs a matchMedia listener.
  const dpr = devicePixelRatio;
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
  let glCanvas: HTMLCanvasElement | undefined;
  let gl: GlLayer | null | undefined;
  let makeGl: NonNullable<Mark['gl']>['layer'] | undefined;

  let W = -1;
  let H = -1;
  let marks = o.marks;
  let xs!: ReturnType<typeof scale>;
  let ys!: ReturnType<typeof scale>;
  let view!: View;
  let viewKey = '';
  let axesKey = '';
  let cache = new Map<Mark, { p: Prepared; gl: boolean }>();
  let flat: [Mark, Prepared][] = [];
  let onGl: [Mark, Prepared][] = [];
  let focused: string | null = null;
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

  const rescale = () => {
    xs = scale(
      o.x.domain,
      marks.flatMap(k => k.channels.x),
    );
    ys = scale(
      o.y.domain,
      marks.flatMap(k => k.channels.y),
    );
  };

  const xPx = (v: number) => (view.ox + v * view.kx) / dpr;
  const yPx = (v: number) => (view.oy - v * view.ky) / dpr;

  const layout = () => {
    const m = o.margin;
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
    if (glCanvas) glCanvas.style.clipPath = `inset(${m.top}px ${m.right}px ${m.bottom}px ${m.left}px)`;

    const key = JSON.stringify([W, H, m, xs, ys, o.x.label, o.y.label]);
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
      for (const v of xs.ticks) text(String(v), xPx(v), H - m.bottom + 8, 'translate(-50%,0)');
      for (const v of ys.ticks) text(String(v), m.left - 8, yPx(v), 'translate(-100%,-50%)');
      text(o.x.label, m.left + width / dpr / 2, H - 2, 'translate(-50%,-100%)');
      text(o.y.label, 10, m.top + height / dpr / 2, 'translate(-50%,-50%) rotate(-90deg)');
      axes.replaceChildren(labels);
    }

    const before = viewKey;
    viewKey = [kx, view.ox, ky, view.oy, left, top, width, height].join();
    return viewKey !== before;
  };

  const prepare = (viewChanged: boolean) => {
    const make = makeGl ?? marks.find(k => k.gl)?.gl?.layer;
    const onLayer = (k: Mark) => !!k.gl && k.gl.layer === make;
    let useGl = marks.reduce((n, k) => n + (onLayer(k) ? k.points : 0), 0) >= GL_FROM;
    if (useGl && gl === undefined) {
      makeGl = make!;
      glCanvas = layer('canvas', 'left:0;top:0');
      canvas.after(glCanvas);
      fit(glCanvas);
      const m = o.margin;
      glCanvas.style.clipPath = `inset(${m.top}px ${m.right}px ${m.bottom}px ${m.left}px)`;
      gl = makeGl(glCanvas);
    }
    useGl &&= !!gl;
    if (glCanvas) glCanvas.style.display = useGl ? '' : 'none';

    const old = cache;
    cache = new Map();
    flat = [];
    onGl = [];
    for (const k of marks) {
      const g = useGl && onLayer(k);
      let e = old.get(k);
      if (!e || viewChanged || e.gl !== g) e = { p: g ? k.gl!.prepare(view, gl!) : k.prepare(view), gl: g };
      cache.set(k, e);
      (g ? onGl : flat).push([k, e.p]);
    }
  };

  const grid = () => {
    const { left, top, width, height, ox, kx, oy, ky } = view;
    ctx.lineWidth = dpr;
    ctx.strokeStyle = '#e5e5e5';
    ctx.beginPath();
    for (const v of ys.ticks) {
      const y = Math.round(oy - v * ky) + dpr / 2;
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.beginPath();
    for (const v of xs.ticks) {
      const x = Math.round(ox + v * kx) + dpr / 2;
      ctx.moveTo(x, top + height);
      ctx.lineTo(x, top + height + 5 * dpr);
    }
    ctx.stroke();
  };

  const render = () => {
    const dim = o.dim ?? 1;
    const lit = dim === 1 ? null : focused;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid();
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, view.top, view.width, view.height);
    ctx.clip();
    for (const [k, p] of flat) if (k.group !== lit) p.paint(lit === null ? 1 : dim);
    for (const [k, p] of flat) if (k.group === lit) p.paint(1);
    ctx.restore();
    if (!onGl.length) return;
    gl!.clear();
    for (const [k, p] of onGl) if (k.group !== lit) p.paint(1);
    if (lit === null) return;
    gl!.fade(dim);
    for (const [k, p] of onGl) if (k.group === lit) p.paint(1);
  };

  const refresh = (data: boolean, repaint = false) => {
    if (data) rescale();
    const m = o.margin;
    const viewChanged = layout();
    drawable = W > m.left + m.right && H > m.top + m.bottom;
    root.style.visibility = drawable ? '' : 'hidden';
    // Growing back always changes the view, so marks replaced while hidden are prepared then.
    if (!drawable) {
      flat = [];
      onGl = [];
      return false;
    }
    if (data || viewChanged) prepare(viewChanged);
    if (data || viewChanged || repaint) render();
    return true;
  };

  const focus = (group: string | null) => {
    if (group === focused) return;
    focused = group;
    if (drawable && (o.dim ?? 1) !== 1) render();
  };

  const internals: Internals = {
    root,
    layer,
    marks: () => marks,
    size: () => ({ width: W, height: H }),
    margin: () => o.margin,
    xPx,
    yPx,
    xValue: px => (px * dpr - view.ox) / view.kx,
    hit(px, py, max) {
      let best: (Hit & { mark: Mark }) | null = null;
      for (const [mark, { p }] of cache) {
        const h: Hit | null | undefined = p.hit?.(px, py, best ? best.distance : max);
        if (h) best = { ...h, mark };
      }
      return best;
    },
    focus,
  };

  el.appendChild(root);
  measure();
  refresh(true);
  const sync = () => {
    for (const f of features) f.update?.();
  };
  const observer = new ResizeObserver(() => refresh(false, measure()) && sync());
  let observing = false;
  const observe = () => {
    const auto = o.width === undefined || o.height === undefined;
    if (auto === observing) return;
    observing = auto;
    if (auto) observer.observe(root);
    else observer.disconnect();
  };
  observe();
  const features = (o.use ?? []).map(feature => feature(internals));

  return {
    update(partial) {
      const prev = o;
      o = { ...o, ...partial };
      let data = String(o.x.domain) !== String(prev.x.domain) || String(o.y.domain) !== String(prev.y.domain);
      if (partial.marks) {
        const before = marks;
        const byKey = new Map(before.map((k, i) => [k.key ?? i, k]));
        marks = partial.marks.map((k, i) => {
          const was = byKey.get(k.key ?? i);
          return was && was.type === k.type && same(was.options, k.options) ? was : k;
        });
        data ||= marks.length !== before.length || marks.some((k, i) => k !== before[i]);
        const kept = new Set(marks);
        for (const k of new Set(before)) {
          if (kept.has(k)) continue;
          cache.delete(k);
          k.release?.(gl ?? null);
        }
      }
      const lost = focused !== null && !marks.some(k => k.group === focused);
      if (lost) focused = null;
      observe();
      const resized = measure();
      if (refresh(data, resized || lost || o.dim !== prev.dim)) sync();
    },
    destroy() {
      for (const f of features) f.destroy();
      observer.disconnect();
      for (const k of new Set(marks)) k.release?.(gl ?? null);
      gl?.destroy();
      root.remove();
    },
  };
}
