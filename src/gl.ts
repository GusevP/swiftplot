import type { GlLayer } from './types.js';

export function program(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const p = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, '#version 300 es\n' + src);
    gl.compileShader(s);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  return p;
}

export function glLayer(canvas: HTMLCanvasElement): GlLayer | null {
  const gl = canvas.getContext('webgl2', { antialias: false });
  if (!gl) return null;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const fade = program(
    gl,
    'void main(){gl_Position=vec4(float((gl_VertexID<<1)&2)*2.0-1.0,float(gl_VertexID&2)*2.0-1.0,0,1);}',
    'precision mediump float;uniform float k;out vec4 o;void main(){o=vec4(0,0,0,k);}',
  );
  const fadeK = gl.getUniformLocation(fade, 'k');
  return {
    gl,
    clear() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    fade(k) {
      gl.useProgram(fade);
      gl.uniform1f(fadeK, k);
      gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    },
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** A CSS colour as red, green, blue and opacity from 0 to 1. */
export function rgba(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  const css = ctx.fillStyle as string;
  // An opaque sRGB colour comes back as #rrggbb; anything else is read from a painted pixel, which costs more.
  if (css.startsWith('#')) return [1, 3, 5].map(i => parseInt(css.slice(i, i + 2), 16) / 255).concat(1);
  const c = new OffscreenCanvas(1, 1).getContext('2d')!;
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  return [...c.getImageData(0, 0, 1, 1).data].map(v => v / 255);
}
