import { glLayer, program, rgba } from '../gl.js';
import type { Col, GlLayer, Label, Mark, Prepared, View } from '../types.js';

/**
 * Nodes in columns with a ribbon for each link, as wide as the link's value, for a blank frame.
 * `source` and `target` hold the places of nodes in `nodes`; see fromLinks() for links given by
 * name. A node is as tall as the larger of what flows in and what flows out. A link whose value
 * is negative or not a number counts as 0. Rows are the nodes first, then the links, so a hit on
 * link i has the row nodes.length + i. Pointing at a node or a link also picks out all that flows
 * into it and out of it, through links that carry something. A link to an unknown node, a link from a node to itself,
 * and a cycle throw.
 * ponytail: a node sits one column after its furthest source, and each column is ordered by one
 * sweep forwards and one back; more sweeps or a relaxation when crossings matter. A pointer move
 * checks the bounds of every link; an index when a diagram has millions. From 1,000 nodes and
 * links together the diagram is drawn by WebGL, where one is as quick to paint as another.
 */
export type SankeyOptions = {
  nodes: string[];
  source: Col;
  target: Col;
  value: Col;
  colors: string[];
  /** Node names beside the nodes; true by default. */
  text?: boolean;
  alpha?: number;
  key?: string;
  label?: string;
  group?: string;
};

// Canvas fills a ribbon at a time, and from about here a hover takes longer than a frame.
const GL_FROM = 1000;
const SEGMENTS = 24;
const programs = new WeakMap<WebGL2RenderingContext, ReturnType<typeof ribbonProgram>>();

// An instance is a ribbon from (e.x, e.z) to (e.y, e.w), h tall, bent as the canvas bezier is. Each
// pixel is as strong as the share of it the ribbon covers. Under an eighth of a pixel that is too
// faint for the canvas to add up, so such a ribbon is drawn an eighth thick or not at all, as
// often as keeps the whole as strong; one on the path pointed at is always drawn.
function ribbonProgram(gl: WebGL2RenderingContext) {
  const p = program(
    gl,
    `layout(location=0) in vec4 e;layout(location=1) in float h;layout(location=2) in vec4 c;layout(location=3) in float s;uniform vec2 size;uniform float lit;out vec4 col;out vec2 v;void main(){float t=float(gl_VertexID>>1)/${SEGMENTS}.0;float side=float(gl_VertexID&1)*2.0-1.0;float w=1.0-t;float x=e.x*w*w*w+(e.x+e.y)*1.5*w*t+e.y*t*t*t;uint z=uint(gl_InstanceID)*2654435761u;z^=z>>15;float d=h;if(h>0.0&&h<0.125)d=s>=lit||float(z&65535u)/65536.0<h*8.0?0.125:0.0;float r=d*0.5+0.5;float y=mix(e.z,e.w,t*t*(3.0-2.0*t))+d*0.5+side*r;gl_Position=vec4(x/size.x*2.0-1.0,1.0-y/size.y*2.0,0,1);col=vec4(c.rgb,1)*c.a*s;v=vec2(side*r,d*0.5);}`,
    'precision highp float;in vec4 col;in vec2 v;out vec4 o;void main(){o=col*clamp(min(v.y,v.x+0.5)-max(-v.y,v.x-0.5),0.0,1.0);}',
  );
  return { p, size: gl.getUniformLocation(p, 'size'), lit: gl.getUniformLocation(p, 'lit') };
}

/** The columns sankey() takes, from links that name their ends. Nodes are listed as first met. */
export function fromLinks(links: { source: string; target: string; value: number }[]) {
  const place = new Map<string, number>();
  const at = (name: string) => {
    if (!place.has(name)) place.set(name, place.size);
    return place.get(name)!;
  };
  const [source, target, value]: number[][] = [[], [], []];
  for (const link of links) {
    source!.push(at(link.source));
    target!.push(at(link.target));
    value!.push(link.value);
  }
  return { nodes: [...place.keys()], source: source!, target: target!, value: value! };
}

export function sankey(o: SankeyOptions): Mark {
  const { nodes, source, target, colors, alpha = 1 } = o;
  const [n, links] = [nodes.length, source.length];
  const named = (i: number) => nodes[i] ?? `#${i}`;
  for (let i = 0; i < links; i++) {
    for (const end of [source[i]!, target[i]!]) {
      if (!Number.isInteger(end) || end < 0 || end >= n)
        throw new Error(`sankey: link ${i} names node ${end}, and there are ${n}`);
    }
    if (source[i] === target[i]) throw new Error(`sankey: ${named(source[i]!)} links to itself`);
  }
  // Values are taken as shares of the largest, so that sums of them cannot overflow.
  let most = 0;
  const worth = (i: number) => (o.value[i]! > 0 && Number.isFinite(o.value[i]) ? o.value[i]! : 0);
  for (let i = 0; i < links; i++) most = Math.max(most, worth(i));
  const value = Float64Array.from({ length: links }, (_, i) => worth(i) / (most || 1));

  // Each node's links, listed once, so that nothing below looks through all links per node.
  const [into, outOf] = [nodes.map((): number[] => []), nodes.map((): number[] => [])];
  for (let i = 0; i < links; i++) {
    outOf[source[i]!]!.push(i);
    into[target[i]!]!.push(i);
  }
  // A column for each node: one after its furthest source. What is left when no node is free of
  // unplaced sources is fed by a cycle.
  const column = new Int32Array(n);
  const waiting = Int32Array.from(into, list => list.length);
  const ready = Array.from({ length: n }, (_, i) => i).filter(i => !waiting[i]);
  for (let done = 0; done < ready.length; done++) {
    const from = ready[done]!;
    for (const i of outOf[from]!) {
      const to = target[i]!;
      column[to] = Math.max(column[to]!, column[from]! + 1);
      if (!--waiting[to]!) ready.push(to);
    }
  }
  if (ready.length < n) {
    // Every unplaced node has an unplaced source; walking back along those must come round.
    const back = (node: number) => source[into[node]!.find(i => waiting[source[i]!])!]!;
    const seen = new Set<number>();
    let node = waiting.findIndex(w => w > 0);
    while (!seen.has(node)) {
      seen.add(node);
      node = back(node);
    }
    const circle = [node];
    for (let next = back(node); next !== node; next = back(next)) circle.unshift(next);
    throw new Error(`sankey: the links go round in a circle through ${circle.map(named).join(', ')}`);
  }
  const size = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const total = (list: number[]) => list.reduce((sum, link) => sum + value[link]!, 0);
    size[i] = Math.max(total(into[i]!), total(outOf[i]!));
  }
  const columns: number[][] = [];
  for (let i = 0; i < n; i++) (columns[column[i]!] ??= []).push(i);
  // Order within a column: by where a node's neighbours on one side sit, weighted by the flow.
  const place = new Float64Array(n);
  const settle = (c: number[]) => c.forEach((node, k) => (place[node] = k));
  const order = (c: number[], near: number[][], far: Col) => {
    const pull = (node: number) => {
      let [sum, weight] = [0, 0];
      for (const i of near[node]!) {
        sum += place[far[i]!]! * value[i]!;
        weight += value[i]!;
      }
      return weight ? sum / weight : place[node]!;
    };
    const pulls = new Map(c.map(node => [node, pull(node)]));
    c.sort((a, b) => pulls.get(a)! - pulls.get(b)! || a - b);
    settle(c);
  };
  columns.forEach(settle);
  for (const c of columns) order(c, into, source);
  for (const c of [...columns].reverse()) order(c, outOf, target);
  const shade = (i: number) => colors[i % colors.length] ?? '#888';
  const holds = new WeakMap<
    WebGL2RenderingContext,
    { vao: WebGLVertexArrayObject; buffers: WebGLBuffer[] }
  >();
  // What lights up with a row: all that flows into it and all that flows out of it, however
  // many nodes away. For a link that is what feeds its source and what its target feeds.
  let lit: { row?: number; rows: Set<number> } = { rows: new Set() };
  const along = (row: number) => {
    if (lit.row === row) return lit.rows;
    const rows = new Set([row]);
    const walk = (from: number, near: number[][], far: Col) => {
      const todo = [from];
      rows.add(from);
      for (let node = todo.pop(); node !== undefined; node = todo.pop()) {
        for (const i of near[node]!) {
          if (!value[i]) continue;
          rows.add(n + i);
          if (!rows.has(far[i]!)) todo.push(far[i]!);
          rows.add(far[i]!);
        }
      }
    };
    walk(row < n ? row : source[row - n]!, into, source);
    walk(row < n ? row : target[row - n]!, outOf, target);
    lit = { row, rows };
    return rows;
  };

  const strength = (k: number, row: number | undefined, rest: number, mine: number) =>
    alpha * k * (row === undefined || along(row).has(mine) ? 1 : rest);
  // Where everything sits in a view: what both the canvas and the WebGL painting draw and hit.
  const lay = ({ ctx, dpr, left, top, width, height }: View) => {
    // Nodes and the gaps between them give way before they crowd out the flows: a node is at
    // most half its column's share of the width, and the gaps in the fullest column a third
    // of the height.
    const fullest = columns.reduce((most, c) => Math.max(most, c.length), 1);
    const thick = Math.min(12 * dpr, width / (2 * Math.max(columns.length, 1)));
    const gap = Math.min(10 * dpr, height / 3 / Math.max(fullest - 1, 1));
    // One scale for every column: the tightest column decides it.
    let scale = Infinity;
    for (const c of columns) {
      const total = c.reduce((sum, node) => sum + size[node]!, 0);
      if (total) scale = Math.min(scale, Math.max(0, height - gap * (c.length - 1)) / total);
    }
    if (!Number.isFinite(scale)) scale = 0;
    const step = columns.length > 1 ? (width - thick) / (columns.length - 1) : 0;
    const [x, y] = [new Float64Array(n), new Float64Array(n)];
    for (const [k, c] of columns.entries()) {
      const used = c.reduce((sum, node) => sum + size[node]! * scale, 0) + gap * (c.length - 1);
      let at = top + (height - used) / 2;
      for (const node of c) {
        [x[node], y[node]] = [left + k * step, at];
        at += size[node]! * scale + gap;
      }
    }
    // A node's links leave and arrive stacked in the order of the nodes at their other end.
    const [leaves, arrives] = [new Float64Array(n), new Float64Array(n)];
    const byEnds = Array.from({ length: links }, (_, i) => i).sort(
      (a, b) => y[source[a]!]! - y[source[b]!]! || y[target[a]!]! - y[target[b]!]! || a - b,
    );
    // The top of each link's ribbon where it leaves and where it arrives.
    const tops = new Float64Array(links * 2);
    for (const i of byEnds) {
      const [s, t, h] = [source[i]!, target[i]!, value[i]! * scale];
      tops.set([y[s]! + leaves[s]!, y[t]! + arrives[t]!], i * 2);
      leaves[s]! += h;
      arrives[t]! += h;
    }
    const trace = (i: number) => {
      const [x0, x1, h] = [x[source[i]!]! + thick, x[target[i]!]!, value[i]! * scale];
      const [y0, y1, bend] = [tops[i * 2]!, tops[i * 2 + 1]!, (x0 + x1) / 2];
      if (!h) return undefined;
      const path = new Path2D();
      path.moveTo(x0, y0);
      path.bezierCurveTo(bend, y0, bend, y1, x1, y1);
      path.lineTo(x1, y1 + h);
      path.bezierCurveTo(bend, y1 + h, bend, y0 + h, x0, y0 + h);
      path.closePath();
      return path;
    };
    const labels: Label[] = [];
    for (let i = 0; o.text !== false && i < n; i++) {
      const last = column[i] === columns.length - 1 && columns.length > 1;
      labels.push({
        x: last ? x[i]! - 6 * dpr : x[i]! + thick + 6 * dpr,
        y: y[i]! + (size[i]! * scale) / 2,
        text: named(i),
        align: last ? 'end' : 'start',
        priority: size[i],
      });
    }
    // A node with any flow keeps a pixel of height, and is drawn and hit as the same rectangle.
    const tall = (i: number) => (size[i] ? Math.max(size[i]! * scale, 1) : 0);
    const frac = (px: number, py: number) => ({ x: (px - left) / width, y: 1 - (py - top) / height });
    // A node before a link; a link the pointer is in before one it is only near. A thin link
    // answers from 3 px either side, since its true width may be less than a pixel.
    const hit =
      (shape: (i: number) => Path2D | undefined): Prepared['hit'] =>
      (px, py, reach) => {
        const [hx, hy] = [px * dpr, py * dpr];
        if (hx < left || hx > left + width || hy < top || hy > top + height) return null;
        for (let i = n - 1; i >= 0; i--) {
          if (hx >= x[i]! && hx < x[i]! + thick && hy >= y[i]! && hy < y[i]! + tall(i)) {
            return {
              ...frac(x[i]! + thick / 2, y[i]! + (size[i]! * scale) / 2),
              distance: reach,
              row: i,
              color: shade(i),
            };
          }
        }
        ctx.lineWidth = 6 * dpr;
        for (const near of [0, 3 * dpr]) {
          for (let i = links - 1; i >= 0; i--) {
            // Only a ribbon whose bounds hold the pointer has its shape asked, which costs far more.
            const [x0, x1, h] = [x[source[i]!]! + thick, x[target[i]!]!, value[i]! * scale];
            const [y0, y1] = [tops[i * 2]!, tops[i * 2 + 1]!];
            if (!h || hx < x0 - near || hx > x1 + near) continue;
            if (hy < Math.min(y0, y1) - near || hy > Math.max(y0, y1) + h + near) continue;
            const path = shape(i)!;
            if (!(near ? ctx.isPointInStroke(path, hx, hy) : ctx.isPointInPath(path, hx, hy))) continue;
            return {
              ...frac((x0 + x1) / 2, (y0 + y1 + h) / 2),
              distance: reach,
              row: n + i,
              color: shade(source[i]!),
            };
          }
        }
        return null;
      };
    return { x, y, thick, scale, tops, labels, tall, trace, hit };
  };

  // Every ribbon and node is one instance of a strip whose curve the vertex shader works out,
  // so a view costs one small upload and a hover one float per instance.
  const prepareGl = (view: View, { gl }: GlLayer): Prepared => {
    const { x, y, thick, scale, tops, labels, tall, trace, hit } = lay(view);
    const u = programs.get(gl) ?? ribbonProgram(gl);
    programs.set(gl, u);
    const count = links + n;
    const place = new Float32Array(count * 5);
    const tone = new Uint8Array(count * 4);
    const tones = (colors.length ? colors : ['#888']).map(c =>
      rgba(view.ctx, c).map(v => Math.round(v * 255)),
    );
    for (let i = 0; i < links; i++) {
      place.set(
        [x[source[i]!]! + thick, x[target[i]!]!, tops[i * 2]!, tops[i * 2 + 1]!, value[i]! * scale],
        i * 5,
      );
      tone.set(tones[source[i]! % tones.length]!, i * 4);
    }
    for (let i = 0; i < n; i++) {
      place.set([x[i]!, x[i]! + thick, y[i]!, y[i]!, tall(i)], (links + i) * 5);
      tone.set(tones[i % tones.length]!, (links + i) * 4);
    }
    let held = holds.get(gl);
    if (!held)
      holds.set(
        gl,
        (held = { vao: gl.createVertexArray(), buffers: [0, 1, 2].map(() => gl.createBuffer()) }),
      );
    gl.bindVertexArray(held.vao);
    const column = (
      at: number,
      buffer: WebGLBuffer,
      data: ArrayBufferView,
      parts: [number, number, number][],
    ) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const float = data instanceof Float32Array;
      const stride = parts.reduce((sum, p) => sum + p[1], 0) * (float ? 4 : 1);
      for (const [slot, length, offset] of parts) {
        gl.enableVertexAttribArray(at + slot);
        gl.vertexAttribPointer(
          at + slot,
          length,
          float ? gl.FLOAT : gl.UNSIGNED_BYTE,
          !float,
          stride,
          offset,
        );
        gl.vertexAttribDivisor(at + slot, 1);
      }
    };
    column(0, held.buffers[0]!, place, [
      [0, 4, 0],
      [1, 1, 16],
    ]);
    column(2, held.buffers[1]!, tone, [[0, 4, 0]]);
    const strengths = new Float32Array(count);
    column(3, held.buffers[2]!, strengths, [[0, 1, 0]]);
    gl.bindVertexArray(null);
    let drawn = '';
    return {
      labels,
      paint(k, row, rest = 1) {
        const { vao, buffers } = held;
        if (drawn !== (drawn = `${k} ${row} ${rest}`)) {
          for (let i = 0; i < links; i++) strengths[i] = strength(k, row, rest, n + i) * 0.45;
          for (let i = 0; i < n; i++) strengths[links + i] = strength(k, row, rest, i);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffers[2]!);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, strengths);
        }
        gl.useProgram(u.p);
        gl.uniform2f(u.size, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(u.lit, row === undefined ? 2 : alpha * k * 0.45 * 0.999);
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * (SEGMENTS + 1), count);
        gl.bindVertexArray(null);
      },
      hit: hit(trace),
    };
  };

  return {
    type: 'sankey',
    key: o.key,
    label: o.label,
    group: o.group ?? o.label,
    color: shade(0),
    options: o,
    points: n + links,
    channels: { x: [], y: [] },
    prepare(view) {
      const { ctx } = view;
      const { x, y, thick, labels, tall, trace, hit } = lay(view);
      const ribbons = Array.from({ length: links }, (_, i) => trace(i));
      return {
        labels,
        paint(k, row, rest = 1) {
          ribbons.forEach((path, i) => {
            if (!path) return;
            ctx.globalAlpha = strength(k, row, rest, n + i) * 0.45;
            ctx.fillStyle = shade(source[i]!);
            ctx.fill(path);
          });
          for (let i = 0; i < n; i++) {
            ctx.globalAlpha = strength(k, row, rest, i);
            ctx.fillStyle = shade(i);
            ctx.fillRect(x[i]!, y[i]!, thick, tall(i));
          }
        },
        hit: hit(i => ribbons[i]),
      };
    },
    gl: { layer: glLayer, from: GL_FROM, prepare: prepareGl },
    release(layer) {
      const held = layer && holds.get(layer.gl);
      if (!held) return;
      layer.gl.deleteVertexArray(held.vao);
      for (const buffer of held.buffers) layer.gl.deleteBuffer(buffer);
      holds.delete(layer.gl);
    },
  };
}
