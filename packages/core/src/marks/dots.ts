import { glLayer, program, rgba } from '../gl.js';
import type { Col, GlLayer, Mark, Prepared, View } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/** A dot at each point, each with its own radius. */
export type DotsOptions = Common & {
  /** The x of each point. */
  x: Col;
  /** The y of each point. */
  y: Col;
  /** The radius of each point in CSS pixels. */
  r: Col;
  /** Draws each point as a ring of its colour this many CSS pixels wide, always on the canvas. */
  ring?: number;
  /** The middle of a ring point, a CSS colour; the theme's surface when left out. */
  fill?: string;
};

const TAU = 2 * Math.PI;
// Measured 2026-11-24: below this the canvas mounts sooner than WebGL can be set up, also at 4x CPU slowdown.
const GL_FROM = 20_000;

const origin = (c: Col) => {
  for (let i = 0; i < c.length; i++) if (Number.isFinite(c[i])) return c[i]!;
  return 0;
};

const programs = new WeakMap<WebGL2RenderingContext, ReturnType<typeof pointProgram>>();

function pointProgram(gl: WebGL2RenderingContext) {
  const p = program(
    gl,
    'in vec3 a;uniform vec4 m;uniform float dpr;out float size;void main(){gl_Position=vec4(a.x*m.x+m.y,a.y*m.z+m.w,0,1);size=a.z*2.0*dpr+1.0;gl_PointSize=size;}',
    'precision mediump float;uniform vec4 color;uniform float hole;in float size;out vec4 o;void main(){float d=length(gl_PointCoord-0.5)*size;float al=clamp(size*0.5-d,0.0,1.0)*color.a;if(hole>0.0)al*=clamp(d-size*0.5+0.5+hole,0.0,1.0);if(al<=0.0)discard;o=vec4(color.rgb*al,al);}',
  );
  const a = gl.getAttribLocation(p, 'a');
  gl.enableVertexAttribArray(a);
  const uniform = (name: string) => gl.getUniformLocation(p, name);
  return { p, a, m: uniform('m'), dpr: uniform('dpr'), hole: uniform('hole'), color: uniform('color') };
}

export function dots(o: DotsOptions): Mark {
  const { x, y, r, color, alpha = 1 } = o;
  const n = x.length;
  const buffers = new WeakMap<WebGL2RenderingContext, WebGLBuffer>();
  let reach = 0;
  for (let i = 0; i < n; i++) reach = Math.max(reach, r[i]!);
  const overhang = reach + (o.ring ?? 0) / 2;

  // ponytail: linear scan per pointer move, fine at 100k points; a grid index when it shows in a profile.
  const hit =
    ({ ox, kx, oy, ky, dpr, left, top, width, height }: View): Prepared['hit'] =>
    (px, py, max) => {
      let best = max ** 2;
      let at = -1;
      for (let i = 0; i < n; i++) {
        const cx = ox + x[i]! * kx;
        const cy = oy - y[i]! * ky;
        if (cx < left || cx > left + width || cy < top || cy > top + height) continue;
        const d = (cx / dpr - px) ** 2 + (cy / dpr - py) ** 2;
        if (d < best) [best, at] = [d, i];
      }
      return at < 0 ? null : { x: x[at]!, y: y[at]!, distance: Math.sqrt(best), row: at };
    };

  const prepareGl = (view: View, layer: GlLayer): Prepared => {
    const { gl } = layer;
    const u = programs.get(gl) ?? pointProgram(gl);
    programs.set(gl, u);
    // The offsets are subtracted in float64: a float32 attribute cannot hold e.g. millisecond timestamps.
    // They come from the data, not the domain, so a new view changes only the uniform and never the buffer.
    const x0 = origin(x);
    const y0 = origin(y);
    let buffer = buffers.get(gl);
    if (!buffer) {
      const data = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        data[3 * i] = x[i]! - x0;
        data[3 * i + 1] = y[i]! - y0;
        data[3 * i + 2] = Math.max(0, r[i]!);
      }
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      buffers.set(gl, buffer);
    }
    const { ctx, kx, ox, ky, oy, dpr } = view;
    const [red, green, blue, opacity = 1] = rgba(ctx, color);
    const ready = () => {
      const { width: w, height: h } = gl.canvas;
      gl.useProgram(u.p);
      gl.uniform4f(
        u.m,
        (kx * 2) / w,
        ((ox + x0 * kx) * 2) / w - 1,
        (ky * 2) / h,
        1 - ((oy - y0 * ky) * 2) / h,
      );
      gl.uniform1f(u.dpr, dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(u.a, 3, gl.FLOAT, false, 0, 0);
    };
    const own = () => {
      gl.uniform1f(u.hole, 0);
      gl.uniform4f(u.color, red!, green!, blue!, alpha * opacity);
    };
    return {
      // The alpha argument is unused: dense points saturate, so the layer's fade() dims a group instead.
      paint(_, row, rest = 1) {
        ready();
        own();
        gl.drawArrays(gl.POINTS, 0, n);
        if (row === undefined || rest === 1) return;
        layer.fade(rest);
        ready();
        own();
        gl.drawArrays(gl.POINTS, row, 1);
      },
      select(rows, outline) {
        ready();
        own();
        for (const i of rows) gl.drawArrays(gl.POINTS, i, 1);
        const [r2, g2, b2, a2 = 1] = rgba(ctx, outline);
        gl.uniform1f(u.hole, dpr);
        gl.uniform4f(u.color, r2!, g2!, b2!, a2);
        for (const i of rows) gl.drawArrays(gl.POINTS, i, 1);
      },
      hit: hit(view),
    };
  };

  return {
    ...base('dots', o, [x], [y]),
    overhang,
    prepare(view) {
      const { ctx, dpr, ox, kx, oy, ky, theme, left, top, width, height } = view;
      // A point further out than twice the overhang cannot reach the area its mark is cut to.
      const out = 2 * overhang * dpr;
      const circle = (path: Path2D, i: number, grow = 0) => {
        const px = ox + x[i]! * kx;
        const py = oy - y[i]! * ky;
        if (px < left - out || px > left + width + out || py < top - out || py > top + height + out) return;
        const radius = Math.max(0, r[i]! * dpr + grow);
        path.moveTo(px + radius, py);
        path.arc(px, py, radius, 0, TAU);
      };
      const path = new Path2D();
      for (let i = 0; i < n; i++) circle(path, i);
      const fill = (shape: Path2D, a: number) => {
        ctx.globalAlpha = alpha * a;
        ctx.fillStyle = o.ring ? (o.fill ?? theme.surface) : color;
        ctx.fill(shape);
        if (!o.ring) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = o.ring * dpr;
        ctx.stroke(shape);
      };
      return {
        paint(a, row, rest = 1) {
          if (row === undefined) return fill(path, a);
          fill(path, a * rest);
          const one = new Path2D();
          circle(one, row);
          fill(one, a);
        },
        select(rows, outline) {
          const some = new Path2D();
          const edge = new Path2D();
          for (const i of rows) {
            circle(some, i);
            circle(edge, i, ((o.ring ?? 0) / 2) * dpr);
          }
          fill(some, 1);
          ctx.save();
          ctx.clip(edge);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = outline;
          ctx.lineWidth = 2 * dpr;
          ctx.stroke(edge);
          ctx.restore();
        },
        hit: hit(view),
      };
    },
    gl: o.ring ? undefined : { layer: glLayer, from: GL_FROM, prepare: prepareGl },
    release(layer) {
      const buffer = layer && buffers.get(layer.gl);
      if (!buffer) return;
      layer.gl.deleteBuffer(buffer);
      buffers.delete(layer.gl);
    },
  };
}
