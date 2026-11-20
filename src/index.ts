export type Col = ArrayLike<number>;
export type Axis = { domain: [number, number] | 'nice'; label: string };
export type Mark =
  // x must be ascending: the step marks are reduced to one min/max per pixel column in a single pass.
  | { type: 'stepLine'; x: Col; y: Col; color: string; width: number; label: string }
  | { type: 'stepBand'; x: Col; lower: Col; upper: Col; color: string; alpha: number; group?: string }
  | { type: 'ticks'; x: Col; y: Col; color: string; size: number; group?: string }
  | { type: 'dots'; x: Col; y: Col; r: Col; color: string; alpha: number; label: string };
export type Tooltip =
  | { mode: 'x'; title: (x: number) => string; value: (y: number) => string }
  | { mode: 'nearest'; text: (label: string, x: number, y: number) => string };
export type Options = {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  x: Axis;
  y: Axis;
  marks: Mark[];
  tooltip?: Tooltip;
  /** Opacity multiplier for every other group while the pointer is on one; a group is a label or `group`. */
  dim?: number;
};

type Dots = Extract<Mark, { type: 'dots' }>;
type Row = { text: string; color?: string };

// ponytail: measured crossover is somewhere between 10k and 100k points; tune per device if it matters.
const GL_FROM = 30_000;
const NEAREST_PX = 20;
const FOCUS_PX = 30;
const TAU = 2 * Math.PI;

function niceStep(span: number) {
  const mag = 10 ** Math.floor(Math.log10(span / 10));
  return mag * ([1, 2, 5].find(k => span / (mag * k) <= 10) ?? 10);
}

function scale(domain: Axis['domain'], cols: Col[]) {
  let [lo, hi] = domain === 'nice' ? [Infinity, -Infinity] : domain;
  if (domain === 'nice') {
    for (const c of cols) {
      for (let i = 0; i < c.length; i++) {
        const v = c[i]!;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (lo > hi) [lo, hi] = [0, 1];
  }
  const step = niceStep(hi - lo || 1);
  if (domain === 'nice') [lo, hi] = [Math.floor(lo / step) * step, Math.ceil(hi / step) * step || step];
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let i = Math.ceil(lo / step); i * step <= hi; i++) ticks.push(+(i * step).toFixed(digits));
  return { lo, hi, ticks };
}

function columns(x: Col, y: Col, ox: number, kx: number, oy: number, ky: number) {
  const n = x.length;
  const col = new Int32Array(n);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  const last = new Float64Array(n);
  let k = -1;
  for (let i = 0; i < n; i++) {
    const c = Math.round(ox + x[i]! * kx);
    const v = oy - y[i]! * ky;
    if (k < 0 || c !== col[k]) {
      k++;
      col[k] = c;
      lo[k] = hi[k] = v;
    } else if (v < lo[k]!) lo[k] = v;
    else if (v > hi[k]!) hi[k] = v;
    last[k] = v;
  }
  return { n: k + 1, col, lo, hi, last };
}

function drawDotsGl(
  canvas: HTMLCanvasElement,
  dots: Dots[],
  t: { kx: number; ox: number; ky: number; oy: number; x0: number; y0: number },
  dpr: number,
  rgb: (c: string) => number[],
) {
  const gl = canvas.getContext('webgl2', { antialias: false });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(
    program,
    shader(
      gl.VERTEX_SHADER,
      '#version 300 es\nin vec3 a;uniform vec4 m;uniform float dpr;out float size;void main(){gl_Position=vec4(a.x*m.x+m.y,a.y*m.z+m.w,0,1);size=a.z*2.0*dpr+1.0;gl_PointSize=size;}',
    ),
  );
  gl.attachShader(
    program,
    shader(
      gl.FRAGMENT_SHADER,
      '#version 300 es\nprecision mediump float;uniform vec4 color;in float size;out vec4 o;void main(){float al=clamp(size*0.5-length(gl_PointCoord-0.5)*size,0.0,1.0)*color.a;if(al<=0.0)discard;o=vec4(color.rgb*al,al);}',
    ),
  );
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const { width: w, height: h } = canvas;
  gl.uniform4f(
    gl.getUniformLocation(program, 'm'),
    (t.kx * 2) / w,
    (t.ox * 2) / w - 1,
    (t.ky * 2) / h,
    1 - (t.oy * 2) / h,
  );
  gl.uniform1f(gl.getUniformLocation(program, 'dpr'), dpr);
  const a = gl.getAttribLocation(program, 'a');
  const color = gl.getUniformLocation(program, 'color');
  gl.enableVertexAttribArray(a);
  const items = dots.map(d => {
    const n = d.x.length;
    const buf = new Float32Array(n * 3);
    // Offsets are subtracted here, in float64: a float32 attribute cannot hold e.g. millisecond timestamps.
    for (let i = 0; i < n; i++) {
      buf[3 * i] = d.x[i]! - t.x0;
      buf[3 * i + 1] = d.y[i]! - t.y0;
      buf[3 * i + 2] = d.r[i]!;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    return { buffer, n, rgb: rgb(d.color) };
  });
  const fade = gl.createProgram();
  gl.attachShader(
    fade,
    shader(
      gl.VERTEX_SHADER,
      '#version 300 es\nvoid main(){gl_Position=vec4(float((gl_VertexID<<1)&2)*2.0-1.0,float(gl_VertexID&2)*2.0-1.0,0,1);}',
    ),
  );
  gl.attachShader(
    fade,
    shader(
      gl.FRAGMENT_SHADER,
      '#version 300 es\nprecision mediump float;uniform float k;out vec4 o;void main(){o=vec4(0,0,0,k);}',
    ),
  );
  gl.linkProgram(fade);
  const fadeK = gl.getUniformLocation(fade, 'k');
  const group = (i: number) => {
    const it = items[i]!;
    gl.bindBuffer(gl.ARRAY_BUFFER, it.buffer);
    gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
    gl.uniform4f(color, it.rgb[0]! / 255, it.rgb[1]! / 255, it.rgb[2]! / 255, dots[i]!.alpha);
    gl.drawArrays(gl.POINTS, 0, it.n);
  };
  // Dense points blend into an opaque mass, so lowering each point's alpha would not dim a group:
  // the others are drawn at full strength, the whole buffer is scaled by `dim`, then the focused group goes on top.
  const draw = (focused: string | null, dim: number) => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    dots.forEach((d, i) => d.label !== focused && group(i));
    if (focused === null) return;
    gl.useProgram(fade);
    gl.uniform1f(fadeK, dim);
    gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(program);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    dots.forEach((d, i) => d.label === focused && group(i));
  };
  return { gl, draw };
}

export function plot(el: HTMLElement, o: Options) {
  const { width: W, height: H, margin: m, marks } = o;
  const dpr = devicePixelRatio;
  const root = document.createElement('div');
  root.style.cssText = `position:relative;width:${W}px;height:${H}px;font:12px system-ui,sans-serif`;
  const layer = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '') => {
    const e = document.createElement(tag);
    e.style.cssText = `position:absolute;pointer-events:none;${css}`;
    return root.appendChild(e);
  };
  const addCanvas = () => {
    const c = layer('canvas', `left:0;top:0;width:${W}px;height:${H}px`);
    c.width = W * dpr;
    c.height = H * dpr;
    return c;
  };
  const ctx = addCanvas().getContext('2d')!;

  const xs = scale(
    o.x.domain,
    marks.map(k => k.x),
  );
  const ys = scale(
    o.y.domain,
    marks.flatMap(k => (k.type === 'stepBand' ? [k.lower, k.upper] : [k.y])),
  );
  const left = m.left * dpr;
  const top = m.top * dpr;
  const pw = (W - m.left - m.right) * dpr;
  const ph = (H - m.top - m.bottom) * dpr;
  const kx = pw / (xs.hi - xs.lo);
  const ky = ph / (ys.hi - ys.lo);
  const ox = left - xs.lo * kx;
  const oy = top + ph + ys.lo * ky;
  const cssX = (v: number) => (ox + v * kx) / dpr;
  const cssY = (v: number) => (oy - v * ky) / dpr;

  const grid = () => {
    ctx.lineWidth = dpr;
    ctx.strokeStyle = '#e5e5e5';
    ctx.beginPath();
    for (const v of ys.ticks) {
      const y = Math.round(oy - v * ky) + dpr / 2;
      ctx.moveTo(left, y);
      ctx.lineTo(left + pw, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.beginPath();
    for (const v of xs.ticks) {
      const x = Math.round(ox + v * kx) + dpr / 2;
      ctx.moveTo(x, top + ph);
      ctx.lineTo(x, top + ph + 5 * dpr);
    }
    ctx.stroke();
  };

  // Axis text is DOM, not fillText: the first text drawn on a canvas cost ~20 ms at 4x CPU slowdown.
  const labels = document.createDocumentFragment();
  const text = (s: string, x: number, y: number, transform: string) => {
    const e = document.createElement('div');
    e.textContent = s;
    e.style.cssText = `position:absolute;white-space:nowrap;left:${x}px;top:${y}px;transform:${transform}`;
    labels.appendChild(e);
  };
  for (const v of xs.ticks) text(String(v), cssX(v), H - m.bottom + 8, 'translate(-50%,0)');
  for (const v of ys.ticks) text(String(v), m.left - 8, cssY(v), 'translate(-100%,-50%)');
  text(o.x.label, m.left + pw / dpr / 2, H - 2, 'translate(-50%,-100%)');
  text(o.y.label, 10, m.top + ph / dpr / 2, 'translate(-50%,-50%) rotate(-90deg)');
  layer('div', 'inset:0;color:#444').appendChild(labels);

  const dots = marks.filter(k => k.type === 'dots');
  let gl: ReturnType<typeof drawDotsGl> = null;
  if (dots.reduce((n, d) => n + d.x.length, 0) >= GL_FROM) {
    const rgb = (c: string) => {
      ctx.fillStyle = c;
      const hex = ctx.fillStyle as string;
      return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    };
    const canvas = addCanvas();
    gl = drawDotsGl(canvas, dots, { kx, ox: left, ky, oy: top + ph, x0: xs.lo, y0: ys.lo }, dpr, rgb);
    if (gl) canvas.style.clipPath = `inset(${m.top}px ${m.right}px ${m.bottom}px ${m.left}px)`;
    else canvas.remove();
  }

  // Paths are built once and kept, so a focus change repaints without touching the data again.
  const painters: { group: string | undefined; paint: (alpha: number) => void }[] = [];
  for (const k of marks) {
    const path = new Path2D();
    if (k.type === 'stepLine') {
      const c = columns(k.x, k.y, ox, kx, oy, ky);
      for (let i = 0; i < c.n; i++) {
        const x = c.col[i]!;
        if (i) path.lineTo(x, c.last[i - 1]!);
        else path.moveTo(x, c.last[0]!);
        if (c.lo[i] !== c.hi[i]) {
          path.lineTo(x, c.lo[i]!);
          path.lineTo(x, c.hi[i]!);
        }
        path.lineTo(x, c.last[i]!);
      }
      painters.push({
        group: k.label,
        paint: a => {
          ctx.globalAlpha = a;
          ctx.lineWidth = k.width * dpr;
          ctx.strokeStyle = k.color;
          ctx.stroke(path);
        },
      });
    } else if (k.type === 'stepBand') {
      const u = columns(k.x, k.upper, ox, kx, oy, ky);
      const l = columns(k.x, k.lower, ox, kx, oy, ky);
      for (let i = 0; i < u.n; i++) {
        const x = u.col[i]!;
        if (i) path.lineTo(x, u.last[i - 1]!);
        path.lineTo(x, u.lo[i]!);
        path.lineTo(x, u.last[i]!);
      }
      for (let i = l.n - 1; i >= 0; i--) {
        const x = l.col[i]!;
        path.lineTo(x, l.last[i]!);
        path.lineTo(x, l.hi[i]!);
        if (i) path.lineTo(x, l.last[i - 1]!);
      }
      painters.push({
        group: k.group,
        paint: a => {
          ctx.globalAlpha = k.alpha * a;
          ctx.fillStyle = k.color;
          ctx.fill(path);
        },
      });
    } else if (k.type === 'ticks') {
      const h = k.size * dpr;
      for (let i = 0; i < k.x.length; i++) {
        const x = ox + k.x[i]! * kx;
        const y = oy - k.y[i]! * ky;
        path.moveTo(x, y - h);
        path.lineTo(x, y + h);
      }
      painters.push({
        group: k.group,
        paint: a => {
          ctx.globalAlpha = a;
          ctx.lineWidth = dpr;
          ctx.strokeStyle = k.color;
          ctx.stroke(path);
        },
      });
    } else if (!gl) {
      for (let i = 0; i < k.x.length; i++) {
        const x = ox + k.x[i]! * kx;
        const y = oy - k.y[i]! * ky;
        const r = k.r[i]! * dpr;
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, TAU);
      }
      painters.push({
        group: k.label,
        paint: a => {
          ctx.globalAlpha = k.alpha * a;
          ctx.fillStyle = k.color;
          ctx.fill(path);
        },
      });
    }
  }

  const dim = o.dim ?? 1;
  let focused: string | null = null;
  const render = () => {
    const weight = (group: string | undefined) => (focused === null || group === focused ? 1 : dim);
    ctx.clearRect(0, 0, W * dpr, H * dpr);
    grid();
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, pw, ph);
    ctx.clip();
    for (const p of painters) if (p.group !== focused) p.paint(weight(p.group));
    for (const p of painters) if (p.group === focused) p.paint(1);
    ctx.restore();
    gl?.draw(focused, dim);
  };
  const focus = (group: string | null) => {
    if (group === focused || dim === 1) return;
    focused = group;
    render();
  };
  render();

  const tooltip = o.tooltip;
  if (tooltip) {
    const cross = layer(
      'div',
      `display:none;top:${m.top}px;height:${ph / dpr}px;border-left:1px dashed #888`,
    );
    const tip = layer(
      'div',
      'display:none;background:#fff;border:1px solid #ccc;padding:4px 8px;white-space:nowrap;z-index:100',
    );
    const hide = () => {
      cross.style.display = tip.style.display = 'none';
      focus(null);
    };
    const show = (x: number, y: number, rows: Row[]) => {
      tip.replaceChildren(
        ...rows.map(r => {
          const e = document.createElement('div');
          e.textContent = r.text;
          if (r.color) e.style.color = r.color;
          return e;
        }),
      );
      const fx = x > W / 2;
      const fy = y > H / 2;
      tip.style.display = '';
      tip.style.left = `${x + (fx ? -12 : 12)}px`;
      tip.style.top = `${y + (fy ? -12 : 12)}px`;
      tip.style.transform = `translate(${fx ? -100 : 0}%,${fy ? -100 : 0}%)`;
    };
    root.addEventListener('mouseleave', hide);
    root.addEventListener('mousemove', e => {
      const box = root.getBoundingClientRect();
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      if (tooltip.mode === 'x') {
        if (px < m.left || px > W - m.right || py < m.top || py > H - m.bottom) return hide();
        const v = (px * dpr - ox) / kx;
        const rows: Row[] = [{ text: tooltip.title(v) }];
        let near = FOCUS_PX;
        let group: string | null = null;
        for (const k of marks) {
          if (k.type !== 'stepLine') continue;
          let a = 0;
          let b = k.x.length;
          while (a < b) {
            const mid = (a + b) >> 1;
            if (k.x[mid]! <= v) a = mid + 1;
            else b = mid;
          }
          rows.push({ text: `${k.label}: ${a ? tooltip.value(k.y[a - 1]!) : '–'}`, color: k.color });
          const gap = a ? Math.abs(cssY(k.y[a - 1]!) - py) : Infinity;
          if (gap < near) [near, group] = [gap, k.label];
        }
        cross.style.display = '';
        cross.style.left = `${px}px`;
        show(px, m.top, rows);
        focus(group);
        return;
      }
      // ponytail: linear scan per mousemove, fine at 100k points; a grid index when it shows in a profile.
      let best = NEAREST_PX ** 2;
      let hit: Dots | null = null;
      let at = 0;
      for (const d of dots) {
        for (let i = 0; i < d.x.length; i++) {
          const dist = (cssX(d.x[i]!) - px) ** 2 + (cssY(d.y[i]!) - py) ** 2;
          if (dist < best) [best, hit, at] = [dist, d, i];
        }
      }
      if (!hit) return hide();
      const hx = hit.x[at]!;
      const hy = hit.y[at]!;
      focus(hit.label);
      show(cssX(hx), cssY(hy), [{ text: tooltip.text(hit.label, hx, hy), color: hit.color }]);
    });
  }

  root.style.pointerEvents = 'auto';
  el.appendChild(root);
  return {
    destroy() {
      gl?.gl.getExtension('WEBGL_lose_context')?.loseContext();
      root.remove();
    },
  };
}
