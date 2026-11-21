import { program, rgba } from '../gl.js';
import type { Col, View } from '../types.js';

const programs = new WeakMap<WebGL2RenderingContext, ReturnType<typeof rectProgram>>();

// An instance is a rectangle between two x and two y in data units, which `m` takes to device
// pixels; `box` then moves it and grows it by pixels, which is how a stem or a cap is made of a point.
// `ramp` blends `color` into `far` across each rectangle or down it; down one that stands on a
// baseline, it runs from the value end, which is the bottom of one below the baseline.
function rectProgram(gl: WebGL2RenderingContext) {
  const p = program(
    gl,
    'layout(location=0) in float xa;layout(location=1) in float xb;layout(location=2) in float ya;layout(location=3) in float yb;uniform vec4 m;uniform vec4 box;uniform vec2 size;uniform float snap;uniform vec2 ramp;out vec2 q;void main(){float x0=min(xa,xb)*m.x+m.y;float x1=max(xa,xb)*m.x+m.y;float y0=m.w-max(ya,yb)*m.z;float y1=m.w-min(ya,yb)*m.z;if(snap>0.5){x0=floor(x0+0.5);y0=floor(y0+0.5);x1=max(floor(x1+0.5),x0+float(xa!=xb));y1=max(floor(y1+0.5),y0+float(ya!=yb));}x0+=box.x-box.z;x1=max(x1+box.x+box.z,x0);y0+=box.y-box.w;y1=max(y1+box.y+box.w,y0);vec2 p=vec2((gl_VertexID&1)==0?x0:x1,(gl_VertexID&2)==0?y0:y1);q=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1));if(ramp.y>0.5&&yb<ya)q.y=1.0-q.y;gl_Position=isnan(xa+xb+ya+yb)?vec4(2,2,2,1):vec4(p.x/size.x*2.0-1.0,1.0-p.y/size.y*2.0,0,1);}',
    'precision highp float;uniform vec4 color;uniform vec4 far;uniform vec2 ramp;in vec2 q;out vec4 o;void main(){o=ramp.x<0.0?color:mix(color,far,ramp.x<0.5?q.x:q.y);}',
  );
  const at = (name: string) => gl.getUniformLocation(p, name);
  return {
    p,
    m: at('m'),
    box: at('box'),
    size: at('size'),
    snap: at('snap'),
    color: at('color'),
    far: at('far'),
    ramp: at('ramp'),
  };
}

/** Two colours as red, green, blue and opacity, blended across each rectangle or down it; `based` starts it at the value end. */
export type Blend = { stops: number[][]; upright: boolean; based: boolean };

type Held = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer };

/** Which columns give a rectangle its two x and two y, and how it is moved and grown in device pixels. */
export type Part = {
  xa: number;
  xb: number;
  ya: number;
  yb: number;
  shift?: [number, number];
  pad?: [number, number];
  /** Edges rounded to device pixels, and a pixel kept of any side that has a length. */
  snap?: boolean;
  alpha?: number;
};

/**
 * The columns of a mark as rows on the GPU, one row per item, uploaded once: a view changes only
 * what the rows are multiplied by. `x` and `y` are numbered together, x first; a column left
 * out stands for zero. A row with a number missing draws nothing.
 */
export function gpuRows(
  holds: WeakMap<WebGL2RenderingContext, Held>,
  x: (Col | undefined)[],
  y: (Col | undefined)[],
) {
  const columns = [...x, ...y];
  const kept = columns.flatMap((c, at) => (c ? [at] : []));
  const n = columns[kept[0] ?? 0]?.length ?? 0;
  // Offsets are subtracted in float64: a float32 cannot hold e.g. millisecond timestamps.
  const first = (list: (Col | undefined)[]) => {
    const v = list.find(c => c)?.[0];
    return Number.isFinite(v) ? v! : 0;
  };
  const [x0, y0] = [first(x), first(y)];
  const zero = (at: number) => (at < x.length ? x0 : y0);
  return {
    release(gl: WebGL2RenderingContext) {
      const held = holds.get(gl);
      if (!held) return;
      gl.deleteVertexArray(held.vao);
      gl.deleteBuffer(held.buffer);
      holds.delete(gl);
    },
    /**
     * A painter for one view. draw(part, strength, from, count) fills `count` rows from `from`;
     * once(draws) runs draws so that a pixel takes only the first rectangle to reach it, as one
     * filled path would, and nothing shows further than `overhang` CSS pixels past the plot area.
     */
    on(
      { ctx, dpr, ox, kx, oy, ky, left, top, width, height }: View,
      gl: WebGL2RenderingContext,
      color: string,
      overhang = 0,
      blend?: Blend,
    ) {
      const u = programs.get(gl) ?? rectProgram(gl);
      programs.set(gl, u);
      let held = holds.get(gl);
      if (!held) {
        holds.set(gl, (held = { vao: gl.createVertexArray(), buffer: gl.createBuffer() }));
        const data = new Float32Array(n * kept.length);
        for (let i = 0, j = 0; i < n; i++) {
          const whole = kept.every(at => Number.isFinite(columns[at]![i]));
          for (const at of kept) data[j++] = whole ? columns[at]![i]! - zero(at) : NaN;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, held.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      }
      const { vao, buffer } = held;
      const [red, green, blue, opacity = 1] = rgba(ctx, color);
      const draw = (part: Part, strength: number, from = 0, count = n) => {
        if (count <= 0) return;
        gl.useProgram(u.p);
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        [part.xa, part.xb, part.ya, part.yb].forEach((at, slot) => {
          const place = kept.indexOf(at);
          gl.vertexAttribDivisor(slot, 1);
          if (place < 0) {
            gl.disableVertexAttribArray(slot);
            gl.vertexAttrib1f(slot, -zero(at));
            return;
          }
          gl.enableVertexAttribArray(slot);
          gl.vertexAttribPointer(slot, 1, gl.FLOAT, false, kept.length * 4, (from * kept.length + place) * 4);
        });
        gl.uniform4f(u.m, kx, ox + x0 * kx, ky, oy - y0 * ky);
        gl.uniform4f(u.box, ...(part.shift ?? [0, 0]), ...(part.pad ?? [0, 0]));
        gl.uniform2f(u.size, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(u.snap, +!!part.snap);
        const a = strength * (blend ? 1 : opacity) * (part.alpha ?? 1);
        const lit = ([r, g, b, alpha = 1]: number[]) =>
          [r! * alpha * a, g! * alpha * a, b! * alpha * a, alpha * a] as const;
        gl.uniform4f(u.color, ...lit(blend ? blend.stops[0]! : [red!, green!, blue!]));
        gl.uniform4f(u.far, ...lit(blend ? blend.stops[1]! : [0, 0, 0, 0]));
        gl.uniform2f(u.ramp, blend ? +blend.upright : -1, +!!blend?.based);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        gl.bindVertexArray(null);
      };
      const once = (draws: () => void) => {
        const over = overhang * dpr;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(left - over, gl.canvas.height - top - height - over, width + 2 * over, height + 2 * over);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        draws();
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.SCISSOR_TEST);
      };
      return { draw, once };
    },
  };
}

/** The runs of rows and their strengths when one row is focused: that row first, so that it is the one a pixel keeps. */
export function focused(
  n: number,
  row: number | undefined,
  rest: number,
): [strength: number, from: number, count: number][] {
  if (row === undefined || row >= n) return [[1, 0, n]];
  return [
    [1, row, 1],
    [rest, 0, row],
    [rest, row + 1, n - row - 1],
  ];
}
