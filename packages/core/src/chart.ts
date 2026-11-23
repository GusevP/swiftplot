import { locate, position } from './features/pointer.js';
import { upTo } from './marks/common.js';
import { extent, scale } from './scale.js';
import { light } from './theme.js';
import type {
  Axis,
  Chart,
  Feature,
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
  Span,
  View,
} from './types.js';

export const NEAREST_PX = 20;

// What an update of these alone leaves alone: a tip held by a tap stays.
const LIGHT = new Set(['pointer', 'onClick', 'onPointerChange', 'onViewChange', 'onHiddenChange']);

// ponytail: measured crossover is somewhere between 10k and 100k points; tune per device if it matters.
const GL_FROM = 10_000;

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
  const s = scale(a.domain, typeof a.domain === 'string' ? of() : a.domain, room, a);
  return { ...s, ticks: s.ticks.map(value => ({ value, label: (a.format ?? String)(value) })) };
};
const AUTO: Axis = { domain: 'nice', label: '' };
const NONE: Axis = { domain: [0, 1], label: '', scale: () => ({ lo: 0, hi: 1, ticks: [] }) };
const bare = (o: Options) => o.frame === 'polar' || o.frame === 'blank';
const axisOf = (o: Options, which: 'x' | 'y') => (bare(o) ? NONE : (o[which] ?? AUTO));
const sameAxis = (a: Axis, b: Axis) =>
  same({ ...a, domain: String(a.domain) }, { ...b, domain: String(b.domain) });
const within = (want: Span | undefined, [lo, hi]: Span, least = (hi - lo) * 1e-6): Span | undefined => {
  if (!want) return undefined;
  let [a, b] = want;
  if (!(a <= b) || !Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  const w = Math.max(b - a, least);
  if (w >= hi - lo) return [lo, hi];
  const narrow = b - a < least;
  if (narrow) a = (a + b) / 2 - w / 2;
  const s: Span = !(a >= lo) ? [lo, lo + w] : a + w > hi ? [hi - w, hi] : narrow ? [a, a + w] : [a, b];
  // Far from zero the floor can be below one float step, so the edges round together.
  const step = Math.max(-lo, hi) * Number.EPSILON * 4;
  return s[0] < s[1] || least >= step ? s : within(want, [lo, hi], step);
};
const clamp = (want: Span | undefined, [p, q]: Span): Span | undefined => {
  if (p <= q) return within(want, [p, q]);
  const s = within(want && [Math.min(...want), Math.max(...want)], [q, p]);
  return s && [s[1], s[0]];
};

export function plot(el: HTMLElement, options: Options): Chart {
  let o = options;
  let dpr = devicePixelRatio;
  const root = document.createElement('div');
  const font = '12px system-ui,sans-serif';
  root.style.cssText = `position:relative;font:${font};pointer-events:auto`;
  const widths = new Map<string, number>();
  let pen: CanvasRenderingContext2D | undefined;
  const textWidth = (s: string) => {
    let w = widths.get(s);
    if (w === undefined) {
      pen ??= Object.assign(document.createElement('canvas').getContext('2d')!, { font });
      widths.set(s, (w = pen.measureText(s).width));
    }
    return w;
  };
  const layer = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '') => {
    const e = document.createElement(tag);
    e.style.cssText = `position:absolute;pointer-events:none;${css}`;
    return root.appendChild(e);
  };
  const canvas = layer('canvas', 'left:0;top:0');
  const ctx = canvas.getContext('2d')!;
  const axes = layer('div', 'inset:0');
  canvas.setAttribute('role', 'img');
  axes.ariaHidden = 'true';
  let glCanvas: HTMLCanvasElement | undefined;
  let gl: GlLayer | null | undefined;
  let makeGl: NonNullable<Mark['gl']>['layer'] | undefined;

  let W = -1;
  let H = -1;
  let marks = o.marks;
  const idOf = (k: Mark) => k.group ?? k.label;
  const sameIds = (a: readonly string[] = [], b: readonly string[] = []) => {
    const of = new Set(a);
    const to = new Set(b);
    return of.size === to.size && [...of].every(id => to.has(id));
  };
  let hiddenIds = [...(o.hidden ?? [])];
  type Laid = Map<string, { members: Mark[]; drawn: Mark[] }>;
  // What arranged marks are drawn as, kept while the shown members of their key stay the same.
  let laid: Laid = new Map();
  let declared = new Map<Mark, Mark>();
  const arrange = (shown: readonly Mark[], kept: Laid = new Map()) => {
    const next: Laid = new Map();
    for (const k of shown) {
      if (!k.arrange) continue;
      const g = next.get(k.arrange.key);
      if (g) g.members.push(k);
      else next.set(k.arrange.key, { members: [k], drawn: [] });
    }
    for (const [key, g] of next) {
      const was = kept.get(key);
      g.drawn =
        was && was.members.length === g.members.length && was.members.every((k, i) => k === g.members[i])
          ? was.drawn
          : g.members[0]!.arrange!.lay(g.members);
    }
    const taken = new Map<string, number>();
    const list = shown.map(k => {
      const g = k.arrange && next.get(k.arrange.key);
      if (!g) return k;
      const i = taken.get(k.arrange!.key) ?? 0;
      taken.set(k.arrange!.key, i + 1);
      return g.drawn[i]!;
    });
    return { list, next };
  };
  const showing = () => {
    const hidden = new Set(hiddenIds);
    const shown = hidden.size ? marks.filter(k => !hidden.has(idOf(k)!)) : marks;
    const { list, next } = arrange(shown, laid);
    let relaid = false;
    const drawn = new Set([...next.values()].flatMap(g => g.drawn));
    for (const [key, g] of laid) {
      const now = next.get(key);
      g.drawn.forEach((d, i) => {
        if (drawn.has(d)) return;
        relaid = true;
        drop(d);
        // The mark that now draws the same member, or the member its update replaced, moves from this one.
        const member = g.members[i]!;
        let nth = g.members.slice(0, i).filter(k => k === member).length;
        const j =
          now?.members.findIndex(k => (k === member || replaced.get(k) === member) && nth-- === 0) ?? -1;
        const to = j < 0 ? undefined : now!.drawn[j]!;
        if (!to) return;
        replaced.set(to, d);
        if (focusedRow?.mark === d) focusedRow = { ...focusedRow, mark: to };
      });
    }
    laid = next;
    declared = new Map([...next.values()].flatMap(g => g.drawn.map((d, i) => [d, g.members[i]!])));
    visible = list;
    return relaid;
  };
  let visible: Mark[] = [];
  // Every arranged mark laid out with none hidden, for an axis that fits them all.
  let everyLaid: Mark[] | undefined;
  const every = () => (everyLaid ??= marks.some(k => k.arrange) ? arrange(marks, laid).list : marks);
  const reshow = () => {
    const relaid = showing();
    delete extents.x;
    delete extents.y;
    scanned = undefined;
    return relaid;
  };
  let xs!: Resolved;
  let ys!: Resolved;
  let view!: View;
  let viewKey = '';
  let axesKey = '';
  let cache = new Map<Mark, { p: Prepared; gl: boolean }>();
  let flat: [Mark, Prepared][] = [];
  let onGl: [Mark, Prepared][] = [];
  // What holds buffers on the layer: a mark keeps them while hidden or moved to the canvas, until released.
  const placed = new Set<Mark>();
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
  const drop = (k: Mark) => {
    // Before any release: finishing a move may still need what release() frees.
    settle();
    cache.delete(k);
    k.release?.(gl ?? null);
    placed.delete(k);
  };
  let drawable = false;

  const fit = (c: HTMLCanvasElement) => {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
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

  // What a reveal has uncovered at a progress, in CSS pixels: the one shape the canvas clip, the
  // WebGL clip and the labels all follow.
  const overhang = () => visible.reduce((most, k) => Math.max(most, k.overhang ?? 0), 0);
  const revealed = (t: number, over = overhang()): [number, number][] => {
    const [l, top, w, h] = [m.left, m.top, W - m.left - m.right, H - m.top - m.bottom];
    if (t >= 1 || o.frame !== 'polar') {
      const [across, down] = visible.some(k => k.reveal === 'down')
        ? [1, Math.min(t, 1)]
        : [Math.min(t, 1), 1];
      // The edge a reveal is moving stays where it is; the others let a mark overhang them.
      const [x0, y0] = [Math.max(l - over, 0), Math.max(top - over, 0)];
      const x1 = across < 1 ? l + w * across : Math.min(l + w + over, W);
      const y1 = down < 1 ? top + h * down : Math.min(top + h + over, H);
      return [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
    }
    // The centre, twelve o'clock, each corner of the rectangle the sweep has passed, and where
    // its leading ray leaves the rectangle.
    const [cx, cy] = [l + w / 2, top + h / 2];
    const ray = (turn: number): [number, number] => {
      const [dx, dy] = [Math.sin(turn * 2 * Math.PI), -Math.cos(turn * 2 * Math.PI)];
      const far = Math.min(w / 2 / Math.abs(dx || 1e-9), h / 2 / Math.abs(dy || 1e-9));
      return [cx + dx * far, cy + dy * far];
    };
    const corner = Math.atan2(w, h) / (2 * Math.PI);
    const passed = [corner, 0.5 - corner, 0.5 + corner, 1 - corner].filter(turn => turn < t);
    return [[cx, cy], ray(0), ...passed.map(ray), ray(t)];
  };
  const inside = (shape: [number, number][], x: number, y: number) => {
    let within = false;
    for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
      const [[xi, yi], [xj, yj]] = [shape[i]!, shape[j]!];
      if (yi > y !== yj > y && x < xi + ((xj - xi) * (y - yi)) / (yj - yi)) within = !within;
    }
    return within;
  };
  const cross = (a: number[], b: number[], c: number[], d: number[]) => {
    const side = (p: number[], q: number[], r: number[]) =>
      Math.sign((q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!));
    return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
  };
  // The whole of a box is uncovered when its corners are and no edge of the outline cuts through
  // it; the corners alone miss a wedge still to come that passes between them. The box is taken a
  // little smaller, so that one touching the edge of the plot counts as inside it.
  const uncovered = (shape: [number, number][], k: { l: number; t: number; r: number; b: number }) => {
    const [l, t, r, b] = [k.l + 0.5, k.t + 0.5, k.r - 0.5, k.b - 0.5];
    const corners = [
      [l, t],
      [r, t],
      [r, b],
      [l, b],
    ];
    return (
      corners.every(([x, y]) => inside(shape, x!, y!)) &&
      !shape.some((p, i) =>
        corners.some((q, j) => cross(p, shape[(i + 1) % shape.length]!, q, corners[(j + 1) % 4]!)),
      )
    );
  };

  // The marks' labels, as DOM in a layer made when the first one is asked for.
  type Box = { l: number; t: number; r: number; b: number; text: string; color?: string };
  let notes: HTMLDivElement | undefined;
  let noted = '[]';
  let boxes: (Box & { el: HTMLElement })[] = [];
  const annotate = () => {
    // In the order of the marks, whichever layer each is drawn on: that order settles a tie.
    const wanted = [...new Set(visible)].flatMap(k => cache.get(k)?.p.labels ?? []);
    const kept: Box[] = [];
    for (const label of wanted.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
      const [x, y, w] = [label.x / dpr, label.y / dpr, label.text.length * 7];
      const l = label.align === 'start' ? x : label.align === 'end' ? x - w : x - w / 2;
      const box = { l, t: y - 8, r: l + w, b: y + 8, text: label.text, color: label.color };
      if (box.l < 0 || box.t < 0 || box.r > W || box.b > H) continue;
      if (kept.some(k => box.l < k.r && k.l < box.r && box.t < k.b && k.t < box.b)) continue;
      kept.push(box);
    }
    const key = JSON.stringify(kept);
    if (key === noted) return;
    noted = key;
    boxes = kept.map(k => {
      const el = document.createElement('div');
      el.textContent = k.text;
      el.style.cssText = `position:absolute;white-space:nowrap;line-height:16px;left:${k.l}px;top:${k.t}px;width:${k.r - k.l}px;text-align:center`;
      if (k.color) el.style.color = k.color;
      return { ...k, el };
    });
    notes ??= layer('div', `inset:0;color:${theme().text}`);
    notes.replaceChildren(...boxes.map(k => k.el));
    uncover();
  };

  // The marks' rules, as DOM between the canvases and the axis text, in a layer made when the first one is asked for.
  let lines: HTMLDivElement | undefined;
  let ruled = '[]';
  const rule = () => {
    const { left, top, width, height } = view;
    const wanted = [...new Set(visible)].flatMap(k => cache.get(k)?.p.rules ?? []);
    const key = JSON.stringify(wanted.length ? [wanted, left, top, width, height] : []);
    if (key === ruled) return;
    ruled = key;
    if (!lines) {
      axes.before((lines = layer('div', 'inset:0')));
      clipped = '';
    }
    lines.replaceChildren(
      ...wanted.map(r => {
        const e = document.createElement('div');
        const w = Number(r.width) / dpr;
        const along = (at: number, lo: number, size: number) =>
          Math.min(Math.max(Math.round(at - r.width / 2) / dpr, lo / dpr), (lo + size) / dpr - w);
        e.style.cssText =
          r.y === undefined
            ? `position:absolute;top:${top / dpr}px;height:${height / dpr}px;width:0;left:${along(r.x!, left, width)}px`
            : `position:absolute;left:${left / dpr}px;width:${width / dpr}px;height:0;top:${along(r.y, top, height)}px`;
        const side = r.y === undefined ? 'Left' : 'Top';
        e.style[`border${side}Width`] = `${w}px`;
        e.style[`border${side}Style`] = r.dashed ? 'dashed' : 'solid';
        e.style[`border${side}Color`] = r.color;
        return e;
      }),
    );
    uncover();
  };

  // An entrance uncovers the chart up to `shown`, or raises it from an opacity of `faded`. Layout
  // calls this with no argument, which must undo neither.
  let shown = 1;
  let faded = 1;
  let clipped = '';
  const uncover = (reveal = shown, opacity = faded) => {
    [shown, faded] = [reveal, opacity];
    const shape = reveal < 1 ? revealed(reveal) : undefined;
    if (notes) {
      notes.style.opacity = opacity === 1 ? '' : String(opacity);
      // A label shows once the whole of its box is uncovered, so it never names what is not there yet.
      for (const k of boxes) k.el.style.visibility = !shape || uncovered(shape, k) ? '' : 'hidden';
    }
    if (!glCanvas && !lines) return;
    const css = shape
      ? `polygon(${shape.map(([x, y]) => `${x}px ${y}px`).join()})`
      : `inset(${[m.top, m.right, m.bottom, m.left].map(side => `${Math.max(side - overhang(), 0)}px`).join(' ')})`;
    for (const e of [glCanvas, lines]) {
      if (!e) continue;
      if (css !== clipped) e.style.clipPath = css;
      e.style.opacity = opacity === 1 ? '' : String(opacity);
    }
    clipped = css;
  };

  // A column set is scanned at most once per list of marks, and only if its axis asks.
  let extents: Partial<Record<'x' | 'y' | 'xAll' | 'yAll', Span>> = {};
  // With every series hidden an axis keeps the extent it last had.
  const last: { x?: Span; y?: Span } = {};
  const limits: { x: Span; y: Span } = { x: [0, 1], y: [0, 1] };
  const wholes = {} as { x: Resolved; y: Resolved };
  // A proposal's scan is kept for the display of the same window that follows it.
  let scanned: { key: string; span: Span | undefined } | undefined;
  let lastWindowFit: Span | undefined;
  let yFitted = false;
  let yFit: { of: () => Span; room: Room } | undefined;
  // The y extent of the shown marks between a and b on x, if any shows there. A connected mark's x
  // is ascending, so its rows are found by binary search, and its values at the two edges count too.
  // A row counts only where every value of it is a number, as a mark draws nothing of it otherwise.
  const scan = (a: number, b: number): Span | undefined => {
    let lo = Infinity;
    let hi = -Infinity;
    let seen = false;
    const add = (v: number) => {
      if (!Number.isFinite(v)) return;
      seen = true;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    };
    for (const k of visible) {
      const n = k.points;
      const { x: X, y: Y } = k.channels;
      const rows = Y.filter(c => c.length === n);
      // A mark with no y per row, such as a heatmap, is given by its bounds and shows whole where it reaches into the window.
      if (!rows.length) {
        const [p, q] = X.length ? extent(X) : [a, b];
        if (p <= b && q >= a) for (const c of Y) for (let i = 0; i < c.length; i++) add(c[i]!);
        continue;
      }
      const [only] = rows;
      const take =
        rows.length === 1
          ? (i: number) => add(only![i]!)
          : (i: number) => {
              for (const c of rows) if (!Number.isFinite(c[i]!)) return;
              for (const c of rows) add(c[i]!);
            };
      seen = false;
      if (!X.some(c => c.length === n)) {
        for (let i = 0; i < n; i++) take(i);
      } else if (k.sampleAtX && X.length === 1) {
        const x = X[0]!;
        let from = upTo(x, a);
        while (from > 0 && x[from - 1] === a) from--;
        for (let i = from, to = upTo(x, b); i < to; i++) take(i);
        for (const v of [a, b]) {
          if (!(v <= x[n - 1]!)) continue;
          // Which of the two a smooth curve draws depends on the pixel columns, so both count.
          for (const s of [k.sampleAtX(v), k.sampleAtX(v, true)]) {
            if (typeof s === 'number') add(s);
            else if (s) {
              add(s.y1);
              add(s.y2);
            }
          }
        }
      } else {
        const across = X.filter(c => c.length === n || c.length === 1);
        for (let i = 0; i < n; i++) {
          let p = Infinity;
          let q = -Infinity;
          for (const c of across) {
            const v = c[c.length === 1 ? 0 : i]!;
            p = Math.min(p, v);
            q = Math.max(q, v);
          }
          if (p <= b && q >= a) take(i);
        }
      }
      // A column shorter than the rows, such as a bar's zero baseline, counts whole once the mark shows.
      if (seen) for (const c of Y) if (c.length !== n) for (let i = 0; i < c.length; i++) add(c[i]!);
    }
    return lo <= hi ? [lo, hi] : undefined;
  };
  const sorted = ([a, b]: Span): Span => [Math.min(a, b), Math.max(a, b)];
  const fitsWindow = (axis: Axis) => axis.fit === 'window' && typeof axis.domain === 'string';
  const scanOnce = (a: number, b: number) => {
    const key = `${a},${b}`;
    if (scanned?.key !== key) scanned = { key, span: scan(a, b) };
    return scanned.span;
  };
  const windowExtent = (whole: () => Span): Span => {
    const [a, b] = sorted([xs.lo, xs.hi]);
    lastWindowFit = scanOnce(a, b) ?? lastWindowFit;
    return lastWindowFit ?? whole();
  };
  const fitted = (which: 'x' | 'y', room: Room): Resolved => {
    const of = () =>
      axisOf(o, which).fit === 'all'
        ? (extents[`${which}All`] ??= extent(every().flatMap(k => k.channels[which])))
        : (extents[which] ??=
            visible.some(k => !k.backdrop) || !marks.length
              ? (last[which] = extent(visible.flatMap(k => k.channels[which])))
              : (last[which] ??= extent(every().flatMap(k => k.channels[which]))));
    const whole = (wholes[which] = resolve(axisOf(o, which), of, room));
    limits[which] = [whole.lo, whole.hi];
    const w = bare(o) ? undefined : clamp(into(which, o.view?.[which]), limits[which]);
    if (which === 'y') {
      yFitted = false;
      yFit = { of, room };
    }
    if (!w) {
      const axis = axisOf(o, which);
      if (which === 'x' || !fitsWindow(axis)) return whole;
      yFitted = true;
      if (xs !== wholes.x) return resolve(axis, () => windowExtent(of), room);
      lastWindowFit = of();
      return whole;
    }
    if (w[0] === whole.lo && w[1] === whole.hi) return whole;
    // The window's own bounds, not the scale's: a band scale keeps the bounds of all its categories.
    const { ticks } = resolve({ ...axisOf(o, which), domain: w }, of, room);
    return {
      lo: w[0],
      hi: w[1],
      ticks: ticks.filter(t => t.value >= Math.min(...w) && t.value <= Math.max(...w)),
    };
  };
  // Before the first layout the room is judged from the margins as given; after it, from the real
  // ones, which is what catches a legend or a wide label taking the room away.
  const rescale = (laidOut: boolean) => {
    const g = o.margin ?? {};
    const bottom = g.bottom ?? (axisOf(o, 'x').label ? 44 : 26);
    const [w, h] = laidOut
      ? [W - m.left - m.right, H - m.top - m.bottom]
      : [W - (g.left ?? 44) - (g.right ?? 16), H - (g.top ?? 12) - bottom];
    xs = fitted('x', { length: w, horizontal: true });
    ys = fitted('y', { length: h, horizontal: false });
  };

  const theme = () => o.theme ?? light;
  const real = (k: 'x' | 'y', v: number) => {
    const a = axisOf(o, k);
    return a.from ? a.from(v, a) : v;
  };
  // A window a gesture wrote is read back as the span it was made from, which a round trip through real values can miss by a float step.
  const exact = new WeakMap<Span, { axis: Axis; span: Span }>();
  const inward = (k: 'x' | 'y', v: number) => {
    const a = axisOf(o, k);
    return a.to ? a.to(v, a) : v;
  };
  const into = (k: 'x' | 'y', s: Span | undefined): Span | undefined => {
    const a = axisOf(o, k);
    if (!s || !a.to) return s;
    const e = exact.get(s);
    if (e && sameAxis(e.axis, a)) return e.span;
    const r: Span = [inward(k, s[0]), inward(k, s[1])];
    // A decreasing transform, such as a log base below 1, turns the window round; either order means the same window.
    return (s[0] - s[1]) * (r[0] - r[1]) < 0 ? sorted(r) : r;
  };
  const out = (k: 'x' | 'y', s: Span): Span => {
    const r: Span = [real(k, s[0]), real(k, s[1])];
    exact.set(r, { axis: axisOf(o, k), span: s });
    return r;
  };
  const xPx = (v: number) => (view.ox + v * view.kx) / dpr;
  const yPx = (v: number) => (view.oy - v * view.ky) / dpr;

  const layout = () => {
    // ponytail: tick labels are taken as 7 px a character, not measured, because measuring text
    // forces a layout before the first paint. Set the margin when labels are wider than that.
    const [xLabel, yLabel] = [axisOf(o, 'x').label, axisOf(o, 'y').label];
    const given = o.margin ?? {};
    let widest = 0;
    if (given.left === undefined)
      for (const t of [...ys.ticks, ...wholes.y.ticks]) widest = Math.max(widest, t.label.length);
    m = bare(o)
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
    // label out again, both bind at once and the two equations are solved together. Under a window
    // this is done for the whole domain's ticks, so the margins hold still as the window moves.
    const wx = wholes.x;
    const span = wx.hi - wx.lo || 1;
    const half = (label: string) => label.length * 3.5 + 4;
    const edge = (t: { value: number; label: string } | undefined) =>
      t && { u: (t.value - wx.lo) / span, half: half(t.label) };
    const [a, b] = [edge(wx.ticks[0]), edge(wx.ticks.at(-1))];
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
      theme: theme(),
    };
    axes.style.color = theme().text;
    if (notes) notes.style.color = theme().text;
    uncover();

    const key = JSON.stringify([W, H, m, xs, ys, xLabel, yLabel, xs !== wx]);
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
      for (const t of xs.ticks) {
        const x = xPx(t.value);
        if (xs !== wx && (x < textWidth(t.label) / 2 || x > W - textWidth(t.label) / 2)) continue;
        text(t.label, x, H - m.bottom + 8, 'translate(-50%,0)');
      }
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

  // The browser takes a context away when too many are open, so a lost layer gives its marks back to the canvas.
  const dropLost = () => {
    if (!gl?.gl.isContextLost()) return false;
    for (const k of placed) k.release?.(gl);
    placed.clear();
    gl.destroy();
    gl = null;
    return true;
  };
  const onLost = () => {
    if (dropLost() && drawable) {
      prepare(false);
      paint('size');
    }
  };

  const prepare = (viewChanged: boolean) => {
    // A backdrop stays on the canvas: the WebGL layer is dimmed as one when a group is focused.
    const make = makeGl ?? visible.find(k => k.gl && !k.backdrop)?.gl?.layer;
    const on = visible.map(k => !!k.gl && !k.backdrop && k.gl.layer === make);
    // The layer lies over the canvas, so a mark that belongs under those after it stays on the
    // canvas unless they are all on the layer too. A backdrop is painted under both.
    for (let at = visible.length - 1, clear = true; at >= 0; at--) {
      if (visible[at]!.backdrop) continue;
      if (visible[at]!.gl?.under && !clear) on[at] = false;
      clear &&= on[at]!;
    }
    const layered = new Map<Mark, boolean>();
    visible.forEach((k, i) => layered.has(k) || layered.set(k, on[i]!));
    const onLayer = (k: Mark) => layered.get(k)!;
    // ponytail: WebGL positions are 32-bit, a pixel off past ~4096x, so deeper zoom draws on the
    // canvas; 64-bit positions in the shader (a high and a low float) would lift this ceiling.
    const deep = [xs, ys].some((s, i) => {
      const whole = i ? wholes.y : wholes.x;
      return (whole.hi - whole.lo) / (s.hi - s.lo) > 4096;
    });
    // Each mark fills its own share of the threshold, so a mark may ask for the layer sooner or later.
    let useGl =
      !deep &&
      visible.reduce((sum, k) => sum + (onLayer(k) ? k.points / (k.gl!.from ?? GL_FROM) : 0), 0) >= 1;
    if (useGl && gl === undefined) {
      makeGl = make!;
      glCanvas = layer('canvas', 'left:0;top:0');
      glCanvas.ariaHidden = 'true';
      canvas.after(glCanvas);
      fit(glCanvas);
      clipped = '';
      uncover();
      gl = makeGl(glCanvas);
      glCanvas.addEventListener('webglcontextlost', onLost);
    }
    dropLost();
    useGl &&= !!gl;
    if (glCanvas) glCanvas.style.display = useGl ? '' : 'none';

    const old = cache;
    cache = new Map();
    flat = [];
    onGl = [];
    settle();
    several = new Set(visible.map(k => k.group).filter(g => g !== undefined)).size > 1;
    let all = paired;
    for (const k of visible) {
      const g = useGl && onLayer(k);
      let e = old.get(k);
      const changed = !e;
      if (!e || viewChanged || e.gl !== g) {
        e = { p: g ? k.gl!.prepare(view, gl!) : k.prepare(view, replaced.get(k)), gl: g };
        if (g) placed.add(k);
      }
      if (changed && e.p.morph && replaced.has(k)) morphs.push(e.p);
      else if (changed) all = false;
      cache.set(k, e);
      (g ? onGl : flat).push([k, e.p]);
    }
    flat = [...flat.filter(([k]) => k.backdrop), ...flat.filter(([k]) => !k.backdrop)];
    if (!all) morphs = [];
    replaced.clear();
    paired = true;
    annotate();
    rule();
  };

  const grid = () => {
    const { left, top, width, height, ox, kx, oy, ky } = view;
    ctx.lineWidth = dpr;
    ctx.strokeStyle = view.theme.grid;
    ctx.beginPath();
    for (const t of ys.ticks) {
      const y = Math.round(oy - t.value * ky) + dpr / 2;
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = view.theme.muted;
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
    (o.dim ?? 1) !== 1 && focusedRow && !focusedRow.mark.rowsAlike && (!several || focusedRow.mark.entries)
      ? focusedRow
      : undefined;
  const chosen = () => {
    if (!o.selected?.length) return undefined;
    const rows = new Map<Mark, number[]>();
    for (const k of visible) {
      const of = new Set(
        o.selected
          .flatMap(s => (s.id === idOf(k) ? s.rows : []))
          .filter(r => Number.isInteger(r) && r >= 0 && r < k.points),
      );
      if (of.size) rows.set(k, [...of]);
    }
    return rows.size ? rows : undefined;
  };
  const drawnFocus = () => ((o.dim ?? 1) === 1 || drawnRow() ? null : focused);
  const hovered = () => focused !== null || focusedRow !== undefined;

  const render = (reveal = 1) => {
    const dim = o.dim ?? 1;
    const lit = drawnFocus();
    const only = drawnRow();
    uncover(reveal, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid();
    if (!reveal) return;
    if (onGl.length && dropLost()) prepare(false);
    // Each mark is cut to the plot area and its own overhang, so a bar beside a point keeps its edge.
    const cut = (k: Mark, draw: () => void) => {
      ctx.save();
      ctx.beginPath();
      for (const [x, y] of revealed(reveal, k.overhang ?? 0)) ctx.lineTo(x * dpr, y * dpr);
      ctx.clip();
      draw();
      ctx.restore();
    };
    const picked = hovered() ? undefined : chosen();
    const pick = (k: Mark, p: Prepared, rows: number[]) => {
      if (p.select) p.select(rows, view.theme.text);
      else if (k.oneShape) p.paint(1);
      else for (const row of rows) p.paint(1, row, 0);
    };
    // Beside a focused row the other marks keep their strength, unless they are other series.
    const others = lit !== null || (only && several) || picked ? dim : 1;
    const [under, over] = [flat.filter(([k]) => k.backdrop), flat.filter(([k]) => !k.backdrop)];
    for (const [k, p] of under) cut(k, () => p.paint(1));
    for (const [k, p] of over) {
      if (k === only?.mark) cut(k, () => p.paint(1, only.row, dim));
      else if (k.group !== lit) cut(k, () => p.paint(others));
    }
    for (const [k, p] of over) if (k.group === lit) cut(k, () => p.paint(1));
    for (const [k, p] of over) {
      const rows = picked?.get(k);
      if (rows) cut(k, () => pick(k, p, rows));
    }
    if (!onGl.length) return;
    gl!.clear();
    // What is to be dimmed is drawn first and faded as one, then what is focused goes on top.
    for (const [k, p] of onGl) if (k !== only?.mark && k.group !== lit) p.paint(1);
    if (others !== 1) gl!.fade(dim);
    for (const [k, p] of onGl) {
      if (k === only?.mark) p.paint(1, only.row, dim);
      else if (lit !== null && k.group === lit) p.paint(1);
      else if (picked?.has(k)) pick(k, p, picked.get(k)!);
    }
  };

  let painter: Painter | undefined;
  const paint = (why: Parameters<Painter>[1]) => (painter ? painter(render, why) : render());

  const refresh = (data: boolean, also?: 'size' | 'focus', restyled = false, asked = false) => {
    const before = viewKey;
    const shown = () => [xs.lo, xs.hi, ys.lo, ys.hi].join();
    const was = asked && shown();
    rescale(false);
    layout();
    // The scales were resolved for a guessed room; resolved again for the real one, their ticks or
    // bounds may differ, and then so may the margins. Once more is enough to be right in all but contrived cases.
    const guessed = JSON.stringify([xs, ys, wholes]);
    rescale(true);
    if (JSON.stringify([xs, ys, wholes]) !== guessed) layout();
    if (asked && shown() !== was) also = 'size';
    const viewChanged = viewKey !== before || restyled;
    drawable = W > m.left + m.right && H > m.top + m.bottom;
    root.style.visibility = drawable ? '' : 'hidden';
    // Growing back always changes the view, so marks replaced while hidden are prepared then.
    if (!drawable) {
      flat = [];
      onGl = [];
      cache.clear();
      settle();
      annotate();
      return false;
    }
    if (data || viewChanged) prepare(viewChanged);
    // A resize has already cleared the canvas, so it is 'size' even when the data changed too.
    if (data || viewChanged || also) paint(also === 'size' || !data ? (also ?? 'size') : 'data');
    return true;
  };

  const unfocusGone = () => {
    const gone = focusedRow !== undefined && !visible.includes(focusedRow.mark);
    if (gone) focusedRow = undefined;
    const lost = gone || (focused !== null && !visible.some(k => k.group === focused));
    if (lost) focused = null;
    return lost;
  };
  const focus: Internals['focus'] = (group, row) => {
    const [was, wasRow, wasHovered] = [drawnFocus(), drawnRow(), hovered()];
    focused = group;
    focusedRow = row && { mark: row.mark, row: row.row };
    // Only what is drawn counts: a new row inside a focused series changes nothing on screen.
    const now = drawnRow();
    const same = drawnFocus() === was && now?.mark === wasRow?.mark && now?.row === wasRow?.row;
    if (same && (hovered() === wasHovered || !chosen())) return;
    if (drawable) paint('focus');
  };

  // In the marks' space, or with `stored` as o.view keeps it: in real values, a side not proposed as the app gave it.
  const wanted = (want: { x?: Span; y?: Span } | null, stored = false) => {
    const next: { x?: Span; y?: Span } = {};
    for (const k of ['x', 'y'] as const) {
      if (!want) continue;
      const given = o.view?.[k];
      const w = k in want ? clamp(want[k], limits[k]) : stored ? given : into(k, given);
      if (w) next[k] = stored && k in want ? out(k, w) : w;
    }
    return next;
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
    revealed,
    reveal: uncover,
    reserve(space) {
      above = space;
    },
    marks: () => visible,
    listed: () => marks,
    hidden: () => hiddenIds,
    hide(ids) {
      if (sameIds(hiddenIds, ids)) return;
      letGo();
      hiddenIds = [...ids];
      const relaid = reshow();
      unfocusGone();
      if (refresh(true, relaid ? undefined : 'size')) sync();
      o.onHiddenChange?.(ids);
    },
    size: () => ({ width: W, height: H }),
    margin: () => m,
    theme,
    xPx,
    yPx,
    xValue: px => (px * dpr - view.ox) / view.kx,
    yValue: px => (view.oy - px * dpr) / view.ky,
    view: () => ({ x: [xs.lo, xs.hi], y: [ys.lo, ys.hi] }),
    domain: () => ({ ...limits }),
    fit(want) {
      if (bare(o)) return internals.view();
      const next = wanted(want);
      const x = clamp(next.x, limits.x) ?? limits.x;
      const derived = () => {
        const whole = x[0] === limits.x[0] && x[1] === limits.x[1];
        if (whole || !yFit || !fitsWindow(axisOf(o, 'y'))) return limits.y;
        const fit = resolve(
          axisOf(o, 'y'),
          () => scanOnce(...sorted(x)) ?? lastWindowFit ?? yFit!.of(),
          yFit.room,
        );
        return [fit.lo, fit.hi] satisfies Span;
      };
      const y = clamp(next.y, limits.y) ?? derived();
      return { x: [...x], y: [...y] };
    },
    propose(want) {
      if (bare(o)) return false;
      const [shown, will] = [internals.view(), internals.fit(want)];
      if ((['x', 'y'] as const).every(k => String(will[k]) === String(shown[k]))) return false;
      letGo();
      o = { ...o, view: want ? wanted(want, true) : undefined };
      if (refresh(false, 'size')) sync();
      o.onViewChange?.({
        x: [real('x', xs.lo), real('x', xs.hi)],
        ...(!yFitted && { y: [real('y', ys.lo), real('y', ys.hi)] }),
      });
      return true;
    },
    real,
    frame: () => o.frame ?? 'axes',
    drag: { brush: false, pan: false, active: false },
    sync: () => sync(),
    // Topmost first, the reverse of render(): a hit that is no nearer never replaces one above it.
    hit(px, py, max) {
      const lit = drawnFocus();
      let best: (Hit & { mark: Mark }) | null = null;
      for (const list of [onGl, flat]) {
        for (const top of [true, false]) {
          for (let i = list.length - 1; i >= 0; i--) {
            const [mark, p] = list[i]!;
            if ((mark.group === lit && !mark.backdrop) !== top) continue;
            const h: Hit | null | undefined = p.hit?.(px, py, best ? best.distance : max);
            if (h && (!best || h.distance < best.distance)) best = { ...h, mark };
          }
        }
      }
      return best;
    },
    pointer() {
      const p = o.pointer;
      if (!p || bare(o) || !drawable) return null;
      const x = xPx(inward('x', p.x));
      if (!(x >= m.left && x <= W - m.right)) return null;
      if (p.y === undefined) return { x };
      const y = yPx(inward('y', p.y));
      return !(y >= m.top && y <= H - m.bottom) ? { x } : { x, y };
    },
    focus,
  };

  let pointed = false;
  const tell = (p: { x: number; y: number } | null) => {
    if (!p && !pointed) return;
    pointed = !!p;
    o.onPointerChange?.(p);
  };
  let at: PointerEvent | undefined;
  const aim = () => {
    root.style.cursor = o.onClick && at && clicked(at)?.hit ? 'pointer' : '';
  };
  const point = (e: PointerEvent) => {
    at = e;
    aim();
    if (internals.drag.active) return tell(null);
    const { px, py, over } = locate(internals, e);
    tell(over ? { x: real('x', internals.xValue(px)), y: real('y', internals.yValue(py)) } : null);
  };
  const unpoint = () => {
    at = undefined;
    root.style.cursor = '';
    tell(null);
  };
  root.addEventListener('pointerdown', point);
  root.addEventListener('pointermove', point);
  root.addEventListener('pointerleave', unpoint);
  root.addEventListener('pointercancel', unpoint);

  const clicked = (e: MouseEvent) => {
    if (internals.drag.active || e.target !== root) return undefined;
    const { px, py, inside } = position(internals, e.clientX, e.clientY);
    if (!inside) return undefined;
    return { px, py, hit: internals.hit(px, py, NEAREST_PX) };
  };
  root.addEventListener('click', e => {
    const c = o.onClick && clicked(e);
    if (!c) return;
    const { px, py, hit } = c;
    o.onClick!(
      hit && {
        ...hit,
        mark: declared.get(hit.mark) ?? hit.mark,
        x: real('x', hit.x),
        y: real('y', hit.y),
        ...(hit.value !== undefined && { value: real('y', hit.value) }),
      },
      {
        x: real('x', internals.xValue(px)),
        y: real('y', internals.yValue(py)),
      },
    );
  });
  showing();
  const features: ReturnType<Feature>[] = [];
  const sync = () => {
    for (const f of features) f.update?.();
    aim();
  };
  const letGo = () => {
    for (const f of features) f.letGo?.();
  };
  let observer: ResizeObserver | undefined;
  let observing = false;
  const observe = () => {
    const auto = o.width === undefined || o.height === undefined;
    if (auto === observing) return;
    observing = auto;
    if (auto) observer!.observe(root);
    else observer!.disconnect();
  };
  // A density query matches one value only, so each change is listened for once and asked for again.
  let density: MediaQueryList | undefined;
  const redensify = () => {
    dpr = devicePixelRatio;
    fit(canvas);
    if (glCanvas) fit(glCanvas);
    watch();
    letGo();
    if (refresh(false, 'size')) sync();
  };
  const watch = () => {
    density = matchMedia(`(resolution: ${dpr}dppx)`);
    density.addEventListener('change', redensify, { once: true });
  };
  const teardown = () => {
    let failed: { e: unknown } | undefined;
    const run = (f: () => void) => {
      try {
        f();
      } catch (e) {
        failed ??= { e };
      }
    };
    run(() => observer?.disconnect());
    run(() => density?.removeEventListener('change', redensify));
    for (const f of features) run(() => f.destroy());
    for (const k of new Set([...marks, ...declared.keys()])) run(() => k.release?.(gl ?? null));
    run(() => glCanvas?.removeEventListener('webglcontextlost', onLost));
    run(() => gl?.destroy());
    root.remove();
    if (failed) throw failed.e;
  };
  el.appendChild(root);
  try {
    measure();
    for (const feature of o.use ?? []) features.push(feature(internals));
    if (refresh(true)) sync();
    observer = new ResizeObserver(() => {
      letGo();
      if (refresh(false, measure() ? 'size' : undefined)) sync();
    });
    observe();
    watch();
  } catch (e) {
    try {
      teardown();
    } catch {}
    throw e;
  }

  return {
    update(partial) {
      const keys = Object.keys(partial);
      if (!keys.length || !keys.every(k => LIGHT.has(k))) letGo();
      const prev = o;
      o = { ...o, ...partial };
      const hid = 'hidden' in partial && !sameIds(partial.hidden, hiddenIds);
      if (hid) hiddenIds = [...(partial.hidden ?? [])];
      let data = !sameAxis(axisOf(o, 'x'), axisOf(prev, 'x')) || !sameAxis(axisOf(o, 'y'), axisOf(prev, 'y'));
      replaced = new Map();
      paired = true;
      let relaid = false;
      let reshown = false;
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
          everyLaid = undefined;
          lastWindowFit = undefined;
          relaid = reshow();
          reshown = true;
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
        for (const k of new Set(before)) if (!kept.has(k)) drop(k);
      }
      // The focused row follows its mark into the mark that replaced it, so a pointer at rest
      // on a bar asks for no new focus and does not cut the bar's move short.
      for (const [k, was] of replaced) if (was === focusedRow?.mark) focusedRow = { ...focusedRow, mark: k };
      if (hid && !reshown) relaid = reshow();
      data ||= hid;
      const lost = unfocusGone();
      observe();
      const resized = measure();
      const restyled = theme() !== (prev.theme ?? light);
      // Ticks are DOM and change at once, so a new window must not cross-fade with new marks.
      const moved = (['x', 'y'] as const).some(k => String(o.view?.[k]) !== String(prev.view?.[k]));
      if (
        refresh(
          data,
          resized || restyled || (hid && !relaid)
            ? 'size'
            : lost || o.dim !== prev.dim || o.selected !== prev.selected
              ? 'focus'
              : undefined,
          restyled,
          moved,
        )
      )
        sync();
      else aim();
    },
    destroy: teardown,
  };
}
