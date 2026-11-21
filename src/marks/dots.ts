import { glLayer, program, rgba } from '../gl.js';
import type { Col, GlLayer, Mark, Prepared, View } from '../types.js';
import { base } from './common.js';
import type { Common } from './common.js';

/**
 * r is the radius of each point in CSS pixels. With `ring`, a width in CSS pixels, a point is a
 * ring of its colour that wide round a middle of `fill`, white by default; such points are
 * always drawn on the canvas.
 */
export type DotsOptions = Common & { x: Col; y: Col; r: Col; ring?: number; fill?: string };

const TAU = 2 * Math.PI;

const programs = new WeakMap<WebGL2RenderingContext, ReturnType<typeof pointProgram>>();

function pointProgram(gl: WebGL2RenderingContext) {
  const p = program(
    gl,
    'in vec3 a;uniform vec4 m;uniform float dpr;out float size;void main(){gl_Position=vec4(a.x*m.x+m.y,a.y*m.z+m.w,0,1);size=a.z*2.0*dpr+1.0;gl_PointSize=size;}',
    'precision mediump float;uniform vec4 color;in float size;out vec4 o;void main(){float al=clamp(size*0.5-length(gl_PointCoord-0.5)*size,0.0,1.0)*color.a;if(al<=0.0)discard;o=vec4(color.rgb*al,al);}',
  );
  const a = gl.getAttribLocation(p, 'a');
  gl.enableVertexAttribArray(a);
  const uniform = (name: string) => gl.getUniformLocation(p, name);
  return { p, a, m: uniform('m'), dpr: uniform('dpr'), color: uniform('color') };
}

export function dots(o: DotsOptions): Mark {
  const { x, y, r, color, alpha = 1 } = o;
  const n = x.length;
  const buffers = new WeakMap<WebGL2RenderingContext, WebGLBuffer>();
  let reach = 0;
  for (let i = 0; i < n; i++) reach = Math.max(reach, r[i]!);

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
      return at < 0 ? null : { x: x[at]!, y: y[at]!, distance: Math.sqrt(best) };
    };

  const prepareGl = (view: View, { gl }: GlLayer): Prepared => {
    const u = programs.get(gl) ?? pointProgram(gl);
    programs.set(gl, u);
    // The offsets are subtracted in float64: a float32 attribute cannot hold e.g. millisecond timestamps.
    // They come from the data, not the domain, so a new view changes only the uniform and never the buffer.
    const x0 = x[0] ?? 0;
    const y0 = y[0] ?? 0;
    let buffer = buffers.get(gl);
    if (!buffer) {
      const data = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        data[3 * i] = x[i]! - x0;
        data[3 * i + 1] = y[i]! - y0;
        data[3 * i + 2] = r[i]!;
      }
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      buffers.set(gl, buffer);
    }
    const { ctx, kx, ox, ky, oy, dpr } = view;
    const [red, green, blue, opacity = 1] = rgba(ctx, color);
    return {
      // The alpha argument is unused: dense points saturate, so the layer's fade() dims a group instead.
      paint() {
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
        gl.uniform4f(u.color, red!, green!, blue!, alpha * opacity);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(u.a, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, n);
      },
      hit: hit(view),
    };
  };

  return {
    ...base('dots', o, [x], [y]),
    overhang: reach + (o.ring ?? 0) / 2,
    prepare(view) {
      const { ctx, dpr, ox, kx, oy, ky } = view;
      const path = new Path2D();
      for (let i = 0; i < n; i++) {
        const px = ox + x[i]! * kx;
        const py = oy - y[i]! * ky;
        const radius = r[i]! * dpr;
        path.moveTo(px + radius, py);
        path.arc(px, py, radius, 0, TAU);
      }
      return {
        paint(a) {
          ctx.globalAlpha = alpha * a;
          ctx.fillStyle = o.ring ? (o.fill ?? '#fff') : color;
          ctx.fill(path);
          if (!o.ring) return;
          ctx.strokeStyle = color;
          ctx.lineWidth = o.ring * dpr;
          ctx.stroke(path);
        },
        hit: hit(view),
      };
    },
    gl: o.ring ? undefined : { layer: glLayer, prepare: prepareGl },
    release(layer) {
      const buffer = layer && buffers.get(layer.gl);
      if (!buffer) return;
      layer.gl.deleteBuffer(buffer);
      buffers.delete(layer.gl);
    },
  };
}
