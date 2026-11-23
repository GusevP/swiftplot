import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';

import {
  animate,
  arcs,
  area,
  band,
  bands,
  bare,
  brand,
  brush,
  dark,
  gradient,
  bar,
  bin,
  box,
  dots,
  errorBars,
  fiveNumbers,
  fromLinks,
  fromTree,
  funnel,
  heatmap,
  legend,
  light,
  line,
  log,
  paletteDark,
  plot,
  radar,
  radialBars,
  rule,
  sankey,
  sequential,
  stack,
  sunburst,
  time,
  tooltip,
  treemap,
  zone,
  zoom,
} from '../src/index.js';
import type { Axis, Col, Internals, Mark, Options } from '../src/index.js';
import type { GlLayer } from '../src/types.js';
import { columns, span, type Curve } from '../src/marks/common.js';
import { scale } from '../src/scale.js';
import {
  host,
  pixel,
  hover,
  touch,
  at,
  wheel,
  press,
  release,
  drag,
  click,
  doubleClick,
  pinch,
  tap,
  entriesOf,
  middleOf,
  nextFrame,
  tipOf,
} from './helpers.js';

const RED = '#ff0000';
const frame = {
  width: 100,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  x: { domain: [0, 10], label: '' },
  y: { domain: [0, 1], label: '' },
} satisfies Partial<Options>;
const { width: _w, height: _h, ...unsized } = frame;

const flat = (y: number) => line({ x: [0, 10], y: [y, y], curve: 'step', color: RED, width: 4 });
const pile = (n: number, color = RED) =>
  dots({
    x: new Float64Array(n).fill(5),
    y: new Float64Array(n).fill(0.5),
    r: new Float64Array(n).fill(3),
    color,
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

test('columns keeps the min, max and last y of each pixel column', () => {
  const c = columns([0, 0.1, 0.2, 5], [1, 9, 4, 2], 0, 1, 10, 1);
  expect(c.n).toBe(2);
  expect([...c.col.subarray(0, 2)]).toEqual([0, 5]);
  expect([...c.lo.subarray(0, 2)]).toEqual([1, 8]);
  expect([...c.hi.subarray(0, 2)]).toEqual([9, 8]);
  expect([...c.last.subarray(0, 2)]).toEqual([6, 8]);
  expect([...columns([0, 0.1, 0.2, 5], [1, 9, 4, 2], 0, 1, 10, 1, true).first.subarray(0, 2)]).toEqual([
    9, 8,
  ]);
});

test('columns ends a run at a value that is not finite, splitting the pixel column it falls in', () => {
  const x = [0, 0.1, 0.2, 1, 1.1, 1.2, 2, 2.1, 3, 3.1, 4];
  const y = [NaN, 9, 4, 5, NaN, 7, 3, NaN, Infinity, NaN, 2];
  const c = columns(x, y, 0, 1, 10, 1, true);
  expect(c.n).toBe(5);
  expect(c.runs).toEqual([
    [0, 2, 3, false],
    [2, 4, 2, false],
    [4, 5, 1, false],
  ]);
  expect([...c.col.subarray(0, 5)]).toEqual([0, 1, 1, 2, 4]);
  expect([...c.lo.subarray(0, 5)]).toEqual([1, 5, 3, 7, 8]);
  expect([...c.hi.subarray(0, 5)]).toEqual([6, 5, 3, 7, 8]);
  expect([...c.first.subarray(0, 5)]).toEqual([1, 5, 3, 7, 8]);
  expect([...c.last.subarray(0, 5)]).toEqual([6, 5, 3, 7, 8]);
  expect(columns([0, 1, 2], [1, 1, 1], 0, 1, 10, 1, false, [0, NaN, 0]).runs).toEqual([
    [0, 1, 1, false],
    [1, 2, 1, false],
  ]);
  expect(
    columns([0, 1, 2, 3], [1, 1, NaN, 1], 0, 1, 10, 1, false, undefined, undefined, new Set([0])).runs,
  ).toEqual([
    [0, 1, 1, false],
    [1, 2, 1, true],
    [2, 3, 1, false],
  ]);
  expect(columns([0, 1], [NaN, NaN], 0, 1, 10, 1)).toMatchObject({ n: 0, runs: [] });
});

test('a nice domain widens to whole steps and an explicit one is kept', () => {
  expect(scale('nice', [3, 97])).toEqual({
    lo: 0,
    hi: 100,
    ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  });
  expect(scale([0, 1], [5, 50])).toEqual({
    lo: 0,
    hi: 1,
    ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  });
});

test('a step line holds the previous sample and has none before the first', () => {
  const mark = line({ x: [1, 2, 3], y: [10, 20, 30], curve: 'step', color: RED });
  expect(mark.sampleAtX!(0.5)).toBeUndefined();
  expect(mark.sampleAtX!(2.5)).toBe(20);
  expect(mark.sampleAtX!(3)).toBe(30);
});

test('a line is drawn where the scales put it, and moves when the domain changes', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [flat(0.5)],
  });
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 25)[3]).toBe(0);

  chart.update({ y: { domain: [0, 2], label: '' } });
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 50)).not.toEqual([255, 0, 0, 255]);

  chart.destroy();
  expect(el.childElementCount).toBe(0);
});

test('a chart without a size fills its container and follows it', async () => {
  const el = host();
  el.style.cssText = 'width:300px;height:200px';
  plot(el, { ...unsized, marks: [flat(0.5)] });
  expect(pixel(el, 150, 100)).toEqual([255, 0, 0, 255]);

  el.style.cssText = 'width:400px;height:300px';
  await expect.poll(() => pixel(el, 350, 150)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 150, 100)[3]).toBe(0);
});

/** Mounts a chart with no size in `inner`, placed in `outer` when given, and returns its canvas size on three frames. */
async function framesOf(outerCss: string | undefined, innerCss: string) {
  const outer = host();
  const el = outerCss === undefined ? outer : outer.appendChild(document.createElement('div'));
  if (outerCss !== undefined) outer.style.cssText = outerCss;
  el.style.cssText = innerCss;
  plot(el, { ...unsized, marks: [flat(0.5)] });
  const canvas = el.querySelector('canvas')!;
  const sizes: string[] = [];
  for (let i = 0; i < 3; i++) {
    await new Promise(requestAnimationFrame);
    sizes.push(`${canvas.style.width}x${canvas.style.height}`);
  }
  return { outer, el, canvas, sizes };
}

test('a chart without a size keeps the size of a flex item, a grid cell or a percent height', async () => {
  const flexed = await framesOf('display:flex;width:300px;height:200px', 'flex:1');
  expect(flexed.sizes).toEqual(['300pxx200px', '300pxx200px', '300pxx200px']);
  const grid = await framesOf('display:grid;grid-template-rows:1fr;width:300px;height:200px', '');
  expect(grid.sizes).toEqual(['300pxx200px', '300pxx200px', '300pxx200px']);
  const percent = await framesOf('width:300px;height:200px', 'height:50%');
  expect(percent.sizes).toEqual(['300pxx100px', '300pxx100px', '300pxx100px']);
});

test('a chart without a size shrinks with a flex or grid container', async () => {
  for (const css of ['display:flex;', 'display:grid;grid-template-rows:1fr;']) {
    const { outer, canvas } = await framesOf(`${css}width:300px;height:200px`, 'flex:1');
    outer.style.cssText = `${css}width:150px;height:80px`;
    await expect.poll(() => `${canvas.style.width}x${canvas.style.height}`).toBe('150pxx80px');
    await new Promise(requestAnimationFrame);
    expect(`${canvas.style.width}x${canvas.style.height}`).toBe('150pxx80px');
  }
});

test('a chart in a container with no height stays empty, and draws once the container has one', async () => {
  const { el, canvas, sizes } = await framesOf(undefined, 'width:300px');
  expect(sizes).toEqual(['300pxx0px', '300pxx0px', '300pxx0px']);
  expect(canvas.height).toBe(0);
  el.style.height = '200px';
  await expect.poll(() => canvas.height).toBeGreaterThan(0);
  expect(pixel(el, 150, 100)).toEqual([255, 0, 0, 255]);
});

test('a chart created inside display: none draws once its container is shown', async () => {
  const el = host();
  el.style.cssText = 'display:none;width:300px;height:200px';
  let chart!: Internals;
  plot(el, {
    ...unsized,
    margin: undefined,
    marks: [flat(0.5)],
    use: [c => ((chart = c), { destroy() {} })],
  });
  const root = el.firstElementChild as HTMLElement;
  expect(el.querySelector('canvas')!.width).toBe(0);
  expect(root.style.visibility).toBe('hidden');
  el.style.display = '';
  await expect.poll(() => root.style.visibility).toBe('');
  expect(pixel(el, Math.round(chart.xPx(5)), Math.round(chart.yPx(0.5)))).toEqual([255, 0, 0, 255]);
  expect([...root.children[1]!.children].map(d => d.textContent)).toContain('10');
});

test('a chart hidden and shown again keeps its marks, labels and tooltip', async () => {
  const el = host();
  el.style.cssText = 'width:300px;height:200px';
  let chart!: Internals;
  plot(el, {
    ...unsized,
    margin: undefined,
    marks: [flat(0.25), dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'A' })],
    use: [tooltip({ mode: 'nearest', text: label => `tip ${label}` }), c => ((chart = c), { destroy() {} })],
  });
  const canvas = el.querySelector('canvas')!;
  const ticks = el.firstElementChild!.children[1]!;
  const labels = () => [...ticks.children].map(d => [d.textContent, (d as HTMLElement).style.cssText]);
  const [x, line, dot] = [chart.xPx(5), chart.yPx(0.25), chart.yPx(0.5)].map(Math.round) as [
    number,
    number,
    number,
  ];
  const before = labels();
  expect(before.map(([text]) => text)).toContain('10');
  expect(pixel(el, x, line)).toEqual([255, 0, 0, 255]);

  el.style.display = 'none';
  await expect.poll(() => canvas.width).toBe(0);
  el.style.display = '';
  await expect.poll(() => canvas.width).toBeGreaterThan(0);
  expect(pixel(el, x, line)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, x, dot)).toEqual([255, 0, 0, 255]);
  expect(labels()).toEqual(before);
  expect(hover(el, x, dot).innerText).toContain('tip A');
});

test('a chart with no room for its tick labels is hidden and draws nothing, and draws once enlarged', () => {
  const long = 'a very long tick label';
  const el = host();
  let chart!: Internals;
  const c = plot(el, {
    ...frame,
    width: 40,
    height: 40,
    margin: undefined,
    marks: [flat(0.5)],
    y: { domain: [0, 1], label: '', scale: () => ({ lo: 0, hi: 1, ticks: [{ value: 0.5, label: long }] }) },
    use: [c => ((chart = c), { destroy() {} })],
  });
  const root = el.firstElementChild as HTMLElement;
  const canvas = el.querySelector('canvas')!;
  expect(chart.margin().left + chart.margin().right).toBeGreaterThanOrEqual(40);
  expect(root.style.visibility).toBe('hidden');
  expect(
    canvas
      .getContext('2d')!
      .getImageData(0, 0, canvas.width, canvas.height)
      .data.every(v => v === 0),
  ).toBe(true);

  c.update({ width: 400, height: 300 });
  expect(root.style.visibility).toBe('');
  expect(pixel(el, Math.round(chart.xPx(5)), Math.round(chart.yPx(0.5)))).toEqual([255, 0, 0, 255]);
});

test('at a fractional pixel density the canvas is rounded, not truncated, to whole device pixels', () => {
  const was = devicePixelRatio;
  try {
    for (const [dpr, width] of [
      [0.9, 101],
      [1.1, 107],
    ] as const) {
      Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
      const el = host();
      const row = 50;
      const v = 1 - (row + 0.5) / (101 * dpr);
      plot(el, {
        ...frame,
        width,
        height: 101,
        marks: [line({ x: [0, 10], y: [v, v], curve: 'step', color: RED, width: 1 / dpr })],
      });
      const canvas = el.querySelector('canvas')!;
      expect(canvas.width).toBe(Math.round(width * dpr));
      expect(canvas.height).toBe(Math.round(101 * dpr));
      expect([...canvas.getContext('2d')!.getImageData(40, row - 1, 1, 3).data]).toEqual([
        0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0,
      ]);
    }
  } finally {
    Object.defineProperty(window, 'devicePixelRatio', { value: was, configurable: true });
  }
});

test('update repaints after a resize that leaves the plot area unchanged', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [flat(0.5)],
  });
  chart.update({ width: 120, margin: { top: 0, right: 20, bottom: 0, left: 0 } });
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
});

test('update prepares a mark again only when its options or the view change', () => {
  let prepares = 0;
  const mark = (color: string, type = 'counted', options: object = { color }): Mark => ({
    type,
    color,
    options,
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => (prepares++, { paint() {} }),
  });
  const chart = plot(host(), { ...frame, marks: [mark('red')] });
  expect(prepares).toBe(1);
  chart.update({ marks: [mark('red')] });
  chart.update({ dim: 0.5 });
  expect(prepares).toBe(1);
  chart.update({ marks: [mark('blue')] });
  expect(prepares).toBe(2);
  chart.update({ width: 200 });
  expect(prepares).toBe(3);
  chart.update({ marks: [mark('blue', 'other')] });
  expect(prepares).toBe(4);
  chart.update({ marks: [mark('blue', 'other', { a: undefined })] });
  chart.update({ marks: [mark('blue', 'other', { b: undefined })] });
  expect(prepares).toBe(6);
});

test('the nearest tooltip names the point under the pointer and hides away from it', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'A' })],
    use: [tooltip({ mode: 'nearest', text: (label, x, y) => `${label} at ${x}, ${y}` })],
  });
  const root = hover(el, 55, 52);
  expect(root.innerText).toContain('A at 5, 0.5');
  hover(el, 10, 10);
  expect(root.innerText).not.toContain('A at 5, 0.5');
});

test('a tapped tooltip stays after the finger lifts, until the touch is cancelled, the page is tapped elsewhere or the chart updates', () => {
  const cases = [
    {
      marks: [dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'A' })],
      tip: tooltip({ mode: 'nearest', text: (label, x, y) => `${label} at ${x}, ${y}` }),
      at: [55, 52],
      text: 'A at 5, 0.5',
    },
    {
      marks: [line({ x: [0, 5], y: [0.2, 0.8], curve: 'step', color: RED, label: 'S' })],
      tip: tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(1) }),
      at: [70, 50],
      text: 'x=7',
    },
  ];
  for (const { marks, tip, at, text } of cases) {
    const el = host();
    const chart = plot(el, { ...frame, marks, use: [tip] });
    const root = el.firstElementChild as HTMLElement;
    const box = root.getBoundingClientRect();
    const tap = () => touch(root, box.left + at[0]!, box.top + at[1]!);
    tap();
    expect(root.innerText).toContain(text);
    root.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch' }));
    expect(root.innerText).not.toContain(text);
    tap();
    expect(root.innerText).toContain(text);
    chart.update({ dim: 0.5 });
    expect(root.innerText).not.toContain(text);
    tap();
    expect(root.innerText).toContain(text);
    const control = host();
    control.addEventListener('pointerdown', e => e.stopPropagation());
    control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    expect(root.innerText).not.toContain(text);
    tap();
    expect(root.innerText).toContain(text);
    chart.update({ width: 200 });
    expect(root.innerText).not.toContain(text);
  }
});

test('a tapped x tooltip lets go of the line it focused when the y domain changes', () => {
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: [
      line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'aa' }),
      line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'bb' }),
    ],
    use: [
      tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(1) }),
      c => ((internals = c), { destroy() {} }),
    ],
  });
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  touch(root, box.left + 30, box.top + internals.yPx(0.75));
  expect(pixel(el, 50, internals.yPx(0.25))[3]).toBeLessThan(100);
  chart.update({ y: { domain: [0, 2], label: '' } });
  expect(root.innerText).not.toContain('x=3');
  expect(pixel(el, 50, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
});

test('dots on WebGL land on the same pixels as on canvas, also after a resize', () => {
  const el = host();
  const n = 30_000;
  const chart = plot(el, {
    ...frame,
    marks: [
      dots({
        x: new Float64Array(n).fill(5),
        y: new Float64Array(n).fill(0.5),
        r: new Float64Array(n).fill(3),
        color: RED,
      }),
    ],
  });
  expect(el.querySelectorAll('canvas')).toHaveLength(2);
  expect(pixel(el, 50, 50, 1)).toEqual([255, 0, 0, 255]);

  chart.update({ width: 200 });
  expect(pixel(el, 100, 50, 1)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 50, 1)[3]).toBe(0);
});

test('a flat series gets a domain with room around it', () => {
  expect(scale('nice', [5, 5])).toEqual({
    lo: 2.5,
    hi: 7.5,
    ticks: [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5],
  });
});

test('marks replaced while the chart is too small to draw appear when it grows back', () => {
  const el = host();
  const chart = plot(el, { ...frame, marks: [flat(0.55)] });
  chart.update({ width: 0, marks: [flat(0.25)] });
  chart.update({ width: 100 });
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 45)[3]).toBe(0);
});

test('every mark a chart has held is released once, also those replaced while it was too small to draw', () => {
  const released: string[] = [];
  const mark = (name: string): Mark => ({
    type: 'tracked',
    color: RED,
    options: { name },
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint() {} }),
    release: () => released.push(name),
  });
  const chart = plot(host(), { ...frame, marks: [mark('a')] });
  chart.update({ width: 0, marks: [mark('b')] });
  chart.update({ marks: [mark('c')] });
  expect(released).toEqual(['a', 'b']);
  chart.destroy();
  expect(released).toEqual(['a', 'b', 'c']);
});

test('axis labels move with the domain even when the ticks stay the same', () => {
  const el = host();
  const chart = plot(el, { ...frame, width: 700, x: { domain: [0.1, 9.9], label: '' }, marks: [] });
  const left = () => [...el.querySelectorAll('div')].find(e => e.textContent === '2')!.style.left;
  const before = left();
  chart.update({ x: { domain: [0.2, 9.8], label: '' } });
  expect(left()).not.toBe(before);
});

test('focus dims the other groups and does not outlive its group or a dim of 1', () => {
  const el = host();
  const dot = (x: number, label: string) => dots({ x: [x], y: [0.55], r: [3], color: RED, label });
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: [dot(2, 'A'), dot(8, 'B')],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  const root = hover(el, 20, 45);
  expect(pixel(el, 20, 45)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 80, 45)[3]).toBeLessThan(100);

  chart.update({ marks: [dot(8, 'B')] });
  expect(pixel(el, 80, 45)).toEqual([255, 0, 0, 255]);
  expect(root.innerText).not.toContain('A');

  chart.update({ marks: [dot(2, 'A'), dot(8, 'B')] });
  hover(el, 20, 45);
  chart.update({ dim: 1 });
  root.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  chart.update({ dim: 0.3 });
  expect(pixel(el, 80, 45)).toEqual([255, 0, 0, 255]);
});

test('hovering the dot of the only group dims the ungrouped marks', () => {
  const el = host();
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [
      dots({ x: [2, 6], y: [0.55, 0.55], r: [3, 3], color: RED, label: 'A' }),
      line({ x: [0, 10], y: [0.2, 0.2], color: RED }),
    ],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  const before = pixel(el, 80, 80)[3]!;
  hover(el, 20, 45);
  expect(pixel(el, 20, 45)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 60, 45)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 80, 80)[3]).toBeLessThan(before / 2);
});

test('the x tooltip lists the sample of each line at the pointer', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [line({ x: [0, 5], y: [0.2, 0.8], curve: 'step', color: RED, label: 'S' })],
    use: [tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(1) })],
  });
  const root = hover(el, 70, 50);
  expect(root.innerText).toContain('x=7');
  expect(root.innerText).toContain('S: 0.8');
  root.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  expect(root.innerText).not.toContain('x=7');
});

test('a dots mark shared by two WebGL charts survives the destruction of one', () => {
  const mark = pile(30_000);
  const first = plot(host(), { ...frame, marks: [mark] });
  const el = host();
  const second = plot(el, { ...frame, marks: [mark] });
  first.destroy();
  second.update({ dim: 0.5 });
  expect(pixel(el, 50, 50, 1)).toEqual([255, 0, 0, 255]);
});

/** The WebGL canvas of a chart, a promise of its context being lost, and a way to lose it. */
function losing(el: HTMLElement) {
  const layer = el.querySelectorAll('canvas')[1]!;
  const lost = new Promise(resolve => layer.addEventListener('webglcontextlost', resolve, { once: true }));
  const lose = () => layer.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  return { layer, lost, lose };
}

test('a chart whose WebGL context is lost draws its marks on the canvas', async () => {
  const el = host();
  plot(el, { ...frame, marks: [pile(30_000)] });
  const { layer, lost, lose } = losing(el);
  expect(pixel(el, 50, 50)).not.toEqual([255, 0, 0, 255]);
  lose();
  await lost;
  expect(layer.style.display).toBe('none');
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
});

test('a lost WebGL context releases only the marks that were on it, each once', async () => {
  const released: string[] = [];
  const kept: Mark = {
    type: 'kept',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint() {} }),
    release: () => released.push('kept'),
  };
  const piled = pile(30_000);
  const free = piled.release!.bind(piled);
  piled.release = layer => (released.push('piled'), free(layer));
  const el = host();
  const chart = plot(el, { ...frame, marks: [piled, kept] });
  const { lost, lose } = losing(el);
  lose();
  await lost;
  expect(released).toEqual(['piled']);
  chart.destroy();
  expect(released).toEqual(['piled', 'piled', 'kept']);
});

test('a lost WebGL context releases the marks that hold buffers on it, also when they are not drawn there', async () => {
  for (const hidden of [true, false]) {
    const released: string[] = [];
    const piled = pile(30_000);
    const free = piled.release!.bind(piled);
    piled.release = layer => (released.push(layer ? 'layer' : 'none'), free(layer));
    const el = host();
    const chart = plot(el, { ...frame, marks: [piled] });
    const { lost, lose } = losing(el);
    if (hidden) chart.update({ width: 0 });
    lose();
    if (!hidden) chart.update({ marks: [] });
    await lost;
    expect(released).toEqual(['layer']);
  }
});

test('a paint after a WebGL context is lost and before the event arrives draws on the canvas', async () => {
  for (const [change, x] of [
    [{ dim: 0.5 }, 50],
    [{ width: 120 }, 60],
  ] as const) {
    const el = host();
    const chart = plot(el, { ...frame, marks: [pile(30_000)] });
    const { lost, lose } = losing(el);
    lose();
    chart.update(change);
    expect(pixel(el, x, 50)).toEqual([255, 0, 0, 255]);
    await lost;
    expect(pixel(el, x, 50)).toEqual([255, 0, 0, 255]);
  }
});

test('a destroyed chart does not repaint when destroy() loses its WebGL context', async () => {
  let paints = 0;
  const counted: Mark = {
    type: 'counted',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint: () => paints++ }),
  };
  const el = host();
  const chart = plot(el, { ...frame, marks: [pile(30_000), counted] });
  const { lost } = losing(el);
  paints = 0;
  chart.destroy();
  await lost;
  expect(paints).toBe(0);
});

/** A WebGL dots mark whose layer is made by `wrap` from the usual one, and whose GPU prepare rejects a lost context. */
function wrapped(wrap: (layer: GlLayer) => GlLayer): Mark {
  const base = pile(30_000);
  const gl = base.gl!;
  return {
    ...base,
    gl: {
      ...gl,
      layer: canvas => wrap(gl.layer(canvas)!),
      prepare: (view, layer) => {
        if (layer.gl.isContextLost()) throw new Error('prepared on a lost context');
        return gl.prepare(view, layer);
      },
    },
  };
}

test('a chart whose WebGL layer comes with its context lost draws its marks on the canvas', () => {
  const el = host();
  const mark = wrapped(layer => {
    layer.gl.getExtension('WEBGL_lose_context')!.loseContext();
    return layer;
  });
  plot(el, { ...frame, marks: [mark] });
  expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('none');
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
});

test('a WebGL layer whose context is lost is destroyed once', async () => {
  let destroyed = 0;
  const mark = wrapped(layer => ({
    ...layer,
    destroy() {
      destroyed++;
      layer.destroy();
    },
  }));
  const el = host();
  const chart = plot(el, { ...frame, marks: [mark] });
  const { lost, lose } = losing(el);
  lose();
  await lost;
  chart.destroy();
  expect(destroyed).toBe(1);
});

test('every one of many WebGL charts shows its marks, and charts destroyed make room for as many new ones', async ({
  skip,
}) => {
  const task = () => new Promise(resolve => setTimeout(resolve));
  const make = (onLost: () => void) => {
    const el = host();
    const chart = plot(el, { ...frame, marks: [pile(30_000)] });
    const layer = el.querySelectorAll('canvas')[1]!;
    layer.addEventListener('webglcontextlost', onLost);
    return { el, chart, layer };
  };
  let lost = 0;
  const charts: ReturnType<typeof make>[] = [];
  while (!lost && charts.length < 40) {
    charts.push(make(() => lost++));
    await task();
  }
  if (!lost) {
    for (const { chart } of charts) chart.destroy();
    skip(
      'no WebGL context was lost after 40 charts, so the limit was not reached; the context-lost tests above cover the fallback',
    );
  }
  for (const { el, chart } of charts) {
    const layer = el.querySelectorAll('canvas')[1]!;
    if (layer.style.display === 'none') {
      expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
      continue;
    }
    chart.update({ dim: 0.5 });
    expect(pixel(el, 50, 50, layer.style.display === 'none' ? 0 : 1)).toEqual([255, 0, 0, 255]);
  }

  const fitted = charts.length - lost;
  for (const { chart } of charts) chart.destroy();
  for (const { layer } of charts) expect(layer.getContext('webgl2')!.isContextLost()).toBe(true);
  let lostAgain = 0;
  const again: ReturnType<typeof make>[] = [];
  while (again.length < fitted) {
    again.push(make(() => lostAgain++));
    await task();
  }
  expect(lostAgain).toBe(0);
  for (const { layer } of again) {
    expect(layer.style.display).toBe('');
    expect(layer.getContext('webgl2')!.isContextLost()).toBe(false);
  }
  for (const { chart } of again) chart.destroy();
});

test('WebGL dots honour a colour with alpha', () => {
  const el = host();
  const n = 30_000;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  x[0] = 5;
  y[0] = 0.5;
  plot(el, {
    ...frame,
    marks: [dots({ x, y, r: new Float64Array(n).fill(3), color: 'rgba(255, 0, 0, 0.5)' })],
  });
  const [red, , , alpha] = pixel(el, 50, 50, 1);
  expect(red).toBeGreaterThan(250);
  expect(alpha).toBeGreaterThan(120);
  expect(alpha).toBeLessThan(136);

  const other = host();
  plot(other, { ...frame, marks: [pile(30_000, 'color(srgb 1 0 0)')] });
  expect(pixel(other, 50, 50, 1)).toEqual([255, 0, 0, 255]);
});

test('WebGL dots with a missing first y still draw the later points', () => {
  const el = host();
  const n = 30_000;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  y[0] = NaN;
  [x[1], y[1]] = [5, 0.5];
  plot(el, { ...frame, marks: [dots({ x, y, r: new Float64Array(n).fill(3), color: RED })] });
  expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('');
  expect(pixel(el, 50, 50, 1)).toEqual([255, 0, 0, 255]);
});

test('dots move between canvas and WebGL as their number crosses the threshold', () => {
  const el = host();
  const chart = plot(el, { ...frame, marks: [pile(30_000)] });
  const glCanvas = el.querySelectorAll('canvas')[1]!;
  chart.update({ marks: [pile(1)] });
  expect(glCanvas.style.display).toBe('none');
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  chart.update({ marks: [pile(30_000)] });
  expect(glCanvas.style.display).toBe('');
  expect(pixel(el, 50, 50, 1)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 48)[3]).toBe(0);
});

/** 20,000 dots, one of them at (7.3, 0.5) far from the first, and a window on it magnified k times. */
function magnified() {
  const n = 20_000;
  const [x, y] = [new Float64Array(n), new Float64Array(n)];
  [x[n - 1], y[n - 1]] = [7.3, 0.5];
  const mark = dots({ x, y, r: new Float64Array(n).fill(3), color: RED });
  return { mark, at: (k: number) => ({ x: [7.3 - 5 / k, 7.3 + 5 / k] as [number, number] }) };
}

test('WebGL dots under a window magnified 1000 times are drawn where they belong', () => {
  const el = host();
  const { mark, at } = magnified();
  plot(el, { ...frame, y: bare([0, 1]), view: at(1000), marks: [mark] });
  expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('');
  expect(pixel(el, 50, 50, 1)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 46, 50, 1)[3]).toBe(0);
  expect(pixel(el, 54, 50, 1)[3]).toBe(0);
  expect(pixel(el, 50, 46, 1)[3]).toBe(0);
  expect(pixel(el, 50, 54, 1)[3]).toBe(0);
});

test('dots under a window magnified 100,000 times leave WebGL for the canvas, and come back without a release', () => {
  const el = host();
  const { mark, at } = magnified();
  let released = 0;
  const free = mark.release!.bind(mark);
  mark.release = layer => (released++, free(layer));
  const chart = plot(el, { ...frame, y: bare([0, 1]), view: at(1000), marks: [mark] });
  const glCanvas = el.querySelectorAll('canvas')[1]!;
  chart.update({ view: at(100_000) });
  expect(glCanvas.style.display).toBe('none');
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 46, 50)[3]).toBe(0);
  expect(pixel(el, 54, 50)[3]).toBe(0);
  expect(pixel(el, 50, 46)[3]).toBe(0);
  expect(pixel(el, 50, 54)[3]).toBe(0);
  chart.update({ view: at(1000) });
  expect(glCanvas.style.display).toBe('');
  expect(pixel(el, 50, 50, 1)).toEqual([255, 0, 0, 255]);
  expect(released).toBe(0);
});

test('a mark with another WebGL layer than the chart uses stays on canvas', () => {
  const calls: string[] = [];
  const other: Mark = {
    type: 'other',
    color: RED,
    options: {},
    points: 30_000,
    channels: { x: [], y: [] },
    prepare: () => (calls.push('canvas'), { paint() {} }),
    gl: { layer: () => null, prepare: () => (calls.push('gl'), { paint() {} }) },
  };
  plot(host(), { ...frame, marks: [pile(30_000), other] });
  expect(calls).toEqual(['canvas']);

  const el = host();
  plot(el, { ...frame, marks: [pile(1), other] });
  expect(el.querySelectorAll('canvas')).toHaveLength(1);
});

test('a point outside the plot area is not offered by the nearest tooltip', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [dots({ x: [-0.5], y: [0.55], r: [3], color: RED, label: 'Out' })],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(hover(el, 5, 45).innerText).not.toContain('Out');
});

test('with dim at 1 a focused group is not drawn over the marks after it', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [
      line({ x: [0, 10], y: [0.55, 0.55], curve: 'step', color: RED, width: 4, label: 'first' }),
      line({ x: [0, 10], y: [0.55, 0.55], curve: 'step', color: '#0000ff', width: 4, label: 'second' }),
    ],
    use: [tooltip({ mode: 'x', title: String, value: String })],
  });
  hover(el, 50, 45);
  chart.update({ width: 120 });
  expect(pixel(el, 50, 45)).toEqual([0, 0, 255, 255]);
});

test('the tooltip follows the pointer when an update moves the chart under it', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [flat(0.5)],
    use: [tooltip({ mode: 'x', title: String, value: String })],
  });
  const root = hover(el, 70, 50);
  const cross = [...root.querySelectorAll('div')].find(e => e.style.borderLeftStyle === 'dashed')!;
  expect(cross.style.left).toBe('70px');
  el.style.marginLeft = '20px';
  chart.update({ dim: 0.9 });
  expect(cross.style.left).toBe('50px');
});

test('a mark listed twice is released once', () => {
  let released = 0;
  const mark: Mark = {
    type: 'twice',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint() {} }),
    release: () => released++,
  };
  plot(host(), { ...frame, marks: [mark, mark] }).destroy();
  expect(released).toBe(1);
});

test('a chart too small to draw paints nothing when a feature changes the focus', () => {
  let paints = 0;
  let internals!: Internals;
  const mark = (name: string): Mark => ({
    type: 'painted',
    color: RED,
    group: name,
    options: { name },
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint: () => paints++ }),
  });
  const chart = plot(host(), {
    ...frame,
    dim: 0.3,
    marks: [mark('a')],
    use: [chart => ((internals = chart), { destroy() {} })],
  });
  chart.update({ width: 0, marks: [mark('b')] });
  paints = 0;
  internals.focus('b');
  expect(paints).toBe(0);
});

test('a line is straight between its points unless it is a step', () => {
  const el = host();
  const chart = plot(el, { ...frame, marks: [line({ x: [0, 10], y: [0, 1], color: RED, width: 4 })] });
  expect(pixel(el, 50, 50)).toEqual([255, 0, 0, 255]);
  chart.update({ marks: [line({ x: [0, 10], y: [0, 1], curve: 'step', color: RED, width: 4 })] });
  expect(pixel(el, 50, 50)).not.toEqual([255, 0, 0, 255]);
});

test('a straight line keeps a spike that falls inside one pixel column', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [line({ x: [0, 5, 5.001, 5.002, 10], y: [0.55, 0.55, 0.9, 0.55, 0.55], color: RED, width: 4 })],
  });
  expect(pixel(el, 50, 15)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 40, 15)[3]).toBe(0);
});

test('a straight line is interpolated between its samples and has no value outside them', () => {
  const mark = line({ x: [1, 3], y: [10, 30], color: RED });
  expect(mark.sampleAtX!(2)).toBe(20);
  expect(mark.sampleAtX!(3)).toBe(30);
  expect(mark.sampleAtX!(0.5)).toBeUndefined();
  expect(mark.sampleAtX!(3.5)).toBeUndefined();
});

test('an area fills from zero to y, or between y1 and y2 along straight edges', () => {
  const el = host();
  const chart = plot(el, { ...frame, marks: [area({ x: [0, 10], y: [0.5, 0.5], color: RED })] });
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 25)[3]).toBe(0);

  chart.update({ marks: [area({ x: [0, 10], y1: [0, 0.5], y2: [0.5, 1], color: RED })] });
  expect(pixel(el, 50, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 12)[3]).toBe(0);
  expect(pixel(el, 50, 88)[3]).toBe(0);
});

test('a bar covers its bounds in either order and nothing else', () => {
  const el = host();
  plot(el, {
    ...frame,
    y: { domain: [-1, 1], label: '' },
    marks: [bar({ x1: [2, 6], x2: [4, 8], y1: [0, 0], y2: [0.5, -0.5], color: RED })],
  });
  expect(pixel(el, 30, 35)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 30, 65)[3]).toBe(0);
  expect(pixel(el, 70, 65)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 70, 35)[3]).toBe(0);
  expect(pixel(el, 50, 35)[3]).toBe(0);
});

test('the nearest tooltip finds a bar under the pointer, and a dot on the bar wins over it', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      bar({ x1: [2], x2: [8], y1: [0], y2: [0.8], color: RED, label: 'bar' }),
      dots({ x: [5], y: [0.45], r: [3], color: '#0000ff', label: 'dot' }),
    ],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(hover(el, 30, 75).innerText).toContain('bar');
  expect(hover(el, 52, 57).innerText).toContain('dot');
  expect(hover(el, 90, 75).innerText).not.toContain('bar');
});

test("a 'data' domain keeps the exact extent and ticks inside it", () => {
  expect(scale('data', [3, 97])).toEqual({ lo: 3, hi: 97, ticks: [10, 20, 30, 40, 50, 60, 70, 80, 90] });
});

test('time ticks fall on calendar boundaries and name the day at midnight', () => {
  const axis = time({ label: '' });
  const hours = axis.scale!(axis, () => [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)]);
  expect(hours.ticks.map(t => t.label)).toEqual([
    'Jan 1',
    '03:00',
    '06:00',
    '09:00',
    '12:00',
    '15:00',
    '18:00',
    '21:00',
    'Jan 2',
  ]);

  const months = axis.scale!(axis, () => [Date.UTC(2025, 10, 15), Date.UTC(2026, 3, 15)]);
  expect(months.ticks.map(t => t.label)).toEqual(['Dec', '2026', 'Feb', 'Mar', 'Apr']);
  expect(months.ticks.map(t => t.value)).toEqual([11, 12, 13, 14, 15].map(m => Date.UTC(2025, m, 1)));

  const years = axis.scale!(axis, () => [Date.UTC(2023, 5, 1), Date.UTC(2029, 5, 1)]);
  expect(years.ticks.map(t => t.label)).toEqual(['2024', '2025', '2026', '2027', '2028', '2029']);
  expect(years.ticks.map(t => t.value)).toEqual(
    [2024, 2025, 2026, 2027, 2028, 2029].map(y => Date.UTC(y, 0, 1)),
  );

  const leap = axis.scale!(axis, () => [Date.UTC(2024, 1, 20), Date.UTC(2024, 2, 5)]);
  expect(leap.ticks.map(t => t.label)).toEqual([
    'Feb 21',
    'Feb 23',
    'Feb 25',
    'Feb 27',
    'Mar 1',
    'Mar 3',
    'Mar 5',
  ]);

  const early = new Date(0);
  early.setUTCFullYear(50, 0, 1);
  early.setUTCDate(15);
  const year50 = axis.scale!(axis, () => [early.getTime(), early.getTime() + 90 * 864e5]);
  expect(year50.ticks.map(t => t.label)).toEqual(['Feb', 'Mar', 'Apr']);
  expect(new Date(year50.ticks[0]!.value).getUTCFullYear()).toBe(50);

  const weeks = axis.scale!(axis, () => [Date.UTC(2026, 0, 20), Date.UTC(2026, 1, 20)]);
  expect(weeks.ticks.map(t => t.label)).toEqual(['Jan 26', 'Feb 2', 'Feb 9', 'Feb 16']);
});

// The test browser runs in America/New_York (vitest.config.ts), where clocks went back on 2024-11-03 at 06:00 UTC.
test('local time ticks keep both occurrences of the hour a clock change repeats', () => {
  const axis = time({ label: '', utc: false });
  const { ticks } = axis.scale!(axis, () => [Date.UTC(2024, 10, 3, 5, 10), Date.UTC(2024, 10, 3, 6, 40)]);
  expect(ticks.map(t => t.label)).toEqual(['01:15', '01:30', '01:45', '01:00', '01:15', '01:30']);
});

test('local time ticks sit on local clock hours', () => {
  const axis = time({ label: '', utc: false });
  const { ticks } = axis.scale!(axis, () => [Date.UTC(2026, 0, 1, 1, 20), Date.UTC(2026, 0, 2, 1, 20)]);
  expect(ticks.length).toBeGreaterThan(6);
  for (const t of ticks) {
    const d = new Date(t.value);
    expect([d.getHours() % 3, d.getMinutes()]).toEqual([0, 0]);
  }
});

const dayTicks = (from: string, to: string, length: number, utc = true) => {
  const axis = time({ label: '', utc });
  return axis.scale!(axis, () => [Date.parse(`${from}T00:00Z`), Date.parse(`${to}T00:00Z`)], {
    length,
    horizontal: true,
  });
};
const gaps = (ticks: { value: number }[]) =>
  ticks.slice(1).map((t, i) => Math.round((t.value - ticks[i]!.value) / 864e5));

test('weekly ticks fall every 7 days on Mondays, across month starts, with no label pair overlapping', () => {
  for (const [from, to, length] of [
    ['2026-06-23', '2026-08-03', 530],
    ['2026-05-01', '2026-06-10', 530],
    ['2026-01-20', '2026-03-08', 600],
  ] as const) {
    const { lo, hi, ticks } = dayTicks(from, to, length);
    expect(ticks.length, from).toBeGreaterThan(3);
    expect(new Set(gaps(ticks)), from).toEqual(new Set([7]));
    for (const t of ticks) expect(new Date(t.value).getUTCDay(), t.label).toBe(1);
    const px = length / (hi - lo);
    for (let i = 1; i < ticks.length; i++) {
      const width = Math.max(ticks[i]!.label.length, ticks[i - 1]!.label.length) * 7;
      expect((ticks[i]!.value - ticks[i - 1]!.value) * px, ticks[i]!.label).toBeGreaterThanOrEqual(width);
    }
  }
});

test('local weekly ticks fall on local Mondays at midnight across a clock change', () => {
  const { ticks } = dayTicks('2026-02-20', '2026-03-31', 530, false);
  expect(ticks.length).toBeGreaterThan(3);
  for (const t of ticks) {
    const d = new Date(t.value);
    expect([d.getDay(), d.getHours(), d.getMinutes()], t.label).toEqual([1, 0, 0]);
  }
});

test("2-day ticks stay on odd days and drop a month's last day, a day before the next month's first", () => {
  const { ticks } = dayTicks('2026-07-21', '2026-08-05', 530);
  expect(ticks.map(t => t.label)).toEqual([
    'Jul 21',
    'Jul 23',
    'Jul 25',
    'Jul 27',
    'Jul 29',
    'Aug 1',
    'Aug 3',
    'Aug 5',
  ]);
  expect(gaps(ticks)).not.toContain(1);
});

test('every 20- to 60-day window ticks every Monday or every month start, with no shorter gap', () => {
  const start = Date.UTC(2026, 4, 1);
  for (let s = 0; s + 20 <= 180; s++) {
    for (let len = 20; len <= 60 && s + len <= 180; len++) {
      const [from, to] = [s, s + len].map(d => new Date(start + d * 864e5).toISOString().slice(0, 10));
      const { ticks } = dayTicks(from!, to!, 530);
      const where = `${from}..${to}`;
      expect(ticks.length, where).toBeGreaterThan(0);
      if (len <= 56) {
        expect(ticks.length, where).toBeGreaterThan(1);
        expect(new Set(gaps(ticks)), where).toEqual(new Set([7]));
        for (const t of ticks) expect(new Date(t.value).getUTCDay(), where).toBe(1);
      } else {
        for (const t of ticks) expect(new Date(t.value).getUTCDate(), where).toBe(1);
        const months = ticks.map(t => new Date(t.value).getUTCMonth());
        expect(months, where).toEqual(months.map((_, i) => months[0]! + i));
      }
    }
  }
});

test('a step puts ticks on its multiples, rounds a nice domain to them and thins to every k-th', () => {
  expect(scale([0, 10], [0, 1], undefined, { step: 2.5 }).ticks).toEqual([0, 2.5, 5, 7.5, 10]);
  expect(scale('nice', [3, 9], undefined, { step: 2.5 })).toEqual({
    lo: 2.5,
    hi: 10,
    ticks: [2.5, 5, 7.5, 10],
  });
  expect(scale([0, 1], [0, 1], undefined, { step: 0.1 }).ticks).toEqual([
    0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
  ]);
  expect(scale([0, 0.3], [0, 1], undefined, { step: 0.1 }).ticks).toEqual([0, 0.1, 0.2, 0.3]);
  expect(scale([2.1, 3], [0, 1], undefined, { step: 0.3 }).ticks).toEqual([2.1, 2.4, 2.7, 3]);
  expect(scale('nice', [0.3, 0.6], undefined, { step: 0.1 })).toEqual({
    lo: 0.3,
    hi: 0.6,
    ticks: [0.3, 0.4, 0.5, 0.6],
  });
  expect(scale('nice', [0.07, 0.09], undefined, { step: 0.01 })).toEqual({
    lo: 0.07,
    hi: 0.09,
    ticks: [0.07, 0.08, 0.09],
  });
  expect(scale('nice', [0.01, 0.07], undefined, { step: 0.01 })).toMatchObject({ lo: 0.01, hi: 0.07 });
  const wide = scale('nice', [1e15 + 0.75, 1e15 + 4.25], undefined, { step: 1 });
  expect(wide).toMatchObject({ lo: 1e15, hi: 1e15 + 5 });
  expect(wide.lo).toBeLessThanOrEqual(1e15 + 0.75);
  expect(wide.hi).toBeGreaterThanOrEqual(1e15 + 4.25);
  for (const [a, b, step] of [
    [1e15 - 0.5, 1e15 + 0.75, 0.3],
    [1e15 + 0.25, 1e15 + 2.5, 0.7],
    [-1e15 - 0.75, -1e15 + 0.5, 0.3],
    [3e15 + 0.5, 3e15 + 3, 1],
  ] as const) {
    const { lo, hi } = scale('nice', [a, b], undefined, { step });
    expect(lo).toBeLessThanOrEqual(a);
    expect(hi).toBeGreaterThanOrEqual(b);
    expect(a - lo).toBeLessThan(step);
    expect(hi - b).toBeLessThan(step);
  }
  expect(scale([1e15 + 1, 1e15 + 4], [0, 1], undefined, { step: 1 })).toEqual({
    lo: 1e15 + 1,
    hi: 1e15 + 4,
    ticks: [1e15 + 1, 1e15 + 2, 1e15 + 3, 1e15 + 4],
  });
  for (const step of [0, -2, NaN, Infinity]) {
    expect(scale('nice', [3, 97], { length: 300, horizontal: true }, { step })).toEqual(
      scale('nice', [3, 97], { length: 300, horizontal: true }),
    );
  }

  const el = host();
  plot(el, {
    ...frame,
    width: 150,
    x: { domain: [0, 10], label: '', step: 2.5 },
    y: { domain: [0, 1], label: '', scale: () => ({ lo: 0, hi: 1, ticks: [] }) },
    marks: [],
  });
  expect(['0', '2.5', '5', '7.5', '10'].map(s => !!textOf(el, s))).toEqual([true, false, true, false, true]);
});

test('a format labels the ticks, and the left margin is sized from what it gives', () => {
  const el = host();
  let chart!: Internals;
  const options = {
    ...frame,
    width: 400,
    height: 300,
    margin: undefined,
    y: { domain: [0, 100], label: '' },
    marks: [],
    use: [(c: Internals) => ((chart = c), { destroy() {} })],
  } satisfies Options;
  plot(host(), options);
  const plain = chart.margin().left;
  plot(el, { ...options, y: { ...options.y, format: v => v.toFixed(1) + '%' } });
  expect(textOf(el, '50.0%')).toBeDefined();
  expect(textOf(el, '50')).toBeUndefined();
  expect(plain).toBe(14 + 3 * 7);
  expect(chart.margin().left).toBe(14 + 6 * 7);
});

test('time ticks every so many of a unit fall on its boundaries and take the format', () => {
  const quarters = time({ label: '', every: 3, unit: 'month' });
  const two = quarters.scale!(quarters, () => [Date.UTC(2026, 0, 1), Date.UTC(2028, 0, 1)]);
  expect(two.ticks.map(t => t.value)).toEqual(
    [0, 3, 6, 9, 12, 15, 18, 21, 24].map(m => Date.UTC(2026, m, 1)),
  );
  expect(two.ticks.map(t => t.label).slice(0, 5)).toEqual(['2026', 'Apr', 'Jul', 'Oct', '2027']);

  const iso = (v: number) => new Date(v).toISOString().slice(0, 7);
  const named = time({ label: '', every: 3, unit: 'month', format: iso });
  const labels = named.scale!(named, () => [Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1)]).ticks.map(
    t => t.label,
  );
  expect(labels).toEqual(['2026-01', '2026-04', '2026-07']);

  // Counted from the start of each year, so a pan does not move them.
  const fives = time({ label: '', every: 5, unit: 'month' });
  const from = (lo: number) =>
    fives.scale!(fives, () => [lo, Date.UTC(2027, 11, 31)]).ticks.map(t => iso(t.value));
  expect(from(Date.UTC(2026, 0, 1)).slice(3)).toEqual(['2027-01', '2027-06', '2027-11']);
  expect(from(Date.UTC(2027, 0, 1))).toEqual(['2027-01', '2027-06', '2027-11']);

  const lo = Date.UTC(2026, 0, 1);
  const cases = [
    ['year', Date.UTC(2031, 0, 1), 6],
    ['month', Date.UTC(2027, 0, 1), 13],
    ['day', lo + 10 * 864e5, 11],
    ['hour', lo + 10 * 36e5, 11],
    ['minute', lo + 10 * 6e4, 11],
    ['second', lo + 10 * 1e3, 11],
  ] as const;
  for (const [unit, hi, count] of cases) {
    const axis = time({ label: '', unit });
    const { ticks } = axis.scale!(axis, () => [lo, hi]);
    expect(
      ticks.map(t => t.value),
      unit,
    ).toEqual(
      ticks.map((_, i) =>
        unit === 'year'
          ? Date.UTC(2026 + i, 0, 1)
          : unit === 'month'
            ? Date.UTC(2026, i, 1)
            : lo + ((hi - lo) / 10) * i,
      ),
    );
    expect(ticks, unit).toHaveLength(count);
  }
});

test('with a window, stepped ticks are the multiples of the step inside it', () => {
  const el = host();
  plot(el, {
    ...frame,
    height: 300,
    x: { domain: [0, 10], label: '', scale: () => ({ lo: 0, hi: 10, ticks: [] }) },
    y: { domain: [0, 100], label: '', step: 7 },
    view: { y: [20, 50] },
    marks: [],
  });
  expect(['14', '21', '28', '35', '42', '49', '56'].map(s => !!textOf(el, s))).toEqual([
    false,
    true,
    true,
    true,
    true,
    true,
    false,
  ]);
});

test('a pan keeps the same stepped ticks where the windows overlap', () => {
  const room = { length: 80, horizontal: false };
  expect(scale([20, 50], [0, 1], room, { step: 7 }).ticks).toEqual([28, 42]);
  expect(scale([21.5, 51.5], [0, 1], room, { step: 7 }).ticks).toEqual([28, 42]);

  const days = time({ label: '', every: 1, unit: 'day' });
  const shown = (from: number) =>
    days.scale!(days, () => [Date.UTC(2026, 0, from), Date.UTC(2026, 0, from + 10)], {
      length: 400,
      horizontal: true,
    }).ticks.map(t => new Date(t.value).getUTCDate());
  expect(shown(2)).toEqual([3, 5, 7, 9, 11]);
  expect(shown(3)).toEqual([3, 5, 7, 9, 11, 13]);
});

test('time steps of days of a week or more still start each month on its first', () => {
  const dates = (every: number, hi: number) => {
    const axis = time({ label: '', every, unit: 'day' });
    return axis.scale!(axis, () => [Date.UTC(2026, 0, 1), hi]).ticks.map(t =>
      new Date(t.value).toISOString().slice(5, 10),
    );
  };
  expect(dates(7, Date.UTC(2026, 1, 1))).toEqual(['01-01', '01-08', '01-15', '01-22', '02-01']);
  const firsts = Array.from({ length: 12 }, (_, m) => `${String(m + 1).padStart(2, '0')}-01`);
  expect(dates(40, Date.UTC(2026, 11, 31))).toEqual(firsts);
  expect(dates(30, Date.UTC(2026, 11, 31))).toEqual(firsts);
  expect(dates(365, Date.UTC(2026, 3, 1))).toEqual(['01-01', '02-01', '03-01', '04-01']);
});

test('thinned time ticks keep at least the thinning step apart where the step restarts', () => {
  const gaps = (unit: 'month' | 'day' | 'hour' | 'minute', lo: number, hi: number, length: number) => {
    const axis = time({ label: '', every: 1, unit });
    const ticks = axis.scale!(axis, () => [lo, hi], { length, horizontal: true }).ticks.map(t => t.value);
    return ticks.slice(1).map((t, i) => t - ticks[i]!);
  };
  const H = 36e5;
  const D = 24 * H;
  expect(Math.min(...gaps('day', Date.UTC(2026, 0, 1), Date.UTC(2026, 2, 1), 600))).toBe(6 * D);
  expect(Math.min(...gaps('hour', Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 3), 600))).toBe(5 * H);
  expect(Math.min(...gaps('minute', Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 2), 1000))).toBe(7 * 6e4);
  expect(Math.min(...gaps('month', Date.UTC(2026, 0, 1), Date.UTC(2029, 0, 1), 400))).toBeGreaterThanOrEqual(
    5 * 28 * D,
  );

  const cases = [
    ['day', 3, Date.UTC(2026, 0, 1), Date.UTC(2026, 3, 1), 870, D, 2],
    ['day', 3, Date.UTC(2026, 0, 1), Date.UTC(2026, 11, 31), 700, D, 10],
    ['hour', 7, Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 4), 400, H, 2],
    ['hour', 7, Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 11), 640, H, 4],
  ] as const;
  for (const [unit, every, lo, hi, length, ms, k] of cases) {
    const axis = time({ label: '', every, unit });
    const all = axis.scale!(axis, () => [lo, hi]).ticks;
    const widest = Math.max(...all.map(t => t.label.length));
    expect(Math.ceil(all.length / k) * (widest * 7 + 16) <= length, `${every} ${unit}`).toBe(true);
    expect(Math.ceil(all.length / (k - 1)) * (widest * 7 + 16) > length, `${every} ${unit}`).toBe(true);
    const ticks = axis.scale!(axis, () => [lo, hi], { length, horizontal: true }).ticks.map(t => t.value);
    expect(ticks.length, `${every} ${unit}`).toBeGreaterThan(1);
    expect(
      Math.min(...ticks.slice(1).map((t, i) => t - ticks[i]!)),
      `${every} ${unit}`,
    ).toBeGreaterThanOrEqual(k * every * ms);
  }
});

test('thinned time ticks over long domains keep some ticks, at least the thinning step apart and still under a pan', () => {
  const H = 36e5;
  const D = 24 * H;
  const cases = [
    ['day', Date.UTC(2024, 0, 1), Date.UTC(2026, 0, 1), 500, D],
    ['hour', Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 31), 600, H],
    ['minute', Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 12), 600, 6e4],
    ['month', Date.UTC(2014, 0, 1), Date.UTC(2026, 0, 1), 600, 28 * D],
  ] as const;
  for (const [unit, lo, hi, length, shortest] of cases) {
    const axis = time({ label: '', every: 1, unit });
    const shown = (shift: number) =>
      axis.scale!(axis, () => [lo + shift, hi + shift], { length, horizontal: true }).ticks.map(t => t.value);
    const all = axis.scale!(axis, () => [lo, hi]).ticks;
    const widest = Math.max(...all.map(t => t.label.length));
    let k = 1;
    while (Math.ceil(all.length / k) * (widest * 7 + 16) > length) k++;
    const ticks = shown(0);
    expect(ticks.length, unit).toBeGreaterThan(1);
    expect(Math.min(...ticks.slice(1).map((t, i) => t - ticks[i]!)), unit).toBeGreaterThanOrEqual(
      k * shortest,
    );
    const later = shown((hi - lo) / 4);
    const overlap = (ts: number[]) => ts.filter(t => t >= lo + (hi - lo) / 4 && t <= hi);
    expect(overlap(later), unit).toEqual(overlap(ticks));
  }
});

test('an update with a new axis of the same step and format, or a new equal time axis, prepares and paints nothing', () => {
  let prepares = 0;
  let paints = 0;
  const mark: Mark = {
    type: 'counted',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => (prepares++, { paint: () => paints++ }),
  };
  const format = (v: number) => v + '%';
  const y = () => ({ domain: [0, 1], label: '', step: 0.25, format }) satisfies Axis;
  const x = () => time({ label: '', domain: [0, 1e10], every: 3, unit: 'month' });
  const chart = plot(host(), { ...frame, x: x(), y: y(), marks: [mark] });
  [prepares, paints] = [0, 0];
  chart.update({ x: x(), y: y() });
  expect([prepares, paints]).toEqual([0, 0]);
  chart.update({ y: { ...y(), step: 0.5 } });
  expect(paints).toBe(1);
  chart.update({ y: { ...y(), step: 0.5, format: v => v + '%' } });
  expect(paints).toBe(2);
  chart.update({ x: time({ label: '', domain: [0, 1e10], every: 2, unit: 'month' }) });
  expect(paints).toBe(3);
});

test('a band axis labels each category at its index and bars sit on them', () => {
  const el = host();
  plot(el, {
    ...frame,
    x: band({ label: '', categories: ['a', 'b', 'c'] }),
    marks: [bar({ x1: [0.6], x2: [1.4], y1: [0], y2: [0.5], color: RED })],
  });
  const label = (s: string) => [...el.querySelectorAll('div')].find(e => e.textContent === s)!.style.left;
  expect([label('a'), label('b'), label('c')].map(parseFloat).map(Math.round)).toEqual([17, 50, 83]);
  expect(pixel(el, 50, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 30, 75)[3]).toBe(0);
});

test('update with an equal axis keeps the geometry and a changed one redraws', () => {
  let prepares = 0;
  const mark: Mark = {
    type: 'counted',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => (prepares++, { paint() {} }),
  };
  const categories = ['a', 'b'];
  const chart = plot(host(), { ...frame, x: band({ label: '', categories }), marks: [mark] });
  chart.update({ x: band({ label: 'renamed', categories }) });
  expect(prepares).toBe(1);
  chart.update({ x: band({ label: '', categories: ['a', 'b', 'c'] }) });
  expect(prepares).toBe(2);
});

test('a bar too narrow for a pixel is drawn the same in either order, and one of no width is not', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [bar({ x1: [3.11, 7.12, 5], x2: [3.12, 7.11, 5], y1: [0, 0, 0], y2: [1, 1, 1], color: RED })],
    use: [tooltip({ mode: 'nearest', text: () => 'bar' })],
  });
  expect(pixel(el, 31, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 71, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 55)[3]).toBe(0);
  expect(hover(el, 50, 55).innerText).not.toContain('bar');
});

test('the part of a bar outside the plot area is not offered by the nearest tooltip', () => {
  const el = host();
  plot(el, {
    ...frame,
    margin: { top: 0, right: 0, bottom: 0, left: 20 },
    marks: [bar({ x1: [-2], x2: [5], y1: [0], y2: [1], color: RED, label: 'bar' })],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(hover(el, 40, 55).innerText).toContain('bar');
  expect(hover(el, 10, 55).innerText).not.toContain('bar');
});

test('a step line starts at the value it holds, not at the lowest of its first pixel column', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [line({ x: [5, 5.001, 10], y: [0.15, 0.75, 0.75], curve: 'step', color: RED, width: 4 })],
  });
  expect(pixel(el, 80, 25)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 65)).toEqual([255, 0, 0, 255]);
});

test('where two bars overlap the pointer gets the one drawn on top, also while one is focused', () => {
  const el = host();
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [
      bar({ x1: [2], x2: [6], y1: [0], y2: [0.8], color: RED, label: 'under' }),
      bar({ x1: [4], x2: [8], y1: [0], y2: [0.8], color: '#0000ff', label: 'over' }),
    ],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(hover(el, 50, 75).innerText).toContain('over');
  hover(el, 90, 75);
  expect(hover(el, 30, 75).innerText).toContain('under');
  expect(hover(el, 50, 75).innerText).toContain('under');
});

test('a custom scale reads its axis and is resolved again when the axis label changes', () => {
  const el = host();
  const scale: Axis['scale'] = axis => ({
    lo: 0,
    hi: 1,
    ticks: [{ value: 0.5, label: `tick of ${axis.label}` }],
  });
  const x = (label: string): Axis => ({ domain: [0, 1], label, scale });
  const chart = plot(el, { ...frame, x: x('one'), marks: [] });
  expect(el.innerText).toContain('tick of one');
  chart.update({ x: x('two') });
  expect(el.innerText).toContain('tick of two');
});

const plain = (o: Record<string, ArrayLike<number>>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v)]));

test('bin counts values into equal bins, the largest value included', () => {
  expect(plain(bin([0, 1, 2, 3, 4, 5, 6, 7, 8, 10], 2))).toEqual({
    x1: [0, 5],
    x2: [5, 10],
    y1: [0, 0],
    y2: [5, 5],
  });
  expect([...bin([1, 2, 3, 4, 5, 6, 7, 8]).y2]).toEqual([2, 2, 2, 2]);
  expect([...bin([0, 1, 2, 3, 10], 2.4).y2]).toEqual([4, 1]);
  expect([...bin([0, 1, 2, 3, 10], 0).y2]).toEqual([5]);
});

test('bin ignores NaN and infinite values, and copes with a constant or a huge extent', () => {
  expect([...bin([0, 1, NaN, Infinity, -Infinity]).y2]).toEqual([1, 1]);
  expect(plain(bin([3, 3, 3], 2))).toEqual({ x1: [1.5, 3], x2: [3, 4.5], y1: [0, 0], y2: [0, 3] });
  expect([...bin([-1e308, 0, 1e308], 2).y2]).toEqual([1, 2]);
  expect([...bin([-Infinity, 0, 1, Infinity], [-Infinity, 0, Infinity]).y2]).toEqual([0, 2]);
  expect([...bin([0, 1, 2], Infinity).y2]).toEqual([3]);
  for (const v of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
    const top = bin([v], 2);
    expect(Array.from(top.x1).concat(top.x2[1]!).every(Number.isFinite)).toBe(true);
    expect(top.y2[0]! + top.y2[1]!).toBe(1);
  }
  const huge = bin([1e16, 1e16], 2);
  expect(huge.x2[0]).toBeGreaterThan(huge.x1[0]!);
  expect([...huge.y2]).toEqual([0, 2]);
});

test('bin with edges puts a value on an edge in the bin above and drops what is outside', () => {
  expect(plain(bin([0, 0.5, 1, 5, 10, 11, -1, NaN], [0, 1, 10]))).toEqual({
    x1: [0, 1],
    x2: [1, 10],
    y1: [0, 0],
    y2: [2, 3],
  });
});

test('stack layers series row by row, negatives downwards', () => {
  expect(
    stack([
      [1, -1, 2],
      [3, -2, NaN],
      [1, 1, 1],
    ]).map(plain),
  ).toEqual([
    { y1: [0, 0, 0], y2: [1, -1, 2] },
    { y1: [1, -1, 2], y2: [4, -3, 2] },
    { y1: [4, 0, 2], y2: [5, 1, 3] },
  ]);
});

test('a histogram is the bins handed to the bar mark', () => {
  const el = host();
  plot(el, {
    ...frame,
    y: { domain: [0, 4], label: '' },
    marks: [bar({ ...bin([1, 1, 1, 1, 9], [0, 5, 10]), color: RED })],
  });
  expect(pixel(el, 25, 15)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 85)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 65)[3]).toBe(0);
});

const RED_PIXEL = [255, 0, 0, 255];
const fakeClock = () =>
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });

const CURVES = ['linear', 'step', 'smooth'] as const;
const GAP_X = [0, 2, 4, 5, 6, 8, 10];
const clear = { ...frame, x: bare([0, 10]), y: bare([0, 1]) };
const gapped = (v: number, missing = NaN) => [v, v, v, missing, v, v, v];

test('a value that is not finite leaves a gap in a line, whatever its curve', () => {
  for (const curve of CURVES) {
    for (const missing of [NaN, Infinity, -Infinity]) {
      const el = host();
      plot(el, {
        ...clear,
        marks: [line({ x: GAP_X, y: gapped(0.5, missing), curve, color: RED, width: 4 })],
      });
      expect(pixel(el, 20, 50), curve).toEqual(RED_PIXEL);
      expect(pixel(el, 80, 50), curve).toEqual(RED_PIXEL);
      expect(pixel(el, 50, 50)[3], `${curve} ${missing}`).toBe(0);
    }

    const ends = host();
    plot(ends, {
      ...clear,
      marks: [line({ x: [0, 2, 8, 10], y: [NaN, 0.5, 0.5, NaN], curve, color: RED, width: 4 })],
    });
    expect(pixel(ends, 50, 50), curve).toEqual(RED_PIXEL);

    const lone = host();
    plot(lone, {
      ...clear,
      marks: [line({ x: [0, 2, 5, 8, 10], y: [0.5, NaN, 0.5, NaN, 0.5], curve, color: RED, width: 4 })],
    });
    for (const at of [1, 30, 50, 70, 99]) expect(pixel(lone, at, 50)[3], `${curve} ${at}`).toBe(0);
  }
});

test('a smooth line curves each run between gaps on its own', () => {
  const el = host();
  plot(el, {
    ...clear,
    width: 400,
    marks: [line({ x: GAP_X, y: [0, 1, 0, NaN, 0, 1, 0], curve: 'smooth', color: RED, width: 4 })],
  });
  for (const at of [40, 120, 280, 360]) {
    expect(pixel(el, at, 50), `straight at ${at}`).toEqual([0, 0, 0, 0]);
    expect(pixel(el, at, 38), `curved at ${at}`).toEqual(RED_PIXEL);
  }
  expect(pixel(el, 200, 99)[3]).toBe(0);

  const dense = host();
  plot(dense, {
    ...clear,
    width: 400,
    marks: [
      line({
        x: [0, 0.01, 1, 2, 4, 6, 8],
        y: [0, 1, 0, NaN, 0, 1, 0],
        curve: 'smooth',
        color: RED,
        width: 4,
      }),
    ],
  });
  expect(pixel(dense, 200, 50), 'straight after a run sharing a pixel').toEqual([0, 0, 0, 0]);
  expect(pixel(dense, 200, 38), 'curved after a run sharing a pixel').toEqual(RED_PIXEL);
});

test('a value missing from an area, or from either of its bounds, leaves it empty there', () => {
  for (const curve of CURVES) {
    for (const o of [
      { y: gapped(0.5) },
      { y1: gapped(0.2), y2: gapped(0.8, 0.8) },
      { y1: gapped(0.2, 0.2), y2: gapped(0.8) },
      { y1: gapped(0.2, Number.MAX_VALUE), y2: gapped(0.8, 0.8) },
    ]) {
      const el = host();
      plot(el, { ...clear, marks: [area({ x: GAP_X, ...o, curve, color: RED })] });
      expect(pixel(el, 20, 60), curve).toEqual(RED_PIXEL);
      expect(pixel(el, 80, 60), curve).toEqual(RED_PIXEL);
      expect(pixel(el, 50, 60)[3], `${curve} ${Object.keys(o).join()}`).toBe(0);
    }
  }
});

test('a shade under a line and a blended area close one shape per run around a gap', () => {
  const shaded = host();
  plot(shaded, { ...clear, marks: [line({ x: GAP_X, y: gapped(0.8), color: RED, width: 2, fill: true })] });
  expect(pixel(shaded, 20, 60)[3]).toBeGreaterThan(0);
  expect(pixel(shaded, 80, 60)[3]).toBeGreaterThan(0);
  expect(pixel(shaded, 50, 60)[3]).toBe(0);

  const blended = host();
  plot(blended, {
    ...clear,
    marks: [area({ x: GAP_X, y: gapped(0.8), color: RED, fill: gradient(0.4, 0) })],
  });
  expect(pixel(blended, 20, 30)[3]).toBeGreaterThan(0);
  expect(pixel(blended, 80, 30)[3]).toBeGreaterThan(0);
  expect(pixel(blended, 50, 30)[3]).toBe(0);

  const missing = host();
  plot(missing, {
    ...clear,
    marks: [area({ x: [0, 10], y1: [NaN, NaN], y2: [NaN, NaN], color: RED, fill: gradient(0.4, 0) })],
  });
  expect(pixel(missing, 50, 50)[3]).toBe(0);
});

test('with more points than pixels, a pixel inside a run of missing values is empty', () => {
  const x = Float64Array.from({ length: 10_000 }, (_, i) => i / 1000);
  const y = Float64Array.from(x, v => ((v >= 4 && v < 6) || (v >= 7 && v < 8) ? NaN : 0.5));
  const el = host();
  plot(el, { ...clear, marks: [line({ x, y, color: RED, width: 4 })] });
  expect(pixel(el, 20, 50)).toEqual(RED_PIXEL);
  expect(pixel(el, 65, 50)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 50)[3]).toBe(0);
  expect(pixel(el, 75, 50)[3]).toBe(0);
});

test('a stacked layer with a missing value has no thickness there, and the layer above still sits on it', () => {
  const x = [0, 5, 10];
  const [bottom, top] = stack([
    [0.3, NaN, 0.3],
    [0.4, 0.4, 0.4],
  ]);
  expect(bottom!.y2[1]).toBe(bottom!.y1[1]);
  expect(top!.y1[1]).toBe(bottom!.y2[1]);
  const el = host();
  plot(el, {
    ...clear,
    marks: [area({ x, ...bottom!, color: RED }), area({ x, ...top!, color: BLUE })],
  });
  expect(pixel(el, 50, 80)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 2, 85)).toEqual(RED_PIXEL);
  expect(pixel(el, 2, 50)).toEqual([0, 0, 255, 255]);
});

test('the x tooltip shows a dash for a line or an area at a gap', () => {
  const el = host();
  const x = [0, 4, 5, 6, 10];
  plot(el, {
    ...frame,
    marks: [
      line({ x, y: [0.5, 0.5, NaN, 0.5, 0.5], color: RED, label: 'L' }),
      area({ x, y: [0.3, 0.3, NaN, 0.3, 0.3], color: RED, label: 'A' }),
      area({ x, y1: [0, 0, NaN, 0, 0], y2: [0.2, 0.2, 0.2, 0.2, 0.2], color: RED, label: 'B' }),
    ],
    use: [tooltip({ mode: 'x', title: () => 'at', value: String })],
  });
  const root = hover(el, 45, 50);
  for (const label of ['L', 'A', 'B']) expect(root.innerText).toContain(`${label}: –`);
  hover(el, 20, 50);
  expect(root.innerText).toContain('L: 0.5');
  expect(root.innerText).toContain('B: 0.2');
});

test('a joined line or area is drawn straight across a gap, whatever its curve, and not past its ends', () => {
  for (const curve of CURVES) {
    const el = host();
    plot(el, {
      ...clear,
      marks: [line({ x: GAP_X, y: gapped(0.5), curve, join: true, color: RED, width: 4 })],
    });
    expect(pixel(el, 50, 50), curve).toEqual(RED_PIXEL);

    for (const o of [
      { y: gapped(0.5) },
      { y1: gapped(0.2), y2: gapped(0.8, 0.8) },
      { y1: gapped(0.2, 0.2), y2: gapped(0.8) },
    ]) {
      const filled = host();
      plot(filled, { ...clear, marks: [area({ x: GAP_X, ...o, curve, join: true, color: RED })] });
      expect(pixel(filled, 50, 60), `${curve} ${Object.keys(o).join()}`).toEqual(RED_PIXEL);
    }

    const ends = host();
    plot(ends, {
      ...clear,
      marks: [
        line({ x: [0, 2, 5, 8, 10], y: [NaN, 0.5, NaN, 0.5, NaN], curve, join: true, color: RED, width: 4 }),
      ],
    });
    expect(pixel(ends, 50, 50), curve).toEqual(RED_PIXEL);
    for (const at of [5, 95]) expect(pixel(ends, at, 50)[3], `${curve} ${at}`).toBe(0);

    const none = host();
    plot(none, {
      ...clear,
      marks: [line({ x: [0, 10], y: [NaN, NaN], curve, join: true, color: RED, width: 4 })],
    });
    for (const at of [1, 50, 99]) expect(pixel(none, at, 50)[3], `${curve} ${at}`).toBe(0);
  }
});

test('a joined line or area is drawn straight across a sloped gap, and with its curve beside it', () => {
  const x = [0, 2, 5, 8, 10];
  const y = [0.2, 0.2, NaN, 0.8, 1];
  for (const curve of CURVES) {
    const el = host();
    plot(el, { ...clear, marks: [line({ x, y, curve, join: true, color: RED, width: 4 })] });
    expect(pixel(el, 50, 50), curve).toEqual(RED_PIXEL);
    expect(pixel(el, 90, 20)[3], curve).toBe(curve === 'step' ? 255 : 0);

    const filled = host();
    plot(filled, { ...clear, marks: [area({ x, y, curve, join: true, color: RED })] });
    expect(pixel(filled, 50, 55), curve).toEqual(RED_PIXEL);
    expect(pixel(filled, 50, 45)[3], curve).toBe(0);

    const band = host();
    const y1 = [0, 0, NaN, 0.6, 0.8];
    plot(band, { ...clear, marks: [area({ x, y1, y2: y, curve, join: true, color: RED })] });
    expect(pixel(band, 50, 60), curve).toEqual(RED_PIXEL);
    for (const at of [45, 75]) expect(pixel(band, 50, at)[3], `${curve} ${at}`).toBe(0);
  }
});

test('a joined line or area bridges a gap from and to its actual end points when they share a pixel', () => {
  const x = [0, 2, 5, 8, 8.001, 10];
  const row = (v: number) => 100 - v * 100;
  for (const curve of CURVES) {
    const mark = line({ x, y: [0.2, 0.2, NaN, 0.8, 0.2, 0.2], curve, join: true, color: RED, width: 4 });
    const el = host();
    plot(el, { ...clear, marks: [mark] });
    expect(pixel(el, 50, row(mark.sampleAtX!(5) as number)), curve).toEqual(RED_PIXEL);

    const under = area({ x, y: [0.2, 0.2, NaN, 0.2, 0.8, 0.8], curve, join: true, color: RED });
    const filled = host();
    plot(filled, { ...clear, marks: [under] });
    const top = row((under.sampleAtX!(5) as { y2: number }).y2);
    expect(pixel(filled, 50, top + 5), curve).toEqual(RED_PIXEL);
    expect(pixel(filled, 50, top - 5)[3], curve).toBe(0);

    const y1 = [0.6, 0.6, NaN, 0.6, 0, 0];
    const between = area({
      x,
      y1,
      y2: x.map((_, i) => (i === 2 ? NaN : 0.9)),
      curve,
      join: true,
      color: RED,
    });
    const band = host();
    plot(band, { ...clear, marks: [between] });
    const bottom = row((between.sampleAtX!(5) as { y1: number }).y1);
    expect(pixel(band, 50, bottom - 5), curve).toEqual(RED_PIXEL);
    expect(pixel(band, 50, bottom + 5)[3], curve).toBe(0);
  }
});

test('a joined line or area still breaks where a finite value overflows once projected', () => {
  const x = [0, 5, 10];
  const y = [0.2, Number.MAX_VALUE, 0.8];
  for (const curve of CURVES) {
    const el = host();
    plot(el, { ...clear, marks: [line({ x, y, curve, join: true, color: RED, width: 4 })] });
    expect(pixel(el, 50, 50)[3], curve).toBe(0);

    const filled = host();
    plot(filled, { ...clear, marks: [area({ x, y, curve, join: true, color: RED })] });
    expect(pixel(filled, 50, 90)[3], curve).toBe(0);
  }
});

test('a joined line or area is sampled across a gap as it is drawn, and not past its ends', () => {
  const x = [0, 2, 4, 6, 8];
  const y = [1, 3, NaN, 8, 9];
  const joined = (curve: Curve) => line({ x, y, curve, join: true, color: RED });
  expect([3, 4, 5].map(v => joined('linear').sampleAtX!(v))).toEqual([4.25, 5.5, 6.75]);
  for (const curve of CURVES) {
    expect(
      [3, 4, 5].map(v => joined(curve).sampleAtX!(v)),
      curve,
    ).toEqual([4.25, 5.5, 6.75]);
    expect(area({ x, y, curve, join: true, color: RED }).sampleAtX!(4), curve).toEqual({
      y1: 0,
      y2: 5.5,
      band: false,
    });
  }
  expect(joined('step').sampleAtX!(7)).toBe(8);
  const long = { x: [0, 2, 4, 6, 8, 10], y: [1, 3, NaN, 8, 9, 9.5], curve: 'smooth' as const, color: RED };
  const run = line({ x: [6, 8, 10], y: [8, 9, 9.5], curve: 'smooth', color: RED });
  expect(line({ ...long, join: true }).sampleAtX!(7)).toBe(run.sampleAtX!(7));
  expect(run.sampleAtX!(7)).not.toBe(8.5);
  expect(
    area({ x, y1: [0, 0, NaN, 0, 0], y2: [2, 2, 2, 2, 2], join: true, color: RED }).sampleAtX!(4),
  ).toEqual({ y1: 0, y2: 2, band: true });

  const open = [NaN, 3, NaN, 8, NaN];
  for (const curve of CURVES) {
    const mark = line({ x, y: open, curve, join: true, color: RED });
    expect(mark.sampleAtX!(4), curve).toBeDefined();
    for (const v of [1, 7, 9]) expect(mark.sampleAtX!(v), `${curve} ${v}`).toBeUndefined();
    const filled = area({ x, y: open, curve, join: true, color: RED });
    for (const v of [1, 7, 9]) expect(filled.sampleAtX!(v), `area ${curve} ${v}`).toBeUndefined();
    expect(line({ x, y: x.map(() => NaN), curve, join: true, color: RED }).sampleAtX!(4)).toBeUndefined();
  }
});

test("with enter: 'fade' marks appear together, over a grid that is there from the start", () => {
  fakeClock();
  const el = host();
  plot(el, { ...frame, marks: [flat(0.55)], use: [animate({ duration: 600, enter: 'fade' })] });
  expect(pixel(el, 10, 45)[3]).toBe(0);
  expect(pixel(el, 50, 50)[3]).toBe(255);

  vi.advanceTimersByTime(100);
  const left = pixel(el, 10, 45)[3]!;
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(255);
  expect(pixel(el, 97, 45)[3]).toBe(left);

  vi.advanceTimersByTime(600);
  expect(pixel(el, 97, 45)).toEqual(RED_PIXEL);
});

test('marks are revealed from the left on the first paint', () => {
  fakeClock();
  const el = host();
  plot(el, { ...frame, marks: [flat(0.55)], use: [animate({ duration: 600 })] });
  expect(pixel(el, 10, 45)[3]).toBe(0);
  expect(pixel(el, 50, 50)[3]).toBe(255);

  vi.advanceTimersByTime(100);
  expect(pixel(el, 10, 45)).toEqual(RED_PIXEL);
  expect(pixel(el, 97, 45)[3]).toBe(0);

  vi.advanceTimersByTime(600);
  expect(pixel(el, 97, 45)).toEqual(RED_PIXEL);
});

test('a data change cross-fades, leaves unchanged pixels alone, and a second update skips the fade', () => {
  fakeClock();
  const el = host();
  const chart = plot(el, { ...frame, marks: [flat(0.55)], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  const grid = pixel(el, 50, 50);

  chart.update({ marks: [flat(0.25)] });
  expect(pixel(el, 50, 45)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 75)[3]).toBe(0);

  vi.advanceTimersByTime(150);
  const going = pixel(el, 50, 45)[3]!;
  const coming = pixel(el, 50, 75)[3]!;
  expect(going).toBeGreaterThan(0);
  expect(going).toBeLessThan(255);
  expect(coming).toBeGreaterThan(0);
  expect(coming).toBeLessThan(255);
  expect(pixel(el, 50, 50)).toEqual(grid);

  chart.update({ marks: [flat(0.85)] });
  expect(pixel(el, 50, 15)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 75)[3]).toBe(0);

  vi.advanceTimersByTime(700);
  chart.update({ marks: [flat(0.25)] });
  expect(pixel(el, 50, 15)).toEqual(RED_PIXEL);
  vi.advanceTimersByTime(700);
  expect(pixel(el, 50, 75)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 15)[3]).toBe(0);
});

test('nothing animates with a duration of zero, or once the chart is resized', () => {
  fakeClock();
  const still = host();
  plot(still, { ...frame, marks: [flat(0.55)], use: [animate({ duration: 0 })] });
  expect(pixel(still, 97, 45)).toEqual(RED_PIXEL);
  const endless = host();
  plot(endless, { ...frame, marks: [flat(0.55)], use: [animate({ duration: Infinity })] });
  expect(pixel(endless, 97, 45)).toEqual(RED_PIXEL);

  const el = host();
  const chart = plot(el, { ...frame, marks: [flat(0.55)], use: [animate({ duration: 600 })] });
  expect(pixel(el, 97, 45)[3]).toBe(0);
  chart.update({ width: 120 });
  expect(pixel(el, 115, 45)).toEqual(RED_PIXEL);
  vi.advanceTimersByTime(100);
  expect(pixel(el, 115, 45)).toEqual(RED_PIXEL);
});

test('the WebGL layer takes part in the entrance and an update in between does not undo it', () => {
  fakeClock();
  const fading = host();
  const chart = plot(fading, {
    ...frame,
    marks: [pile(30_000)],
    use: [animate({ duration: 300, enter: 'fade' })],
  });
  const layer = fading.querySelectorAll('canvas')[1]!;
  expect(layer.style.opacity).toBe('0');
  chart.update({});
  expect(layer.style.opacity).toBe('0');
  vi.advanceTimersByTime(400);
  expect(layer.style.opacity).toBe('');

  const el = host();
  const revealed = plot(el, {
    ...frame,
    marks: [pile(30_000)],
    use: [animate({ duration: 300 })],
  });
  const clip = el.querySelectorAll('canvas')[1]!.style;
  const outline = () => (clip.clipPath.match(/-?[\d.e-]+px/g) ?? []).map(parseFloat);
  expect(outline()).toEqual([0, 0, 0, 0, 0, 100, 0, 100]);
  revealed.update({});
  expect(outline()).toEqual([0, 0, 0, 0, 0, 100, 0, 100]);
  vi.advanceTimersByTime(400);
  expect(clip.clipPath).toBe('inset(0px)');
});

test('a chart first drawn by a resize cross-fades its next data change and does not replay the entrance', () => {
  fakeClock();
  const el = host();
  const chart = plot(el, { ...frame, width: 0, marks: [flat(0.55)], use: [animate({ duration: 600 })] });
  chart.update({ width: 100 });
  expect(pixel(el, 97, 45)).toEqual(RED_PIXEL);
  vi.advanceTimersByTime(700);
  chart.update({ marks: [flat(0.25)] });
  expect(pixel(el, 97, 45)).toEqual(RED_PIXEL);
});

const column = (y2: number) => bar({ x1: [2], x2: [4], y1: [0], y2: [y2], color: RED });

test('a bar grows to its new value: between the two heights it is solid or absent, never faint', () => {
  fakeClock();
  const el = host();
  const chart = plot(el, { ...frame, marks: [column(0.2)], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);

  chart.update({ marks: [column(0.8)] });
  expect(pixel(el, 30, 85)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 55)[3]).toBe(0);

  vi.advanceTimersByTime(150);
  expect(pixel(el, 30, 55)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 35)[3]).toBe(0);

  chart.update({ dim: 0.5 });
  expect(pixel(el, 30, 35)).toEqual(RED_PIXEL);
});

test('bars cross-fade when their number changes, and jump without animate', () => {
  fakeClock();
  const el = host();
  const chart = plot(el, { ...frame, marks: [column(0.2)], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  chart.update({ marks: [bar({ x1: [2, 6], x2: [4, 8], y1: [0, 0], y2: [0.8, 0.8], color: RED })] });
  vi.advanceTimersByTime(150);
  const faint = pixel(el, 30, 35)[3]!;
  expect(faint).toBeGreaterThan(0);
  expect(faint).toBeLessThan(255);

  const plain = host();
  const still = plot(plain, { ...frame, marks: [column(0.2)] });
  still.update({ marks: [column(0.8)] });
  expect(pixel(plain, 30, 35)).toEqual(RED_PIXEL);
});

test('a bar part-way through its move is finished when another update leaves it unchanged', () => {
  fakeClock();
  const el = host();
  const at = (x: number, y2: number, key: string) =>
    bar({ x1: [x], x2: [x + 2], y1: [0], y2: [y2], color: RED, key });
  const low = at(6, 0.2, 'b');
  const chart = plot(el, { ...frame, marks: [at(2, 0.2, 'a'), low], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  const tall = at(2, 0.8, 'a');
  chart.update({ marks: [tall, low] });
  vi.advanceTimersByTime(150);
  expect(pixel(el, 30, 35)[3]).toBe(0);

  chart.update({ marks: [tall, at(6, 0.8, 'b')] });
  expect(pixel(el, 30, 35)).toEqual(RED_PIXEL);
  expect(pixel(el, 70, 35)).toEqual(RED_PIXEL);
});

test('a bar far outside the domain does not wrap round into view', () => {
  const el = host();
  plot(el, { ...frame, marks: [bar({ x1: [429496731], x2: [429496733], y1: [0], y2: [1], color: RED })] });
  expect(pixel(el, 24, 55)[3]).toBe(0);
});

test('a chart too slow to move its bars cross-fades from the picture it had', () => {
  fakeClock();
  const el = host();
  const slow: Mark = {
    type: 'slow',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint: () => vi.advanceTimersByTime(10) }),
  };
  const chart = plot(el, { ...frame, marks: [slow, column(0.2)], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  chart.update({
    marks: [slow, bar({ x1: [2], x2: [4], y1: [0], y2: [0.8], color: '#0000ff' })],
  });
  expect(pixel(el, 30, 85)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 35)[3]).toBe(0);
});

test('a mark that can always morph is still cross-faded when it replaces an unrelated mark', () => {
  fakeClock();
  const el = host();
  const square = (key: string): Mark => ({
    type: 'square',
    key,
    color: RED,
    options: { key },
    points: 0,
    channels: { x: [], y: [] },
    prepare({ ctx, dpr }) {
      let t = 1;
      return {
        paint() {
          if (t < 1) return;
          ctx.fillStyle = RED;
          ctx.fillRect(25 * dpr, 41 * dpr, 10 * dpr, 8 * dpr);
        },
        morph: v => void (t = v),
      };
    },
  });
  const chart = plot(el, { ...frame, marks: [square('a')], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  chart.update({ marks: [square('b')] });
  vi.advanceTimersByTime(150);
  expect(pixel(el, 30, 45)).toEqual(RED_PIXEL);
});

test('a mark removed while moving is finished before it is released', () => {
  fakeClock();
  const order: string[] = [];
  const mover = (name: string): Mark => ({
    type: 'mover',
    key: 'm',
    color: RED,
    options: { name },
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint() {}, morph: t => void (t === 1 && order.push(`${name} settled`)) }),
    release: () => order.push(`${name} released`),
  });
  const chart = plot(host(), { ...frame, marks: [mover('one')], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  chart.update({ marks: [mover('two')] });
  vi.advanceTimersByTime(150);
  order.length = 0;
  chart.update({ marks: [] });
  expect(order).toEqual(['two settled', 'two released']);
});

test('removing one of two listings of the same mark cross-fades the update', () => {
  fakeClock();
  const el = host();
  const at = (x: number, y2: number, key: string) =>
    bar({ x1: [x], x2: [x + 2], y1: [0], y2: [y2], color: RED, key });
  const twice = at(2, 0.2, 'a');
  const chart = plot(el, {
    ...frame,
    marks: [twice, twice, at(6, 0.2, 'b')],
    use: [animate({ duration: 600 })],
  });
  vi.advanceTimersByTime(700);
  chart.update({ marks: [twice, at(6, 0.8, 'b')] });
  vi.advanceTimersByTime(150);
  const faint = pixel(el, 70, 35)[3]!;
  expect(faint).toBeGreaterThan(0);
  expect(faint).toBeLessThan(255);
});

test('a listing dropped and another added in one update cross-fade it, though the count is the same', () => {
  fakeClock();
  const el = host();
  const at = (x: number, y2: number, key: string) =>
    bar({ x1: [x], x2: [x + 1], y1: [0], y2: [y2], color: RED, key });
  const a = at(1, 0.2, 'a');
  const b = at(3, 0.2, 'b');
  const chart = plot(el, { ...frame, marks: [a, a, b, at(6, 0.2, 'c')], use: [animate({ duration: 600 })] });
  vi.advanceTimersByTime(700);
  chart.update({ marks: [a, b, b, at(6, 0.8, 'c')] });
  vi.advanceTimersByTime(150);
  const faint = pixel(el, 65, 35)[3]!;
  expect(faint).toBeGreaterThan(0);
  expect(faint).toBeLessThan(255);
});

test('the x tooltip gives each stacked area its own value and focuses the one under the pointer', () => {
  const el = host();
  const x = [0, 10];
  const [bottom, top] = stack([
    [0.3, 0.3],
    [0.4, 0.4],
  ]);
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [
      area({ x, ...bottom!, color: RED, label: 'Bottom' }),
      area({ x, ...top!, color: RED, label: 'Top' }),
      area({ x, y1: [0.9, 0.9], y2: [0.95, 0.95], color: RED, group: 'unlabelled' }),
    ],
    use: [tooltip({ mode: 'x', title: () => 'at', value: y => y.toFixed(1) })],
  });
  const root = hover(el, 50, 45);
  expect(root.innerText).toContain('Bottom: 0.3');
  expect(root.innerText).toContain('Top: 0.4');
  expect(root.innerText.match(/: /g)).toHaveLength(2);
  expect(pixel(el, 50, 45)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 85)[3]).toBeLessThan(100);

  hover(el, 50, 85);
  expect(pixel(el, 50, 85)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 45)[3]).toBeLessThan(100);
});

test('a line within reach of the pointer is focused before the area it lies on', () => {
  const el = host();
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [
      area({ x: [0, 10], y: [0.8, 0.8], color: RED, label: 'fill' }),
      line({ x: [0, 10], y: [0.55, 0.55], color: '#0000ff', width: 4, label: 'line' }),
    ],
    use: [tooltip({ mode: 'x', title: () => 'at', value: String })],
  });
  hover(el, 50, 48);
  expect(pixel(el, 50, 85)[3]).toBeLessThan(100);
  hover(el, 50, 85);
  expect(pixel(el, 50, 85)).toEqual([255, 0, 0, 255]);
});

test('area focus follows what is drawn: below zero, never where it is flat or has ended', () => {
  const el = host();
  const x = [0, 10];
  const use = () => [tooltip({ mode: 'x' as const, title: () => 'at', value: (y: number) => y.toFixed(1) })];
  const base = { ...frame, dim: 0.3, y: { domain: [-1, 1] as [number, number], label: '' } };

  plot(el, {
    ...base,
    marks: [
      area({ x, y: [-0.6, -0.6], color: RED, label: 'below' }),
      area({ x, y: [0.6, 0.6], color: RED, label: 'above' }),
    ],
    use: use(),
  });
  expect(hover(el, 50, 65).innerText).toContain('below: -0.6');
  expect(pixel(el, 50, 35)[3]).toBeLessThan(100);

  const flat = host();
  plot(flat, {
    ...base,
    marks: [
      area({ x, y: [0.9, 0.9], color: RED, label: 'fill' }),
      area({ x, y1: [0, 0], y2: [0, 0], color: RED, label: 'flat' }),
    ],
    use: use(),
  });
  hover(flat, 50, 35);
  expect(pixel(flat, 50, 15)).toEqual([255, 0, 0, 255]);

  const ended = host();
  plot(ended, {
    ...base,
    marks: [
      area({ x: [0, 5], y: [0.6, 0.6], curve: 'step', color: RED, label: 'short' }),
      area({ x, y: [-0.6, -0.6], color: RED, label: 'other' }),
    ],
    use: use(),
  });
  expect(hover(ended, 80, 35).innerText).toContain('short: –');
  expect(pixel(ended, 50, 65)).toEqual([255, 0, 0, 255]);
});

test('a line 29 px from the pointer still wins over the area the pointer is in', () => {
  const el = host();
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [
      line({ x: [0, 10], y: [0.55, 0.55], color: '#0000ff', width: 2, label: 'line' }),
      area({ x: [0, 10], y: [0.8, 0.8], color: RED, label: 'fill' }),
    ],
    use: [tooltip({ mode: 'x', title: () => 'at', value: String })],
  });
  hover(el, 50, 74);
  expect(pixel(el, 50, 85)[3]).toBeLessThan(100);
});

test('with one series the hovered bar is picked out; with two the hovered series is', () => {
  const pair = (y2: number, color: string, label?: string) =>
    bar({ x1: [1, 5], x2: [3, 7], y1: [0, 0], y2: [y2, y2], color, label });
  const use = () => [tooltip({ mode: 'nearest' as const, text: () => 'tip' })];

  const one = host();
  plot(one, { ...frame, dim: 0.3, marks: [pair(0.8, RED), flat(0.95)], use: use() });
  hover(one, 20, 55);
  expect(pixel(one, 20, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(one, 60, 55)[3]).toBeLessThan(100);
  expect(pixel(one, 85, 5)).toEqual([255, 0, 0, 255]);
  hover(one, 60, 55);
  expect(pixel(one, 60, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(one, 20, 55)[3]).toBeLessThan(100);
  hover(one, 90, 55);
  expect(pixel(one, 20, 55)).toEqual([255, 0, 0, 255]);

  const two = host();
  plot(two, {
    ...frame,
    dim: 0.3,
    marks: [pair(0.8, RED, 'a'), bar({ x1: [8], x2: [10], y1: [0], y2: [0.8], color: RED, label: 'b' })],
    use: use(),
  });
  hover(two, 20, 55);
  expect(pixel(two, 60, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(two, 90, 55)[3]).toBeLessThan(100);
});

test('a pointer given at creation on a bar of a fixed-size chart does not skip the entrance', () => {
  fakeClock();
  const el = host();
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [column(0.8)],
    pointer: { x: 3, y: 0.4 },
    use: [tooltip({ mode: 'nearest', text: () => 'tip' }), animate({ duration: 600 })],
  });
  expect((el.firstElementChild as HTMLElement).innerText).toContain('tip');
  expect(pixel(el, 35, 55)[3]).toBe(0);
  vi.advanceTimersByTime(700);
  expect(pixel(el, 35, 55)).toEqual(RED_PIXEL);
});

test('an update of the focus and the layout during the entrance leaves the picture of the new layout', () => {
  fakeClock();
  const options = {
    ...frame,
    x: { domain: [0, 10], label: '' },
    marks: [column(0.8)],
  } satisfies Partial<Options>;
  const moved = { margin: { top: 0, right: 0, bottom: 60, left: 0 }, dim: 0.3 };
  const el = host();
  const chart = plot(el, {
    ...options,
    margin: { top: 0, right: 0, bottom: 20, left: 0 },
    use: [animate({ duration: 600 })],
  });
  vi.advanceTimersByTime(100);
  chart.update(moved);
  vi.advanceTimersByTime(700);
  const still = host();
  plot(still, { ...options, ...moved });
  expect(drift(pixels(el), pixels(still))).toBeLessThanOrEqual(6);
});

test('a pointer at rest on a bar does not cut the bar short when its data changes', () => {
  fakeClock();
  const el = host();
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: [column(0.2)],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' }), animate({ duration: 600 })],
  });
  vi.advanceTimersByTime(700);
  hover(el, 30, 85);
  chart.update({ marks: [column(0.8)] });
  vi.advanceTimersByTime(150);
  expect(pixel(el, 30, 55)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 35)[3]).toBe(0);
});

test('a tapped bar lets go of its focus without cutting the bar short when its data changes', () => {
  fakeClock();
  const el = host();
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: [column(0.2)],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' }), animate({ duration: 600 })],
  });
  vi.advanceTimersByTime(700);
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  touch(root, box.left + 30, box.top + 85);
  expect(root.innerText).toContain('tip');
  chart.update({ marks: [column(0.8)] });
  expect(root.innerText).not.toContain('tip');
  vi.advanceTimersByTime(150);
  expect(pixel(el, 30, 55)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 35)[3]).toBe(0);
});

test('moving between bars of the focused series does not cut their move short', () => {
  fakeClock();
  const el = host();
  const pair = (y2: number) =>
    bar({ x1: [1, 5], x2: [3, 7], y1: [0, 0], y2: [y2, y2], color: RED, label: 'a' });
  const other = bar({ x1: [8], x2: [10], y1: [0], y2: [0.5], color: RED, label: 'b' });
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: [pair(0.2), other],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' }), animate({ duration: 600 })],
  });
  vi.advanceTimersByTime(700);
  hover(el, 20, 85);
  chart.update({ marks: [pair(0.8), other] });
  vi.advanceTimersByTime(150);
  hover(el, 60, 85);
  expect(pixel(el, 60, 55)).toEqual(RED_PIXEL);
  expect(pixel(el, 60, 35)[3]).toBe(0);
});

test('a margin left out is sized from the labels, and a side that is given is kept', () => {
  const left = (options: Partial<Options>) => {
    let chart!: Internals;
    plot(host(), { ...frame, marks: [], ...options, use: [c => ((chart = c), { destroy() {} })] });
    return chart.margin();
  };
  const small = left({ margin: undefined });
  const wide = left({ margin: undefined, y: { domain: [0, 1_000_000], label: '' } });
  const titled = left({ margin: undefined, y: { domain: [0, 1], label: 'Value' } });
  expect(wide.left).toBeGreaterThan(small.left);
  expect(titled.left).toBeGreaterThan(small.left);
  expect(left({ margin: { left: 5 } })).toEqual({ ...small, left: 5 });
});

test('bands gives each category its bar, and each slot of a group its share of it', () => {
  const round = (pair: Float64Array[]) => pair.map(c => Array.from(c, v => +v.toFixed(3)));
  expect(round(bands(3))).toEqual([
    [-0.4, 0.6, 1.6],
    [0.4, 1.4, 2.4],
  ]);
  expect(round(bands([2, 5], { slot: 1, of: 2 }))).toEqual([
    [2, 5],
    [2.4, 5.4],
  ]);
  expect(round(bands(1, { width: 1 }))).toEqual([[-0.5], [0.5]]);
});

test('a bar given a single y or x starts at zero', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      bar({ x1: [1], x2: [3], y: [0.5], color: RED }),
      bar({ x: [8], y1: [0.72], y2: [0.88], color: RED }),
    ],
  });
  expect(pixel(el, 20, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 20, 35)[3]).toBe(0);
  expect(pixel(el, 5, 21)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 21)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 85, 21)[3]).toBe(0);
});

test('the legend lists each labelled group once, makes room above the plot and focuses on hover', () => {
  const el = host();
  let chart!: Internals;
  const marks = [
    line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'first' }),
    area({ x: [0, 10], y1: [0.2, 0.2], y2: [0.3, 0.3], color: RED, group: 'first' }),
    line({ x: [0, 10], y: [0.75, 0.75], color: '#0000ff', width: 4, label: 'second' }),
    line({ x: [0, 10], y: [0.5, 0.5], color: RED }),
  ];
  plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks,
    use: [
      legend(),
      tooltip({ mode: 'x', title: () => '', value: String }),
      c => ((chart = c), { destroy() {} }),
    ],
  });
  const items = [...el.querySelectorAll('span')].filter(s => s.children.length);
  expect(items.map(s => s.textContent)).toEqual(['first', 'second']);
  expect(chart.margin().top).toBe(24);

  const second = chart.yPx(0.75);
  items[0]!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, 150, second)[3]).toBeLessThan(100);
  items[0]!.firstElementChild!.dispatchEvent(
    new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }),
  );
  expect(pixel(el, 150, second)[3]).toBeLessThan(100);
  el.firstElementChild!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse' }));
  expect(pixel(el, 150, second)).toEqual([0, 0, 255, 255]);
});

test('the legend wraps onto as many rows as its entries need and reserves them all', () => {
  let chart!: Internals;
  const named = (label: string) => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label });
  const el = host();
  plot(el, {
    ...frame,
    height: 300,
    marks: [named('a rather long name'), named('another long name'), named('third')],
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().top).toBe(64);
  expect(el.querySelectorAll('span > span')).toHaveLength(3);
});

const textOf = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll('div')].find(d => !d.children.length && d.textContent === text)!;

test('twelve legend entries stay inside a 400 px chart, on as many rows as they take', () => {
  const el = host();
  let chart!: Internals;
  const named = (label: string) => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label });
  plot(el, {
    ...frame,
    width: 400,
    height: 300,
    marks: Array.from({ length: 12 }, (_, i) => named(`entry ${String.fromCharCode(97 + i)}xxx`)),
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  const root = el.firstElementChild!.getBoundingClientRect();
  expect(root.width).toBe(400);
  const items = [...el.querySelectorAll('span')].filter(s => s.children.length);
  expect(items).toHaveLength(12);
  for (const item of items) {
    const box = item.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(root.left);
    expect(box.right).toBeLessThanOrEqual(root.left + 400);
  }
  const tops = [...new Set(items.map(i => i.getBoundingClientRect().top))].sort((a, b) => a - b);
  expect(tops.slice(1).map((t, i) => t - tops[i]!)).toEqual([20, 20]);
  const first = items[0]!.parentElement!.getBoundingClientRect();
  const last = items.at(-1)!.parentElement!.getBoundingClientRect();
  expect(chart.margin().top).toBe(last.bottom - first.top + 4);
});

const moreOf = (el: HTMLElement) =>
  [...el.querySelectorAll('span')].find(s => !s.children.length && s.textContent!.startsWith('+'));

test('thirty legend entries in a chart 120 px tall take a third of it, the last row ending in "+N more" titled with the rest', async () => {
  const el = host();
  let chart!: Internals;
  const onHiddenChange = vi.fn();
  const names = Array.from({ length: 30 }, (_, i) => `series ${i}`);
  plot(el, {
    ...frame,
    width: 300,
    height: 120,
    marks: names.map(label => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label })),
    onHiddenChange,
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().top).toBeLessThanOrEqual(40);
  const shown = entriesOf(el).map(s => s.textContent);
  expect(shown).toEqual(names.slice(0, shown.length));
  await nextFrame();
  await nextFrame();
  const more = moreOf(el)!;
  expect(more.textContent).toBe(`+${30 - shown.length} more`);
  expect(more.title).toBe(names.slice(shown.length).join(', '));
  expect(more.parentElement).toBe(entriesOf(el).at(-1)!.parentElement);
  expect(more.getAttribute('role')).toBeNull();
  expect(more.tabIndex).toBe(-1);
  const root = el.firstElementChild!.getBoundingClientRect();
  expect(more.getBoundingClientRect().right).toBeLessThanOrEqual(root.left + 300);
  more.dispatchEvent(new MouseEvent('click', middleOf(more)));
  expect(onHiddenChange).not.toHaveBeenCalled();
});

test('legend({ rows: 2 }) caps the legend at two rows', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...frame,
    width: 300,
    height: 600,
    marks: Array.from({ length: 30 }, (_, i) =>
      line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: `series ${i}` }),
    ),
    use: [legend({ rows: 2 }), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().top).toBe(44);
  expect(new Set(entriesOf(el).map(s => s.parentElement)).size).toBe(2);
  expect(moreOf(el)).toBeDefined();
});

test('legend({ rows: 1 }) with one long label on a narrow chart keeps "+N more" in sight', () => {
  const el = host();
  plot(el, {
    ...frame,
    width: 200,
    marks: ['a very long series label indeed', 'b', 'c'].map(label =>
      line({ x: [0, 10], y: [0.5, 0.5], color: RED, label }),
    ),
    use: [legend({ rows: 1 })],
  });
  const more = moreOf(el)!;
  expect(more.textContent).toBe('+2 more');
  const row = more.parentElement!.getBoundingClientRect();
  expect(more.getBoundingClientRect().right).toBeLessThanOrEqual(row.right);
  expect(entriesOf(el)[0]!.getBoundingClientRect().right).toBeLessThanOrEqual(
    more.getBoundingClientRect().left,
  );
});

test('legend({ rows: 1.5 }) caps the legend at one row', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...frame,
    width: 300,
    height: 600,
    marks: Array.from({ length: 30 }, (_, i) =>
      line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: `series ${i}` }),
    ),
    use: [legend({ rows: 1.5 }), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().top).toBe(24);
  expect(moreOf(el)).toBeDefined();
});

test('heatmap strips share the third of the height with the entries, those left out behind "+N more"', () => {
  const heatmaps = () =>
    ['Load', 'Heat', 'Wind'].map(label =>
      heatmap({ values: [0, 1], columns: 2, label, color: sequential({ stops: ['#ff0000', '#0000ff'] }) }),
    );
  const series = () =>
    Array.from({ length: 30 }, (_, i) =>
      line({ x: [0, 1], y: [0.5, 0.5], color: RED, label: `series ${i}` }),
    );
  const strips = (el: HTMLElement) => [...el.querySelectorAll('span')].filter(s => s.style.backgroundImage);
  const draw = (height: number, marks: Mark[]) => {
    const el = host();
    let chart!: Internals;
    plot(el, {
      ...frame,
      width: 300,
      height,
      x: { domain: 'data', label: '' },
      y: { domain: 'data', label: '' },
      marks,
      use: [legend(), c => ((chart = c), { destroy() {} })],
    });
    return { el, top: chart.margin().top };
  };
  const mixed = draw(120, [...heatmaps(), ...series()]);
  expect(mixed.top).toBeLessThanOrEqual(40);
  expect(strips(mixed.el)).toHaveLength(0);
  const shown = entriesOf(mixed.el).length;
  expect(moreOf(mixed.el)!.textContent).toBe(`+${30 - shown + 3} more`);
  expect(moreOf(mixed.el)!.title).toMatch(/, Load, Heat, Wind$/);
  const only = draw(120, heatmaps());
  expect(only.top).toBeLessThanOrEqual(40);
  expect(moreOf(only.el)!.textContent).toBe('+3 more');
  const roomy = draw(180, [...heatmaps(), ...series()]);
  expect(roomy.top).toBeLessThanOrEqual(60);
  expect(strips(roomy.el)).toHaveLength(1);
  expect(moreOf(roomy.el)!.title).toMatch(/, Heat, Wind$/);
});

test('a series behind "+N more" is still hidden and shown with hidden', () => {
  const el = host();
  let chart!: Internals;
  const marks = [
    ...Array.from({ length: 29 }, (_, i) =>
      line({ x: [0, 10], y: [0.2, 0.2], color: '#0000ff', label: `series ${i}` }),
    ),
    line({ x: [0, 10], y: [0.8, 0.8], color: RED, width: 4, label: 'last' }),
  ];
  const options = { ...frame, width: 300, height: 120, marks, use: [legend(), grab(c => (chart = c))] };
  const c = plot(el, { ...options, hidden: ['last'] });
  expect(entriesOf(el).map(s => s.textContent)).not.toContain('last');
  expect(pixel(el, 150, chart.yPx(0.8))).not.toEqual([255, 0, 0, 255]);
  c.update({ hidden: [] });
  expect(pixel(el, 150, chart.yPx(0.8))).toEqual([255, 0, 0, 255]);
});

test('y tick labels of twelve characters get a left margin of 14 plus 7 a character', () => {
  const el = host();
  let chart!: Internals;
  const labels = ['xxxxxxxxxxx0', 'xxxxxxxxxxx1'];
  plot(el, {
    ...frame,
    width: 400,
    height: 300,
    margin: undefined,
    marks: [],
    y: {
      domain: [0, 1],
      label: '',
      scale: () => ({ lo: 0, hi: 1, ticks: labels.map((label, value) => ({ value, label })) }),
    },
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().left).toBe(14 + 12 * 7);
  const root = el.firstElementChild!.getBoundingClientRect();
  for (const label of labels)
    expect(textOf(el, label).getBoundingClientRect().left).toBeGreaterThanOrEqual(root.left);
});

test('the last x tick label ends inside the right edge on a linear, a time and a band axis', () => {
  const cases: [Axis, string, number][] = [
    [{ domain: [0, 1_000_000], label: '' }, '1000000', 1_000_000],
    [
      time({ label: '', domain: [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 12)] }),
      '12:00',
      Date.UTC(2026, 0, 1, 12),
    ],
    [band({ label: '', categories: ['a', 'b', 'c'].map(c => c + 'x'.repeat(21)) }), 'c' + 'x'.repeat(21), 2],
  ];
  for (const [x, last, value] of cases) {
    const el = host();
    let chart!: Internals;
    plot(el, {
      ...frame,
      width: 400,
      height: 300,
      margin: undefined,
      x,
      marks: [],
      use: [c => ((chart = c), { destroy() {} })],
    });
    expect(chart.xPx(value) + last.length * 3.5).toBeLessThanOrEqual(400);
    const root = el.firstElementChild!.getBoundingClientRect();
    expect(root.width).toBe(400);
    expect(textOf(el, last).getBoundingClientRect().right).toBeLessThanOrEqual(root.left + 400);
  }
});

test('a legend label longer than the plot ends in an ellipsis on one row and is titled, one that fits is not', async () => {
  const el = host();
  let chart!: Internals;
  const long = 'x'.repeat(80);
  const named = (label: string) => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label });
  const laid = async () => {
    await nextFrame();
    await nextFrame();
    return [...el.querySelectorAll('span')].find(s => s.children.length)!;
  };
  const c = plot(el, {
    ...frame,
    width: 400,
    height: 300,
    marks: [named(long)],
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().top).toBe(24);
  const root = el.firstElementChild!.getBoundingClientRect();
  const item = await laid();
  const row = item.parentElement!;
  expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(root.left + 400);
  expect(item.getBoundingClientRect().width).toBe(row.getBoundingClientRect().width);
  expect(getComputedStyle(item).textOverflow).toBe('ellipsis');
  expect(item.scrollWidth).toBeGreaterThan(item.clientWidth);
  expect(item.title).toBe(long);

  c.update({ width: 1000 });
  expect((await laid()).hasAttribute('title')).toBe(false);

  c.update({ width: 400, marks: [named('short')] });
  const fits = await laid();
  expect(fits.hasAttribute('title')).toBe(false);
  expect(fits.scrollWidth).toBe(fits.clientWidth);
});

test('a legend title follows the rendered glyphs, not the width a label is estimated at', async () => {
  const el = host();
  const named = (label: string) => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label });
  const laid = async () => {
    await nextFrame();
    await nextFrame();
    return [...el.querySelectorAll('span')].find(s => s.children.length)!;
  };
  // At 7 px a character 22 W fit in 200 px and 30 i do not; in the chart's proportional font it is the other way.
  const wide = 'W'.repeat(22);
  const c = plot(el, { ...frame, width: 200, height: 300, marks: [named(wide)], use: [legend()] });
  const cut = await laid();
  expect(cut.scrollWidth).toBeGreaterThan(cut.clientWidth);
  expect(cut.title).toBe(wide);

  c.update({ marks: [named('i'.repeat(30))] });
  const fits = await laid();
  expect(fits.scrollWidth).toBe(fits.clientWidth);
  expect(fits.hasAttribute('title')).toBe(false);

  c.update({ width: 60 });
  expect((await laid()).title).toBe('i'.repeat(30));
});

test('only the legend entries take the pointer, and the legend follows an update', () => {
  const el = host();
  let internals!: Internals;
  const named = (label: string) => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label });
  const chart = plot(el, {
    ...frame,
    width: 300,
    marks: [named('one')],
    use: [legend(), c => ((internals = c), { destroy() {} })],
  });
  const root = el.firstElementChild!;
  const box = root.getBoundingClientRect();
  const item = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = item.getBoundingClientRect();
  expect(document.elementFromPoint(spot.left + 2, spot.top + spot.height / 2)).toBe(item.firstElementChild);
  expect(document.elementFromPoint(box.left + 250, box.top + 12)).toBe(root);

  chart.update({ marks: [named('one'), named('two')] });
  expect([...el.querySelectorAll('span')].filter(s => s.children.length).map(s => s.textContent)).toEqual([
    'one',
    'two',
  ]);
  chart.update({ marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED })] });
  expect(el.querySelectorAll('span')).toHaveLength(0);
  expect(internals.margin().top).toBe(0);
});

test('an automatic margin survives an undefined side and makes room for a long first x tick', () => {
  const margin = (options: Partial<Options>) => {
    let chart!: Internals;
    plot(host(), { ...frame, marks: [], ...options, use: [c => ((chart = c), { destroy() {} })] });
    return chart.margin();
  };
  const auto = margin({ margin: undefined });
  expect(margin({ margin: { left: undefined } })).toEqual(auto);

  const long = 'a tick label of 26 letters';
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...frame,
    width: 190,
    margin: undefined,
    marks: [],
    x: { domain: [0, 1], label: '', scale: () => ({ lo: 0, hi: 1, ticks: [{ value: 0, label: long }] }) },
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().left).toBeGreaterThanOrEqual(long.length * 3.5);
  expect(chart.margin().right).toBe(16);
  expect((el.firstElementChild as HTMLElement).style.visibility).toBe('');
});

test('the legend lets go of its focus when the hovered entry is taken away, and sets a colour only as a colour', () => {
  const el = host();
  const named = (label?: string) =>
    line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label, group: 'a' });
  const other = line({
    x: [0, 10],
    y: [0.75, 0.75],
    color: 'red;background-image:url(x)',
    width: 4,
    label: 'b',
  });
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks: [named('a'), other],
    use: [legend(), c => ((internals = c), { destroy() {} })],
  });
  const items = [...el.querySelectorAll('span')].filter(s => s.children.length);
  expect((items[1]!.firstElementChild as HTMLElement).style.backgroundImage).toBe('');

  const y = internals.yPx(0.25);
  expect(pixel(el, 150, y)).toEqual([255, 0, 0, 255]);
  items[1]!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, 150, y)[3]).toBeLessThan(100);
  chart.update({
    marks: [named('a'), line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, group: 'b' })],
  });
  expect(pixel(el, 150, y)).toEqual([255, 0, 0, 255]);
});

test('a tapped legend entry keeps its series highlighted after the finger lifts, until the page is tapped elsewhere or the chart updates', () => {
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks: [
      line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'aa' }),
      line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'bb' }),
    ],
    use: [legend({ toggle: false }), c => ((internals = c), { destroy() {} })],
  });
  const first = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = first.getBoundingClientRect();
  touch(first, spot.left + spot.width / 2, spot.top + spot.height / 2);
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
  chart.update({ dim: 0.2 });
  expect(pixel(el, 150, internals.yPx(0.75))).toEqual([255, 0, 0, 255]);
  touch(first, spot.left + spot.width / 2, spot.top + spot.height / 2);
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
  const control = host();
  control.addEventListener('pointerdown', e => e.stopPropagation());
  control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  expect(pixel(el, 150, internals.yPx(0.75))).toEqual([255, 0, 0, 255]);
});

test('a pen lifted off the chart leaves no tooltip or legend highlight behind', () => {
  const el = host();
  let internals!: Internals;
  plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks: [
      line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'aa' }),
      line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'bb' }),
    ],
    use: [
      legend(),
      tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(1) }),
      c => ((internals = c), { destroy() {} }),
    ],
  });
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  touch(root, box.left + 210, box.top + internals.yPx(0.5), 'pen');
  expect(root.innerText).not.toContain('x=7');
  const first = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = first.getBoundingClientRect();
  touch(first, spot.left + spot.width / 2, spot.top + spot.height / 2, 'pen');
  expect(pixel(el, 150, internals.yPx(0.75))).toEqual([255, 0, 0, 255]);
});

test('a tap on the plot does not let a pen that came straight onto a legend entry lose its highlight on an update', () => {
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks: [
      line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'aa' }),
      line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'bb' }),
    ],
    use: [
      legend(),
      tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(1) }),
      c => ((internals = c), { destroy() {} }),
    ],
  });
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  touch(root, box.left + 210, box.top + internals.yPx(0.5));
  expect(root.innerText).toContain('x=7');
  const first = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = first.getBoundingClientRect();
  const init = {
    bubbles: true,
    pointerType: 'pen',
    clientX: spot.left + spot.width / 2,
    clientY: spot.top + spot.height / 2,
  };
  first.dispatchEvent(new PointerEvent('pointermove', init));
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
  chart.update({ dim: 0.2 });
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
});

test('a chart taken out of the page after a legend entry is tapped still updates', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    width: 300,
    marks: [line({ x: [0, 10], y: [0.25, 0.25], color: RED, label: 'aa' })],
    use: [legend()],
  });
  const first = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = first.getBoundingClientRect();
  touch(first, spot.left + spot.width / 2, spot.top + spot.height / 2);
  el.remove();
  expect(() => chart.update({ height: 120 })).not.toThrow();
});

test.each(['open', 'closed'] as const)(
  'in a %s shadow root a tapped tooltip and legend entry stay after the finger lifts and are let go on a resize',
  mode => {
    const el = host().attachShadow({ mode }).appendChild(document.createElement('div'));
    let internals!: Internals;
    const chart = plot(el, {
      ...frame,
      width: 300,
      dim: 0.3,
      marks: [
        dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'A' }),
        line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'bb' }),
      ],
      use: [
        legend({ toggle: false }),
        tooltip({ mode: 'nearest', text: label => `tip ${label}` }),
        c => ((internals = c), { destroy() {} }),
      ],
    });
    const root = el.firstElementChild as HTMLElement;
    const box = root.getBoundingClientRect();
    touch(root, box.left + internals.xPx(5), box.top + internals.yPx(0.5));
    expect(root.innerText).toContain('tip A');
    const entry = [...el.querySelectorAll('span')].find(s => s.children.length)!;
    const spot = entry.getBoundingClientRect();
    touch(entry, spot.left + spot.width / 2, spot.top + spot.height / 2);
    expect(pixel(el, 150, internals.yPx(0.25))[3]).toBeLessThan(100);
    chart.update({ height: 120 });
    expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
  },
);

const three = () => [
  line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'A' }),
  line({ x: [0, 10], y: [0.5, 0.5], color: RED, width: 4, label: 'B' }),
  line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'C' }),
];

test('the legend lists a hidden series dimmed and not pressed, and pointing at it focuses nothing', () => {
  const el = host();
  let internals!: Internals;
  plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    hidden: ['B'],
    marks: three(),
    use: [legend(), grab(c => (internals = c))],
  });
  const [a, b] = entriesOf(el);
  expect(entriesOf(el).map(s => s.textContent)).toEqual(['A', 'B', 'C']);
  expect(b!.style.opacity).toBe('0.4');
  expect(a!.style.opacity).toBe('');
  expect(b!.getAttribute('aria-pressed')).toBe('false');
  expect(a!.getAttribute('aria-pressed')).toBe('true');
  b!.dispatchEvent(new PointerEvent('pointermove', middleOf(b!)));
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
  a!.dispatchEvent(new PointerEvent('pointermove', middleOf(a!)));
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
});

test('a click on a legend entry hides its series and a second shows it, each reported once, and the resting mouse dims nothing', () => {
  const el = host();
  let internals!: Internals;
  const onHiddenChange = vi.fn();
  plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks: three(),
    onHiddenChange,
    use: [legend(), grab(c => (internals = c))],
  });
  const b = entriesOf(el)[1]!;
  expect(b.getAttribute('role')).toBe('button');
  expect(b.tabIndex).toBe(0);
  b.dispatchEvent(new PointerEvent('pointermove', middleOf(b)));
  expect(pixel(el, 150, internals.yPx(0.25))[3]).toBeLessThan(100);

  b.dispatchEvent(new MouseEvent('click', middleOf(b)));
  expect(onHiddenChange.mock.calls).toEqual([[['B']]]);
  expect(pixel(el, 150, internals.yPx(0.5))).not.toEqual([255, 0, 0, 255]);
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
  expect(b.getAttribute('aria-pressed')).toBe('false');

  entriesOf(el)[1]!.dispatchEvent(new MouseEvent('click', middleOf(b)));
  expect(onHiddenChange.mock.calls).toEqual([[['B']], [[]]]);
  for (const y of [0.25, 0.5, 0.75]) expect(pixel(el, 150, internals.yPx(y))).toEqual([255, 0, 0, 255]);
});

test('a legend entry can be focused with the keyboard, and Enter and Space toggle it', () => {
  const el = host();
  let internals!: Internals;
  plot(el, { ...frame, width: 300, marks: three(), use: [legend(), grab(c => (internals = c))] });
  const b = entriesOf(el)[1]!;
  b.focus();
  expect(document.activeElement).toBe(b);
  const key = (k: string) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(e);
    return e;
  };
  key('Enter');
  expect(internals.hidden()).toEqual(['B']);
  expect(document.activeElement).toBe(b);
  expect(key(' ').defaultPrevented).toBe(true);
  expect(internals.hidden()).toEqual([]);
  expect(key('a').defaultPrevented).toBe(false);
  expect(internals.hidden()).toEqual([]);
});

test('a legend entry keeps the keyboard focus when hiding its series narrows the y tick labels', () => {
  const el = host();
  plot(el, {
    width: 300,
    height: 300,
    x: { domain: [0, 10], label: '' },
    marks: [
      line({ x: [0, 10], y: [0, 1], color: RED, label: 'A' }),
      line({ x: [0, 10], y: [0, 1000], color: RED, label: 'B' }),
    ],
    use: [legend()],
  });
  const b = entriesOf(el)[1]!;
  const box = b.parentElement!.parentElement!;
  const before = box.style.left;
  b.focus();
  b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(box.style.left).not.toBe(before);
  expect(document.activeElement).toBe(b);
  b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(box.style.left).toBe(before);
  expect(document.activeElement).toBe(b);
});

test('a legend entry keeps the keyboard focus when hiding its series moves the other entry onto its row', () => {
  const el = host();
  plot(el, {
    width: 300,
    height: 300,
    x: { domain: [0, 10], label: '' },
    marks: [
      line({ x: [0, 10], y: [0, 1], color: RED, label: 'A'.repeat(13) }),
      line({ x: [0, 10], y: [0, 1e6], color: RED, label: 'B'.repeat(14) }),
    ],
    use: [legend()],
  });
  const rows = () => entriesOf(el)[0]!.parentElement!.parentElement!.children.length;
  expect(rows()).toBe(2);
  entriesOf(el)[1]!.focus();
  const key = () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
  key();
  expect(rows()).toBe(1);
  expect(document.activeElement).toBe(entriesOf(el)[1]);
  key();
  expect(rows()).toBe(2);
  expect(document.activeElement).toBe(entriesOf(el)[1]);
});

test('a tap on a legend entry hides its series and holds no highlight after the finger lifts, while a mouse hover still highlights', () => {
  const el = host();
  let internals!: Internals;
  plot(el, { ...frame, width: 300, dim: 0.3, marks: three(), use: [legend(), grab(c => (internals = c))] });
  const [a, b] = entriesOf(el);
  const { clientX, clientY } = middleOf(b!);
  touch(b!, clientX, clientY);
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
  const box = el.firstElementChild!.getBoundingClientRect();
  tap(el, clientX - box.left, clientY - box.top);
  expect(internals.hidden()).toEqual(['B']);
  for (const y of [0.25, 0.75]) expect(pixel(el, 150, internals.yPx(y))).toEqual([255, 0, 0, 255]);
  a!.dispatchEvent(new PointerEvent('pointermove', middleOf(a!)));
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
});

test('with legend({ toggle: false }) a click on an entry changes nothing and an entry is no button', () => {
  const el = host();
  let internals!: Internals;
  const onHiddenChange = vi.fn();
  plot(el, {
    ...frame,
    width: 300,
    marks: three(),
    onHiddenChange,
    use: [legend({ toggle: false }), grab(c => (internals = c))],
  });
  const b = entriesOf(el)[1]!;
  b.dispatchEvent(new MouseEvent('click', middleOf(b)));
  b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(internals.hidden()).toEqual([]);
  expect(onHiddenChange).not.toHaveBeenCalled();
  expect(['role', 'tabindex', 'aria-pressed'].map(n => b.getAttribute(n))).toEqual([null, null, null]);
});

test("a slice's legend entry does not toggle and still picks its slice out", () => {
  const el = host();
  let internals!: Internals;
  plot(el, {
    ...pie,
    width: 300,
    height: 320,
    dim: 0.2,
    marks: [arcs({ values: [1, 1], colors: [RED, BLUE], labels: ['one', 'two'] })],
    use: [legend(), grab(c => (internals = c))],
  });
  const two = entriesOf(el)[1]!;
  expect(two.getAttribute('role')).toBeNull();
  two.dispatchEvent(new MouseEvent('click', middleOf(two)));
  expect(internals.hidden()).toEqual([]);
  const middle = (el.querySelector('canvas')!.height / devicePixelRatio + 24) / 2;
  two.dispatchEvent(new PointerEvent('pointermove', middleOf(two)));
  expect(pixel(el, 80, middle)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 220, middle)[3]).toBeLessThan(100);
});

test('destroying a chart removes the document listeners its tooltip and legend added', () => {
  const add = vi.spyOn(document, 'addEventListener');
  const remove = vi.spyOn(document, 'removeEventListener');
  const chart = plot(host(), {
    ...frame,
    marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: 'a' })],
    use: [legend(), tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(add.mock.calls).toHaveLength(2);
  chart.destroy();
  expect(remove.mock.calls).toEqual(expect.arrayContaining(add.mock.calls));
});

test('the legend follows its entries when they move under a pointer at rest', () => {
  const el = host();
  let internals!: Internals;
  const a = line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'aa' });
  const b = line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'bb' });
  const chart = plot(el, {
    ...frame,
    width: 300,
    dim: 0.3,
    marks: [a, b],
    use: [legend(), c => ((internals = c), { destroy() {} })],
  });
  const first = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = first.getBoundingClientRect();
  const [x, y] = [spot.left + spot.width / 2, spot.top + spot.height / 2];
  first.dispatchEvent(
    new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true, clientX: x, clientY: y }),
  );
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);

  chart.update({ marks: [b, a] });
  expect(pixel(el, 150, internals.yPx(0.75))).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 150, internals.yPx(0.25))[3]).toBeLessThan(100);

  chart.update({ marks: [line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4 })] });
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
});

test('a long label on a tick part-way along the axis is kept inside the chart, and no further', () => {
  let chart!: Internals;
  const long = 'x'.repeat(40);
  plot(host(), {
    ...frame,
    width: 300,
    margin: undefined,
    marks: [],
    x: {
      domain: [0, 1],
      label: '',
      scale: () => ({
        lo: 0,
        hi: 1,
        ticks: [
          { value: 0.2, label: long },
          { value: 0.5, label: 'm' },
        ],
      }),
    },
    use: [c => ((chart = c), { destroy() {} })],
  });
  const leftEdge = chart.xPx(0.2) - (long.length * 3.5 + 4);
  expect(leftEdge).toBeGreaterThanOrEqual(-0.01);
  expect(leftEdge).toBeLessThan(1);
  expect(chart.margin().right).toBe(16);
});

test('two long labels close together on the axis are both kept inside the chart', () => {
  let chart!: Internals;
  const long = 'x'.repeat(140);
  const half = long.length * 3.5 + 4;
  const el = host();
  plot(el, {
    ...frame,
    width: 1000,
    margin: undefined,
    marks: [],
    x: {
      domain: [0, 1],
      label: '',
      scale: () => ({
        lo: 0,
        hi: 1,
        ticks: [
          { value: 0.4, label: long },
          { value: 0.45, label: long },
        ],
      }),
    },
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(chart.xPx(0.4) - half).toBeGreaterThanOrEqual(-0.01);
  expect(chart.xPx(0.45) + half).toBeLessThanOrEqual(1000.01);
  expect((el.firstElementChild as HTMLElement).style.visibility).toBe('');
});

test('ticks thin out to fit the axis while the rounded bounds hold still', () => {
  const wide = scale('nice', [3, 97], { length: 800, horizontal: true });
  const narrow = scale('nice', [3, 97], { length: 120, horizontal: true });
  const short = scale('nice', [3, 97], { length: 70, horizontal: false });
  expect(wide.ticks).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  expect(narrow).toEqual({ lo: 0, hi: 100, ticks: [0, 50, 100] });
  expect(short.ticks).toEqual([0, 50, 100]);
  expect(scale('nice', [0, 5_000_000], { length: 300, horizontal: true }).ticks).toEqual([
    0, 2_000_000, 4_000_000,
  ]);

  const days = time({ label: '' });
  const span: [number, number] = [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 11)];
  expect(days.scale!(days, () => span, { length: 900, horizontal: true }).ticks).toHaveLength(11);
  const fortnight: [number, number] = [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 15)];
  expect(
    days.scale!(days, () => fortnight, { length: 200, horizontal: true }).ticks.map(t => t.label),
  ).toEqual(['Jan 5', 'Jan 12']);

  const names = band({ label: '', categories: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
  expect(names.scale!(names, () => [0, 1], { length: 600, horizontal: true }).ticks).toHaveLength(5);
  expect(
    names.scale!(names, () => [0, 1], { length: 200, horizontal: true }).ticks.map(t => t.label),
  ).toEqual(['Monday', 'Thursday']);
});

test('a chart ticks its axes again when it is resized', () => {
  const el = host();
  const chart = plot(el, { ...frame, width: 600, x: { domain: [0, 100], label: '' }, marks: [] });
  const labels = () =>
    [...el.querySelectorAll('div')].filter(d => !d.children.length && d.textContent).length;
  const many = labels();
  chart.update({ width: 120 });
  expect(labels()).toBeLessThan(many);
  chart.update({ width: 600 });
  expect(labels()).toBe(many);
});

test('a chart redraws at the new density when the screen density changes', () => {
  const was = devicePixelRatio;
  let changed!: () => void;
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        addEventListener: (_: string, f: () => void) => void (changed = f),
        removeEventListener() {},
      }) as never,
  );
  const el = host();
  plot(el, { ...frame, marks: [flat(0.55)] });
  const canvas = el.querySelector('canvas')!;
  expect(canvas.width).toBe(100 * was);
  try {
    Object.defineProperty(window, 'devicePixelRatio', { value: was * 2, configurable: true });
    changed();
    expect(canvas.width).toBe(200 * was);
    expect(canvas.style.width).toBe('100px');
    expect(pixel(el, 50, 45)).toEqual([255, 0, 0, 255]);
  } finally {
    Object.defineProperty(window, 'devicePixelRatio', { value: was, configurable: true });
  }
});

test('a horizontal bar reports its value end, and the tooltip is told the row', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [bar({ x: [4, 8], y1: [0.1, 0.6], y2: [0.4, 0.9], color: RED })],
    use: [tooltip({ mode: 'nearest', text: (_, x, y, row) => `x ${x} y ${y.toFixed(2)} row ${row}` })],
  });
  expect(hover(el, 20, 25).innerText).toContain('x 8 y 0.75 row 1');
  expect(hover(el, 20, 75).innerText).toContain('x 4 y 0.25 row 0');
});

test('the chart is an image with a label that follows updates, and its tick labels are hidden from readers', () => {
  const el = host();
  const named = (label?: string) => line({ x: [0, 10], y: [0.5, 0.5], color: RED, label });
  const chart = plot(el, { ...frame, marks: [named()] });
  const canvas = el.querySelector('canvas')!;
  expect(canvas.getAttribute('role')).toBe('img');
  expect(canvas.ariaLabel).toBe('Chart');
  expect(el.querySelector('[aria-hidden="true"]')!.textContent).toContain('0');

  chart.update({
    x: { domain: [0, 10], label: 'Day' },
    y: { domain: [0, 1], label: 'Orders' },
    marks: [named('2025'), named('2026')],
  });
  expect(canvas.ariaLabel).toBe('Orders by Day: 2025, 2026');
  chart.update({ description: 'Orders fell in March' });
  expect(canvas.ariaLabel).toBe('Orders fell in March');
});

test('ticks end where numbers run out of precision, and drop to one when two would collide', () => {
  const huge = scale([1e16, 1e16 + 2], [0, 1]);
  expect(huge.ticks.length).toBeLessThan(20);
  expect(new Set(huge.ticks).size).toBe(huge.ticks.length);
  expect(scale([1_000_000, 1_000_010], [0, 1], { length: 20, horizontal: true }).ticks).toHaveLength(1);
  expect(scale([1, 4], [1, 4], { length: 10, horizontal: true }).ticks).toHaveLength(1);

  const axis = time({ label: '' });
  const day: [number, number] = [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)];
  expect(axis.scale!(axis, () => day, { length: 30, horizontal: true }).ticks).toHaveLength(1);
});

test('ticks are chosen for the room the margins and the legend really leave', () => {
  const el = host();
  const labels = () => [...el.querySelectorAll('[aria-hidden] div')].length;
  const chart = plot(el, { ...frame, width: 600, x: { domain: [0, 100], label: '' }, marks: [] });
  const many = labels();
  chart.update({ margin: { ...frame.margin, right: 500 } });
  expect(labels()).toBeLessThan(many);

  const tall = host();
  const named = (i: number) =>
    line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: `a series with a long name ${i}` });
  const count = (use: Options['use']) => {
    tall.replaceChildren();
    plot(tall, { ...frame, width: 200, height: 330, marks: [0, 1, 2, 3, 4].map(named), use });
    return [...tall.querySelectorAll('[aria-hidden] div')].length;
  };
  expect(count([legend()])).toBeLessThan(count([]));
});

test('columns are scanned for an extent only when an axis needs one', () => {
  let reads = 0;
  const counted = new Proxy([0, 10], { get: (a, k) => (k === '0' && reads++, Reflect.get(a, k)) });
  const mark: Mark = {
    type: 'counted',
    color: RED,
    options: {},
    points: 2,
    channels: { x: [counted], y: [counted] },
    prepare: () => ({ paint() {} }),
  };
  const chart = plot(host(), { ...frame, marks: [mark] });
  chart.update({ x: { domain: [0, 5], label: 'renamed' } });
  expect(reads).toBe(0);
  chart.update({ x: { domain: 'nice', label: '' } });
  chart.update({ x: { domain: 'nice', label: 'renamed' } });
  chart.update({ marks: [mark] });
  expect(reads).toBe(1);
});

test('a custom scale whose bounds depend on the room is drawn with the bounds it was last asked for', () => {
  let chart!: Internals;
  let asked = 0;
  plot(host(), {
    ...frame,
    width: 400,
    margin: undefined,
    marks: [],
    x: {
      domain: 'data',
      label: '',
      scale: (_axis, _extent, room) => ({
        lo: 0,
        hi: (asked = room!.length),
        ticks: [{ value: 0, label: '0' }],
      }),
    },
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(asked).toBe(400 - chart.margin().left - chart.margin().right);
  expect(chart.xPx(asked)).toBeCloseTo(400 - chart.margin().right);
});

test('error bars draw a stem between their ends and a cap across each, upright or lying', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      errorBars({ x: [2], y1: [0.25], y2: [0.75], color: RED, width: 2, cap: 10 }),
      errorBars({ y: [0.45], x1: [5], x2: [9], color: RED, width: 2, cap: 10 }),
    ],
  });
  expect(pixel(el, 20, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 13, 25)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 27, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 13, 55)[3]).toBe(0);
  expect(pixel(el, 70, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 50, 62)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 90, 48)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 70, 62)[3]).toBe(0);
});

test('fiveNumbers gives the quartiles of each group, interpolated, without what is not a number', () => {
  const stats = fiveNumbers([[5, 1, 3, 2, 4, NaN, Infinity], [10, 20], []]);
  expect(plain(stats)).toEqual({
    min: [1, 10, NaN],
    q1: [2, 12.5, NaN],
    median: [3, 15, NaN],
    q3: [4, 17.5, NaN],
    max: [5, 20, NaN],
  });
});

test('a box spans its quartiles with whiskers to the extremes and answers the tooltip with its median', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      box({ x: [5], min: [0.1], q1: [0.35], median: [0.55], q3: [0.75], max: [0.95], color: RED, width: 4 }),
    ],
    use: [tooltip({ mode: 'nearest', text: (_, x, y, row) => `median ${y} of row ${row}` })],
  });
  expect(pixel(el, 40, 35)[3]).toBeGreaterThan(40);
  expect(pixel(el, 40, 35)[3]).toBeLessThan(90);
  expect(pixel(el, 40, 35)).toEqual(pixel(el, 60, 58));
  expect(pixel(el, 50, 15)[3]).toBeGreaterThan(150);
  expect(pixel(el, 50, 80)[3]).toBeGreaterThan(150);
  expect(pixel(el, 40, 15)[3]).toBe(0);
  expect(pixel(el, 40, 45)[3]).toBeGreaterThan(200);
  expect(hover(el, 60, 62).innerText).toContain('median 0.55 of row 0');
  expect(hover(el, 60, 15).innerText).not.toContain('median');
});

test('rows with a number missing draw nothing and join nothing', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      errorBars({ x: [2, 8], y1: [0.25, NaN], y2: [0.45, 0.85], color: RED, width: 3, cap: 10 }),
      box({ x: [5], min: [0.05], q1: [NaN], median: [0.5], q3: [0.7], max: [0.95], color: RED, width: 2 }),
    ],
  });
  expect(pixel(el, 20, 65)).toEqual([255, 0, 0, 255]);
  for (const [x, y] of [
    [55, 35],
    [80, 25],
    [50, 85],
    [50, 15],
  ] as const)
    expect(pixel(el, x, y)[3]).toBe(0);
});

test('an automatic x domain makes room for whole boxes, and hovering one dims the other', () => {
  const el = host();
  let chart!: Internals;
  const five = (v: number) => ({
    min: [v - 0.3, v - 0.3],
    q1: [v - 0.1, v - 0.1],
    median: [v, v],
    q3: [v + 0.1, v + 0.1],
    max: [v + 0.3, v + 0.3],
  });
  plot(el, {
    ...frame,
    width: 300,
    dim: 0.2,
    x: { domain: 'data', label: '' },
    marks: [box({ x: [1, 2], ...five(0.55), color: RED, width: 0.6 })],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' }), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.xPx(0.7)).toBeCloseTo(0);
  expect(chart.xPx(2.3)).toBeCloseTo(300);
  const [one, two] = [chart.xPx(1), chart.xPx(2)];
  expect(pixel(el, two - 20, 45)[3]).toBeGreaterThan(200);
  hover(el, one + 20, 40);
  expect(pixel(el, one - 20, 45)[3]).toBeGreaterThan(200);
  expect(pixel(el, two - 20, 45)[3]).toBeLessThan(100);
});

test('fiveNumbers interpolates between huge values of opposite sign', () => {
  expect(fiveNumbers([[-1e308, 1e308]]).median[0]).toBe(0);
});

test('two boxes at the same x are told apart on hover', () => {
  const el = host();
  plot(el, {
    ...frame,
    dim: 0.2,
    marks: [
      box({
        x: [5, 5],
        min: [0.05, 0.6],
        q1: [0.1, 0.65],
        median: [0.25, 0.75],
        q3: [0.35, 0.85],
        max: [0.4, 0.95],
        color: RED,
        width: 4,
      }),
    ],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' })],
  });
  hover(el, 60, 22);
  expect(pixel(el, 40, 25)[3]).toBeGreaterThan(200);
  expect(pixel(el, 40, 75)[3]).toBeLessThan(100);
});

test('values that are not finite do not reach an automatic axis, and huge finite ones are drawn', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...frame,
    x: { domain: 'data', label: '' },
    y: { domain: [0, 1.1e308], label: '' },
    marks: [
      errorBars({
        x: [1, Infinity, 3],
        y1: [9e307, 9e307, NaN],
        y2: [1e308, 1e308, 1e308],
        color: RED,
        width: 4,
      }),
    ],
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(Number.isFinite(chart.xPx(1))).toBe(true);
  expect(chart.xPx(3)).toBeCloseTo(100);
  expect(pixel(el, chart.xPx(1) + 1, chart.yPx(9.5e307))).toEqual([255, 0, 0, 255]);
});

test('a colour scale runs from its first stop to its last', () => {
  const { table } = sequential({ stops: ['#f00', '#00ff00', '#0000ff'] });
  const bytes = (i: number) => [...new Uint8Array(new Uint32Array([table[i]!]).buffer)];
  expect(bytes(0)).toEqual([255, 0, 0, 255]);
  expect(bytes(255)).toEqual([0, 0, 255, 255]);
  expect(bytes(128)[1]).toBeGreaterThan(250);
});

test('a heatmap colours each cell by its value, leaves a missing one empty and answers for the cell hit', () => {
  const el = host();
  const auto = { domain: 'data' as const, label: '' };
  plot(el, {
    ...frame,
    x: auto,
    y: auto,
    marks: [
      heatmap({ values: [0, 10, NaN, 5], columns: 2, color: sequential({ stops: ['#ff0000', '#0000ff'] }) }),
    ],
    use: [tooltip({ mode: 'nearest', text: (_, x, y, row) => `cell ${row} at ${x}, ${y}` })],
  });
  expect(pixel(el, 25, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 75)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 25, 35)[3]).toBe(0);
  const half = pixel(el, 75, 25);
  expect(half[0]).toBeGreaterThan(100);
  expect(half[2]).toBeGreaterThan(100);
  expect(pixel(el, 52, 75)).toEqual([0, 0, 255, 255]);

  expect(hover(el, 75, 25).innerText).toContain('cell 3 at 1, 1');
  expect(hover(el, 25, 75).innerText).toContain('cell 0 at 0, 0');
  expect(hover(el, 25, 25).innerText).not.toContain('cell');
});

test('a heatmap can be given the outer edges of its grid and a fixed colour domain', () => {
  const el = host();
  plot(el, {
    ...frame,
    x: { domain: [0, 10], label: '' },
    y: { domain: [0, 1], label: '' },
    marks: [
      heatmap({
        values: [5, 5],
        columns: 2,
        x: [0, 5],
        y: [0, 0.5],
        color: sequential({ stops: ['#ff0000', '#0000ff'], domain: [5, 6] }),
      }),
    ],
  });
  expect(pixel(el, 25, 75)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 75)[3]).toBe(0);
  expect(pixel(el, 25, 25)[3]).toBe(0);
});

test('a heatmap squeezed below a pixel a cell still shows a single hot column, and survives a bad column count', () => {
  const el = host();
  const auto = { domain: 'data' as const, label: '' };
  const values = new Float64Array(400);
  values[200] = 1;
  plot(el, {
    ...frame,
    x: auto,
    y: auto,
    marks: [heatmap({ values, columns: 400, color: sequential({ stops: ['#000000', '#ff0000'] }) })],
  });
  expect(pixel(el, 50, 55)[0]).toBeGreaterThan(20);
  expect(pixel(el, 20, 55)[0]).toBe(0);

  for (const columns of [0, 1.5, NaN]) {
    expect(() => plot(host(), { ...frame, marks: [heatmap({ values: [1, 2], columns })] })).not.toThrow();
  }
});

test('hover and paint agree on which cell a point belongs to', () => {
  const el = host();
  const auto = { domain: 'data' as const, label: '' };
  plot(el, {
    ...frame,
    x: auto,
    y: auto,
    marks: [heatmap({ values: [0, 1, 0], columns: 3, color: sequential({ stops: ['#ff0000', '#0000ff'] }) })],
    use: [tooltip({ mode: 'nearest', text: (_, x, y, row) => `cell ${row}` })],
  });
  expect(pixel(el, 32, 55)).toEqual([255, 0, 0, 255]);
  expect(hover(el, 32, 55).innerText).toContain('cell 0');
  expect(pixel(el, 34, 55)).toEqual([0, 0, 255, 255]);
  expect(hover(el, 34, 55).innerText).toContain('cell 1');
});

test('a heatmap draws only what is in view, however large or sparse the grid', () => {
  const el = host();
  const one = sequential({ stops: ['#ff0000', '#ff0000'] });
  expect(() =>
    plot(el, {
      ...frame,
      x: { domain: [0, 1], label: '' },
      marks: [heatmap({ values: [1], columns: 1e9, color: one })],
    }),
  ).not.toThrow();
  const wide = host();
  const values = new Float64Array(1_000_000).fill(1);
  plot(wide, {
    ...frame,
    x: { domain: [499_995, 500_005], label: '' },
    y: { domain: [-0.5, 0.5], label: '' },
    marks: [heatmap({ values, columns: 1_000_000, color: one })],
  });
  expect(pixel(wide, 50, 55)).toEqual([255, 0, 0, 255]);
  for (const columns of [Infinity, -3]) {
    expect(() => plot(host(), { ...frame, marks: [heatmap({ values: [1, 2], columns })] })).not.toThrow();
  }
  expect(sequential({ stops: [] }).table).toHaveLength(256);
});

test('a heatmap answers for the cell a pixel shows, and for its grid given backwards', () => {
  const auto = { domain: 'data' as const, label: '' };
  const use = () => [
    tooltip({
      mode: 'nearest' as const,
      text: (_: string, x: number, y: number, row?: number) => `cell ${row}`,
    }),
  ];
  const shared = host();
  const values = new Float64Array(400);
  values.set([NaN, 1, 0, 0]);
  plot(shared, {
    ...frame,
    x: auto,
    y: auto,
    marks: [heatmap({ values, columns: 400, color: sequential({ stops: ['#000000', '#ff0000'] }) })],
    use: use(),
  });
  expect(pixel(shared, 0, 55)).toEqual([255, 0, 0, 255]);
  expect(hover(shared, 0, 55).innerText).toContain('cell 1');

  const back = host();
  plot(back, {
    ...frame,
    x: { domain: [0, 2], label: '' },
    y: { domain: [0, 1], label: '' },
    marks: [
      heatmap({
        values: [0, 1],
        columns: 2,
        x: [2, 0],
        y: [0, 1],
        color: sequential({ stops: ['#ff0000', '#0000ff'] }),
      }),
    ],
    use: use(),
  });
  expect(pixel(back, 25, 55)).toEqual([0, 0, 255, 255]);
  expect(hover(back, 25, 55).innerText).toContain('cell 1');
  expect(pixel(back, 75, 55)).toEqual([255, 0, 0, 255]);
  expect(hover(back, 75, 55).innerText).toContain('cell 0');
  expect(hover(back, 75, 0).innerText).toContain('cell 0');
  expect(hover(back, 75, 100).innerText).toContain('cell 0');
});

test('hovering a heatmap cell dims the others, and colours span even the widest domain', () => {
  const el = host();
  const auto = { domain: 'data' as const, label: '' };
  plot(el, {
    ...frame,
    dim: 0.2,
    x: auto,
    y: auto,
    marks: [heatmap({ values: [1, 1], columns: 2, color: sequential({ stops: ['#ff0000', '#ff0000'] }) })],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' })],
  });
  hover(el, 25, 55);
  expect(pixel(el, 25, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 55)[3]).toBeLessThan(100);

  const huge = host();
  plot(huge, {
    ...frame,
    x: auto,
    y: auto,
    marks: [
      heatmap({
        values: [-1e308, 0, 1e308],
        columns: 3,
        color: sequential({ stops: ['#ff0000', '#00ff00', '#0000ff'], domain: [-1e308, 1e308] }),
      }),
    ],
  });
  expect(pixel(huge, 15, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(huge, 50, 55)[1]).toBeGreaterThan(250);
  expect(pixel(huge, 85, 55)).toEqual([0, 0, 255, 255]);
});

const BLUE = '#0000ff';
const GREEN = '#00ff00';
const pie = {
  width: 100,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  frame: 'polar' as const,
};

test('slices start at twelve and run clockwise, each as wide as its share', () => {
  const el = host();
  plot(el, { ...pie, marks: [arcs({ values: [1, 1, 2], colors: [RED, BLUE, GREEN] })] });
  expect(pixel(el, 70, 30)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 70, 70)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 25, 50)).toEqual([0, 255, 0, 255]);
  expect(pixel(el, 3, 3)[3]).toBe(0);
  expect(el.querySelectorAll('[aria-hidden] div')).toHaveLength(2);
  expect(el.querySelector('[aria-hidden]')!.textContent).toBe('');
});

test('a frame without axes centres the pie with the same margin all round', () => {
  let chart!: Internals;
  plot(host(), {
    width: 200,
    height: 120,
    frame: 'polar',
    marks: [arcs({ values: [1], colors: [RED] })],
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin()).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
});

test('one slice fills the pie or the ring; slices worth nothing draw nothing', () => {
  const whole = host();
  plot(whole, { ...pie, marks: [arcs({ values: [0, 5, -2, NaN], colors: [BLUE, RED, GREEN, GREEN] })] });
  for (const [x, y] of [
    [50, 50],
    [50, 10],
    [10, 50],
    [50, 90],
    [90, 50],
  ] as const) {
    expect(pixel(whole, x, y)).toEqual([255, 0, 0, 255]);
  }
  const ring = host();
  plot(ring, { ...pie, marks: [arcs({ values: [3], colors: [RED], inner: 0.5 })] });
  expect(pixel(ring, 50, 50)[3]).toBe(0);
  expect(pixel(ring, 50, 10)).toEqual([255, 0, 0, 255]);
  expect(pixel(ring, 50, 90)).toEqual([255, 0, 0, 255]);

  const none = host();
  expect(() =>
    plot(none, {
      ...pie,
      marks: [arcs({ values: [0, 0], colors: [RED] }), arcs({ values: [], colors: [] })],
    }),
  ).not.toThrow();
  expect(pixel(none, 50, 30)[3]).toBe(0);
});

test('a slice answers the tooltip from its own area, not from the hole, and holds its starting edge', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...pie,
    marks: [arcs({ values: [1, 1, 2], colors: [RED, BLUE, GREEN], inner: 0.4 })],
    use: [
      tooltip({ mode: 'nearest', text: (_, x, y, row) => `slice ${row}` }),
      c => ((chart = c), { destroy() {} }),
    ],
  });
  expect(hover(el, 70, 30).innerText).toContain('slice 0');
  expect(hover(el, 70, 70).innerText).toContain('slice 1');
  expect(hover(el, 20, 50).innerText).toContain('slice 2');
  expect(hover(el, 50, 50).innerText).not.toContain('slice');
  expect(hover(el, 2, 2).innerText).not.toContain('slice');
  expect(chart.hit(90, 50, 20)!.row).toBe(1);
  expect(chart.hit(50, 5, 20)!.row).toBe(0);

  const first = chart.hit(70, 30, 20)!;
  const [x, y] = [chart.xPx(first.x), chart.yPx(first.y)];
  expect(x).toBeCloseTo(50 + Math.SQRT1_2 * 35);
  expect(y).toBeCloseTo(50 - Math.SQRT1_2 * 35);
});

test('the legend lists the slices and pointing at one picks it out, also after new values', () => {
  const el = host();
  const slices = (values: number[]) => arcs({ values, colors: [RED, BLUE], labels: ['one', 'two'] });
  const chart = plot(el, {
    ...pie,
    width: 300,
    height: 320,
    dim: 0.2,
    marks: [slices([1, 1])],
    use: [legend()],
  });
  const items = () => [...el.querySelectorAll('span')].filter(s => s.children.length);
  expect(items().map(s => s.textContent)).toEqual(['one', 'two']);

  const canvas = el.querySelector('canvas')!;
  const middle = (canvas.height / devicePixelRatio + 24) / 2;
  items()[1]!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, 80, middle)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 220, middle)[3]).toBeLessThan(100);

  el.firstElementChild!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse' }));
  chart.update({ marks: [slices([3, 1])] });
  items()[0]!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, 220, middle)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 80, 60)[3]).toBeLessThan(100);
});

test('the tooltip names and colours the slice that was hit', () => {
  const el = host();
  plot(el, {
    ...pie,
    marks: [arcs({ values: [1, 1], colors: [RED, BLUE], labels: ['right', 'left'] })],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(hover(el, 25, 50).innerText).toContain('left');
  const row = [...el.querySelectorAll('div')].find(d => d.textContent === 'left' && !d.children.length)!;
  expect(row.style.color).toBe('rgb(0, 0, 255)');
});

test.each(['none', 'scale(0.5)'])(
  'a tooltip wider than half the chart stays inside it wherever the pointer is, transform %s',
  transform => {
    const el = host();
    el.style.transform = transform;
    el.style.transformOrigin = '0 0';
    const scale = transform === 'none' ? 1 : 0.5;
    const text = (x: number) => `a tooltip of twenty at ${x}`;
    const at = [0.1, 4.5, 5.5, 9.9];
    plot(el, {
      ...frame,
      width: 200,
      marks: [dots({ x: at, y: at.map(() => 0.5), r: at.map(() => 3), color: RED, label: 'A' })],
      use: [tooltip({ mode: 'nearest', text: (_, x) => text(x) })],
    });
    for (const x of at) {
      const root = hover(el, x * 20 * scale, 50 * scale);
      const box = root.getBoundingClientRect();
      const tip = textOf(el, text(x)).parentElement!.getBoundingClientRect();
      expect(tip.width).toBeGreaterThan(box.width / 2);
      expect(tip.width).toBeLessThan(box.width);
      expect(tip.left).toBeGreaterThanOrEqual(box.left);
      expect(tip.right).toBeLessThanOrEqual(box.right);
    }
  },
);

test('a tooltip with text wider than the chart wraps inside it at either edge, even under nowrap', () => {
  const el = host();
  el.style.whiteSpace = 'nowrap';
  const text = 'a tooltip whose text is far wider than this narrow chart';
  plot(el, {
    ...frame,
    marks: [dots({ x: [0.1, 9.9], y: [0.5, 0.5], r: [3, 3], color: RED, label: 'A' })],
    use: [tooltip({ mode: 'nearest', text: () => text })],
  });
  for (const px of [1, 99]) {
    const box = hover(el, px, 50).getBoundingClientRect();
    const row = textOf(el, text);
    const tip = row.parentElement!.getBoundingClientRect();
    expect(tip.left).toBeGreaterThanOrEqual(box.left);
    expect(tip.right).toBeLessThanOrEqual(box.right);
    expect(tip.top).toBeGreaterThanOrEqual(box.top);
    expect(tip.bottom).toBeLessThanOrEqual(box.bottom);
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  }
});

test('a tooltip taller than the chart is cut off at its bottom', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: Array.from({ length: 12 }, (_, i) =>
      line({ x: [0, 10], y: [i / 12, i / 12], color: RED, label: `series ${i}` }),
    ),
    use: [tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(1) })],
  });
  const box = hover(el, 50, 50).getBoundingClientRect();
  const tip = textOf(el, 'x=5').parentElement!.getBoundingClientRect();
  expect(tip.top).toBeGreaterThanOrEqual(box.top);
  expect(tip.bottom).toBeLessThanOrEqual(box.bottom);
});

test('the x tooltip samples each line at its own x, and gives a dash where a line has no sample', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      line({ x: [0, 10], y: [0, 1], color: RED, label: 'A' }),
      line({ x: [2, 3, 6], y: [1, 0.9, 0.1], color: RED, label: 'B' }),
    ],
    use: [tooltip({ mode: 'x', title: () => 'at', value: y => y.toFixed(1) })],
  });
  const root = hover(el, 40, 50);
  expect(root.innerText).toContain('A: 0.4');
  expect(root.innerText).toContain('B: 0.6');
  for (const px of [10, 80]) {
    hover(el, px, 50);
    expect(root.innerText).toContain(`A: ${(px / 100).toFixed(1)}`);
    expect(root.innerText).toContain('B: –');
  }
});

test('two points at the same place give one tooltip, the one drawn on top', () => {
  const at = (label: string, color: string) => dots({ x: [5], y: [0.5], r: [3], color, label });
  for (const [below, above] of [
    [at('A', RED), at('B', BLUE)],
    [at('B', BLUE), at('A', RED)],
  ]) {
    const el = host();
    plot(el, {
      ...frame,
      marks: [below!, above!],
      use: [tooltip({ mode: 'nearest', text: label => label })],
    });
    hover(el, 50, 50);
    expect(el.querySelectorAll('canvas')).toHaveLength(1);
    const row = textOf(el, above!.label!);
    expect(row.parentElement!.children).toHaveLength(1);
    expect(row.style.color).toBe(above!.color === RED ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)');
    expect(textOf(el, below!.label!)).toBeUndefined();
  }
});

test('a heatmap squeezed to a fraction of a pixel a cell still shows its peak', () => {
  const el = host();
  plot(el, {
    ...frame,
    y: { domain: [0, 1], label: '' },
    marks: [
      heatmap({
        values: [0, 1, 0, 0],
        columns: 4,
        x: [0, 0.22 / devicePixelRatio],
        y: [0, 1],
        color: sequential({ stops: ['#000000', '#ff0000'] }),
      }),
    ],
  });
  const reds = [0, 1, 2].map(px => pixel(el, px / devicePixelRatio, 55)[0]!);
  expect(Math.max(...reds)).toBe(255);
});

test('a colour domain of the smallest possible width still spans the colours', () => {
  const el = host();
  const auto = { domain: 'data' as const, label: '' };
  plot(el, {
    ...frame,
    x: auto,
    y: auto,
    marks: [
      heatmap({
        values: [0, Number.MIN_VALUE],
        columns: 2,
        color: sequential({ stops: ['#ff0000', '#0000ff'] }),
      }),
    ],
  });
  expect(pixel(el, 25, 55)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 75, 55)).toEqual([0, 0, 255, 255]);
});

test('slices of enormous values still share the pie, and labels beyond the slices are dropped', () => {
  const el = host();
  const mark = arcs({ values: [1e308, 1e308], colors: [RED, BLUE], labels: ['a', 'b', 'c'] });
  plot(el, { ...pie, marks: [mark] });
  expect(pixel(el, 75, 50)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 25, 50)).toEqual([0, 0, 255, 255]);
  expect(mark.entries).toHaveLength(2);
});

test('pointing at a slice in the legend picks it out among other series too', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...pie,
    width: 300,
    height: 324,
    dim: 0.2,
    marks: [
      bar({ x1: [0.4], x2: [0.6], y1: [0.4], y2: [0.6], color: GREEN, label: 'core' }),
      arcs({ values: [1, 1], colors: [RED, BLUE], labels: ['right', 'left'], group: '0/0', inner: 0.5 }),
      line({ x: [0, 1], y: [0.02, 0.02], color: GREEN, label: 'other', group: '1/0' }),
    ],
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  const items = [...el.querySelectorAll('span')].filter(s => s.children.length);
  expect(items.map(s => s.textContent)).toEqual(['core', 'right', 'left', 'other']);
  const y = chart.yPx(0.5);
  const [right, left, centre] = [chart.xPx(0.9), chart.xPx(0.1), chart.xPx(0.5)];

  items[1]!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, right, y)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, left, y)[3]).toBeLessThan(100);
  expect(pixel(el, centre, y)[3]).toBeLessThan(100);

  items[0]!.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, centre, y)).toEqual([0, 255, 0, 255]);
  expect(pixel(el, right, y)[3]).toBeLessThan(100);
});

test('a pie is revealed by a sweep from twelve round the clock', () => {
  fakeClock();
  const el = host();
  plot(el, { ...pie, marks: [arcs({ values: [1], colors: [RED] })], use: [animate({ duration: 600 })] });
  expect(pixel(el, 70, 30)[3]).toBe(0);
  vi.advanceTimersByTime(150);
  expect(pixel(el, 70, 30)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 70)[3]).toBe(0);
  expect(pixel(el, 30, 30)[3]).toBe(0);
  vi.advanceTimersByTime(600);
  expect(pixel(el, 30, 30)).toEqual(RED_PIXEL);
});

test('the WebGL layer dims with the rest when a slice is picked out, and is swept in a frame without axes', () => {
  fakeClock();
  const el = host();
  const n = 30_000;
  const centre = dots({
    x: new Float64Array(n).fill(0.5),
    y: new Float64Array(n).fill(0.5),
    r: new Float64Array(n).fill(4),
    color: GREEN,
    label: 'cloud',
  });
  let chart!: Internals;
  plot(el, {
    ...pie,
    width: 300,
    height: 324,
    dim: 0.2,
    marks: [
      arcs({ values: [1, 1], colors: [RED, BLUE], labels: ['right', 'left'], group: 'pie', inner: 0.5 }),
      centre,
    ],
    use: [legend(), animate({ duration: 400 }), c => ((chart = c), { destroy() {} })],
  });
  const layer = el.querySelectorAll('canvas')[1]!;
  expect(layer.style.clipPath).toContain('polygon');
  vi.advanceTimersByTime(100);
  expect(layer.style.clipPath).toContain('polygon');
  vi.advanceTimersByTime(400);
  expect(layer.style.clipPath).toBe('inset(20px 0px 0px)');

  const [x, y] = [chart.xPx(0.5), chart.yPx(0.5)];
  expect(pixel(el, x, y, 1)).toEqual([0, 255, 0, 255]);
  const right = [...el.querySelectorAll('span')].find(s => s.textContent === 'right')!;
  right.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }));
  expect(pixel(el, x, y, 1)[3]).toBeLessThan(100);
});

test('the sweep over the WebGL layer takes in each corner of a wide plot as it passes it', () => {
  const el = host();
  const n = 30_000;
  let chart!: Internals;
  plot(el, {
    ...pie,
    width: 1000,
    marks: [
      dots({
        x: new Float64Array(n).fill(0.5),
        y: new Float64Array(n).fill(0.5),
        r: new Float64Array(n).fill(2),
        color: RED,
      }),
    ],
    use: [c => ((chart = c), { destroy() {} })],
  });
  const layer = el.querySelectorAll('canvas')[1]!;
  const points = () => (layer.style.clipPath.match(/-?[\d.e-]+px/g) ?? []).map(parseFloat).map(Math.round);
  chart.reveal(0.25);
  expect(points()).toEqual([500, 50, 500, 0, 1000, 0, 1000, 50]);
  chart.reveal(0.6);
  expect(points()).toEqual([500, 50, 500, 0, 1000, 0, 1000, 100, 464, 100]);
  chart.reveal(1);
  expect(layer.style.clipPath).toBe('inset(0px)');
});

const labelsOf = (el: HTMLElement) =>
  [...el.querySelectorAll('div')].filter(
    d => !d.children.length && /%|\w/.test(d.textContent ?? '') && d.style.lineHeight,
  );

test('slices carry their share where it fits, and not where it does not', () => {
  const el = host();
  plot(el, {
    ...pie,
    width: 300,
    height: 300,
    marks: [arcs({ values: [70, 28, 2], colors: [RED, BLUE, GREEN], text: true })],
  });
  const labels = labelsOf(el);
  expect(labels.map(d => d.textContent)).toEqual(['70%', '28%']);
  const big = labels[0]!;
  expect(big.style.color).toBe('rgb(255, 255, 255)');
  expect(parseFloat(big.style.left) + parseFloat(big.style.width) / 2).toBeGreaterThan(150);

  const own = host();
  plot(own, {
    ...pie,
    width: 300,
    height: 300,
    marks: [
      arcs({
        values: [1, 1],
        colors: [RED, BLUE],
        text: row => ['left', 'a far longer name than fits in here at all'][1 - row]!,
      }),
    ],
  });
  expect(labelsOf(own).map(d => d.textContent)).toEqual(['left']);
});

test("a mark's labels are placed in CSS pixels whatever the density, dropped where they collide or leave the chart, and follow updates", () => {
  const noted = (labels: { x: number; y: number; text: string; priority?: number }[]): Mark => ({
    type: 'noted',
    color: RED,
    options: { labels },
    points: 0,
    channels: { x: [], y: [] },
    prepare: ({ dpr }) => ({ paint() {}, labels: labels.map(l => ({ ...l, x: l.x * dpr, y: l.y * dpr })) }),
  });
  const el = host();
  const chart = plot(el, {
    ...frame,
    width: 300,
    marks: [
      noted([
        { x: 100, y: 50, text: 'first' },
        { x: 110, y: 52, text: 'second', priority: 1 },
        { x: 295, y: 50, text: 'off the edge' },
        { x: 200, y: 20, text: 'third' },
      ]),
    ],
  });
  expect(labelsOf(el).map(d => d.textContent)).toEqual(['second', 'third']);
  const left = () => labelsOf(el).map(d => d.style.left);
  const before = left();

  const was = devicePixelRatio;
  let changed!: () => void;
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        addEventListener: (_: string, f: () => void) => void (changed = f),
        removeEventListener() {},
      }) as never,
  );
  const dense = host();
  plot(dense, { ...frame, width: 300, marks: [noted([{ x: 200, y: 20, text: 'third' }])] });
  try {
    Object.defineProperty(window, 'devicePixelRatio', { value: was * 2, configurable: true });
    changed();
    expect(labelsOf(dense).map(d => d.style.left)).toEqual([before[1]]);
  } finally {
    Object.defineProperty(window, 'devicePixelRatio', { value: was, configurable: true });
  }

  chart.update({ marks: [noted([{ x: 100, y: 50, text: 'only' }])] });
  expect(labelsOf(el).map(d => d.textContent)).toEqual(['only']);
  chart.update({ marks: [] });
  expect(labelsOf(el)).toHaveLength(0);
});

test('a label appears when the reveal has uncovered all of it, as the pixel under it does', () => {
  fakeClock();
  const el = host();
  const noted: Mark = {
    type: 'noted',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: ({ ctx, dpr }) => ({
      paint() {
        ctx.fillStyle = RED;
        ctx.fillRect(140 * dpr, 40 * dpr, 20 * dpr, 20 * dpr);
      },
      labels: [{ x: 150 * dpr, y: 50 * dpr, text: 'here' }],
    }),
  };
  const chart = plot(el, { ...frame, width: 300, marks: [noted], use: [animate({ duration: 600 })] });
  const label = labelsOf(el)[0]!;
  expect(label.style.visibility).toBe('hidden');
  vi.advanceTimersByTime(60);
  expect(pixel(el, 150, 45)[3]).toBe(0);
  expect(label.style.visibility).toBe('hidden');
  chart.update({});
  expect(label.style.visibility).toBe('hidden');
  vi.advanceTimersByTime(600);
  expect(pixel(el, 150, 45)).toEqual(RED_PIXEL);
  expect(label.style.visibility).toBe('');
});

const blank = {
  width: 100,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  frame: 'blank' as const,
};
const labelled = (labels: { x: number; y: number; text: string }[], extra: Partial<Mark> = {}): Mark => ({
  type: 'labelled',
  color: RED,
  options: { labels },
  points: 0,
  channels: { x: [], y: [] },
  prepare: ({ ctx, dpr }) => ({
    paint() {
      ctx.fillStyle = RED;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    labels: labels.map(l => ({ ...l, x: l.x * dpr, y: l.y * dpr })),
  }),
  ...extra,
});

test('a chart drawn part revealed is uncovered the same way on the canvas as for its labels', () => {
  const el = host();
  plot(el, {
    ...blank,
    marks: [
      labelled(
        [
          { x: 50, y: 20, text: 'top' },
          { x: 50, y: 80, text: 'low' },
        ],
        { reveal: 'down' },
      ),
    ],
    use: [chart => (chart.onPaint(draw => draw(0.5)), { destroy() {} })],
  });
  expect(pixel(el, 80, 25)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 20, 75)[3]).toBe(0);
  expect(labelsOf(el).map(d => [d.textContent, d.style.visibility])).toEqual([
    ['top', ''],
    ['low', 'hidden'],
  ]);
});

test('a label waits for the last wedge of a sweep to pass, and one at the edge of the plot is not kept waiting', () => {
  let chart!: Internals;
  const capture = (c: Internals) => ((chart = c), { destroy() {} });
  const round = host();
  plot(round, { ...pie, marks: [labelled([{ x: 50, y: 30, text: 'wide' }])], use: [capture] });
  chart.reveal(0.98);
  expect(labelsOf(round)[0]!.style.visibility).toBe('hidden');
  chart.reveal(1);
  expect(labelsOf(round)[0]!.style.visibility).toBe('');

  const across = host();
  plot(across, { ...blank, marks: [labelled([{ x: 20, y: 92, text: 'ab' }])], use: [capture] });
  chart.reveal(0.5);
  expect(labelsOf(across)[0]!.style.visibility).toBe('');
  chart.reveal(0.2);
  expect(labelsOf(across)[0]!.style.visibility).toBe('hidden');
});

test('a ring too thin to hold its label goes without one', () => {
  const el = host();
  plot(el, {
    ...pie,
    width: 300,
    height: 300,
    marks: [arcs({ values: [1], colors: [RED], inner: 0.99, text: true })],
  });
  expect(labelsOf(el)).toHaveLength(0);
  const thick = host();
  plot(thick, {
    ...pie,
    width: 300,
    height: 300,
    marks: [arcs({ values: [1], colors: [RED], inner: 0.5, text: true })],
  });
  expect(labelsOf(thick).map(d => d.textContent)).toEqual(['100%']);
});

test('a funnel narrows stage by stage, names its stages and answers for the one under the pointer', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...blank,
    width: 300,
    height: 300,
    dim: 0.2,
    marks: [
      funnel({
        values: [100, 50, -5, NaN],
        colors: [RED, BLUE, GREEN],
        labels: ['Visits', 'Carts', 'Orders', 'Paid', 'extra'],
        text: true,
      }),
    ],
    use: [tooltip({ mode: 'nearest', text: label => `tip ${label}` }), c => ((chart = c), { destroy() {} })],
  });
  expect(pixel(el, 10, 5)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 290, 5)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 150, 100)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 30, 100)[3]).toBe(0);
  expect(pixel(el, 150, 200)[3]).toBe(0);
  expect(labelsOf(el).map(d => d.textContent)).toEqual(['Visits 100%', 'Carts 50%', 'Orders 0%', 'Paid 0%']);
  expect(chart.marks()[0]!.entries).toHaveLength(4);
  expect(chart.marks()[0]!.reveal).toBe('down');

  expect(hover(el, 150, 100).innerText).toContain('tip Carts');
  expect(pixel(el, 150, 100)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 150, 20)[3]).toBeLessThan(100);
  expect(hover(el, 20, 110).innerText).not.toContain('tip');

  for (const values of [[], [0, 0], [1e308, 1e308]]) {
    expect(() =>
      plot(host(), { ...blank, marks: [funnel({ values, colors: [RED], text: true })] }),
    ).not.toThrow();
  }
});

test('a sankey lays nodes out in columns, joins them with ribbons as wide as the flow, and names them', () => {
  const el = host();
  let chart!: Internals;
  const flows = fromLinks([
    { source: 'A', target: 'B', value: 3 },
    { source: 'A', target: 'C', value: 1 },
    { source: 'B', target: 'D', value: 3 },
  ]);
  expect(flows).toEqual({
    nodes: ['A', 'B', 'C', 'D'],
    source: [0, 0, 1],
    target: [1, 2, 3],
    value: [3, 1, 3],
  });
  plot(el, {
    ...blank,
    width: 312,
    height: 200,
    dim: 0.2,
    marks: [sankey({ ...flows, colors: [RED, BLUE, GREEN, BLUE] })],
    use: [
      tooltip({ mode: 'nearest', text: (_, x, y, row) => `row ${row}` }),
      c => ((chart = c), { destroy() {} }),
    ],
  });
  expect(pixel(el, 5, 100)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 155, 60)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 305, 60)).toEqual([0, 0, 255, 255]);
  const ribbon = pixel(el, 80, 60);
  expect(ribbon[3]).toBeGreaterThan(90);
  expect(ribbon[3]).toBeLessThan(140);
  expect(pixel(el, 155, 147)[3]).toBe(0);
  expect(
    labelsOf(el)
      .map(d => d.textContent)
      .sort(),
  ).toEqual(['A', 'B', 'C', 'D']);

  const c = Array.from({ length: 200 }, (_, y) => y).find(y => pixel(el, 155, y)[1] === 255)!;
  expect(pixel(el, 155, c + 1)).toEqual([0, 255, 0, 255]);
  expect(hover(el, 5, 100).innerText).toContain('row 0');
  expect(hover(el, 80, 60).innerText).toContain('row 4');
  expect(hover(el, 230, 60).innerText).toContain('row 6');
  expect(pixel(el, 230, 60)[3]).toBeGreaterThan(90);
  expect(pixel(el, 80, 60)[3]).toBeGreaterThan(90);
  expect(pixel(el, 5, 100)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 155, c + 1)[3]).toBeLessThan(60);
  expect(hover(el, 155, 147).innerText).not.toContain('row');
  expect(chart.marks()[0]!.points).toBe(7);

  expect(pixel(el, 155, c + 1)).toEqual([0, 255, 0, 255]);
  expect(hover(el, 305, 60).innerText).toContain('row 3');
  expect(pixel(el, 5, 100)).toEqual([255, 0, 0, 255]);
  expect(pixel(el, 155, 60)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 80, 60)[3]).toBeGreaterThan(90);
  expect(pixel(el, 230, 60)[3]).toBeGreaterThan(90);
  expect(pixel(el, 155, c + 1)[3]).toBeLessThan(60);
});

test('a sankey refuses links it cannot place, and copes with empty and enormous flows', () => {
  const make = (source: number[], target: number[], value = source.map(() => 1)) =>
    sankey({ nodes: ['A', 'B', 'C'], source, target, value, colors: [RED] });
  expect(() => make([0, 1, 2], [1, 2, 0])).toThrow(/circle through (A, B, C|B, C, A|C, A, B)$/);
  expect(() => make([0, 1, 1], [1, 0, 2])).toThrow(/circle through (A, B|B, A)$/);
  expect(() => make([0], [0])).toThrow(/A links to itself/);
  expect(() => make([0], [7])).toThrow(/names node 7/);
  expect(() => make([0], [1.5])).toThrow(/names node 1.5/);
  for (const mark of [
    make([], []),
    make([0, 0], [1, 2], [1e308, 1e308]),
    make([0], [1], [NaN]),
    make([0], [1], [-4]),
  ]) {
    expect(() => plot(host(), { ...blank, marks: [mark] })).not.toThrow();
  }
  const el = host();
  plot(el, { ...blank, width: 300, height: 200, marks: [make([0, 0], [1, 2], [1e308, 1e308])] });
  expect(pixel(el, 5, 100)).toEqual([255, 0, 0, 255]);
});

test("the legend shows a heatmap's colours as a strip between the ends of its domain", () => {
  const el = host();
  let chart!: Internals;
  const auto = { domain: 'data' as const, label: '' };
  plot(el, {
    ...frame,
    width: 300,
    x: auto,
    y: auto,
    marks: [
      heatmap({
        values: [2, 7.123456, NaN, 4],
        columns: 2,
        label: 'Load',
        color: sequential({ stops: ['#ff0000', '#0000ff'] }),
      }),
    ],
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  const strip = [...el.querySelectorAll('span')].find(s => s.style.backgroundImage)!;
  expect(strip.style.backgroundImage).toMatch(
    /^linear-gradient\(to right, rgb\(255, 0, 0\).*rgb\(0, 0, 255\)\)$/,
  );
  expect(strip.parentElement!.textContent).toBe('Load 27.12');
  expect(chart.margin().top).toBe(24);
});

test('a crowded sankey keeps its flows and its nodes inside the plot', () => {
  const many = host();
  const fan = fromLinks(
    Array.from({ length: 12 }, (_, i) => ({ source: 'in', target: `out ${i}`, value: 1 })),
  );
  plot(many, { ...blank, marks: [sankey({ ...fan, colors: [RED], text: false })] });
  const across = Array.from({ length: 20 }, (_, i) => pixel(many, 50, 40 + i)[3]!);
  expect(Math.max(...across)).toBeGreaterThan(90);
  expect(Math.min(...across)).toBeLessThan(40);
  expect(pixel(many, 97, 1)[3]).toBe(255);
  expect(pixel(many, 97, 98)[3]).toBe(255);

  const long = host();
  let chart!: Internals;
  const chain = fromLinks(
    Array.from({ length: 11 }, (_, i) => ({ source: `n${i}`, target: `n${i + 1}`, value: 1 })),
  );
  plot(long, {
    ...blank,
    marks: [sankey({ ...chain, colors: [RED], text: false })],
    use: [c => ((chart = c), { destroy() {} })],
  });
  const rows = [2, 6.5, 98].map(x => chart.hit(x, 50, 5)?.row);
  expect(rows).toEqual([0, 12, 11]);
  expect(
    fromLinks([
      { source: 'A', target: 'B', value: 1 },
      { source: 'C', target: 'D', value: 1 },
    ]).nodes,
  ).toEqual(['A', 'B', 'C', 'D']);
  expect(() =>
    sankey({
      ...fromLinks(
        Array.from({ length: 10_000 }, (_, i) => ({ source: `${i}`, target: `${i + 1}`, value: 1 })),
      ),
      colors: [RED],
    }),
  ).not.toThrow();
});

test('a funnel is hit where it is painted, and keeps text off its sloping sides', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...blank,
    marks: [funnel({ values: [1, 1], colors: [RED] })],
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(chart.hit(50, 49.5, 5)).toBeNull();
  expect(chart.hit(50, 48, 5)!.row).toBe(0);
  expect(chart.hit(50, 50, 5)!.row).toBe(1);

  const curved = host();
  plot(curved, {
    ...blank,
    marks: [funnel({ values: [1, 0.2], colors: [RED] })],
    use: [c => ((chart = c), { destroy() {} })],
  });
  // Half-widths of 50 and 10: a quarter of the way down a straight side is 40 out and the curve
  // 35.6; three quarters down they are 20 and 13.3.
  expect(chart.hit(82, 12, 5)!.row).toBe(0);
  expect(pixel(curved, 82, 12)).toEqual(RED_PIXEL);
  expect(chart.hit(88, 12, 5)).toBeNull();
  expect(pixel(curved, 88, 12)).not.toEqual(RED_PIXEL);
  expect(chart.hit(62, 37, 5)!.row).toBe(0);
  expect(chart.hit(66, 37, 5)).toBeNull();
  expect(pixel(curved, 66, 37)).not.toEqual(RED_PIXEL);

  const steep = host();
  plot(steep, {
    ...blank,
    width: 300,
    height: 120,
    marks: [funnel({ values: [1, 0.3, 0.05], colors: [RED], text: row => (row === 1 ? 'Carts step' : '') })],
  });
  const beside = labelsOf(steep);
  expect(beside.map(d => [d.textContent, d.style.color])).toEqual([['Carts step', '']]);
  // The second stage runs from y = 40 to 79 and from a half-width of 45 down to 7.5; the text is
  // 16 px tall about its middle, and must start to the right of the stage's edge at its top.
  // The half-widths are 150, 45 and 7.5, so the side leans by the harmonic mean of -105 and
  // -37.5 where the stage starts and is upright where it ends; a straight side would be 5 px out.
  const u = (59.5 - 8 - 40) / 39;
  const lean = (2 * 105 * 37.5) / -(105 + 37.5);
  const edgeAtTop =
    150 + 45 * (1 + 2 * u) * (1 - u) ** 2 + lean * u * (1 - u) ** 2 + 7.5 * u * u * (3 - 2 * u);
  expect(parseFloat(beside[0]!.style.left)).toBeGreaterThan(edgeAtTop + 7);
  expect(parseFloat(beside[0]!.style.left)).toBeLessThan(edgeAtTop + 9);

  const cramped = host();
  plot(cramped, {
    ...blank,
    width: 300,
    height: 40,
    marks: [funnel({ values: [1, 0], colors: [RED], text: row => (row ? '' : 'Stage') })],
  });
  expect(labelsOf(cramped)).toHaveLength(0);
});

test('the ends of a colour strip are told apart however close they are', () => {
  const el = host();
  const auto = { domain: 'data' as const, label: '' };
  plot(el, {
    ...frame,
    width: 300,
    x: auto,
    y: auto,
    marks: [heatmap({ values: [1000, 1001], columns: 2 })],
    use: [legend()],
  });
  const strip = [...el.querySelectorAll('span')].find(s => s.style.backgroundImage)!;
  expect(strip.parentElement!.textContent).toBe('10001001');
});

test('a radar draws rings and spokes once, a shape per series, and answers at its corners', () => {
  const el = host();
  let chart!: Internals;
  const axes = ['A', 'B', 'C', 'D'];
  const spy: Options['use'] = [c => ((chart = c), { destroy() {} })];
  plot(el, {
    ...pie,
    marks: radar({ axes, max: 1, series: [{ values: [1, 1, 1, 1], color: RED, label: 'a' }] }),
    use: spy,
  });
  // Names take 19 px at the sides and 22 px above and below, so the rim is 28 px out.
  expect(pixel(el, 50, 22)).toEqual(RED_PIXEL);
  const filled = pixel(el, 57, 56);
  expect(filled[0]).toBeGreaterThan(200);
  expect(filled[3]).toBeGreaterThan(20);
  expect(filled[3]).toBeLessThan(60);
  expect(pixel(el, 70, 30)[3]).toBe(0);
  expect(labelsOf(el).map(d => d.textContent)).toEqual(expect.arrayContaining([...axes, '1']));
  expect(chart.hit(78, 50, 5)).toMatchObject({ row: 1, mark: { label: 'a' } });
  expect(chart.hit(60, 60, 5)).toBeNull();

  const empty = host();
  plot(empty, { ...pie, marks: radar({ axes: [], series: [{ values: [], color: RED }] }) });
  expect(labelsOf(empty)).toHaveLength(0);
  expect(() =>
    plot(host(), {
      ...pie,
      marks: radar({ axes, series: [{ values: [NaN, -1, Infinity, 1e308], color: RED }] }),
    }),
  ).not.toThrow();
});

test('a radar keeps its grid while a series is dimmed, and moves every series when the rim changes', () => {
  const el = host();
  let chart!: Internals;
  const axes = ['A', 'B', 'C', 'D'];
  const a = { values: [0.5, 0.5, 0.5, 0.5], color: RED, label: 'a' };
  const b = { values: [0.25, 0.25, 0.25, 0.25], color: BLUE, label: 'b' };
  const drawn = plot(el, {
    ...pie,
    dim: 0.2,
    marks: radar({ axes, max: 1, series: [a, b] }),
    use: [
      tooltip({ mode: 'nearest', text: (label, _x, _y, row) => `${label} ${row}` }),
      c => ((chart = c), { destroy() {} }),
    ],
  });
  const spoke = pixel(el, 50, 30);
  expect(spoke[3]).toBeGreaterThan(0);
  expect(pixel(el, 57, 50)).toEqual([0, 0, 255, 255]);
  expect(hover(el, 64, 50).innerText).toContain('a 1');
  expect(pixel(el, 50, 30)).toEqual(spoke);
  expect(pixel(el, 57, 50)).not.toEqual([0, 0, 255, 255]);

  drawn.update({ marks: radar({ axes, series: [a, { ...b, values: [2, 2, 2, 2] }] }) });
  expect(chart.hit(64, 50, 3)).toBeNull();
  expect(chart.hit(57, 50, 3)).toMatchObject({ row: 1, mark: { label: 'a' } });
  expect(chart.hit(78, 50, 3)).toMatchObject({ row: 1, mark: { label: 'b' } });
});

test('radial bars bend each value round its own ring and leave the last quarter for names', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...pie,
    width: 200,
    height: 200,
    dim: 0.2,
    marks: [radialBars({ values: [1, 0.5], max: 1, colors: [RED, BLUE], labels: ['x', 'y'] })],
    use: [
      tooltip({ mode: 'nearest', text: (label, _x, _y, row) => `${label} ${row}` }),
      c => ((chart = c), { destroy() {} }),
    ],
  });
  // Rings of 67 to 100 px and 32 to 65 px from the centre.
  expect(pixel(el, 183, 100)).toEqual(RED_PIXEL);
  expect(pixel(el, 100, 183)).toEqual(RED_PIXEL);
  expect(pixel(el, 40, 40)[3]).toBe(0);
  expect(pixel(el, 148, 100)).toEqual([0, 0, 255, 255]);
  const track = pixel(el, 100, 148);
  expect(track[3]).toBeGreaterThan(0);
  expect(track[3]).toBeLessThan(40);
  expect(labelsOf(el).map(d => d.textContent)).toEqual(['x', 'y']);
  expect(chart.hit(100, 148, 5)).toBeNull();
  expect(chart.hit(40, 40, 5)).toBeNull();
  expect(hover(el, 183, 100).innerText).toContain('x 0');
  expect(pixel(el, 183, 100)).toEqual(RED_PIXEL);
  expect(pixel(el, 148, 100)[3]).toBeLessThan(80);

  expect(() => plot(host(), { ...pie, marks: [radialBars({ values: [], colors: [] })] })).not.toThrow();
  expect(() =>
    plot(host(), { ...pie, marks: [radialBars({ values: [NaN, -1, Infinity, 1e308, 0], colors: [RED] })] }),
  ).not.toThrow();
});

test('a radar and radial bars put the largest and the smallest numbers there are on the rim', () => {
  for (const v of [1.79e308, 1e-110, Number.MIN_VALUE]) {
    const el = host();
    let chart!: Internals;
    plot(el, {
      ...pie,
      marks: radar({ axes: ['A', 'B', 'C', 'D'], series: [{ values: [v, v, v, v], color: RED }] }),
      use: [c => ((chart = c), { destroy() {} })],
    });
    expect(pixel(el, 50, 22)).toEqual(RED_PIXEL);
    expect(chart.hit(50, 22, 3)!.row).toBe(0);

    // The bar ends within 2 degrees of three quarters of a turn: there at 265 degrees, gone at 272.
    const bars = host();
    plot(bars, {
      ...pie,
      width: 200,
      height: 200,
      marks: [radialBars({ values: [v], colors: [RED] })],
      use: [c => ((chart = c), { destroy() {} })],
    });
    const round = (degrees: number) => {
      const angle = ((degrees - 90) * Math.PI) / 180;
      return [Math.round(100 + 83 * Math.cos(angle)), Math.round(100 + 83 * Math.sin(angle))] as const;
    };
    expect(pixel(bars, ...round(265))).toEqual(RED_PIXEL);
    expect(chart.hit(...round(265), 3)!.row).toBe(0);
    expect(pixel(bars, ...round(272))[3]).toBe(0);
    expect(chart.hit(...round(272), 3)).toBeNull();
  }
});

test('a radar with one long name keeps its shape, and is hit where its corner is painted', () => {
  for (const axes of [['Thirteen chars'], ['Thirteen chars', 'Another long one']]) {
    const el = host();
    let chart!: Internals;
    plot(el, {
      ...pie,
      width: 200,
      height: 200,
      marks: radar({ axes, max: 1, series: [{ values: [1, 1], color: RED }] }),
      use: [c => ((chart = c), { destroy() {} })],
    });
    // Upright spokes need 22 px above and below, whatever the length of their names.
    expect(pixel(el, 100, 22)).toEqual(RED_PIXEL);
    expect(chart.hit(100, 22, 3)!.row).toBe(0);
    expect(labelsOf(el).map(d => d.textContent)).toEqual(expect.arrayContaining(axes));
  }
});

test('a backdrop that could go on WebGL stays on the canvas and is not dimmed', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...frame,
    dim: 0.2,
    marks: [
      { ...pile(30_000), backdrop: true },
      { ...flat(0.2), group: 'a' },
      { ...flat(0.8), group: 'b' },
    ],
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(el.querySelectorAll('canvas')).toHaveLength(1);
  expect(pixel(el, 50, 50)).toEqual(RED_PIXEL);
  const line = pixel(el, 30, 20);
  chart.focus('a');
  expect(pixel(el, 50, 50)).toEqual(RED_PIXEL);
  expect(pixel(el, 30, 20)[3]).toBeLessThan(line[3]!);
});

test('a sankey path does not pass through a link that carries nothing', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...blank,
    width: 300,
    height: 100,
    dim: 0.2,
    marks: [
      sankey({
        nodes: ['A', 'B', 'C', 'D'],
        source: [0, 1, 2],
        target: [1, 2, 3],
        value: [1, 0, 1],
        colors: [RED],
        text: false,
      }),
    ],
    use: [c => ((chart = c), { destroy() {} })],
  });
  const find = (row: number) => {
    for (let y = 1; y < 100; y += 2)
      for (let x = 1; x < 300; x += 2) if (chart.hit(x, y, 0)?.row === row) return [x, y] as const;
    throw new Error(`row ${row} is nowhere`);
  };
  const [first, last, start] = [find(4), find(6), find(0)];
  const before = [pixel(el, ...first)[3]!, pixel(el, ...last)[3]!];
  chart.focus(null, { mark: chart.marks()[0]!, row: chart.hit(...start, 0)!.row! });
  expect(pixel(el, ...first)[3]).toBe(before[0]);
  expect(pixel(el, ...last)[3]).toBeLessThan(before[1]!);
});

const twigs = fromTree([
  {
    name: 'A',
    value: 99,
    children: [
      { name: 'a1', value: 2 },
      { name: 'a2', value: 2 },
    ],
  },
  { name: 'B', value: 4 },
]);
const rowOf = tooltip({ mode: 'nearest', text: (_l, _x, _y, row) => `row ${row}` });

test('a tree is given in columns, keeps nodes of one name apart and refuses what is not a tree', () => {
  expect(twigs).toEqual({ nodes: ['A', 'a1', 'a2', 'B'], parent: [-1, 0, 0, -1], value: [99, 2, 2, 4] });
  const others = fromTree({
    name: 'All',
    children: ['X', 'Y'].map(name => ({ name, children: [{ name: 'Other', value: 1 }] })),
  });
  expect(others.nodes).toEqual(['All', 'X', 'Other', 'Y', 'Other']);
  expect(others.parent).toEqual([-1, 0, 1, 0, 3]);

  const nodes = ['A', 'B', 'C'];
  for (const mark of [treemap, sunburst]) {
    expect(() => mark({ nodes, parent: [-1, 5, 0], value: [1, 1, 1], colors: [RED] })).toThrow(
      /B has parent 5/,
    );
    expect(() => mark({ nodes, parent: [-1, 0.5, 0], value: [1, 1, 1], colors: [RED] })).toThrow(
      /B has parent 0.5/,
    );
    expect(() => mark({ nodes, parent: [-1, 1, 0], value: [1, 1, 1], colors: [RED] })).toThrow(
      /B is its own parent/,
    );
    expect(() => mark({ nodes, parent: [-1, 2, 1], value: [1, 1, 1], colors: [RED] })).toThrow(
      /circle through (B, C|C, B)$/,
    );
    for (const frameOf of [blank, pie]) {
      expect(() =>
        plot(host(), { ...frameOf, marks: [mark({ nodes: [], parent: [], value: [], colors: [] })] }),
      ).not.toThrow();
      expect(() =>
        plot(host(), {
          ...frameOf,
          marks: [mark({ nodes, parent: [-1, 0, 0], value: [1, NaN, -Infinity], colors: [RED] })],
        }),
      ).not.toThrow();
    }
    // A chain 10,000 deep: nothing may recurse per level.
    const deep = Array.from({ length: 10_000 }, (_, i) => i);
    const chain = {
      nodes: deep.map(String),
      parent: deep.map(i => i - 1),
      value: deep.map(() => 1),
      colors: [RED],
    };
    expect(() => plot(host(), { ...blank, marks: [mark(chain)] })).not.toThrow();
  }
});

test('a treemap packs leaves inside their parents, by value, and is hit where it is painted', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...blank,
    dim: 0.2,
    marks: [treemap({ ...twigs, colors: [RED, BLUE] })],
    use: [rowOf, c => ((chart = c), { destroy() {} })],
  });
  // A's own 99 is ignored, so A and B are halves: A above with a pixel round its two leaves,
  // which meet at x = 50, and B below from y = 50. Every leaf loses half a pixel all round.
  expect(pixel(el, 25, 25)).toEqual(RED_PIXEL);
  expect(pixel(el, 75, 25)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 75)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 25, 49)[3]).toBe(0);
  expect(pixel(el, 25, 0)[3]).toBe(0);
  expect(pixel(el, 25, 2)).toEqual(RED_PIXEL);
  expect(pixel(el, 25, 47)).toEqual(RED_PIXEL);
  expect(pixel(el, 25, 51)).toEqual([0, 0, 255, 255]);
  expect(chart.hit(48, 25, 0)!.row).toBe(1);
  expect(chart.hit(50, 25, 0)).toBeNull();
  expect(chart.hit(52, 25, 0)!.row).toBe(2);
  expect(chart.hit(25, 48, 0)!.row).toBe(1);
  expect(chart.hit(25, 49.5, 0)).toBeNull();
  expect(chart.hit(25, 51, 0)!.row).toBe(3);
  expect(
    labelsOf(el)
      .map(d => d.textContent)
      .sort(),
  ).toEqual(['B', 'a1', 'a2']);

  expect(hover(el, 25, 25).innerText).toContain('row 1');
  expect(pixel(el, 25, 25)).toEqual(RED_PIXEL);
  expect(pixel(el, 75, 25)[3]).toBeLessThan(80);
  expect(pixel(el, 50, 75)[3]).toBeLessThan(80);

  // Four equal leaves in a square are its four quarters.
  const four = host();
  plot(four, {
    ...blank,
    marks: [
      treemap({
        nodes: ['a', 'b', 'c', 'd'],
        parent: [-1, -1, -1, -1],
        value: [1, 1, 1, 1],
        colors: [RED, BLUE],
      }),
    ],
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(
    [
      chart.hit(25, 25, 0)!.row,
      chart.hit(25, 75, 0)!.row,
      chart.hit(75, 25, 0)!.row,
      chart.hit(75, 75, 0)!.row,
    ].sort((a, b) => a! - b!),
  ).toEqual([0, 1, 2, 3]);
});

test('a sunburst rings children round their parents, and is hit where it is painted', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...pie,
    width: 200,
    height: 200,
    dim: 0.2,
    marks: [sunburst({ ...twigs, colors: [RED, BLUE] })],
    use: [rowOf, c => ((chart = c), { destroy() {} })],
  });
  // Two rings of 50 px. A is the right half of the inner one and B the left; a1 and a2 are the
  // upper and lower right quarters of the outer one, and nothing is outside B.
  expect(pixel(el, 125, 100)).toEqual(RED_PIXEL);
  expect(pixel(el, 75, 100)).toEqual([0, 0, 255, 255]);
  const outer = pixel(el, 153, 47);
  expect(outer[0]).toBe(255);
  expect(outer[3]).toBeGreaterThan(150);
  expect(outer[3]).toBeLessThan(210);
  expect(pixel(el, 25, 100)[3]).toBe(0);
  expect(chart.hit(125, 100, 0)!.row).toBe(0);
  expect(chart.hit(75, 100, 0)!.row).toBe(3);
  expect(chart.hit(25, 100, 0)).toBeNull();
  expect(chart.hit(5, 5, 0)).toBeNull();
  expect(chart.hit(175, 98, 0)!.row).toBe(1);
  expect(chart.hit(175, 100, 0)).toBeNull();
  expect(chart.hit(175, 102, 0)!.row).toBe(2);
  // Either side of the 50 px ring edge, 45 degrees round: 48 px out and 54 px out.
  expect(chart.hit(134, 66, 0)!.row).toBe(0);
  expect(chart.hit(138, 62, 0)!.row).toBe(1);
  expect(
    labelsOf(el)
      .map(d => d.textContent)
      .sort(),
  ).toEqual(['A', 'B', 'a1', 'a2']);

  // The node pointed at stays whole, the one it sits under fades half-way, the rest all the way.
  expect(hover(el, 153, 47).innerText).toContain('row 1');
  expect(pixel(el, 153, 47)).toEqual(outer);
  const under = pixel(el, 125, 100)[3]!;
  expect(under).toBeGreaterThan(120);
  expect(under).toBeLessThan(200);
  expect(pixel(el, 75, 100)[3]).toBeLessThan(80);
  expect(pixel(el, 153, 153)[3]).toBeLessThan(80);

  // A single root is a grey disc in the middle with its children round it in their colours.
  const one = host();
  plot(one, {
    ...pie,
    width: 200,
    height: 200,
    marks: [
      sunburst({
        ...fromTree({
          name: 'All',
          children: [
            { name: 'x', value: 1 },
            { name: 'y', value: 1 },
          ],
        }),
        colors: [RED, BLUE],
      }),
    ],
    use: [c => ((chart = c), { destroy() {} })],
  });
  expect(chart.hit(100, 100, 0)!.row).toBe(0);
  expect(chart.hit(100, 80, 0)!.row).toBe(0);
  expect(chart.hit(180, 100, 0)!.row).toBe(1);
  expect(chart.hit(20, 100, 0)!.row).toBe(2);
  expect(pixel(one, 100, 80)[0]).toBe(pixel(one, 100, 80)[2]);
  expect(pixel(one, 180, 100)[0]).toBe(255);
  expect(pixel(one, 20, 100)[2]).toBe(255);
  expect(labelsOf(one).map(d => d.textContent)).toContain('All');
});

test('trees cope with a nested object inside itself, an only child, an empty branch and an empty last child', () => {
  const loop: { name: string; children: unknown[] } = { name: 'L', children: [] };
  loop.children.push(loop);
  expect(() => fromTree(loop as Parameters<typeof fromTree>[0])).toThrow(/L is among its own children/);
  const shared = { name: 's', value: 1 };
  expect(fromTree(['a', 'b'].map(name => ({ name, children: [shared] }))).nodes).toEqual([
    'a',
    's',
    'b',
    's',
  ]);

  // An only child takes all of its parent's room, so the leaf of a long chain fills the plot.
  let chart!: Internals;
  const spy: Options['use'] = [c => ((chart = c), { destroy() {} })];
  const deep = Array.from({ length: 10_000 }, (_, i) => i);
  const chain = {
    nodes: deep.map(String),
    parent: deep.map(i => i - 1),
    value: deep.map(() => 1),
    colors: [RED],
  };
  const el = host();
  plot(el, { ...blank, marks: [treemap(chain)], use: spy });
  expect(pixel(el, 50, 50)).toEqual(RED_PIXEL);
  expect(pixel(el, 2, 2)).toEqual(RED_PIXEL);
  expect(chart.hit(50, 50, 0)!.row).toBe(9999);

  // A branch of no size, however deep, takes no ring: the fixture's outer ring stays 50 px wide.
  const empty = Array.from({ length: 1000 }, (_, i) => i);
  const withEmpty = {
    nodes: [...twigs.nodes, ...empty.map(i => `z${i}`)],
    parent: [...twigs.parent, ...empty.map(i => (i ? 3 + i : -1))],
    value: [...twigs.value, ...empty.map(() => 0)],
  };
  const rings = host();
  plot(rings, {
    ...pie,
    width: 200,
    height: 200,
    marks: [sunburst({ ...withEmpty, colors: [RED, BLUE] })],
    use: spy,
  });
  expect(pixel(rings, 153, 47)[0]).toBe(255);
  expect(pixel(rings, 153, 47)[3]).toBeGreaterThan(150);
  expect(chart.hit(153, 47, 0)!.row).toBe(1);
  expect(chart.hit(125, 100, 0)!.row).toBe(0);

  // Six equal nodes and one of no size: the sixth ends the turn and the seventh is not there.
  const asked: number[] = [];
  const seven = host();
  plot(seven, {
    ...pie,
    width: 200,
    height: 200,
    marks: [
      sunburst({
        nodes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        parent: [-1, -1, -1, -1, -1, -1, -1],
        value: [1, 1, 1, 1, 1, 1, 0],
        colors: [RED],
        text: row => (asked.push(row), ''),
      }),
    ],
    use: spy,
  });
  expect(asked.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(chart.hit(98, 20, 0)!.row).toBe(5);
  expect(chart.hit(102, 20, 0)!.row).toBe(0);
});

test('a point on the edge of the plot area is drawn whole, and a bar beside it is still cut there', () => {
  const el = host();
  plot(el, {
    ...frame,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    marks: [
      bar({ x1: [0], x2: [4], y1: [0], y2: [2], color: BLUE }),
      dots({ x: [10], y: [1], r: [4], color: RED }),
    ],
  });
  expect(pixel(el, 92, 8)).toEqual(RED_PIXEL);
  expect(pixel(el, 20, 12)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 20, 8)).toEqual([0, 0, 0, 0]);
});

test('points drawn by WebGL overhang the plot area as far as on the canvas', () => {
  const el = host();
  plot(el, { ...frame, margin: { top: 10, right: 10, bottom: 10, left: 10 }, marks: [pile(30_000)] });
  expect(el.querySelectorAll('canvas')[1]!.style.clipPath).toBe('inset(7px)');
});

test('the nearest tooltip takes the colour of the node it names', () => {
  const el = host();
  plot(el, {
    ...blank,
    marks: [treemap({ nodes: ['a', 'b'], parent: [-1, -1], value: [1, 1], colors: [RED, BLUE] })],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' })],
  });
  const tipColor = (x: number) =>
    [...hover(el, x, x).querySelectorAll<HTMLElement>('*')].find(
      e => e.innerText === 'tip' && !e.children.length,
    )!.style.color;
  const painted = (x: number) => `rgb(${pixel(el, x, x).slice(0, 3).join(', ')})`;
  expect(tipColor(25)).toBe(painted(25));
  expect(tipColor(75)).toBe(painted(75));
  expect(tipColor(25)).not.toBe(tipColor(75));
});

test('a mark with more shapes than pixels fills a bounded number and still names the row pointed at', () => {
  const many = 10_000;
  const ones = new Float64Array(many).fill(1);
  const twigs = Array.from({ length: many * 2 }, (_, i) => `t${i}`);
  const cases: [
    name: string,
    options: Partial<Options>,
    x: number,
    y: number,
    rows: number[],
    far?: [number, number],
  ][] = [
    ['pie', { ...pie, marks: [arcs({ values: ones, colors: [RED, BLUE] })] }, 75, 50, [2499, 2500]],
    [
      'funnel',
      { ...blank, marks: [funnel({ values: ones.map((_, i) => many - i), colors: [RED, BLUE] })] },
      50,
      50,
      [5000],
      [50, 10],
    ],
    [
      'radial bars',
      { ...pie, marks: [radialBars({ values: ones, max: 1, colors: [RED, BLUE] })] },
      82,
      50,
      [5142, 5143],
    ],
    [
      'sunburst',
      {
        ...pie,
        marks: [
          sunburst({
            nodes: twigs.slice(0, many),
            parent: ones.map(() => -1),
            value: ones,
            colors: [RED, BLUE],
          }),
        ],
      },
      90,
      50,
      [2499, 2500],
    ],
    [
      'treemap',
      {
        ...blank,
        marks: [
          treemap({
            nodes: ['a', 'b', ...twigs],
            parent: [-1, -1, ...twigs.map((_, i) => i % 2)],
            value: [0, 0, ...twigs.map(() => 1)],
            colors: [RED, BLUE],
          }),
        ],
      },
      25,
      25,
      [0, 1],
    ],
  ];
  for (const [name, options, x, y, rows, [fx, fy] = [100 - x, 100 - y]] of cases) {
    const fills = vi.spyOn(CanvasRenderingContext2D.prototype, 'fill');
    const el = host();
    plot(el, {
      ...options,
      width: 100,
      height: 100,
      dim: 0.2,
      use: [tooltip({ mode: 'nearest', text: (_, _x, _y, row) => `row ${row}` })],
    } as Options);
    expect(fills.mock.calls.length, name).toBeLessThan(1000);
    const before = pixel(el, fx, fy)[3]!;
    expect(
      rows.map(row => `row ${row}`),
      name,
    ).toContain(hover(el, x, y).innerText.trim());
    expect(pixel(el, x, y)[3], name).toBeGreaterThan(pixel(el, fx, fy)[3]!);
    expect(pixel(el, fx, fy)[3], name).toBeLessThan(before);
    fills.mockRestore();
  }
});

test('a sankey of thousands of links is drawn by WebGL as it is on the canvas, and dims off the path', () => {
  const el = host();
  const spare = Array.from({ length: 2000 }, () => 0);
  plot(el, {
    ...blank,
    dim: 0.2,
    marks: [
      sankey({
        nodes: ['a', 'b', 'c'],
        source: [0, 0, ...spare],
        target: [1, 2, ...spare.map(() => 1)],
        value: [1, 1, ...spare],
        colors: [RED, BLUE],
      }),
    ],
    use: [tooltip({ mode: 'nearest', text: (_, _x, _y, row) => `row ${row}` })],
  });
  expect(pixel(el, 50, 25)).toEqual([0, 0, 0, 0]);
  const [red, green, blue, strength] = pixel(el, 50, 75, 1);
  expect([red, green, blue]).toEqual([255, 0, 0]);
  expect(strength).toBeGreaterThan(105);
  expect(strength).toBeLessThan(125);
  expect(pixel(el, 5, 50, 1)).toEqual(RED_PIXEL);
  expect(pixel(el, 95, 25, 1)).toEqual([0, 0, 255, 255]);
  expect(labelsOf(el).map(label => label.textContent)).toContain('b');
  expect(hover(el, 50, 25).innerText).toContain('row 3');
  expect(pixel(el, 50, 25, 1)[3]).toBeGreaterThan(105);
  expect(pixel(el, 50, 75, 1)[3]).toBeLessThan(35);
});

// Rows of rectangles for the WebGL painters: the first are given, the rest have no number and draw nothing.
const padded = (...first: number[]) => {
  const column = new Float64Array(10_000).fill(NaN);
  column.set(first);
  return column;
};

test('bars are drawn by WebGL from 10,000 of them, dim round the one pointed at, and stay under a line', () => {
  const el = host();
  const bars = bar({ x1: padded(2, 6), x2: padded(4, 8), y: padded(0.5, 1), color: BLUE });
  const chart = plot(el, {
    ...frame,
    dim: 0.2,
    marks: [bars],
    use: [tooltip({ mode: 'nearest', text: (_, _x, _y, row) => `row ${row}` })],
  });
  expect(pixel(el, 30, 75)).toEqual([0, 0, 0, 0]);
  expect(pixel(el, 30, 75, 1)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 30, 25, 1)).toEqual([0, 0, 0, 0]);
  expect(pixel(el, 70, 25, 1)).toEqual([0, 0, 255, 255]);
  expect(hover(el, 30, 75).innerText).toContain('row 0');
  expect(pixel(el, 30, 75, 1)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 70, 25, 1)[3]).toBe(51);

  chart.update({ marks: [bars, flat(0.5)] });
  expect(pixel(el, 30, 75)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 90, 50)).toEqual(RED_PIXEL);
  expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('none');
});

test('error bars and a box are drawn by WebGL as on the canvas, under points on the same layer', () => {
  const el = host();
  plot(el, {
    ...frame,
    marks: [
      errorBars({ x: padded(5), y1: padded(0.2), y2: padded(0.8), color: BLUE, width: 2 }),
      pile(10_000),
    ],
  });
  expect(pixel(el, 50, 50, 1)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 30, 1)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 47, 80, 1)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 47, 70, 1)).toEqual([0, 0, 0, 0]);

  const boxed = host();
  plot(boxed, {
    ...frame,
    marks: [
      box({
        x: padded(5),
        min: padded(0.1),
        q1: padded(0.3),
        median: padded(0.5),
        q3: padded(0.7),
        max: padded(0.9),
        color: RED,
        width: 4,
      }),
    ],
  });
  expect(pixel(boxed, 40, 40, 1)).toEqual([255, 0, 0, 64]);
  expect(pixel(boxed, 40, 50, 1)).toEqual(RED_PIXEL);
  expect(pixel(boxed, 50, 20, 1)).toEqual(RED_PIXEL);
  expect(pixel(boxed, 20, 50, 1)).toEqual([0, 0, 0, 0]);
});

test('bars too many for the pixels dim as one shape on WebGL, and are cut at the plot area beside error bars', () => {
  const n = 20_000;
  const el = host();
  const column = (at: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => at(i));
  plot(el, {
    ...frame,
    dim: 0.2,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    marks: [
      bar({
        x1: column(i => (i / n) * 10),
        x2: column(i => ((i + 1) / n) * 10),
        y: column(() => 2),
        color: BLUE,
      }),
      errorBars({ y: padded(0.5), x1: padded(2), x2: padded(8), color: RED, width: 2 }),
    ],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' })],
  });
  expect(pixel(el, 50, 30, 1)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 50, 50, 1)).toEqual(RED_PIXEL);
  expect(pixel(el, 26, 47, 1)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 8, 1)).toEqual([0, 0, 0, 0]);
  hover(el, 30, 80);
  expect(pixel(el, 70, 30, 1)[3]).toBe(51);
});

test('a sankey of links too thin to show one by one still shows them together, and a radar of too many spokes its shape', () => {
  const many = 100_000;
  const el = host();
  plot(el, {
    ...blank,
    marks: [
      sankey({
        nodes: ['a', 'b'],
        source: new Float64Array(many),
        target: new Float64Array(many).fill(1),
        value: new Float64Array(many).fill(1),
        colors: [RED],
        text: false,
      }),
    ],
  });
  // Each link is a thousandth of a pixel; together they are one band as strong as a single link would be.
  const [, , , strength] = pixel(el, 50, 50, 1);
  expect(strength).toBeGreaterThan(60);
  expect(strength).toBeLessThan(130);

  const round = host();
  const fills = vi.spyOn(CanvasRenderingContext2D.prototype, 'arc');
  plot(round, {
    ...pie,
    marks: radar({
      axes: Array.from({ length: many }, () => ''),
      series: [{ values: new Float64Array(many).fill(1), color: RED }],
      max: 1,
      fill: 1,
    }),
  });
  expect(pixel(round, 50, 30)).toEqual(RED_PIXEL);
  expect(fills.mock.calls.length).toBeLessThan(1000);
});

test('a smooth line curves through its points, and a line drawn with the brand blend runs from cyan to violet', () => {
  const el = host();
  plot(el, {
    ...frame,
    x: bare([0, 10]),
    y: bare([0, 1]),
    marks: [line({ x: [0, 5, 10], y: [0, 1, 0], curve: 'smooth', color: RED, width: 4 })],
  });
  // Straight, the line is half-way up a quarter of the way along; curved, it is already higher.
  expect(pixel(el, 25, 50)).toEqual([0, 0, 0, 0]);
  expect(pixel(el, 25, 38)).toEqual(RED_PIXEL);
  expect(pixel(el, 50, 1)[3]).toBeGreaterThan(0);

  const blended = host();
  plot(blended, {
    ...frame,
    marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED, stroke: brand, width: 6 })],
  });
  const [left, right] = [pixel(blended, 3, 50), pixel(blended, 97, 50)];
  expect(left[1]).toBeGreaterThan(160);
  expect(right[0]).toBeGreaterThan(120);
  expect(right[1]).toBeLessThan(110);
});

test('an area fades towards its baseline on both sides of it, and a bare axis shows nothing', () => {
  const el = host();
  plot(el, {
    ...frame,
    x: bare([0, 10]),
    y: bare([-1, 1]),
    marks: [area({ x: [0, 5, 5, 10], y: [1, 1, -1, -1], color: RED, fill: gradient(1, 0) })],
  });
  expect(pixel(el, 25, 2)[3]).toBeGreaterThan(235);
  expect(pixel(el, 25, 47)[3]).toBeLessThan(25);
  expect(pixel(el, 75, 97)[3]).toBeGreaterThan(235);
  expect(pixel(el, 75, 53)[3]).toBeLessThan(25);
  expect(el.innerText.trim()).toBe('');
});

test('bars are rounded at their value end and blended alike on the canvas and on WebGL; ringed points are hollow', () => {
  const fill = gradient(RED, BLUE);
  const small = host();
  plot(small, {
    ...frame,
    marks: [bar({ x1: [2], x2: [8], y: [1], color: RED, radius: 10, fill })],
  });
  expect(pixel(small, 21, 1)).toEqual([0, 0, 0, 0]);
  expect(pixel(small, 50, 1)[0]).toBeGreaterThan(240);
  expect(pixel(small, 21, 98)[2]).toBeGreaterThan(240);

  const large = host();
  plot(large, { ...frame, marks: [bar({ x1: padded(2), x2: padded(8), y: padded(1), color: RED, fill })] });
  for (const y of [10, 50, 90]) {
    const [onCanvas, onLayer] = [pixel(small, 50, y), pixel(large, 50, y, 1)];
    onCanvas.forEach((channel, at) => expect(Math.abs(channel - onLayer[at]!)).toBeLessThan(8));
  }

  const ringed = host();
  plot(ringed, {
    ...frame,
    marks: [dots({ x: [5], y: [0.5], r: [10], color: RED, ring: 4 })],
  });
  expect(pixel(ringed, 50, 50)).toEqual([255, 255, 255, 255]);
  expect(pixel(ringed, 60, 50)).toEqual(RED_PIXEL);
});

test('below the baseline a fade and a blend still run from the value end to the baseline', () => {
  const el = host();
  plot(el, {
    ...frame,
    x: bare([0, 10]),
    y: bare([-1, 0]),
    marks: [area({ x: [0, 10], y: [-1, -1], color: RED, fill: gradient(1, 0) })],
  });
  expect(pixel(el, 50, 3)[3]).toBeLessThan(25);
  expect(pixel(el, 50, 97)[3]).toBeGreaterThan(235);

  const fill = gradient(RED, BLUE);
  const [small, large] = [host(), host()];
  const axes = { ...frame, x: bare([0, 10]), y: bare([-1, 0]) };
  plot(small, { ...axes, marks: [bar({ x1: [2], x2: [8], y: [-1], color: RED, fill })] });
  plot(large, { ...axes, marks: [bar({ x1: padded(2), x2: padded(8), y: padded(-1), color: RED, fill })] });
  for (const [painted, nth] of [
    [small, 0],
    [large, 1],
  ] as const) {
    expect(pixel(painted, 50, 97, nth)[0]).toBeGreaterThan(235);
    expect(pixel(painted, 50, 3, nth)[2]).toBeGreaterThan(235);
  }
});

test('a line shades what is under it only when asked, fading towards the bottom of the plot area', () => {
  const under = (fill?: boolean) => {
    const el = host();
    plot(el, {
      ...frame,
      x: bare([0, 10]),
      y: bare([0, 1]),
      marks: [line({ x: [0, 10], y: [0.8, 0.8], color: RED, width: 2, fill })],
    });
    return [pixel(el, 50, 25)[3]!, pixel(el, 50, 95)[3]!];
  };
  expect(under()).toEqual([0, 0]);
  const [near, far] = under(true);
  expect(near).toBeGreaterThan(30);
  expect(near).toBeLessThan(50);
  expect(far).toBeLessThan(6);
});

test('a gap sets touching bars apart alike on both painters, and bars that start at zero are rounded at the top only', () => {
  const [small, large] = [host(), host()];
  const axes = { ...frame, x: bare([0, 10]), y: bare([0, 1]) };
  plot(small, {
    ...axes,
    marks: [bar({ x1: [0, 5], x2: [5, 10], y1: [0, 0], y2: [1, 1], color: RED, gap: 4, radius: 10 })],
  });
  plot(large, {
    ...axes,
    marks: [
      bar({ x1: padded(0, 5), x2: padded(5, 10), y1: padded(0, 0), y2: padded(1, 1), color: RED, gap: 4 }),
    ],
  });
  for (const [painted, nth] of [
    [small, 0],
    [large, 1],
  ] as const) {
    expect(pixel(painted, 44, 50, nth)).toEqual(RED_PIXEL);
    expect(pixel(painted, 47, 50, nth)).toEqual([0, 0, 0, 0]);
    expect(pixel(painted, 51, 50, nth)).toEqual(RED_PIXEL);
  }
  expect(pixel(small, 1, 1)).toEqual([0, 0, 0, 0]);
  expect(pixel(small, 1, 98)).toEqual(RED_PIXEL);
});

test('a sankey ribbon blends from its source to its target on both painters; a funnel and a donut take a blend', () => {
  const spare = Array.from({ length: 2000 }, () => 0);
  for (const [extra, nth] of [
    [[], 0],
    [spare, 1],
  ] as const) {
    const el = host();
    plot(el, {
      ...blank,
      marks: [
        sankey({
          nodes: ['a', 'b'],
          source: [0, ...extra],
          target: [1, ...extra.map(() => 1)],
          value: [1, ...extra],
          colors: [RED, BLUE],
          blend: true,
          text: false,
        }),
      ],
    });
    const [left, right] = [pixel(el, 18, 50, nth), pixel(el, 82, 50, nth)];
    expect(left[0]! - left[2]!).toBeGreaterThan(150);
    expect(right[2]! - right[0]!).toBeGreaterThan(150);
  }

  const narrowing = host();
  plot(narrowing, {
    ...blank,
    marks: [funnel({ values: [1, 1, 1, 1], colors: [GREEN], fill: gradient(RED, BLUE) })],
  });
  expect(pixel(narrowing, 50, 4)[0]).toBeGreaterThan(230);
  expect(pixel(narrowing, 50, 96)[2]).toBeGreaterThan(230);

  const ring = host();
  plot(ring, { ...pie, marks: [arcs({ values: [1], colors: [RED], inner: 0.5, sweep: 0.2 })] });
  // Just past twelve the single slice is faint; just before it, where it ends, it is full.
  expect(pixel(ring, 58, 14)[3]).toBeLessThan(80);
  expect(pixel(ring, 42, 14)[3]).toBeGreaterThan(230);
});

test('a shaded treemap is lighter at the top of a branch, and a swept radial bar at its start', () => {
  const map = host();
  plot(map, {
    ...blank,
    marks: [
      treemap({
        nodes: ['a', 'top', 'bottom'],
        parent: [-1, 0, 0],
        value: [0, 1, 1],
        colors: [RED],
        shade: 0.2,
        text: false,
      }),
    ],
  });
  const [high, low] = [pixel(map, 30, 6)[3]!, pixel(map, 70, 94)[3]!];
  expect(high).toBeLessThan(90);
  expect(low).toBeGreaterThan(230);

  const bars = host();
  plot(bars, { ...pie, marks: [radialBars({ values: [1], max: 1, colors: [RED], sweep: 0.2, inner: 0.5 })] });
  // The one bar runs three quarters of a turn from twelve: faint just after it, full near nine.
  expect(pixel(bars, 58, 12)[3]).toBeLessThan(90);
  expect(pixel(bars, 12, 58)[3]).toBeGreaterThan(215);
});

test('a shaded sunburst runs from its full colour at the centre to a fainter rim', () => {
  const el = host();
  plot(el, {
    ...pie,
    marks: [
      sunburst({
        nodes: ['a', 'b'],
        parent: [-1, -1],
        value: [1, 1],
        colors: [RED, BLUE],
        shade: 0.2,
        text: false,
      }),
    ],
  });
  expect(pixel(el, 56, 50)[3]).toBeGreaterThan(215);
  expect(pixel(el, 95, 50)[3]).toBeLessThan(95);
});

test('a box takes a blend, a heavier median and fainter whiskers alike on both painters, and round corners on the canvas', () => {
  const style = { color: RED, width: 4, fill: gradient(0.8, 0.2), medianWidth: 6, whiskers: 0.5 };
  const [small, large] = [host(), host()];
  const axes = { ...frame, x: bare([0, 10]), y: bare([0, 1]) };
  plot(small, {
    ...axes,
    marks: [
      box({ x: [5], min: [0.1], q1: [0.3], median: [0.5], q3: [0.7], max: [0.9], radius: 8, ...style }),
    ],
  });
  plot(large, {
    ...axes,
    marks: [
      box({
        x: padded(5),
        min: padded(0.1),
        q1: padded(0.3),
        median: padded(0.5),
        q3: padded(0.7),
        max: padded(0.9),
        ...style,
      }),
    ],
  });
  for (const [painted, nth] of [
    [small, 0],
    [large, 1],
  ] as const) {
    // Stronger under the top of the box than above its bottom, a median three pixels either side, a faint whisker.
    expect(pixel(painted, 40, 34, nth)[3]! - pixel(painted, 40, 66, nth)[3]!).toBeGreaterThan(90);
    expect(pixel(painted, 40, 52, nth)).toEqual(RED_PIXEL);
    expect(pixel(painted, 40, 48, nth)).toEqual(RED_PIXEL);
    const whisker = pixel(painted, 50, 20, nth)[3]!;
    expect(whisker).toBeGreaterThan(85);
    expect(whisker).toBeLessThan(145);
  }
  expect(pixel(small, 31, 31)[3]).toBeLessThan(60);
  expect(pixel(large, 31, 31, 1)[3]).toBeGreaterThan(150);
});

const channels = (hex: string) => {
  const full = hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);
  return [0, 2, 4].map(at => parseInt(full.slice(at, at + 2), 16));
};
const rgb = (hex: string) => `rgb(${channels(hex).join(', ')})`;
const themed = (theme?: Options['theme']) => {
  const el = host();
  let chart!: Internals;
  const views: Parameters<Mark['prepare']>[0][] = [];
  const spy: Mark = {
    type: 'spy',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: view => (views.push(view), { paint() {} }),
  };
  const one = (value: number, label: string): Axis => ({
    domain: [0, value * 2],
    label: '',
    scale: () => ({ lo: 0, hi: value * 2, ticks: [{ value, label }] }),
  });
  const drawn = plot(el, {
    width: 120,
    height: 120,
    margin: { top: 10, right: 10, bottom: 20, left: 20 },
    x: one(5, 'five'),
    y: one(0.5, 'half'),
    theme,
    marks: [line({ x: [0, 10], y: [0.2, 0.2], curve: 'step', color: RED, width: 4, label: 'a' }), spy],
    use: [
      legend(),
      tooltip({ mode: 'x', title: () => 'tip', value: String }),
      c => ((chart = c), { destroy() {} }),
    ],
  });
  const root = el.firstElementChild as HTMLElement;
  const read = () => {
    const [x, y] = [Math.round(chart.xPx(5)), Math.round(chart.yPx(0.5))];
    const text = (s: string) => [...root.querySelectorAll('div')].find(d => d.textContent === s)!;
    const tip = [...root.querySelectorAll('div')].find(d => d.style.zIndex === '100')!;
    const style = getComputedStyle(tip);
    return {
      grid: pixel(el, x + 20, y),
      tick: pixel(el, x, chart.size().height - chart.margin().bottom + 2),
      line: pixel(el, 30, Math.round(chart.yPx(0.2))),
      axis: getComputedStyle(text('half')).color,
      legend: getComputedStyle(root.querySelector('span')!.parentElement!).color,
      tip: [style.display, style.backgroundColor, style.borderTopColor],
    };
  };
  hover(el, 60, 60);
  return { drawn, read, views };
};

test('a theme colours the grid, the tick marks, the axis and legend text and the tooltip', () => {
  const { read } = themed(dark);
  expect(read()).toEqual({
    grid: [...channels(dark.grid), 255],
    tick: [...channels(dark.muted), 255],
    line: RED_PIXEL,
    axis: rgb(dark.text),
    legend: rgb(dark.text),
    tip: ['block', rgb(dark.surface), rgb(dark.border)],
  });
  expect(themed().read()).toMatchObject({
    grid: [...channels(light.grid), 255],
    tick: [...channels(light.muted), 255],
    axis: rgb(light.text),
    tip: ['block', rgb(light.surface), rgb(light.border)],
  });
});

test('an update to another theme prepares the marks again and restyles the chart; the same theme prepares nothing', () => {
  const { drawn, read, views } = themed();
  const before = views.length;
  drawn.update({ theme: dark });
  expect(views.length).toBe(before + 1);
  expect(views.at(-1)!.theme).toBe(dark);
  expect(read()).toEqual({
    grid: [...channels(dark.grid), 255],
    tick: [...channels(dark.muted), 255],
    line: RED_PIXEL,
    axis: rgb(dark.text),
    legend: rgb(dark.text),
    tip: ['block', rgb(dark.surface), rgb(dark.border)],
  });
  drawn.update({ theme: dark });
  expect(views.length).toBe(before + 1);
  drawn.update({ theme: undefined });
  expect(views.length).toBe(before + 2);
  expect(read().grid).toEqual([...channels(light.grid), 255]);
});

test('a theme changed together with the marks or the dimming is painted as a resize', () => {
  const whys: string[] = [];
  const marks = (color: string) => [line({ x: [0, 10], y: [0.5, 0.5], color, width: 4 })];
  const chart = plot(host(), {
    ...frame,
    marks: marks(RED),
    use: [c => (c.onPaint((draw, why) => (whys.push(why), draw(1))), { destroy() {} })],
  });
  chart.update({ theme: dark, marks: marks('#0000ff') });
  chart.update({ theme: light, dim: 0.5 });
  expect(whys.slice(-2)).toEqual(['size', 'size']);
});

test("a radar's rings and scale labels, a radial bar's track and a ringed point's fill follow the theme", () => {
  const draw = (theme: Options['theme']) => {
    const [web, bars, ringed] = [host(), host(), host()];
    plot(web, { ...pie, theme, marks: radar({ axes: ['A', 'B', 'C', 'D'], max: 1, series: [] }) });
    plot(bars, { ...pie, theme, marks: [radialBars({ values: [0.5], max: 1, colors: [RED] })] });
    plot(ringed, { ...frame, theme, marks: [dots({ x: [5], y: [0.5], r: [10], color: RED, ring: 4 })] });
    // The spoke up from the centre straddles two pixel columns.
    const spoke = [pixel(web, 49, 40), pixel(web, 50, 40)].sort((a, b) => b[3]! - a[3]!)[0]!;
    const scaleLabel = labelsOf(web).find(d => d.textContent === '1')!;
    return { spoke, label: scaleLabel.style.color, track: pixel(bars, 10, 50), fill: pixel(ringed, 50, 50) };
  };
  const [day, night] = [draw(undefined), draw(dark)];
  expect(day.spoke[0]).toBeGreaterThan(200);
  expect(night.spoke[0]).toBeLessThan(80);
  expect(night.spoke[3]).toBeGreaterThan(100);
  expect([day.label, night.label]).toEqual([rgb(light.muted), rgb(dark.muted)]);
  expect(day.track[0]).toBeLessThan(100);
  expect(night.track[0]).toBeGreaterThan(160);
  expect(night.track[3]).toBe(day.track[3]);
  expect(night.track[3]).toBeGreaterThan(0);
  expect([day.fill, night.fill]).toEqual([
    [255, 255, 255, 255],
    [...channels(dark.surface), 255],
  ]);
});

test('the dark theme and its palette keep their contrast on the dark surface', () => {
  const luminance = (hex: string) => {
    const [r, g, b] = channels(hex).map(c => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (hi! + 0.05) / (lo! + 0.05);
  };
  expect(paletteDark).toHaveLength(8);
  for (const c of paletteDark) expect(contrast(c, dark.surface)).toBeGreaterThanOrEqual(3);
  expect(contrast(dark.text, dark.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(dark.muted, dark.surface)).toBeGreaterThanOrEqual(3);
});

function windowed(options: Partial<Options>) {
  const el = host();
  const whys: string[] = [];
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    marks: [],
    ...options,
    use: [
      ...(options.use ?? []),
      c => ((internals = c), c.onPaint((draw, why) => (whys.push(why), draw())), { destroy() {} }),
    ],
  });
  return { el, chart, internals, whys };
}
/** The numbers in the axis layer, which with a bare y axis are the x tick labels. */
const tickValues = (el: HTMLElement) =>
  [...el.firstElementChild!.querySelector(':scope > div')!.children]
    .map(d => d.textContent ?? '')
    .filter(Boolean)
    .map(Number);

test('a zoom window shows its part of the domain, with ticks inside it and nothing past its edge', () => {
  const { el } = windowed({
    margin: { top: 0, right: 20, bottom: 20, left: 0 },
    y: bare([0, 1]),
    view: { x: [2, 4] },
    marks: [dots({ x: [3, 4.2], y: [0.5, 0.5], r: [3, 6], color: RED })],
  });
  expect(pixel(el, 40, 40)).toEqual(RED_PIXEL);
  expect(pixel(el, 88, 40)[3]).toBe(0);
  const ticks = tickValues(el);
  expect(ticks.length).toBeGreaterThan(1);
  for (const t of ticks) expect(t >= 2 && t <= 4).toBe(true);
});

test('a zoom window is moved inside the domain, cut to it, widened to a least span, or ignored', () => {
  const cases: [[number, number], [number, number]][] = [
    [
      [-5, 3],
      [0, 8],
    ],
    [
      [-50, 50],
      [0, 10],
    ],
    [
      [4, 2],
      [0, 10],
    ],
    [
      [NaN, 4],
      [0, 10],
    ],
    [
      [0, Infinity],
      [0, 10],
    ],
  ];
  for (const [want, shown] of cases)
    expect(windowed({ view: { x: want } }).internals.view().x).toEqual(shown);
  const [lo, hi] = windowed({ view: { x: [3, 3 + 1e-9] } }).internals.view().x;
  expect(hi - lo).toBeCloseTo(1e-5, 12);
  expect((lo + hi) / 2).toBeCloseTo(3, 8);
  const [farLo, farHi] = windowed({ view: { x: [1e12, 1e12] } }).internals.view().x;
  expect(farHi).toBe(10);
  expect(farHi - farLo).toBeCloseTo(1e-5, 12);
  const big = 1e15;
  const [bigLo, bigHi] = windowed({
    x: { domain: [big, big + 10], label: '' },
    view: { x: [big + 3, big + 3] },
  }).internals.view().x;
  expect(bigHi).toBeGreaterThan(bigLo);
  expect(bigLo).toBeGreaterThanOrEqual(big);
  expect(
    windowed({
      x: { domain: [big, big + 10], label: '' },
      view: { x: [big + 3, big + 3.25] },
    }).internals.view().x,
  ).toEqual([big + 3, big + 3.25]);
});

test('the window is kept across updates, and only a proposal reports it', () => {
  const calls: unknown[] = [];
  const { chart, internals, whys } = windowed({
    view: { x: [2, 4] },
    onViewChange: v => calls.push(v),
    marks: [flat(0.5)],
  });
  chart.update({ dim: 0.5 });
  expect(internals.view().x).toEqual([2, 4]);
  chart.update({ view: undefined });
  expect(internals.view().x).toEqual([0, 10]);
  chart.update({ view: { x: [1, 3] } });
  expect(internals.view().x).toEqual([1, 3]);
  expect(calls).toEqual([]);

  const paints = whys.length;
  expect(internals.propose({ x: [5, 7] })).toBe(true);
  expect(calls).toEqual([{ x: [5, 7], y: [0, 1] }]);
  expect(whys.slice(paints)).toEqual(['size']);
  expect(internals.propose({ x: [5, 7] })).toBe(false);
  expect(calls).toHaveLength(1);
  expect(whys).toHaveLength(paints + 1);
  expect(internals.propose(null)).toBe(true);
  expect(internals.view().x).toEqual([0, 10]);
});

test('a proposal past the edge is stored clamped, so the next one starts from what is shown', () => {
  const calls: { x: number[] }[] = [];
  const { internals } = windowed({ onViewChange: v => calls.push(v) });
  internals.propose({ x: [8, 14] });
  const [lo, hi] = calls[0]!.x;
  internals.propose({ x: [lo! - 1, hi! - 1] });
  expect(calls.map(c => c.x)).toEqual([
    [4, 10],
    [3, 9],
  ]);
});

test('a window the domain shrinks under is shown clamped and comes back when the domain grows', () => {
  const onViewChange = vi.fn();
  const reach = (x: number) => [line({ x: [0, x], y: [0.5, 0.5], color: RED })];
  const { chart, internals } = windowed({
    x: { domain: 'nice', label: '' },
    view: { x: [6, 9] },
    onViewChange,
    marks: reach(10),
  });
  chart.update({ marks: reach(5) });
  expect(internals.view().x).toEqual([2, 5]);
  chart.update({ marks: reach(10) });
  expect(internals.view().x).toEqual([6, 9]);
  expect(onViewChange).not.toHaveBeenCalled();
});

test('a window works on a time, a bare and a y axis, and a polar or blank frame ignores it', () => {
  const day = (d: number, h = 0) => Date.UTC(2026, 0, d, h);
  const timed = windowed({
    width: 300,
    x: time({ label: '' }),
    y: bare([0, 1]),
    view: { x: [day(10, 12), day(13, 12)] },
    marks: [line({ x: [day(1), day(32)], y: [0.5, 0.5], color: RED })],
  });
  const labels = [...timed.el.querySelectorAll('div')].filter(
    d => !d.children.length && (d.textContent ?? '').startsWith('Jan'),
  );
  expect(labels.map(d => d.textContent)).toEqual(['Jan 11', 'Jan 12', 'Jan 13']);
  expect(labels[1]!.style.left).toBe(`${timed.internals.xPx(day(12))}px`);

  const plain = windowed({
    x: bare([0, 10]),
    y: bare([0, 1]),
    view: { x: [2, 4] },
    marks: [dots({ x: [3], y: [0.5], r: [5], color: RED })],
  });
  expect(pixel(plain.el, 50, 50)).toEqual(RED_PIXEL);
  expect(tickValues(plain.el)).toEqual([]);

  const upright = windowed({ x: bare([0, 10]), view: { y: [0.25, 0.75] }, marks: [flat(0.6)] });
  expect(pixel(upright.el, 50, 30)).toEqual(RED_PIXEL);
  const ticks = tickValues(upright.el);
  expect(ticks.length).toBeGreaterThan(1);
  for (const t of ticks) expect(t >= 0.25 && t <= 0.75).toBe(true);

  for (const shape of ['polar', 'blank'] as const) {
    const { internals } = windowed({ frame: shape, view: { x: [0.2, 0.4], y: [0.5, 0.6] } });
    expect(internals.view()).toEqual({ x: [0, 1], y: [0, 1] });
    expect(internals.propose({ x: [0.2, 0.4] })).toBe(false);
  }
});

test('under animate() a new window is painted at once, also when the marks change with it', () => {
  fakeClock();
  const point = (r: number) => [dots({ x: [3], y: [0.5], r: [r], color: RED })];
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    marks: point(5),
    use: [animate({ duration: 600 }), c => ((internals = c), { destroy() {} })],
  });
  vi.advanceTimersByTime(1000);
  internals.propose({ x: [2.5, 4.5] });
  expect(pixel(el, 25, 50)).toEqual(RED_PIXEL);
  chart.update({ view: { x: [1, 5] }, marks: point(6) });
  expect(pixel(el, 50, 50)).toEqual(RED_PIXEL);
});

test('a new window that shows what is already shown paints nothing', () => {
  for (const [options, next] of [
    [{}, { x: [-60, 60] }],
    [{ frame: 'polar' }, { x: [0.2, 0.4] }],
    [{ frame: 'blank' }, { x: [0.2, 0.4] }],
  ] as const) {
    const { chart, whys } = windowed({ ...options, view: { x: [-50, 50] }, marks: [flat(0.5)] });
    const paints = whys.length;
    chart.update({ view: { x: [...next.x] } });
    expect(whys).toHaveLength(paints);
  }
});

test('under a window a bar is hit on its visible part only, and a point outside it not at all', () => {
  const tip = tooltip({ mode: 'nearest', text: label => label });
  const margin = { top: 0, right: 0, bottom: 0, left: 20 };
  const barred = windowed({
    margin,
    view: { x: [2, 4] },
    marks: [bar({ x1: [1], x2: [3], y1: [0], y2: [1], color: RED, label: 'bar' })],
    use: [tip],
  });
  expect(hover(barred.el, 40, 50).innerText).toContain('bar');
  expect(hover(barred.el, 10, 50).innerText).not.toContain('bar');
  const dotted = windowed({
    margin,
    view: { x: [2, 4] },
    marks: [dots({ x: [1.8], y: [0.5], r: [3], color: RED, label: 'dot' })],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(hover(dotted.el, 12, 50).innerText).not.toContain('dot');
});

test('an update with an axis equal to the current one prepares and paints nothing', () => {
  let prepares = 0;
  const mark: Mark = {
    type: 'counted',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => (prepares++, { paint() {} }),
  };
  const { chart, whys } = windowed({ x: { domain: [0, 10], label: 'X' }, marks: [mark] });
  const paints = whys.length;
  chart.update({ x: { domain: [0, 10], label: 'X' } });
  expect(prepares).toBe(1);
  expect(whys).toHaveLength(paints);
});

/** Every piece of text the chart draws, as boxes in the page. */
const texts = (el: HTMLElement) =>
  [...el.querySelectorAll('div')]
    .filter(d => !d.children.length && d.textContent)
    .map(d => ({ text: d.textContent!, box: d.getBoundingClientRect() }));

test('under a time window panned across the domain the margins hold still and no tick label leaves the chart', () => {
  const day = (d: number) => Date.UTC(2026, 0, d);
  const { el, chart, internals } = windowed({
    width: 400,
    margin: undefined,
    x: time({ label: '' }),
    marks: [line({ x: [day(1), day(366)], y: [0.5, 0.5], color: RED })],
  });
  const margins = new Set<string>();
  for (let i = 0; i < 20; i++) {
    chart.update({ view: { x: [day(1 + i * 17.5), day(13 + i * 17.5)] } });
    const { left, right } = internals.margin();
    margins.add(JSON.stringify({ left, right }));
    const outer = el.firstElementChild!.getBoundingClientRect();
    for (const { text, box } of texts(el)) {
      expect(box.left, text).toBeGreaterThanOrEqual(outer.left);
      expect(box.right, text).toBeLessThanOrEqual(outer.right);
    }
  }
  expect(margins.size).toBe(1);
});

test("a y window with longer tick labels than the whole domain's keeps them inside the chart", () => {
  const { el } = windowed({
    height: 400,
    margin: undefined,
    y: { domain: [0, 10], label: '' },
    view: { y: [2.25, 2.75] },
    marks: [flat(2.5)],
  });
  const outer = el.firstElementChild!.getBoundingClientRect();
  const labels = texts(el).filter(t => t.text.includes('.'));
  expect(labels.length).toBeGreaterThan(1);
  for (const { text, box } of labels) expect(box.left, text).toBeGreaterThanOrEqual(outer.left);
});

test("a y window with shorter tick labels than the whole domain's keeps the whole domain's left margin", () => {
  const left = (view?: { y: [number, number] }) => {
    const { el, internals } = windowed({
      height: 400,
      margin: undefined,
      y: { domain: [0, 10000], label: '' },
      view,
      marks: [flat(2.5)],
    });
    const outer = el.firstElementChild!.getBoundingClientRect();
    for (const { text, box } of texts(el)) expect(box.left, text).toBeGreaterThanOrEqual(outer.left);
    return internals.margin().left;
  };
  expect(left({ y: [2, 3] })).toBe(left());
});

test('a band window labels every category it shows where the whole axis labels every fourth', () => {
  const categories = Array.from({ length: 40 }, (_, i) => 'c' + String(i).padStart(2, '0'));
  const labelled = (view?: { x: [number, number] }) =>
    texts(windowed({ width: 400, x: band({ label: '', categories }), y: bare([0, 1]), view }).el).map(
      t => t.text,
    );
  expect(labelled()).toEqual(['c00', 'c04', 'c08', 'c12', 'c16', 'c20', 'c24', 'c28', 'c32', 'c36']);
  expect(labelled({ x: [9.5, 14.5] })).toEqual(['c10', 'c11', 'c12', 'c13', 'c14']);
});

test('a band window allows for the widths of the categories it shows, not of those outside it', () => {
  const categories = Array.from({ length: 40 }, (_, i) =>
    i ? 'c' + String(i).padStart(2, '0') : 'x'.repeat(60),
  );
  const { el } = windowed({
    width: 400,
    x: band({ label: '', categories }),
    y: bare([0, 1]),
    view: { x: [9.5, 14.5] },
  });
  expect(texts(el).map(t => t.text)).toEqual(['c10', 'c11', 'c12', 'c13', 'c14']);
});

test('a band scale given a reversed domain labels nothing', () => {
  const axis = band({ label: '', categories: ['a', 'b', 'c'] });
  for (const room of [undefined, { length: 400, horizontal: true }])
    expect(axis.scale!({ ...axis, domain: [2, 0] }, () => [0, 1], room).ticks).toEqual([]);
});

test('a window drops an edge label whose rendered width reaches past the chart', () => {
  const wide = 'W'.repeat(10);
  const { el } = windowed({
    width: 400,
    margin: { top: 0, right: 0, bottom: 20, left: 0 },
    x: band({ label: '', categories: Array.from({ length: 20 }, () => wide) }),
    y: bare([0, 1]),
    view: { x: [9.4, 14.4] },
  });
  const outer = el.firstElementChild!.getBoundingClientRect();
  const labels = texts(el);
  expect(labels.length).toBeGreaterThan(0);
  for (const { box } of labels) {
    expect(box.left).toBeGreaterThanOrEqual(outer.left);
    expect(box.right).toBeLessThanOrEqual(outer.right);
  }
});

test('a window equal to the whole domain it replaces still drops the edge labels that reach past the chart', () => {
  const { el, chart } = windowed({
    width: 200,
    margin: { top: 0, right: 0, bottom: 20, left: 0 },
    y: bare([0, 1]),
  });
  const outer = el.firstElementChild!.getBoundingClientRect();
  expect(texts(el).some(t => t.box.left < outer.left)).toBe(true);
  chart.update({ x: { domain: [0, 20], label: '' }, view: { x: [0, 10] } });
  for (const { text, box } of texts(el)) expect(box.left, text).toBeGreaterThanOrEqual(outer.left);
});

const near = (got: number[], want: number[]) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i]!, 9));

/** Every pixel of a chart's 2D canvas. */
const pixels = (el: HTMLElement) => {
  const canvas = el.querySelector('canvas')!;
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
};
/**
 * The largest difference in any channel of any pixel, with colour weighted by alpha. Chrome antialiases
 * the same edge up to 6 levels apart when the path holds more outside the canvas.
 */
const drift = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let most = 0;
  for (let i = 0; i < a.length; i += 4) {
    most = Math.max(most, Math.abs(a[i + 3]! - b[i + 3]!));
    for (let k = 0; k < 3; k++)
      most = Math.max(most, Math.abs(a[i + k]! * a[i + 3]! - b[i + k]! * b[i + 3]!) / 255);
  }
  return most;
};
const inkedColumn = (el: HTMLElement, x: number) =>
  Array.from({ length: 100 }, (_, y) => pixel(el, x, y)[3]!).some(a => a > 0);
const wavy = [0.5, 0.2, 0.8, 0.3, 0.9, 0.1, 0.6, 0.4, 0.7, 0.5, 0.3];
/** The mark as it draws without cutting its rows to the window: no row lies outside a plot this wide. */
const everyRow = (m: Mark): Mark => ({
  ...m,
  prepare: (v, p) => m.prepare({ ...v, left: -1e9, width: 2e9 }, p),
});

test.each([
  ['line', 'linear', 1, 45, 40],
  ['line', 'step', 1, 20, 70],
  ['line', 'smooth', 2, 45, 40],
  ['area', 'linear', 1, 47, 42],
  ['area', 'step', 1, 22, 72],
  ['area', 'smooth', 2, 47, 42],
] as const)(
  'a zoomed %s (%s) draws as the points in its window and %i beyond each edge do',
  (kind, curve, keep, edge, middle) => {
    for (const [lo, hi, inked] of [
      [2.5, 6.5, [0, edge]],
      [3.2, 3.8, [50, middle]],
    ] as const) {
      const draw = (from: number, to: number, all = false) => {
        const el = host();
        const x = Float64Array.from({ length: 11 }, (_, i) => i).slice(from, to);
        const y = Float64Array.from(wavy).slice(from, to);
        const mark = kind === 'line' ? line({ x, y, curve, color: RED }) : area({ x, y, curve, color: RED });
        plot(el, { ...frame, y: bare([0, 1]), view: { x: [lo, hi] }, marks: [all ? everyRow(mark) : mark] });
        return el;
      };
      const whole = draw(0, 11);
      expect(
        drift(pixels(whole), pixels(draw(Math.floor(lo) - keep + 1, Math.ceil(hi) + keep, true))),
      ).toBeLessThanOrEqual(8);
      expect(pixel(whole, inked[0], inked[1])[3]).toBeGreaterThan(0);
    }
  },
);

test('a zoomed curve reads the rows in its window, so many columns of rows beyond each edge, and whole columns', () => {
  const x = Float64Array.from({ length: 11 }, (_, i) => i);
  expect(span(x, 0, 10, 25, 65, 1)).toEqual([2, 8]);
  expect(span(x, 0, 10, 25, 65, 2)).toEqual([1, 9]);
  expect(span(x, 0, 10, 32, 38, 1)).toEqual([3, 5]);
  expect(span(x, 0, 10, -5, 200, 2)).toEqual([0, 11]);
  // Four rows to a pixel column: rows 250 to 253 make the column at the left edge, 650 to 653 the one at the right.
  const dense = Float64Array.from({ length: 1001 }, (_, i) => i / 100);
  expect(span(dense, 0, 25, 62.5, 162.5, 1)).toEqual([250, 654]);
  expect(span(dense, 0, 25, 62.5, 162.5, 2)).toEqual([246, 658]);
  expect(span(x, 100, -10, 35, 75, 1)).toEqual([2, 8]);
});

test.each(['line', 'area'] as const)('a %s on a reversed x axis draws as it does reading every row', kind => {
  const draw = (all: boolean) => {
    const el = host();
    const x = Float64Array.from({ length: 11 }, (_, i) => i);
    const mark = kind === 'line' ? line({ x, y: wavy, color: RED }) : area({ x, y: wavy, color: RED });
    plot(el, { ...frame, x: bare([10, 0]), y: bare([0, 1]), marks: [all ? everyRow(mark) : mark] });
    return el;
  };
  const reversed = draw(false);
  expect(drift(pixels(reversed), pixels(draw(true)))).toBeLessThanOrEqual(8);
  expect(inkedColumn(reversed, 50)).toBe(true);
});

test.each(['line', 'area'] as const)(
  'a %s filled with a blend spans the rows it draws, though a value beyond them overflows once projected',
  kind => {
    const el = host();
    const [x, y] = [
      [0, 5, 10],
      [0.5, 0.5, Number.MAX_VALUE],
    ];
    const fill = gradient(0.4, 0);
    const mark = kind === 'line' ? line({ x, y, fill, color: RED }) : area({ x, y, fill, color: RED });
    plot(el, { ...frame, y: bare([0, 1]), marks: [mark] });
    expect(pixel(el, 2, 75)[3]).toBeGreaterThan(0);
  },
);

test.each(['line', 'area'] as const)(
  'a zoomed %s with several points to a pixel column draws as the points round its window do',
  kind => {
    const draw = (from: number, to: number, all = false) => {
      const el = host();
      const x = Float64Array.from({ length: 1001 }, (_, i) => i / 100).slice(from, to);
      const y = Float64Array.from({ length: 1001 }, (_, i) => 0.5 + 0.3 * Math.sin(i / 7)).slice(from, to);
      const mark = kind === 'line' ? line({ x, y, color: RED }) : area({ x, y, color: RED });
      plot(el, { ...frame, y: bare([0, 1]), view: { x: [2.5, 6.5] }, marks: [all ? everyRow(mark) : mark] });
      return el;
    };
    const whole = draw(0, 1001);
    expect(drift(pixels(whole), pixels(draw(230, 671, true)))).toBeLessThanOrEqual(8);
    expect(inkedColumn(whole, 0)).toBe(true);
    expect(inkedColumn(whole, 99)).toBe(true);
  },
);

test.each(['line', 'area'] as const)(
  'a zoomed smooth %s curves through the points in its window though rows outside it share a pixel column',
  kind => {
    const draw = (from: number, curve: Curve = 'smooth', all = false) => {
      const el = host();
      const x = Float64Array.from([
        ...Array.from({ length: 100 }, (_, i) => i / 100),
        ...Array.from({ length: 10 }, (_, i) => i + 1),
      ]).slice(from);
      const y = Float64Array.from([...Array.from({ length: 100 }, () => 0.5), ...wavy.slice(1)]).slice(from);
      const mark = kind === 'line' ? line({ x, y, curve, color: RED }) : area({ x, y, curve, color: RED });
      plot(el, { ...frame, y: bare([0, 1]), view: { x: [3.5, 7.5] }, marks: [all ? everyRow(mark) : mark] });
      return el;
    };
    const whole = draw(0);
    expect(drift(pixels(whole), pixels(draw(100, 'smooth', true)))).toBeLessThanOrEqual(8);
    expect(drift(pixels(whole), pixels(draw(0, 'linear')))).toBeGreaterThan(8);
  },
);

test('zoomed points on the canvas draw as the points whose circles reach the plot do', () => {
  const draw = (rows: [number, number][], view: [number, number] = [2.5, 6.5]) => {
    const el = host();
    const x = Float64Array.from(rows, r => r[0]);
    const y = Float64Array.from(rows, r => r[1]);
    plot(el, {
      ...frame,
      y: bare([0, 1]),
      view: { x: view },
      marks: [dots({ x, y, r: new Float64Array(rows.length).fill(4), color: RED })],
    });
    return el;
  };
  const reaching: [number, number][] = [
    [2.4, 0.5],
    [3, 0.5],
    [4, 1.03],
    [5, 0.5],
    [6.6, 0.5],
  ];
  const whole = draw([[1, 0.5], [2, 0.5], ...reaching, [4, 1.2], [9, 0.5]]);
  expect(drift(pixels(whole), pixels(draw(reaching)))).toBeLessThanOrEqual(8);
  expect(pixel(whole, 0, 50)[3]).toBeGreaterThan(0);
  expect(pixel(whole, 37, 0)[3]).toBeGreaterThan(0);
  // No point inside [3.2, 3.8]; the circles at 3.18 and 3.82 reach in across its edges.
  const edges: [number, number][] = [
    [3.18, 0.5],
    [3.82, 0.5],
  ];
  const empty = draw([[2, 0.5], ...edges, [5, 0.5]], [3.2, 3.8]);
  expect(drift(pixels(empty), pixels(draw(edges, [3.2, 3.8])))).toBeLessThanOrEqual(8);
  expect(pixel(empty, 0, 50)[3]).toBeGreaterThan(0);
  expect(pixel(empty, 99, 50)[3]).toBeGreaterThan(0);
});

test('ctrl + wheel over the plot zooms about the pointer, is prevented and reports the window', async () => {
  const onViewChange = vi.fn();
  const { el, internals } = windowed({ use: [zoom()], onViewChange });
  const under = internals.xValue(30);
  expect(wheel(el, 30, 50, -100, { ctrlKey: true }).defaultPrevented).toBe(true);
  await nextFrame();
  const [lo, hi] = internals.view().x;
  expect(hi! - lo!).toBeLessThan(10);
  expect(Math.abs(internals.xPx(under) - 30)).toBeLessThan(1);
  expect(onViewChange).toHaveBeenCalledWith({ x: [lo, hi], y: [0, 1] });
});

test("a plain wheel is the page's unless wheel is 'plain', and then only while the window can move", async () => {
  const ctrl = windowed({ use: [zoom()] });
  expect(wheel(ctrl.el, 50, 50, -100).defaultPrevented).toBe(false);
  await nextFrame();
  expect(ctrl.internals.view().x).toEqual([0, 10]);
  for (let i = 0; i < 2; i++) {
    expect(wheel(ctrl.el, 50, 50, 100, { ctrlKey: true }).defaultPrevented).toBe(true);
    await nextFrame();
  }

  const { el, internals } = windowed({ use: [zoom({ wheel: 'plain' })] });
  expect(wheel(el, 50, 50, 100).defaultPrevented).toBe(false);
  expect(wheel(el, 50, 50, -100).defaultPrevented).toBe(true);
  await nextFrame();
  expect(internals.view().x[1]! - internals.view().x[0]!).toBeLessThan(10);
  expect(wheel(el, 50, 50, 10000).defaultPrevented).toBe(true);
  await nextFrame();
  expect(internals.view().x).toEqual([0, 10]);
  expect(wheel(el, 50, 50, 100).defaultPrevented).toBe(false);
  expect(wheel(el, 50, 50, -100000).defaultPrevented).toBe(true);
  await nextFrame();
  const [lo, hi] = internals.view().x;
  expect(hi! - lo!).toBeCloseTo(1e-5, 12);
  expect(wheel(el, 50, 50, -100).defaultPrevented).toBe(false);
  expect(wheel(el, 50, 50, 100).defaultPrevented).toBe(true);
  await nextFrame();
  expect(internals.view().x[1]! - internals.view().x[0]!).toBeGreaterThan(1e-5);
});

test("a plain wheel in is the page's at the least width after a pan, and on a chart created there", async () => {
  const { el, internals } = windowed({ use: [zoom({ wheel: 'plain' })] });
  wheel(el, 50, 50, -100000);
  await nextFrame();
  const [lo] = internals.view().x;
  drag(el, [50, 50], [30, 50]);
  await nextFrame();
  expect(internals.view().x[0]).not.toBe(lo);
  expect(wheel(el, 50, 50, -100).defaultPrevented).toBe(false);

  const made = windowed({ view: { x: [5, 5 + 1e-5] }, use: [zoom({ wheel: 'plain' })] });
  expect(wheel(made.el, 50, 50, -100).defaultPrevented).toBe(false);
});

test("a plain wheel out keeps zooming while a window against the domain's edge is narrower than the domain", async () => {
  const { el, internals } = windowed({ view: { x: [0, 5] }, use: [zoom({ wheel: 'plain' })] });
  const widths = [5];
  for (let i = 0; i < 2; i++) {
    expect(wheel(el, 50, 50, 100).defaultPrevented).toBe(true);
    await nextFrame();
    const [lo, hi] = internals.view().x;
    expect(lo).toBe(0);
    expect(hi! - lo!).toBeGreaterThan(widths.at(-1)!);
    widths.push(hi! - lo!);
  }
});

test('a wheel before the frame of a double click zooms from the whole domain', async () => {
  for (const axes of ['x', 'xy'] as const) {
    const { el, internals } = windowed({ view: { x: [2, 4], y: [0.25, 0.75] }, use: [zoom({ axes })] });
    doubleClick(el, 50, 50);
    expect(wheel(el, 50, 50, -100, { ctrlKey: true }).defaultPrevented).toBe(true);
    await nextFrame();
    const { x, y } = internals.view();
    expect(x[1]! - x[0]!).toBeCloseTo(10 * Math.exp(-0.2), 9);
    expect(y[1]! - y[0]!).toBeCloseTo(axes === 'x' ? 0.5 : Math.exp(-0.2), 9);
  }
});

test('a plain wheel in and back out within one frame leaves the whole domain', async () => {
  const { el, internals, whys } = windowed({ use: [zoom({ wheel: 'plain' })] });
  const before = whys.length;
  expect(wheel(el, 30, 50, -100).defaultPrevented).toBe(true);
  expect(wheel(el, 30, 50, 100).defaultPrevented).toBe(true);
  await nextFrame();
  expect(internals.view().x).toEqual([0, 10]);
  expect(whys).toHaveLength(before);
});

test('a wheel in reaches the least width about the pointer and then neither pans nor reports', async () => {
  const onViewChange = vi.fn();
  const { el, internals } = windowed({ view: { x: [2, 6] }, onViewChange, use: [zoom()] });
  const under = internals.xValue(20);
  wheel(el, 20, 50, -100000, { ctrlKey: true });
  await nextFrame();
  const shown = internals.view().x;
  expect(shown[1]! - shown[0]!).toBeCloseTo(1e-5, 12);
  expect(Math.abs(internals.xPx(under) - 20)).toBeLessThan(1);
  onViewChange.mockClear();
  expect(wheel(el, 20, 50, -100, { ctrlKey: true }).defaultPrevented).toBe(true);
  await nextFrame();
  expect(internals.view().x).toEqual(shown);
  expect(onViewChange).not.toHaveBeenCalled();
});

test("on a reversed x axis a wheel in reaches the least width about an off-centre pointer, then a plain wheel is the page's", async () => {
  const { el, internals } = windowed({ x: { domain: [10, 0], label: '' }, use: [zoom({ wheel: 'plain' })] });
  const under = internals.xValue(25);
  wheel(el, 25, 50, -100000);
  await nextFrame();
  const shown = internals.view().x;
  expect(shown[0]! - shown[1]!).toBeCloseTo(1e-5, 12);
  expect(Math.abs(internals.xPx(under) - 25)).toBeLessThan(1);
  expect(wheel(el, 25, 50, -100).defaultPrevented).toBe(false);
  await nextFrame();
  expect(internals.view().x).toEqual(shown);
});

test('a plain wheel zooms in far from zero down to the least window the chart shows', async () => {
  const { el, internals } = windowed({
    x: { domain: [1e15, 1e15 + 10], label: '' },
    view: { x: [1e15 + 4, 1e15 + 5] },
    use: [zoom({ wheel: 'plain' })],
  });
  expect(wheel(el, 50, 50, -100).defaultPrevented).toBe(true);
  await nextFrame();
  const [lo, hi] = internals.view().x;
  expect(hi! - lo!).toBeLessThan(1);
});

test('a press that can pan keeps the browser from starting a text selection', () => {
  const { el } = windowed({ use: [zoom()] });
  const select = () => {
    const e = new Event('selectstart', { bubbles: true, cancelable: true });
    el.firstElementChild!.dispatchEvent(e);
    return e.defaultPrevented;
  };
  press(el, 'pointerdown', 50, 50);
  expect(select()).toBe(true);
  release(el, 50, 50);
  expect(select()).toBe(false);
});

test('a wheel over the margin or the legend does nothing and is not prevented', async () => {
  const { el, internals } = windowed({
    margin: { top: 0, right: 0, bottom: 0, left: 30 },
    marks: [flat(0.5), line({ x: [0, 10], y: [0.2, 0.2], color: RED, label: 'named' })],
    use: [legend(), zoom()],
  });
  expect(wheel(el, 10, 50, -100, { ctrlKey: true }).defaultPrevented).toBe(false);
  const entry = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const box = entry.getBoundingClientRect();
  const over = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -100,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  });
  entry.dispatchEvent(over);
  expect(over.defaultPrevented).toBe(false);
  await nextFrame();
  expect(internals.view().x).toEqual([0, 10]);
});

test("a mouse drag pans by the distance dragged and stops at the domain's edge with its width kept", async () => {
  const { el, internals } = windowed({ width: 200, view: { x: [2, 4], y: [0.25, 0.75] }, use: [zoom()] });
  drag(el, [150, 20], [50, 80]);
  await nextFrame();
  near(internals.view().x, [3, 5]);
  expect(internals.view().y).toEqual([0.25, 0.75]);
  drag(el, [50, 50], [53, 50]);
  await nextFrame();
  near(internals.view().x, [3, 5]);
  drag(el, [190, 50], [-1000, 50]);
  await nextFrame();
  near(internals.view().x, [8, 10]);
  expect(internals.view().y).toEqual([0.25, 0.75]);
});

test("a drag back from past the edge moves the window by that drag's own distance", async () => {
  const { el, internals } = windowed({ width: 200, view: { x: [6, 8] }, use: [zoom()] });
  drag(el, [190, 50], [-310, 50]);
  await nextFrame();
  expect(internals.view().x).toEqual([8, 10]);
  drag(el, [50, 50], [100, 50]);
  await nextFrame();
  near(internals.view().x, [7.5, 9.5]);

  const quick = windowed({ width: 200, view: { x: [6, 8] }, use: [zoom()] });
  drag(quick.el, [190, 50], [-310, 50]);
  drag(quick.el, [50, 50], [100, 50]);
  await nextFrame();
  near(quick.internals.view().x, [7.5, 9.5]);
});

test('a double click shows the whole domain and reports it', async () => {
  const onViewChange = vi.fn();
  const { el, internals } = windowed({ view: { x: [2, 4] }, onViewChange, use: [zoom()] });
  doubleClick(el, 50, 50);
  await nextFrame();
  expect(internals.view().x).toEqual([0, 10]);
  expect(onViewChange).toHaveBeenCalledWith({ x: [0, 10], y: [0, 1] });
});

test('a drag hides the tooltip from the move that passes 4 px until a move after the release', async () => {
  const { el } = windowed({
    width: 200,
    view: { x: [2, 4] },
    marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: 'named' })],
    use: [tooltip({ mode: 'x', title: String, value: String }), zoom()],
  });
  const tip = [...el.querySelectorAll('div')].find(d => d.style.zIndex === '100')!;
  const showing = () => tip.style.display !== 'none';
  press(el, 'pointermove', 100, 50);
  expect(showing()).toBe(true);
  press(el, 'pointerdown', 100, 50);
  press(el, 'pointermove', 102, 50);
  expect(showing()).toBe(true);
  press(el, 'pointermove', 110, 50);
  expect(showing()).toBe(false);
  press(el, 'pointermove', 120, 50);
  expect(showing()).toBe(false);
  await nextFrame();
  expect(showing()).toBe(false);
  release(el, 120, 50);
  press(el, 'pointermove', 121, 50);
  expect(showing()).toBe(false);
  await new Promise(r => setTimeout(r, 0));
  press(el, 'pointermove', 122, 50);
  expect(showing()).toBe(true);
});

test('wheel events within one frame repaint once', async () => {
  const { el, whys } = windowed({ use: [zoom()] });
  const before = whys.length;
  for (let i = 0; i < 3; i++) wheel(el, 50, 50, -50, { ctrlKey: true });
  expect(whys).toHaveLength(before);
  await nextFrame();
  expect(whys).toHaveLength(before + 1);
});

test('zoom() leaves a polar frame alone, and destroy() removes its listeners', async () => {
  const polar = windowed({ frame: 'polar', use: [zoom()] });
  expect(wheel(polar.el, 50, 50, -100, { ctrlKey: true }).defaultPrevented).toBe(false);
  await nextFrame();
  expect(polar.internals.view()).toEqual({ x: [0, 1], y: [0, 1] });

  const { el, chart } = windowed({ use: [zoom()] });
  const root = el.firstElementChild!;
  const fields = at(el, 50, 50);
  chart.destroy();
  const e = new WheelEvent('wheel', { ...fields, ctrlKey: true, deltaY: -100 });
  root.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(false);
});

test('two fingers zoom about their midpoint and pan when they move together; one finger changes nothing', async () => {
  const { el, internals } = windowed({ width: 200, view: { x: [2, 6] }, use: [zoom()] });
  const mid = internals.xValue(100);
  pinch(el, [80, 50], [120, 50], [60, 50], [140, 50]);
  await nextFrame();
  const [lo, hi] = internals.view().x;
  expect(hi! - lo!).toBeCloseTo(2, 9);
  expect(Math.abs(internals.xPx(mid) - 100)).toBeLessThan(1);
  expect(internals.view().y).toEqual([0, 1]);

  const under = internals.xValue(100);
  pinch(el, [60, 50], [140, 50], [40, 50], [120, 50]);
  await nextFrame();
  const [lo2, hi2] = internals.view().x;
  expect(hi2! - lo2!).toBeCloseTo(2, 9);
  expect(Math.abs(internals.xPx(under) - 80)).toBeLessThan(1);

  const shown = internals.view().x;
  const finger = { pointerType: 'touch', pointerId: 3 };
  press(el, 'pointerdown', 100, 50, finger);
  press(el, 'pointermove', 60, 50, finger);
  press(el, 'pointermove', 20, 50, finger);
  press(el, 'pointerup', 20, 50, finger);
  await nextFrame();
  expect(internals.view().x).toEqual(shown);
});

const tipped = (options: Partial<Options> = {}) =>
  windowed({
    width: 200,
    view: { x: [2, 4] },
    marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: 'named' })],
    use: [tooltip({ mode: 'x', title: String, value: String }), zoom()],
    ...options,
  });

test('a second finger hides the tooltip the first showed, and a cancel ends the gesture', async () => {
  for (const cancelled of [1, 2]) {
    const { el } = tipped();
    const showing = tipOf(el);
    press(el, 'pointerdown', 100, 50, { pointerType: 'touch', pointerId: 1 });
    expect(showing()).toBe(true);
    press(el, 'pointerdown', 120, 50, { pointerType: 'touch', pointerId: 2 });
    expect(showing()).toBe(false);
    press(el, 'pointercancel', 100, 50, { pointerType: 'touch', pointerId: cancelled });
    await new Promise(r => setTimeout(r, 0));
    tap(el, 100, 50);
    expect(showing()).toBe(true);
  }
});

test('two taps close in time and place show the whole domain and no tooltip; others do not', async () => {
  const now = vi.spyOn(performance, 'now');
  const twice = async (ms: number, dx: number) => {
    const { el, internals } = tipped();
    const showing = tipOf(el);
    now.mockReturnValue(1000);
    tap(el, 100, 50);
    now.mockReturnValue(1000 + ms);
    tap(el, 100 + dx, 50);
    await nextFrame();
    return { x: internals.view().x, showing: showing() };
  };
  expect(await twice(200, 10)).toEqual({ x: [0, 10], showing: false });
  expect(await twice(400, 0)).toEqual({ x: [2, 4], showing: true });
  expect(await twice(200, 30)).toEqual({ x: [2, 4], showing: true });
});

test('a long press neither arms a double tap nor completes one', async () => {
  const now = vi.spyOn(performance, 'now');
  const finger = { pointerType: 'touch', pointerId: 1 };
  const twice = async (first: number, second: number) => {
    const { el, internals } = tipped();
    let t = 1000;
    for (const held of [first, second]) {
      now.mockReturnValue(t);
      press(el, 'pointerdown', 100, 50, finger);
      now.mockReturnValue((t += held));
      press(el, 'pointerup', 100, 50, finger);
      t += 100;
    }
    await nextFrame();
    return internals.view().x;
  };
  expect(await twice(50, 50)).toEqual([0, 10]);
  expect(await twice(50, 2000)).toEqual([2, 4]);
  expect(await twice(2000, 50)).toEqual([2, 4]);
  now.mockRestore();
});

test('a second touch that moves, is cancelled or gains a finger does not reset the view', async () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const finger = (pointerId: number) => ({ pointerType: 'touch', pointerId });
  const after = async (second: (el: HTMLElement) => void) => {
    const { el, internals } = tipped();
    tap(el, 100, 50);
    second(el);
    await nextFrame();
    return internals.view().x;
  };
  expect(
    await after(el => {
      press(el, 'pointerdown', 100, 50, finger(1));
      press(el, 'pointermove', 110, 50, finger(1));
      press(el, 'pointerup', 110, 50, finger(1));
    }),
  ).toEqual([2, 4]);
  expect(
    await after(el => {
      press(el, 'pointerdown', 100, 50, finger(1));
      press(el, 'pointercancel', 100, 50, finger(1));
    }),
  ).toEqual([2, 4]);
  expect(
    await after(el => {
      press(el, 'pointerdown', 100, 50, finger(1));
      press(el, 'pointerdown', 140, 50, finger(2));
      press(el, 'pointerup', 100, 50, finger(1));
      press(el, 'pointerup', 140, 50, finger(2));
    }),
  ).toEqual([2, 4]);
  now.mockRestore();
});

test('a pinch at the narrowest window keeps the value under a midpoint at a quarter of the plot', async () => {
  const { el, internals } = windowed({ width: 200, view: { x: [4, 4 + 1e-5] }, use: [zoom()] });
  const [lo, hi] = internals.view().x as [number, number];
  const under = lo + (hi - lo) / 4;
  const mid = internals.xPx(under);
  pinch(el, [mid - 10, 50], [mid + 10, 50], [mid - 30, 50], [mid + 30, 50]);
  await nextFrame();
  const [lo2, hi2] = internals.view().x as [number, number];
  expect(hi2 - lo2).toBeCloseTo(hi - lo, 12);
  expect(Math.abs(internals.xPx(under) - mid)).toBeLessThan(1);
});

test('after one finger of a pinch lifts, a new finger pinches with the one still down', async () => {
  const { el, internals } = windowed({ width: 200, view: { x: [2, 6] }, use: [zoom()] });
  const finger = (pointerId: number) => ({ pointerType: 'touch', pointerId });
  press(el, 'pointerdown', 80, 50, finger(1));
  press(el, 'pointerdown', 120, 50, finger(2));
  press(el, 'pointerup', 120, 50, finger(2));
  press(el, 'pointermove', 90, 50, finger(1));
  await nextFrame();
  expect(internals.view().x).toEqual([2, 6]);
  press(el, 'pointerdown', 130, 50, finger(3));
  press(el, 'pointermove', 50, 50, finger(1));
  press(el, 'pointermove', 170, 50, finger(3));
  press(el, 'pointerup', 50, 50, finger(1));
  press(el, 'pointerup', 170, 50, finger(3));
  await nextFrame();
  const [lo, hi] = internals.view().x as [number, number];
  expect(hi - lo).toBeCloseTo(4 / 3, 9);
});

test("zoom() sets touch-action: pan-x pan-y on the chart's root and gives it back on destroy()", () => {
  const { el, chart } = windowed({ use: [zoom()] });
  const root = el.firstElementChild as HTMLElement;
  expect(root.style.touchAction).toBe('pan-x pan-y');
  chart.destroy();
  expect(root.style.touchAction).toBe('');
  const bare = windowed({});
  expect((bare.el.firstElementChild as HTMLElement).style.touchAction).toBe('');
});

/** The brush's rectangle relative to the chart, as [left, top, width, height], or null while hidden. */
const shadeOf = (el: HTMLElement) => {
  const shade = [...el.querySelectorAll('div')].find(d => d.style.opacity === '0.2')!;
  return () => {
    if (shade.style.display === 'none') return null;
    const [r, b] = [shade.getBoundingClientRect(), el.firstElementChild!.getBoundingClientRect()];
    return [r.left - b.left, r.top - b.top, r.width, r.height];
  };
};
const brushed = (options: Partial<Options> = {}, axes?: 'x' | 'y' | 'xy', zoom?: boolean) => {
  const onSelect = vi.fn();
  const made = windowed({
    width: 120,
    height: 120,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    ...options,
    use: [brush({ axes, zoom, onSelect }), ...(options.use ?? [])],
  });
  return { ...made, onSelect, shade: shadeOf(made.el) };
};
const spanOf = (onSelect: ReturnType<typeof vi.fn>) => {
  const { x, y } = onSelect.mock.calls.at(-1)![0] as { x: number[]; y: number[] };
  return { x, y };
};

test("an x brush spans the plot's height and reports the span dragged once, on release, cut to the plot", () => {
  const { el, onSelect, shade } = brushed({}, 'x');
  press(el, 'pointerdown', 30, 40);
  press(el, 'pointermove', 50, 60);
  press(el, 'pointermove', 70, 80);
  expect(shade()).toEqual([30, 10, 40, 100]);
  expect(onSelect).not.toHaveBeenCalled();
  release(el, 70, 80);
  expect(onSelect).toHaveBeenCalledTimes(1);
  const { x, y } = spanOf(onSelect);
  expect(Math.abs(x[0]! - 2) + Math.abs(x[1]! - 6)).toBeLessThan(0.1);
  expect(y).toEqual([0, 1]);
  expect(shade()).toEqual([30, 10, 40, 100]);

  drag(el, [70, 50], [30, 50]);
  expect(onSelect).toHaveBeenCalledTimes(3);
  expect(onSelect.mock.calls[1]).toEqual([null]);
  near(spanOf(onSelect).x, x);
  drag(el, [50, 50], [500, 50]);
  near(spanOf(onSelect).x, [4, 10]);
  expect(shade()).toEqual([50, 10, 60, 100]);
  drag(el, [50, 50], [-500, 50]);
  near(spanOf(onSelect).x, [0, 4]);
});

test('a release away from the last move ends the brush where it lets go', () => {
  const { el, onSelect, shade } = brushed({}, 'x');
  press(el, 'pointerdown', 30, 50);
  press(el, 'pointermove', 50, 50);
  release(el, 70, 50);
  near(spanOf(onSelect).x, [2, 6]);
  expect(shade()).toEqual([30, 10, 40, 100]);
});

test('a brush whose onSelect(null) destroys the chart on a press leaves no gesture to report', () => {
  const { el, chart, onSelect } = brushed({}, 'x');
  drag(el, [30, 50], [70, 50]);
  onSelect.mockReset().mockImplementation(range => range === null && chart.destroy());
  const to = at(el, 90, 50);
  press(el, 'pointerdown', 50, 50);
  for (const type of ['pointermove', 'pointerup'])
    document.dispatchEvent(new PointerEvent(type, { ...to, pointerType: 'mouse', pointerId: 1 }));
  expect(onSelect.mock.calls).toEqual([[null]]);
});

test('a y brush spans the width and an xy brush both ways, in ascending values', () => {
  const y = brushed({}, 'y');
  drag(y.el, [30, 30], [70, 90]);
  expect(y.shade()).toEqual([10, 30, 100, 60]);
  const got = spanOf(y.onSelect);
  expect(got.x).toEqual([0, 10]);
  near(got.y, [0.2, 0.8]);
  const xy = brushed({}, 'xy');
  drag(xy.el, [70, 90], [30, 30]);
  expect(xy.shade()).toEqual([30, 30, 40, 60]);
  near(spanOf(xy.onSelect).x, [2, 6]);
  near(spanOf(xy.onSelect).y, [0.2, 0.8]);
});

test('a press without a drag clears a shown brush with one null, and Escape abandons a drag without a call', async () => {
  const { el, onSelect, shade } = brushed();
  click(el, 50, 50);
  expect(onSelect).not.toHaveBeenCalled();
  drag(el, [30, 50], [70, 50]);
  onSelect.mockClear();
  click(el, 50, 50);
  expect(onSelect.mock.calls).toEqual([[null]]);
  expect(shade()).toBe(null);
  click(el, 50, 50);
  expect(onSelect).toHaveBeenCalledTimes(1);

  onSelect.mockClear();
  press(el, 'pointerdown', 30, 50);
  press(el, 'pointermove', 60, 50);
  expect(shade()).not.toBe(null);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(shade()).toBe(null);
  press(el, 'pointermove', 80, 50);
  release(el, 80, 50);
  expect(shade()).toBe(null);
  expect(onSelect).not.toHaveBeenCalled();
});

test('a drag across an x brush with no width along x is a press', () => {
  const { el, onSelect, shade } = brushed({}, 'x');
  drag(el, [50, 20], [50, 90]);
  expect(shade()).toBe(null);
  expect(onSelect).not.toHaveBeenCalled();
});

test.each([
  ['brush first', true],
  ['zoom first', false],
])('with zoom() (%s) a plain drag brushes and shift + drag pans', async (_, first) => {
  const onSelect = vi.fn();
  const features = [brush({ onSelect }), zoom()];
  const { el, internals } = windowed({
    width: 200,
    view: { x: [2, 4] },
    use: first ? features : features.reverse(),
  });
  drag(el, [150, 50], [50, 50]);
  await nextFrame();
  expect(internals.view().x).toEqual([2, 4]);
  expect(onSelect).toHaveBeenCalledTimes(1);
  onSelect.mockClear();
  drag(el, [150, 50], [50, 50], { shiftKey: true });
  await nextFrame();
  near(internals.view().x, [3, 5]);
  expect(onSelect.mock.calls).toEqual([[null]]);
  expect(shadeOf(el)()).toBe(null);
});

test("beside zoom({ drag: 'pan' }) a brush takes no drag", async () => {
  const onSelect = vi.fn();
  const { el, internals } = windowed({
    width: 200,
    view: { x: [2, 4] },
    use: [brush({ onSelect }), zoom({ drag: 'pan' })],
  });
  drag(el, [150, 50], [50, 50]);
  await nextFrame();
  near(internals.view().x, [3, 5]);
  expect(onSelect).not.toHaveBeenCalled();
  expect(shadeOf(el)()).toBe(null);
});

test("zoom({ drag: 'pan' }) alone pans with a plain drag", async () => {
  const { el, internals } = windowed({ width: 200, view: { x: [2, 4] }, use: [zoom({ drag: 'pan' })] });
  drag(el, [150, 50], [50, 50]);
  await nextFrame();
  near(internals.view().x, [3, 5]);
});

test('a shown brush is cleared with one null by an update, a resize or a zoom step', async () => {
  for (const change of [
    (c: { chart: { update(o: Partial<Options>): void } }) => c.chart.update({}),
    (c: { chart: { update(o: Partial<Options>): void } }) => c.chart.update({ height: 140 }),
    (c: { el: HTMLElement }) => void wheel(c.el, 50, 50, -100, { ctrlKey: true }),
    (c: { el: HTMLElement }) => void wheel(c.el, 50, 50, -100, { metaKey: true }),
  ]) {
    const made = brushed({ use: [zoom()] });
    drag(made.el, [30, 50], [70, 50]);
    made.onSelect.mockClear();
    change(made as never);
    await nextFrame();
    expect(made.onSelect.mock.calls).toEqual([[null]]);
    expect(made.shade()).toBe(null);
  }
});

test('a brush that zooms to its selection leaves no rectangle', () => {
  let chart!: { update(o: Partial<Options>): void };
  const onSelect = vi.fn(
    (r: { x: [number, number]; y: [number, number] } | null) => r && chart.update({ view: r }),
  );
  const made = windowed({
    width: 120,
    height: 120,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    use: [brush({ onSelect })],
  });
  chart = made.chart;
  drag(made.el, [30, 50], [70, 50]);
  near(made.internals.view().x, (onSelect.mock.calls[0]![0] as { x: number[] }).x);
  expect(Math.abs(made.internals.view().x[0]! - 2)).toBeLessThan(0.1);
  expect(onSelect.mock.calls.at(-1)).toEqual([null]);
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(shadeOf(made.el)()).toBe(null);
});

test('brush({ zoom: true }) reports the range once, then shows it on x alone and leaves no rectangle', () => {
  const { el, onSelect, shade, internals } = brushed({ view: { y: [0.2, 0.8] } }, 'x', true);
  const shown: number[][] = [];
  onSelect.mockImplementation(() => shown.push(internals.view().x));
  drag(el, [30, 50], [70, 50]);
  expect(onSelect).toHaveBeenCalledTimes(1);
  const { x, y } = spanOf(onSelect);
  expect(Math.abs(x[0]! - 2) + Math.abs(x[1]! - 6)).toBeLessThan(0.1);
  expect(y).toEqual([0.2, 0.8]);
  expect(shown).toEqual([[0, 10]]);
  near(internals.view().x, x);
  expect(internals.view().y).toEqual([0.2, 0.8]);
  expect(shade()).toBe(null);
  click(el, 50, 50);
  expect(onSelect).toHaveBeenCalledTimes(1);
});

test('brush({ zoom: true }) on a reversed x axis reports ascending values and shows the window reversed', () => {
  const { el, onSelect, internals } = brushed({ x: { domain: [10, 0], label: '' } }, 'x', true);
  drag(el, [50, 50], [90, 50]);
  const { x } = spanOf(onSelect);
  expect(Math.abs(x[0]! - 2) + Math.abs(x[1]! - 6)).toBeLessThan(0.1);
  near(internals.view().x, [x[1]!, x[0]!]);
});

test('brush({ zoom: true }) on xy sets both windows, a press sets none, and zoom() still resets on a double click', async () => {
  const xy = brushed({ use: [zoom({ axes: 'xy' })] }, 'xy', true);
  click(xy.el, 50, 50);
  expect(xy.internals.view()).toEqual({ x: [0, 10], y: [0, 1] });
  drag(xy.el, [70, 90], [30, 30]);
  near(xy.internals.view().x, [2, 6]);
  near(xy.internals.view().y, [0.2, 0.8]);
  click(xy.el, 50, 50);
  near(xy.internals.view().x, [2, 6]);
  doubleClick(xy.el, 50, 50);
  await nextFrame();
  expect(xy.internals.view()).toEqual({ x: [0, 10], y: [0, 1] });
  expect(xy.onSelect).toHaveBeenCalledTimes(1);

  const quiet = windowed({ use: [brush({ zoom: true })] });
  drag(quiet.el, [30, 50], [70, 50]);
  near(quiet.internals.view().x, [3, 7]);

  const onViewChange = vi.fn();
  const gone = brushed({ onViewChange }, 'x', true);
  gone.onSelect.mockImplementation(() => gone.chart.destroy());
  press(gone.el, 'pointerdown', 30, 50);
  press(gone.el, 'pointermove', 70, 50);
  press(gone.el, 'pointerup', 70, 50);
  expect(gone.onSelect).toHaveBeenCalledTimes(1);
  expect(onViewChange).not.toHaveBeenCalled();

  const plain = brushed({}, 'xy');
  drag(plain.el, [70, 90], [30, 30]);
  expect(plain.internals.view()).toEqual({ x: [0, 10], y: [0, 1] });
});

test('brushing hides the tooltip; a touch drag does not brush; a polar frame ignores it', async () => {
  const onSelect = vi.fn();
  const { el } = windowed({
    width: 200,
    marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: 'named' })],
    use: [tooltip({ mode: 'x', title: String, value: String }), brush({ onSelect })],
  });
  const showing = tipOf(el);
  press(el, 'pointermove', 100, 50);
  expect(showing()).toBe(true);
  press(el, 'pointerdown', 100, 50);
  press(el, 'pointermove', 110, 50);
  expect(showing()).toBe(false);
  release(el, 110, 50);
  await new Promise(r => setTimeout(r, 0));
  press(el, 'pointermove', 120, 50);
  expect(showing()).toBe(true);

  onSelect.mockClear();
  const finger = { pointerType: 'touch', pointerId: 2 };
  press(el, 'pointerdown', 50, 50, finger);
  press(el, 'pointermove', 90, 50, finger);
  press(el, 'pointerup', 90, 50, finger);
  expect(onSelect).not.toHaveBeenCalled();

  const polar = brushed({ frame: 'polar' });
  drag(polar.el, [30, 50], [70, 50]);
  expect(polar.onSelect).not.toHaveBeenCalled();
  expect(polar.shade()).toBe(null);
});

const series = (name: string, y: number, color = RED) =>
  line({ x: [0, 10], y: [y, y], curve: 'step', color, width: 4, label: name });
const rise = (name: string, top: number) =>
  line({ x: [0, 10], y: [0, top], color: RED, width: 4, label: name });
const grab = (got: (c: Internals) => void) => (c: Internals) => (got(c), { destroy() {} });

test('a series hidden from the start is not drawn, sampled, hit or labelled, and is still named', () => {
  const el = host();
  let internals!: Internals;
  const note: Mark = {
    type: 'noted',
    group: 'B',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: view => ({ paint() {}, labels: [{ x: 50 * view.dpr, y: 50 * view.dpr, text: 'note' }] }),
  };
  const marks = [
    series('A', 0.25),
    series('B', 0.75, BLUE),
    dots({ x: [5], y: [0.75], r: [3], color: BLUE, group: 'B' }),
    note,
  ];
  let shown!: Internals;
  plot(host(), { ...frame, marks, use: [grab(c => (shown = c))] });
  expect(shown.hit(50, shown.yPx(0.75), 20)).not.toBeNull();
  plot(el, {
    ...frame,
    hidden: ['B'],
    marks,
    use: [tooltip({ mode: 'x', title: () => 'title', value: String }), grab(c => (internals = c))],
  });
  expect(pixel(el, 50, internals.yPx(0.25))).toEqual(RED_PIXEL);
  expect(pixel(el, 50, internals.yPx(0.75))[3]).toBe(0);
  expect(el.textContent).not.toContain('note');
  expect(internals.hit(50, internals.yPx(0.75), 20)).toBeNull();
  expect(hover(el, 50, 50).textContent).toContain('A: 0.25');
  expect(el.textContent).not.toContain('B:');
  expect(el.querySelector('canvas')!.ariaLabel).toBe('A, B');
});

test('hiding a series re-fits a nice domain to what is shown, unless the axis fits all or is fixed', () => {
  const marks = [rise('a', 1), rise('b', 2), rise('c', 20)];
  const make = (y: Axis) => {
    let internals!: Internals;
    const el = host();
    plot(el, { ...frame, y, marks, use: [grab(c => (internals = c))] });
    return { el, internals };
  };
  const nice = make({ domain: 'nice', label: '' });
  expect(nice.internals.view().y[1]).toBe(20);
  nice.internals.hide(['c']);
  expect(nice.internals.view().y[1]).toBe(2);
  nice.internals.hide(['a', 'b', 'c']);
  expect(nice.internals.view().y[1]).toBe(2);
  expect(pixel(nice.el, 30, nice.internals.yPx(0.6))[3]).toBe(0);
  expect(pixel(nice.el, 30, nice.internals.yPx(0.3))[3]).toBe(0);

  const all = make({ domain: 'nice', label: '', fit: 'all' });
  all.internals.hide(['c']);
  expect(all.internals.view().y[1]).toBe(20);

  const fixed = make({ domain: [0, 50], label: '' });
  fixed.internals.hide(['c']);
  expect(fixed.internals.view().y).toEqual([0, 50]);
});

test('the hidden ids are read when given, not later through the caller array', () => {
  let internals!: Internals;
  const ids: string[] = [];
  const chart = plot(host(), {
    ...frame,
    hidden: ids,
    marks: [series('A', 0.25), series('B', 0.75), series('C', 0.5)],
    onHiddenChange: got => got.push('C'),
    use: [grab(c => (internals = c))],
  });
  ids.push('B');
  chart.update({ hidden: ids });
  expect(internals.marks().map(k => k.label)).toEqual(['A', 'C']);
  const given = ['A'];
  internals.hide(given);
  expect(internals.marks().map(k => k.label)).toEqual(['B', 'C']);
  chart.update({ height: 140 });
  expect(internals.marks().map(k => k.label)).toEqual(['B', 'C']);
  expect(internals.hidden()).toEqual(['A']);
  chart.update({ hidden: given });
  expect(internals.marks().map(k => k.label)).toEqual(['B']);
  expect(internals.hidden()).toEqual(['A', 'C']);
});

test('an axis of a chart hidden from the start keeps its first domain while its data changes', () => {
  let internals!: Internals;
  const chart = plot(host(), {
    ...frame,
    y: { domain: 'nice', label: '' },
    hidden: ['a'],
    marks: [rise('a', 2)],
    use: [grab(c => (internals = c))],
  });
  expect(internals.view().y[1]).toBe(2);
  chart.update({ marks: [rise('a', 20)] });
  expect(internals.view().y[1]).toBe(2);
});

test('hide() reports the hidden ids once, update() reports nothing, and unknown ids are kept', () => {
  const el = host();
  let internals!: Internals;
  const onHiddenChange = vi.fn();
  const chart = plot(el, {
    ...frame,
    marks: [series('A', 0.25), series('B', 0.75)],
    onHiddenChange,
    use: [grab(c => (internals = c))],
  });
  internals.hide(['B']);
  expect(onHiddenChange.mock.calls).toEqual([[['B']]]);
  expect(internals.hidden()).toEqual(['B']);
  chart.update({ hidden: ['nobody', 'A'] });
  expect(onHiddenChange).toHaveBeenCalledTimes(1);
  expect(internals.hidden()).toEqual(['nobody', 'A']);
  internals.hide(['A', 'nobody']);
  expect(onHiddenChange).toHaveBeenCalledTimes(1);
  expect(internals.listed()).toHaveLength(2);
  expect(internals.marks().map(k => k.label)).toEqual(['B']);
  expect(pixel(el, 50, internals.yPx(0.75))).toEqual(RED_PIXEL);
  expect(pixel(el, 50, internals.yPx(0.25))[3]).toBe(0);
});

test('hiding the focused series lights the rest, and one series left picks out its rows', () => {
  const el = host();
  let internals!: Internals;
  plot(el, {
    ...frame,
    dim: 0.3,
    marks: [series('A', 0.25), series('B', 0.75)],
    use: [grab(c => (internals = c))],
  });
  internals.focus('B');
  expect(pixel(el, 50, internals.yPx(0.25))[3]).toBeLessThan(100);
  internals.hide(['B']);
  expect(pixel(el, 50, internals.yPx(0.25))).toEqual(RED_PIXEL);

  const two = host();
  let chart!: Internals;
  plot(two, {
    ...frame,
    dim: 0.3,
    marks: [
      bar({ x1: [1, 5], x2: [3, 7], y1: [0, 0], y2: [0.8, 0.8], color: RED, label: 'a' }),
      bar({ x1: [8], x2: [10], y1: [0], y2: [0.8], color: RED, label: 'b' }),
    ],
    use: [tooltip({ mode: 'nearest', text: () => 'tip' }), grab(c => (chart = c))],
  });
  chart.hide(['b']);
  hover(two, 20, 55);
  expect(pixel(two, 20, 55)).toEqual(RED_PIXEL);
  expect(pixel(two, 60, 55)[3]).toBeLessThan(100);
});

test('a zoom window is clamped while a series is hidden and comes back when it is shown', () => {
  let internals!: Internals;
  const onViewChange = vi.fn();
  plot(host(), {
    ...frame,
    y: { domain: 'nice', label: '' },
    view: { y: [50, 90] },
    marks: [rise('low', 60), rise('tall', 100)],
    onViewChange,
    use: [grab(c => (internals = c))],
  });
  expect(internals.view().y).toEqual([50, 90]);
  internals.hide(['tall']);
  const [lo, hi] = internals.view().y;
  expect(hi).toBe(internals.domain().y[1]);
  expect(hi).toBeLessThan(90);
  expect(hi - lo).toBeCloseTo(40);
  internals.hide([]);
  expect(internals.view().y).toEqual([50, 90]);
  expect(onViewChange).not.toHaveBeenCalled();
});

test('a hidden WebGL mark is drawn again when shown, and released only when it leaves the marks or the chart', () => {
  const el = host();
  let internals!: Internals;
  const released: string[] = [];
  const at = (x: number, label: string, color: string) => {
    const k = dots({
      x: new Float64Array(20_000).fill(x),
      y: new Float64Array(20_000).fill(0.5),
      r: new Float64Array(20_000).fill(3),
      color,
      label,
    });
    const free = k.release!.bind(k);
    k.release = layer => (released.push(label), free(layer));
    return k;
  };
  const [a, b] = [at(3, 'A', RED), at(7, 'B', BLUE)];
  const chart = plot(el, { ...frame, marks: [a, b], use: [grab(c => (internals = c))] });
  expect(pixel(el, 70, 50, 1)).toEqual([0, 0, 255, 255]);
  internals.hide(['B']);
  expect(pixel(el, 70, 50, 1)[3]).toBe(0);
  expect(pixel(el, 30, 50, 1)).toEqual(RED_PIXEL);
  internals.hide([]);
  expect(pixel(el, 70, 50, 1)).toEqual([0, 0, 255, 255]);
  expect(released).toEqual([]);
  internals.hide(['B']);
  chart.update({ marks: [a] });
  expect(released).toEqual(['B']);
  chart.destroy();
  expect(released).toEqual(['B', 'A']);
});

test('under animate() hiding a series paints the final state at once', () => {
  fakeClock();
  const el = host();
  let internals!: Internals;
  plot(el, {
    ...frame,
    marks: [series('A', 0.25), series('B', 0.75)],
    use: [animate({ duration: 600 }), grab(c => (internals = c))],
  });
  vi.advanceTimersByTime(1000);
  internals.hide(['B']);
  expect(pixel(el, 50, internals.yPx(0.75))[3]).toBe(0);
  expect(pixel(el, 50, internals.yPx(0.25))).toEqual(RED_PIXEL);
});

test('under animate() the same hidden ids in another order leave a data change to cross-fade', () => {
  fakeClock();
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    hidden: ['B', 'A'],
    marks: [series('A', 0.5), series('B', 0.5), series('C', 0.25)],
    use: [animate({ duration: 600 }), grab(c => (internals = c))],
  });
  vi.advanceTimersByTime(1000);
  chart.update({ hidden: ['A', 'B'], marks: [series('A', 0.5), series('B', 0.5), series('C', 0.75)] });
  expect(pixel(el, 50, internals.yPx(0.25))).toEqual(RED_PIXEL);
});

const days = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
const fitY = { domain: 'nice', label: '', fit: 'window' } satisfies Axis;
const climb = line({ x: days(180, i => i), y: days(180, i => 2 * i), color: RED, label: 'climb' });
const daily = (options: Partial<Options> = {}) =>
  windowed({ x: { domain: 'data', label: '' }, y: fitY, marks: [climb], ...options });

test("fit: 'window' fits y to the points inside the x window; without it y keeps the whole extent", () => {
  expect(daily({ view: { x: [50, 87.5] } }).internals.view().y).toEqual([100, 180]);
  expect(daily({ view: { x: [50, 87.5] }, y: { domain: 'nice', label: '' } }).internals.view().y).toEqual([
    0, 400,
  ]);
  expect(daily().internals.view().y).toEqual([0, 400]);
});

test("fit: 'window' counts a line's value at the window's edge, leaves out a hidden series and keeps a baseline", () => {
  const steep = line({ x: [0, 10, 20], y: [1000, 10, 20], color: RED });
  expect(windowed({ y: fitY, view: { x: [5, 10] }, marks: [steep] }).internals.view().y).toEqual([0, 550]);

  const high = line({ x: [0, 179], y: [1000, 1000], color: RED, label: 'high' });
  const { internals } = daily({ view: { x: [50, 87.5] }, marks: [climb, high] });
  expect(internals.view().y).toEqual([100, 1000]);
  internals.hide(['high']);
  expect(internals.view().y).toEqual([100, 180]);

  const bars = bar({ x1: days(10, i => i), x2: days(10, i => i + 1), y: days(10, i => 50 + i), color: RED });
  expect(windowed({ y: fitY, view: { x: [5, 8] }, marks: [bars] }).internals.view().y).toEqual([0, 60]);
  const filled = area({ x: days(10, i => i), y: days(10, i => 50 + i), color: RED });
  expect(windowed({ y: fitY, view: { x: [5, 8] }, marks: [filled] }).internals.view().y).toEqual([0, 60]);
});

test("a y window wins over fit: 'window', a fixed domain ignores it, and a reset gives the whole fit", async () => {
  expect(daily({ view: { x: [50, 87.5], y: [20, 30] } }).internals.view().y).toEqual([20, 30]);
  expect(daily({ view: { x: [50, 87.5] }, y: { ...fitY, domain: [0, 200] } }).internals.view().y).toEqual([
    0, 200,
  ]);

  const brushedY = brushed({ x: { domain: 'data', label: '' }, y: fitY, marks: [climb] }, 'xy', true);
  const [top, bottom] = [brushedY.internals.yValue(30), brushedY.internals.yValue(70)];
  drag(brushedY.el, [30, 30], [70, 70]);
  near(brushedY.internals.view().y, [bottom, top]);

  const onViewChange = vi.fn();
  const { el, internals } = daily({ use: [zoom()], onViewChange });
  expect(internals.propose({ x: [50, 87.5] })).toBe(true);
  expect(internals.propose({ x: [50, 87.5] })).toBe(false);
  expect(onViewChange.mock.calls).toEqual([[{ x: [50, 87.5] }]]);
  doubleClick(el, 50, 50);
  await nextFrame();
  expect(internals.view()).toEqual({ x: [0, 179], y: [0, 400] });
  expect(onViewChange).toHaveBeenLastCalledWith({ x: [0, 179] });
});

test("fit: 'window' over a window with no points keeps the last fitted y", () => {
  const gapped = dots({
    x: [0, 1, 2, 8, 9, 10],
    y: [10, 20, 30, 300, 400, 500],
    r: days(6, () => 2),
    color: RED,
  });
  const { internals } = windowed({ y: fitY, marks: [gapped] });
  internals.propose({ x: [0, 2.5] });
  expect(internals.view().y).toEqual([10, 30]);
  internals.propose({ x: [4, 6] });
  expect(internals.view().y).toEqual([10, 30]);
  expect(windowed({ y: fitY, view: { x: [4, 6] }, marks: [gapped] }).internals.view().y).toEqual([0, 500]);
  internals.propose(null);
  expect(internals.view().y).toEqual([0, 500]);
  internals.propose({ x: [4, 6] });
  expect(internals.view().y).toEqual([0, 500]);
});

test("fit: 'window' over a window with no points in replaced data gives the new data's whole fit", () => {
  const before = dots({ x: [0, 1, 2, 10], y: [10, 20, 30, 40], r: days(4, () => 2), color: RED });
  const after = dots({ x: [-1, 5, 10], y: [1000, 2000, 3000], r: days(3, () => 2), color: RED });
  const { chart, internals } = windowed({ y: fitY, marks: [before] });
  internals.propose({ x: [0, 2.5] });
  expect(internals.view().y).toEqual([10, 30]);
  chart.update({ marks: [after] });
  expect(internals.view().y).toEqual(
    windowed({ y: fitY, view: { x: [-1, 10] }, marks: [after] }).internals.view().y,
  );
});

test("an explicit y window equal to the whole y domain wins over fit: 'window' and is reported", () => {
  expect(daily({ view: { x: [50, 87.5], y: [0, 400] } }).internals.view().y).toEqual([0, 400]);
  const onViewChange = vi.fn();
  const { internals } = daily({ onViewChange });
  internals.propose({ x: [50, 87.5], y: [0, 400] });
  expect(onViewChange).toHaveBeenLastCalledWith({ x: [50, 87.5], y: [0, 400] });
});

test("fit: 'window' panned from bars or an area to an empty gap keeps their fit, not their baseline", () => {
  const bars = bar({ x1: [0, 1, 8, 9], x2: [1, 2, 9, 10], y: [50, 60, 70, 80], color: RED });
  const filled = [
    area({ x: [0, 1, 2], y: [50, 55, 60], color: RED }),
    area({ x: [8, 9, 10], y: [70, 75, 80], color: RED }),
  ];
  for (const marks of [[bars], filled]) {
    const { internals } = windowed({ y: fitY, marks });
    internals.propose({ x: [0, 2] });
    expect(internals.view().y).toEqual([0, 60]);
    internals.propose({ x: [4, 6] });
    expect(internals.view().y).toEqual([0, 60]);
  }
});

const dataY = { domain: 'data', label: '', fit: 'window' } satisfies Axis;

test('a smooth line samples and fits as it is drawn, and a step line has no value past its end', () => {
  const curved = line({ x: [0, 1, 2], y: [0, 10, 0], curve: 'smooth', color: RED });
  expect(curved.sampleAtX!(0.5)).toBe(6.25);
  expect(windowed({ y: dataY, view: { x: [0, 0.5] }, marks: [curved] }).internals.view().y).toEqual([
    0, 6.25,
  ]);

  const stepped = line({ x: [0, 1, 2], y: [1, 2, 3], curve: 'step', color: RED });
  const far = dots({ x: [8, 10], y: [100, 200], r: [2, 2], color: RED });
  const { internals } = windowed({ y: dataY, marks: [stepped, far] });
  internals.propose({ x: [0, 1.5] });
  expect(internals.view().y).toEqual([1, 2]);
  internals.propose({ x: [4, 6] });
  expect(internals.view().y).toEqual([1, 2]);
});

test("fit: 'window' counts a smooth line's straight value at an edge where its rows share a pixel column", () => {
  const dense = line({ x: [0, 0.0001, 1, 2], y: [0, 0, 10, 0], curve: 'smooth', color: RED });
  expect(dense.sampleAtX!(0.25)).toBeCloseTo(1.56, 2);
  const { internals } = windowed({ y: dataY, view: { x: [0, 0.25] }, marks: [dense] });
  expect(internals.view().y[1]).toBeCloseTo(2.5, 2);
});

test("fit: 'window' leaves out a row of a band or bars with one of its values missing", () => {
  const banded = area({ x: [0, 1, 2, 3, 4], y1: [0, 0, NaN, 0, 0], y2: [1, 2, 10_000, 2, 1], color: RED });
  const barred = bar({
    x1: [0, 1, 2, 3],
    x2: [1, 2, 3, 4],
    y1: [0, 0, NaN, 0],
    y2: [1, 2, 10_000, 2],
    color: RED,
  });
  expect(windowed({ y: dataY, view: { x: [0.5, 3.5] }, marks: [banded] }).internals.view().y).toEqual([0, 2]);
  expect(windowed({ y: dataY, view: { x: [0.5, 3.5] }, marks: [barred] }).internals.view().y).toEqual([0, 2]);
});

test("a smooth band's tangents stop at a row where its other outline is missing", () => {
  const x = [0, 1, 2, 3];
  const [gap, peak] = [
    [NaN, 0, 0, 0],
    [0, 0, 10, 0],
  ];
  for (const [y1, y2, edge] of [
    [gap, peak, 'y2'],
    [peak, gap, 'y1'],
  ] as const) {
    const band = area({ x, y1, y2, curve: 'smooth', color: RED });
    expect(band.sampleAtX!(1.5)).toMatchObject({ [edge]: 6.25 });
    expect(band.sampleAtX!(1.5, true)).toMatchObject({ [edge]: 5 });
    expect(windowed({ y: dataY, view: { x: [1, 1.5] }, marks: [band] }).internals.view().y).toEqual([
      0, 6.25,
    ]);
  }
});

test("fit: 'window' scans a proposed x window once, and not at all under an explicit y", () => {
  const counted = {
    ...climb,
    sampleAtX: vi.fn((v: number, straight?: boolean) => climb.sampleAtX!(v, straight)),
  };
  const { internals } = daily({ marks: [counted] });
  internals.propose({ x: [50, 87.5] });
  expect(counted.sampleAtX).toHaveBeenCalledTimes(4);
  counted.sampleAtX.mockClear();
  internals.propose({ x: [60, 97.5], y: [0, 400] });
  expect(counted.sampleAtX).not.toHaveBeenCalled();
});

test("fit: 'window' counts every row at the window's left edge", () => {
  const upright = line({ x: [0, 1, 1, 2], y: [0, 100, 1, 2], color: RED });
  expect(windowed({ y: dataY, view: { x: [1, 2] }, marks: [upright] }).internals.view().y).toEqual([1, 100]);
});

test('fit previews the y a proposed x window or a cleared y window would show', () => {
  expect(daily().internals.fit({ x: [50, 87.5] }).y).toEqual([100, 180]);
  const { internals } = daily({ view: { x: [50, 87.5], y: [20, 30] } });
  expect(internals.fit({ y: undefined }).y).toEqual([100, 180]);
  internals.propose({ y: undefined });
  expect(internals.view().y).toEqual([100, 180]);
});

const clickable = (options: Partial<Options> = {}) => {
  const onClick = vi.fn();
  const dot = dots({ x: [2, 5], y: [0.9, 0.5], r: [3, 3], color: RED, label: 'A' });
  const block = bar({ x1: [1], x2: [2], y1: [0], y2: [0.3], color: RED, label: 'B' });
  const made = windowed({
    width: 120,
    height: 120,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    marks: [dot, block],
    onClick,
    ...options,
  });
  return { ...made, onClick, dot, block };
};

test('a click calls onClick with the mark and row within 20 px and the real x and y, or with null on empty plot', () => {
  const { el, onClick, dot, block } = clickable();
  click(el, 75, 60);
  click(el, 25, 95);
  click(el, 90, 60);
  expect(
    onClick.mock.calls.map(([hit, at]) => [hit && { mark: hit.mark, row: hit.row, x: hit.x, y: hit.y }, at]),
  ).toEqual([
    [
      { mark: dot, row: 1, x: 5, y: 0.5 },
      { x: expect.closeTo(6.5), y: expect.closeTo(0.5) },
    ],
    [
      { mark: block, row: 0, x: expect.closeTo(1.5), y: expect.closeTo(0.3) },
      { x: expect.closeTo(1.5), y: expect.closeTo(0.15) },
    ],
    [null, { x: expect.closeTo(8), y: expect.closeTo(0.5) }],
  ]);
});

test('a click on the legend, in the margin, or ending a pan or a brush calls nothing; a double click calls twice', async () => {
  const shown = clickable({ use: [legend()] });
  shown.el.querySelector('span')!.dispatchEvent(new MouseEvent('click', at(shown.el, 75, 60)));
  click(shown.el, 5, 60);
  click(shown.el, 60, 115);
  expect(shown.onClick).not.toHaveBeenCalled();

  for (const use of [[zoom()], [brush({})]]) {
    const { el, onClick } = clickable({ view: { x: [2, 6] }, use });
    drag(el, [80, 60], [40, 60]);
    expect(onClick).not.toHaveBeenCalled();
    await new Promise(r => setTimeout(r, 0));
    click(el, 90, 30);
    expect(onClick).toHaveBeenCalledTimes(1);
  }

  const twice = clickable();
  doubleClick(twice.el, 90, 30);
  expect(twice.onClick).toHaveBeenCalledTimes(2);
});

test('update({ onClick: other }) makes the next click call other only', () => {
  const { el, chart, onClick } = clickable();
  const other = vi.fn();
  chart.update({ onClick: other });
  click(el, 90, 30);
  expect(onClick).not.toHaveBeenCalled();
  expect(other).toHaveBeenCalledTimes(1);
});

const crossOf = (el: HTMLElement) =>
  [...el.firstElementChild!.children].find(
    e => (e as HTMLElement).style.borderLeftStyle === 'dashed',
  ) as HTMLElement;
const twoLines = () => [
  line({ x: [0, 10], y: [0.25, 0.25], color: RED, width: 4, label: 'aa', group: 'aa' }),
  line({ x: [0, 10], y: [0.75, 0.75], color: RED, width: 4, label: 'bb', group: 'bb' }),
];
const xTip = () => tooltip({ mode: 'x', title: x => `x=${x.toFixed(0)}`, value: y => y.toFixed(2) });
const leave = (el: HTMLElement) =>
  el.firstElementChild!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));

test('onPointerChange gets real values over the plot, null once for the margin, a leave or a drag, and nothing for update()', async () => {
  const onPointerChange = vi.fn();
  const { el, chart } = clickable({ onPointerChange, view: { x: [2, 6] }, use: [zoom()] });
  const values = () => onPointerChange.mock.calls.map(([p]) => p);
  hover(el, 75, 60);
  hover(el, 5, 60);
  hover(el, 5, 30);
  hover(el, 75, 60);
  leave(el);
  leave(el);
  expect(values()).toEqual([
    { x: expect.closeTo(4.6), y: expect.closeTo(0.5) },
    null,
    { x: expect.closeTo(4.6), y: expect.closeTo(0.5) },
    null,
  ]);
  onPointerChange.mockClear();
  drag(el, [80, 60], [40, 60]);
  expect(values()).toEqual([{ x: expect.closeTo(4.8), y: expect.closeTo(0.5) }, null]);
  await new Promise(r => setTimeout(r, 0));
  hover(el, 75, 60);
  expect(values()).toHaveLength(3);
  expect(values()[2]).toEqual({ x: expect.any(Number), y: expect.closeTo(0.5) });
  onPointerChange.mockClear();
  chart.update({ pointer: { x: 3 } });
  chart.update({ pointer: null });
  expect(onPointerChange).not.toHaveBeenCalled();
});

test('update({ pointer }) shows the x tooltip there, focusing a series only with a y, and nothing outside the window', () => {
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: twoLines(),
    use: [xTip(), grab(c => (internals = c))],
  });
  const root = el.firstElementChild as HTMLElement;
  const strength = () => [pixel(el, 50, internals.yPx(0.25))[3], pixel(el, 50, internals.yPx(0.75))[3]];
  chart.update({ pointer: { x: 3 } });
  expect(root.innerText).toContain('x=3');
  expect(crossOf(el).style.display).toBe('');
  expect(crossOf(el).style.left).toBe('30px');
  expect(strength()).toEqual([255, 255]);
  chart.update({ pointer: { x: 4, y: 0.75 } });
  expect(root.innerText).toContain('x=4');
  expect(strength()[0]).toBeLessThan(100);
  expect(strength()[1]).toBe(255);
  chart.update({ pointer: null });
  expect(root.innerText).not.toContain('x=');
  expect(crossOf(el).style.display).toBe('none');
  expect(strength()).toEqual([255, 255]);
  chart.update({ view: { x: [5, 10] }, pointer: { x: 3 } });
  expect(root.innerText).not.toContain('x=');
});

test('update({ pointer }) shows the nearest tooltip only for a point with a y and a mark within reach', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'A' })],
    use: [tooltip({ mode: 'nearest', text: (label, x, y) => `${label} at ${x}, ${y}` })],
  });
  const root = el.firstElementChild as HTMLElement;
  chart.update({ pointer: { x: 5 } });
  expect(root.innerText).not.toContain('A at');
  chart.update({ pointer: { x: 5, y: 0.5 } });
  expect(root.innerText).toContain('A at 5, 0.5');
  chart.update({ pointer: { x: 9, y: 0.1 } });
  expect(root.innerText).not.toContain('A at');
  chart.update({ pointer: { x: 5, y: 0.5 } });
  chart.update({ pointer: null });
  expect(root.innerText).not.toContain('A at');
});

test("while the mouse is over the chart the app's pointer is ignored, and it shows once the mouse leaves", () => {
  const el = host();
  const chart = plot(el, { ...frame, marks: twoLines(), use: [legend(), xTip()] });
  const root = el.firstElementChild as HTMLElement;
  chart.update({ pointer: { x: 3 } });
  hover(el, 70, 50);
  expect(root.innerText).toContain('x=7');
  chart.update({ pointer: { x: 4 } });
  expect(root.innerText).toContain('x=7');
  expect(root.innerText).not.toContain('x=4');
  el.querySelector('span')!.dispatchEvent(
    new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }),
  );
  chart.update({ pointer: { x: 4 } });
  expect(root.innerText).not.toContain('x=');
  leave(el);
  expect(root.innerText).toContain('x=4');
});

test('two charts that pass each other their pointer both show it, and each callback runs once per move', () => {
  const [a, b] = [host(), host()];
  const charts: ReturnType<typeof plot>[] = [];
  const calls = [vi.fn(), vi.fn()];
  for (const [i, el] of [a, b].entries()) {
    charts.push(
      plot(el, {
        ...frame,
        marks: twoLines(),
        onPointerChange: p => (calls[i]!(p), charts[1 - i]!.update({ pointer: p })),
        use: [xTip()],
      }),
    );
  }
  hover(a, 30, 50);
  expect([crossOf(a).style.left, crossOf(b).style.left]).toEqual(['30px', '30px']);
  expect(crossOf(b).style.display).toBe('');
  expect(calls.map(c => c.mock.calls.length)).toEqual([1, 0]);
  leave(a);
  expect(crossOf(b).style.display).toBe('none');
  hover(b, 70, 50);
  expect([crossOf(a).style.left, crossOf(b).style.left]).toEqual(['70px', '70px']);
  expect(crossOf(a).style.display).toBe('');
  expect(calls.map(c => c.mock.calls.length)).toEqual([2, 1]);
});

test('a chart passed a pointer whose y is outside its y range still shows the crosshair at its x, with no series focused', () => {
  const [a, b] = [host(), host()];
  let internals!: Internals;
  const other = plot(b, { ...frame, dim: 0.3, marks: twoLines(), use: [xTip(), grab(c => (internals = c))] });
  plot(a, {
    ...frame,
    y: { domain: [0, 1000], label: '' },
    marks: twoLines(),
    onPointerChange: p => other.update({ pointer: p }),
    use: [xTip()],
  });
  hover(a, 30, 50);
  expect(crossOf(b).style.display).toBe('');
  expect(crossOf(b).style.left).toBe('30px');
  expect((b.firstElementChild as HTMLElement).innerText).toContain('x=3');
  expect([0.25, 0.75].map(y => pixel(b, 50, internals.yPx(y))[3])).toEqual([255, 255]);
});

test("the app's pointer moved after the mouse went onto a legend entry leaves the entry's highlight", () => {
  const el = host();
  let internals!: Internals;
  const chart = plot(el, {
    ...frame,
    dim: 0.3,
    marks: twoLines(),
    use: [legend(), xTip(), grab(c => (internals = c))],
  });
  chart.update({ pointer: { x: 3 } });
  const b = entriesOf(el)[1]!;
  b.dispatchEvent(new PointerEvent('pointermove', middleOf(b)));
  chart.update({ pointer: { x: 4 } });
  expect(pixel(el, 50, internals.yPx(0.25))[3]).toBeLessThan(100);
  expect(pixel(el, 50, internals.yPx(0.75))[3]).toBe(255);
});

test("a finger lifted from a legend entry that does not toggle shows the app's pointer again", () => {
  const el = host();
  const chart = plot(el, { ...frame, marks: twoLines(), use: [legend({ toggle: false }), xTip()] });
  const root = el.firstElementChild as HTMLElement;
  chart.update({ pointer: { x: 3 } });
  touch(entriesOf(el)[0]!);
  expect(crossOf(el).style.display).toBe('');
  expect(root.innerText).toContain('x=3');
});

test("once the user's pointer leaves or lifts, a tip it shows is held and anything else gives way to the app's pointer", async () => {
  const modes = [
    {
      tip: tooltip({ mode: 'nearest', text: (label, x) => `${label} at ${x}` }),
      app: [{ x: 8, y: 0.5 }, { x: 2, y: 0.5 }, 'A at 8', 'A at 2'],
      own: 'A at 5',
      bare: (c: Internals) => [c.xPx(5), c.yPx(0.95)] as const,
    },
    {
      tip: xTip(),
      app: [{ x: 8 }, { x: 2 }, 'x=8', 'x=2'],
      own: 'x=5',
      bare: (c: Internals) => [c.margin().left / 2, c.yPx(0.5)] as const,
    },
  ] as const;
  for (const { tip, app, own, bare: bareOf } of modes) {
    const el = host();
    let internals!: Internals;
    const chart = plot(el, {
      ...frame,
      margin: { top: 0, right: 0, bottom: 0, left: 20 },
      marks: [
        dots({ x: [2, 5, 8], y: [0.5, 0.5, 0.5], r: [3, 3, 3], color: RED, label: 'A' }),
        ...twoLines(),
      ],
      use: [legend({ toggle: false }), tip, zoom(), grab(c => (internals = c))],
    });
    const mark = [internals.xPx(5), internals.yPx(0.5)] as const;
    const bare = bareOf(internals);
    const root = el.firstElementChild as HTMLElement;
    const [first, second, firstText, secondText] = app;
    const showsApp = () => {
      expect(root.innerText).toContain(firstText);
      chart.update({ pointer: second });
      expect(root.innerText).toContain(secondText);
      chart.update({ pointer: first });
    };
    const finger = (x: number, y: number) => {
      const { clientX, clientY } = at(el, x, y);
      touch(root, clientX, clientY);
    };
    chart.update({ pointer: first });

    hover(el, mark[0], mark[1]);
    expect(root.innerText).toContain(own);
    leave(el);
    showsApp();

    press(el, 'pointerdown', mark[0], mark[1], { pointerType: 'touch' });
    expect(root.innerText).toContain(own);
    press(el, 'pointercancel', mark[0], mark[1], { pointerType: 'touch' });
    showsApp();

    finger(mark[0], mark[1]);
    expect(root.innerText).toContain(own);
    chart.update({ pointer: second });
    expect(root.innerText).toContain(own);
    expect(root.innerText).not.toContain(secondText);
    chart.update({ pointer: first, dim: 0.5 });
    showsApp();

    finger(bare[0], bare[1]);
    showsApp();

    touch(entriesOf(el)[0]!);
    showsApp();

    const settled = async () => {
      await new Promise(r => setTimeout(r, 0));
      showsApp();
    };
    drag(el, [mark[0], mark[1]], [mark[0] + 20, mark[1]]);
    leave(el);
    await settled();

    pinch(el, [mark[0] - 10, mark[1]], [mark[0] + 10, mark[1]], [mark[0] - 5, mark[1]], [...mark]);
    root.dispatchEvent(
      new PointerEvent('pointerleave', { ...at(el, mark[0], mark[1]), pointerType: 'touch' }),
    );
    await settled();
  }
});

test('a tip held by a tap survives updates of the pointer or callbacks alone, and is let go by any other', () => {
  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'A' })],
    use: [tooltip({ mode: 'nearest', text: (label, x, y) => `${label} at ${x}, ${y}` })],
  });
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  const tap = () => touch(root, box.left + 55, box.top + 52);
  tap();
  chart.update({ pointer: null });
  chart.update({ onClick: vi.fn() });
  expect(root.innerText).toContain('A at 5, 0.5');
  chart.update({});
  expect(root.innerText).not.toContain('A at');
  tap();
  expect(root.innerText).toContain('A at 5, 0.5');
  chart.update({ pointer: null, dim: 0.5 });
  expect(root.innerText).not.toContain('A at');
});

const INK = [68, 68, 68, 255];
const twoBars = () => [
  bar({ x1: [0, 2, 4], x2: [1, 3, 5], y: [0.5, 0.5, 0.5], color: RED, label: 'a' }),
  bar({ x1: [6, 8], x2: [7, 9], y: [0.5, 0.5], color: RED, label: 'b' }),
];

test("selected draws its rows at full strength with an outline in the theme's text and every other row at dim", () => {
  const { el, chart } = windowed({ dim: 0.3, marks: twoBars(), selected: [{ id: 'a', rows: [2] }] });
  const alpha = (x: number) => pixel(el, x, 75)[3]!;
  expect(pixel(el, 45, 75)).toEqual(RED_PIXEL);
  expect(pixel(el, 40, 75)).toEqual(INK);
  expect([5, 25, 65, 85].map(alpha).every(a => a > 60 && a < 100)).toBe(true);
  chart.update({ selected: null });
  expect([5, 25, 45, 65, 85].map(x => pixel(el, x, 75))).toEqual(Array(5).fill(RED_PIXEL));
  expect(pixel(el, 40, 75)).toEqual(RED_PIXEL);
});

test('a selected bar on WebGL is drawn at full strength inside an outline, and the rest at dim', () => {
  const n = 20_000;
  const [x1, x2] = [new Float64Array(n), new Float64Array(n).fill(1)];
  [x1[2], x2[2]] = [4, 5];
  const marks = [bar({ x1, x2, y: new Float64Array(n).fill(0.5), color: RED, label: 'a' })];
  const { el } = windowed({ dim: 0.3, marks, selected: [{ id: 'a', rows: [2] }] });
  expect([pixel(el, 45, 75, 1), pixel(el, 40, 75, 1)]).toEqual([RED_PIXEL, INK]);
  expect(pixel(el, 5, 75, 1)[3]).toBeLessThan(100);
});

test.each([
  ['canvas', 5, 0],
  ['WebGL', 30_000, 1],
])(
  'selected dots on the %s are drawn over the rest at full strength; an unknown id or a row past the end changes nothing',
  (_, n, nth) => {
    const x = new Float64Array(n).fill(5);
    [x[1], x[3]] = [2, 8];
    const dotsA = dots({
      x,
      y: new Float64Array(n).fill(0.55),
      r: new Float64Array(n).fill(3),
      color: RED,
      label: 'A',
    });
    const dotB = dots({ x: [8], y: [0.55], r: [3], color: BLUE, label: 'B' });
    const { el, chart } = windowed({ dim: 0.3, marks: [dotsA, dotB], selected: [{ id: 'A', rows: [1, 3] }] });
    expect(el.querySelectorAll('canvas')).toHaveLength(nth + 1);
    expect([pixel(el, 20, 45, nth), pixel(el, 80, 45, nth)]).toEqual([RED_PIXEL, RED_PIXEL]);
    expect(pixel(el, 50, 45, nth)[3]).toBeLessThan(100);
    chart.update({
      selected: [
        { id: 'zz', rows: [1] },
        { id: 'A', rows: [n, -1, 1.5] },
      ],
    });
    expect([pixel(el, 50, 45, nth), pixel(el, 20, 45, nth)]).toEqual([RED_PIXEL, RED_PIXEL]);
    expect(pixel(el, 80, 45, nth)).toEqual([0, 0, 255, 255]);
  },
);

test('selecting several rows of an area draws it whole once, not once per row', () => {
  const shade = (rows: number[]) => {
    const marks = [area({ x: [0, 5, 10], y: [1, 1, 1], color: RED, alpha: 0.5, label: 'L' })];
    return pixel(windowed({ dim: 0.3, marks, selected: [{ id: 'L', rows }] }).el, 50, 50);
  };
  expect(shade([0, 1, 2])).toEqual(shade([0]));
});

test('a translucent selected dot on WebGL keeps its colour inside the outline', () => {
  const n = 30_000;
  const marks = [
    dots({
      x: new Float64Array(n).fill(2),
      y: new Float64Array(n).fill(0.55),
      r: new Float64Array(n).fill(3),
      color: RED,
      alpha: 0.4,
      label: 'A',
    }),
  ];
  const { el } = windowed({ dim: 0.3, marks, selected: [{ id: 'A', rows: [0] }] });
  const [red, green] = pixel(el, 20, 45, 1);
  expect(red).toBeGreaterThan(200);
  expect(green).toBeLessThan(10);
});

test('a hovered mark focuses over a selection, leaving shows it again, and update({ selected }) only repaints', () => {
  const [onViewChange, onHiddenChange, onPointerChange] = [vi.fn(), vi.fn(), vi.fn()];
  const marks = twoBars();
  const { el, chart, whys } = windowed({
    dim: 0.3,
    marks,
    selected: [{ id: 'a', rows: [2] }],
    onViewChange,
    onHiddenChange,
    onPointerChange,
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  const alphas = () => [5, 45, 65, 85].map(x => pixel(el, x, 75)[3]! > 200);
  hover(el, 65, 75);
  expect(alphas()).toEqual([false, false, true, true]);
  leave(el);
  expect(alphas()).toEqual([false, true, false, false]);
  onPointerChange.mockClear();
  const prepare = marks.map(k => vi.spyOn(k, 'prepare'));
  whys.length = 0;
  chart.update({ selected: [{ id: 'b', rows: [0] }] });
  expect(alphas()).toEqual([false, false, true, false]);
  expect(whys).toEqual(['focus']);
  for (const p of prepare) expect(p).not.toHaveBeenCalled();
  for (const f of [onViewChange, onHiddenChange, onPointerChange]) expect(f).not.toHaveBeenCalled();
});

test('at the default dim a hovered bar hides the outline of a selected one until the pointer leaves', () => {
  const { el } = windowed({
    marks: twoBars(),
    selected: [{ id: 'a', rows: [2] }],
    use: [tooltip({ mode: 'nearest', text: label => label })],
  });
  expect(pixel(el, 40, 75)).toEqual(INK);
  hover(el, 65, 75);
  expect(pixel(el, 40, 75)).toEqual(RED_PIXEL);
  leave(el);
  expect(pixel(el, 40, 75)).toEqual(INK);
});

test("with onClick the root's cursor is a pointer over a dot or bar within reach and the default elsewhere; without, it never changes", () => {
  const { el, chart, block } = clickable();
  const root = el.firstElementChild as HTMLElement;
  const cursorAt = (x: number, y: number) => (hover(el, x, y), root.style.cursor);
  expect([cursorAt(75, 60), cursorAt(90, 30), cursorAt(25, 95), cursorAt(5, 60)]).toEqual([
    'pointer',
    '',
    'pointer',
    '',
  ]);
  hover(el, 75, 60);
  leave(el);
  expect(root.style.cursor).toBe('');
  hover(el, 75, 60);
  chart.update({ onClick: undefined });
  expect(root.style.cursor).toBe('');
  chart.update({ onClick: vi.fn() });
  expect(root.style.cursor).toBe('pointer');
  chart.update({ marks: [block] });
  expect(root.style.cursor).toBe('');
  const plain = clickable({ onClick: undefined });
  hover(plain.el, 75, 60);
  hover(plain.el, 25, 95);
  expect((plain.el.firstElementChild as HTMLElement).style.cursor).toBe('');
});

test('the cursor follows what a resting pointer is over after hidden, view, a wheel zoom or a resize', async () => {
  const { el, chart } = clickable({ use: [zoom()] });
  const root = hover(el, 75, 60);
  chart.update({ hidden: ['A'] });
  expect(root.style.cursor).toBe('');
  chart.update({ hidden: [] });
  expect(root.style.cursor).toBe('pointer');
  chart.update({ view: { x: [4, 8] } });
  expect(root.style.cursor).toBe('');
  chart.update({ view: undefined });
  expect(root.style.cursor).toBe('pointer');
  wheel(el, 110, 60, -1000, { ctrlKey: true });
  await expect.poll(() => root.style.cursor).toBe('');

  const sized = clickable({ width: undefined, height: undefined });
  sized.el.style.cssText = 'width:120px;height:120px';
  await expect.poll(() => sized.internals.size().width).toBe(120);
  const resting = hover(sized.el, 75, 60);
  expect(resting.style.cursor).toBe('pointer');
  sized.el.style.width = '240px';
  await expect.poll(() => sized.internals.size().width).toBe(240);
  expect(resting.style.cursor).toBe('');
});

const bounds = (k: Mark) => {
  const { x1, x2, y1, y2 } = k.options as Record<string, ArrayLike<number> | undefined>;
  const all = (c?: ArrayLike<number>) => c && Array.from(c);
  return { x1: all(x1), x2: all(x2), y1: all(y1), y2: all(y2) };
};
const layer = (label: string, y: number[], options: Partial<Parameters<typeof area>[0]> = {}) =>
  area({ x: [0, 1, 2], y, stack: 'load', color: RED, label, ...options });

test('stacked areas are stacked over the shown ones in listed order, also when one is shown again', () => {
  const { internals } = windowed({
    marks: [layer('A', [1, 2, 3]), layer('B', [2, 2, 2]), layer('C', [3, 1, 1]), layer('D', [1, 1, 1])],
  });
  const drawn = () => internals.marks().map(k => ({ label: k.label, ...bounds(k) }));
  expect(drawn().map(k => k.y2)).toEqual([
    [1, 2, 3],
    [3, 4, 5],
    [6, 5, 6],
    [7, 6, 7],
  ]);
  internals.hide(['B']);
  const [a, c] = drawn();
  expect(c!.y1).toEqual(a!.y2);
  internals.hide(['A']);
  expect(drawn()[0]).toMatchObject({ label: 'B', y1: [0, 0, 0], y2: [2, 2, 2] });
  internals.hide([]);
  expect(drawn().map(k => [k.label, k.y1])).toEqual([
    ['A', [0, 0, 0]],
    ['B', [1, 2, 3]],
    ['C', [3, 4, 5]],
    ['D', [6, 5, 6]],
  ]);
});

test("the y extent follows the restacked top under the default fit and fit: 'window', the whole stack under fit: 'all'", () => {
  const marks = [layer('A', [1, 2, 3]), layer('B', [2, 2, 2]), layer('C', [3, 1, 1])];
  const fitted = (y: Axis, view?: Options['view']) => {
    const { internals } = windowed({ x: { domain: 'data', label: '' }, y, marks, view });
    internals.hide(['C']);
    return internals.view().y;
  };
  expect(fitted({ domain: 'data', label: '' })).toEqual([0, 5]);
  expect(fitted({ domain: 'data', label: '', fit: 'window' }, { x: [0, 1] })).toEqual([0, 4]);
  expect(fitted({ domain: 'data', label: '', fit: 'all' })).toEqual([0, 6]);

  const { internals } = windowed({
    y: { domain: 'data', label: '' },
    marks: [layer('A', [1, 1, 1]), layer('B', [-2, -2, -2]), layer('C', [1, 1, 1])],
  });
  expect(internals.view().y).toEqual([-2, 2]);
  internals.hide(['A']);
  expect(internals.view().y).toEqual([-2, 1]);
});

test('a stacked or dodged mark listed twice is laid out once per listing', () => {
  const a = area({ x: [0, 1], y: [1, 1], stack: 's', color: RED, label: 'A' });
  const b = area({ x: [0, 1], y: [2, 2], stack: 's', color: BLUE, label: 'B' });
  const { internals } = windowed({ y: { domain: 'data', label: '' }, marks: [a, b, a] });
  const layers = () => internals.marks().map(k => [bounds(k).y1, bounds(k).y2]);
  expect(layers()).toEqual([
    [
      [0, 0],
      [1, 1],
    ],
    [
      [1, 1],
      [3, 3],
    ],
    [
      [3, 3],
      [4, 4],
    ],
  ]);
  expect(internals.view().y).toEqual([0, 4]);
  internals.hide(['B']);
  expect(layers()).toEqual([
    [
      [0, 0],
      [1, 1],
    ],
    [
      [1, 1],
      [2, 2],
    ],
  ]);

  const d = bar({ x: [0], y: [1], dodge: 'd', color: RED });
  const slots = windowed({ x: { domain: [-0.5, 0.5], label: '' }, marks: [d, d] }).internals.marks();
  expect(slots.map(k => bounds(k).x1![0]!.toFixed(2))).toEqual(['-0.40', '0.00']);
});

test('hiding one of two dodged bar series gives the other the whole slot, centred on its category', () => {
  const series = (label: string, color: string) =>
    bar({ x: [0, 1, 2], y: [1, 1, 1], dodge: 'years', color, label });
  const { el, internals } = windowed({
    x: { domain: [-0.5, 2.5], label: '' },
    marks: [series('A', RED), series('B', BLUE)],
  });
  const slots = () =>
    internals
      .marks()
      .map(k => [k.label, ...[bounds(k).x1, bounds(k).x2].map(c => c!.map(v => +v.toFixed(2)))]);
  const both = [
    ['A', [-0.4, 0.6, 1.6], [0, 1, 2]],
    ['B', [0, 1, 2], [0.4, 1.4, 2.4]],
  ];
  expect(slots()).toEqual(both);
  internals.hide(['A']);
  expect(slots()).toEqual([['B', [-0.4, 0.6, 1.6], [0.4, 1.4, 2.4]]]);
  expect(pixel(el, 10, 50)).toEqual([0, 0, 255, 255]);
  internals.hide([]);
  expect(slots()).toEqual(both);
  expect(pixel(el, 10, 50)).toEqual(RED_PIXEL);
});

test('the x tooltip and onClick report a layer its own value, and the legend still lists a hidden layer', () => {
  const { el, internals } = windowed({
    x: { domain: [0, 2], label: '' },
    y: { domain: [0, 4], label: '' },
    marks: [layer('A', [1, 1, 1]), layer('B', [2, 2, 2])],
    use: [tooltip({ mode: 'x', title: () => 'at', value: String }), legend()],
  });
  const root = hover(el, 50, 80);
  expect(root.innerText).toContain('B: 2');
  internals.hide(['A']);
  expect([...el.querySelectorAll('[role=button]')].map(s => s.textContent)).toEqual(['A', 'B']);

  const onClick = vi.fn();
  const top = bar({ x: [0], y: [2], stack: 's', color: BLUE, label: 'B' });
  const clicked = windowed({
    x: { domain: [-0.5, 0.5], label: '' },
    y: { domain: [0, 4], label: '' },
    marks: [bar({ x: [0], y: [1], stack: 's', color: RED, label: 'A' }), top],
    onClick,
  });
  click(clicked.el, 50, 50);
  expect(onClick.mock.calls[0]![0]).toMatchObject({ mark: top, row: 0, y: 3, value: 2 });
});

test('the nearest tooltip on a stacked bar sits at the top of the bar and names its own value', () => {
  const layers = ['A', 'B', 'C'].map(label => bar({ x: [0], y: [5], stack: 's', color: RED, label }));
  const { el, internals } = windowed({
    x: { domain: [-0.5, 0.5], label: '' },
    y: { domain: [0, 15], label: '' },
    marks: layers,
    use: [tooltip({ mode: 'nearest', text: (label, _, y) => `${label} ${y}` })],
  });
  const root = hover(el, 50, Math.round(internals.yPx(12.5)));
  const tip = [...root.querySelectorAll('div')].find(d => d.textContent === 'C 5')!;
  expect(tip.style.transform).toContain(`${internals.yPx(15) + 12}px`);
});

test('a bar given stack or dodge as undefined is drawn by its own bounds', () => {
  expect(bar({ x: [0], y: [1], color: RED, stack: undefined }).arrange).toBeUndefined();
  expect(bar({ x: [0], y: [1], color: RED, dodge: undefined }).arrange).toBeUndefined();
  expect(bounds(bar({ x1: [0], x2: [1], y: [1], color: RED, stack: undefined })).x2).toEqual([1]);
});

function rejectsArrangedBounds() {
  // @ts-expect-error a bar given x1 and x2 is not stacked
  bar({ x1: [0], x2: [1], y: [1], stack: 's', color: RED });
  // @ts-expect-error a bar given y1 and y2 is not dodged
  bar({ x: [0], y1: [0], y2: [1], dodge: 'd', color: RED });
  // @ts-expect-error a bar is stacked or dodged, not both
  bar({ x: [0], y: [1], stack: 's', dodge: 'd', color: RED });
}
void rejectsArrangedBounds;

test('update() with equal options keeps the laid-out marks, and hiding and showing frees what it lays out again', () => {
  const rows = 10_000;
  const [x, y] = [Float64Array.from({ length: rows }, (_, i) => i), new Float64Array(rows).fill(1)];
  const many = (label: string) => bar({ x, y, stack: 's', color: RED, label });
  const created = vi.spyOn(WebGL2RenderingContext.prototype, 'createBuffer');
  const deleted = vi.spyOn(WebGL2RenderingContext.prototype, 'deleteBuffer');
  const { el, chart, internals } = windowed({
    x: { domain: [-1, rows], label: '' },
    y: { domain: [0, 3], label: '' },
    marks: [many('A'), many('B')],
  });
  expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('');
  const drawn = internals.marks();
  chart.update({ marks: [many('A'), many('B')] });
  expect(internals.marks().every((k, i) => k === drawn[i])).toBe(true);

  const live = () => created.mock.calls.length - deleted.mock.calls.length;
  try {
    internals.hide(['A']);
    internals.hide([]);
    const [settled, made] = [live(), created.mock.calls.length];
    for (let i = 0; i < 3; i++) {
      internals.hide(['A']);
      internals.hide([]);
    }
    expect(created.mock.calls.length).toBeGreaterThan(made);
    expect(live()).toBe(settled);
  } finally {
    chart.destroy();
    created.mockRestore();
    deleted.mockRestore();
  }
});

const ZONED = { ...frame, margin: { top: 10, right: 10, bottom: 10, left: 10 } };

test('a zone is under an opaque line listed before or after it, spans the plot, and is cut to it', () => {
  const flat = line({ x: [0, 10], y: [0.5, 0.5], color: RED, width: 6 });
  const band = () => zone({ x1: 2, x2: 6, color: BLUE, alpha: 0.5 });
  for (const marks of [
    [band(), flat],
    [flat, band()],
  ]) {
    const el = host();
    plot(el, { ...ZONED, marks });
    expect(pixel(el, 40, 50)).toEqual(RED_PIXEL);
    for (const y of [12, 30, 88]) {
      const [r, g, b, a] = pixel(el, 40, y);
      expect([r, g, b]).toEqual([0, 0, 255]);
      expect(Math.abs(a! - 128)).toBeLessThanOrEqual(2);
    }
    expect(pixel(el, 40, 5)[3]).toBe(0);
    expect(pixel(el, 40, 95)[3]).toBe(0);
    expect(pixel(el, 70, 30)[3]).toBe(0);
  }

  const part = host();
  plot(part, { ...ZONED, view: { x: [2, 6] }, marks: [zone({ x1: 0, x2: 4, color: BLUE, alpha: 1 })] });
  expect(pixel(part, 12, 30)).toEqual([0, 0, 255, 255]);
  expect(pixel(part, 48, 30)).toEqual([0, 0, 255, 255]);
  expect(pixel(part, 52, 30)[3]).toBe(0);
  expect(pixel(part, 5, 30)[3]).toBe(0);

  const out = host();
  plot(out, { ...ZONED, marks: [zone({ x1: 12, x2: 15, color: BLUE, alpha: 1, text: 'out' })] });
  for (const x of [5, 50, 92, 98]) expect(pixel(out, x, 30)[3]).toBe(0);
  expect(labelsOf(out).map(d => d.textContent)).not.toContain('out');
});

test('a zone does not widen a fitted domain, nor take it over when every series is hidden', () => {
  let internals!: Internals;
  plot(host(), {
    ...ZONED,
    y: { domain: 'nice', label: '' },
    marks: [line({ x: [0, 10], y: [0, 3], color: RED, label: 'a' }), zone({ y1: 8, y2: 10, color: BLUE })],
    use: [grab(c => (internals = c))],
  });
  expect(internals.domain().y).toEqual([0, 3]);
  internals.hide(['a']);
  expect(internals.domain().y).toEqual([0, 3]);
});

test('20,000 bars followed by a zone stay on WebGL, over the zone', () => {
  const n = 20_000;
  const el = host();
  const column = (at: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => at(i));
  plot(el, {
    ...ZONED,
    y: { domain: [0, 4], label: '' },
    marks: [
      bar({ x1: column(i => (i ? 20 : 4)), x2: column(i => (i ? 21 : 6)), y: column(() => 2), color: BLUE }),
      zone({ y1: 1, y2: 3, color: RED, alpha: 1 }),
    ],
  });
  expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('');
  expect(pixel(el, 50, 60, 1)).toEqual([0, 0, 255, 255]);
  expect(pixel(el, 50, 40, 1)[3]).toBe(0);
  expect(pixel(el, 50, 40)).toEqual(RED_PIXEL);
});

test('a zone with text is no series: no legend entry, no part in hover, and its strength beside a focused group', () => {
  const el = host();
  plot(el, {
    ...ZONED,
    dim: 0.3,
    marks: [
      zone({ y1: 0.9, y2: 1, color: BLUE, alpha: 1, text: 'target' }),
      bar({ x1: [1, 5], x2: [3, 7], y1: [0, 0], y2: [0.8, 0.8], color: RED, label: 'a' }),
    ],
    use: [legend(), tooltip({ mode: 'nearest', text: () => 'tip' })],
  });
  expect(entriesOf(el).map(s => s.textContent)).toEqual(['a']);
  expect(labelsOf(el).map(d => d.textContent)).toContain('target');
  hover(el, 26, 60);
  expect(pixel(el, 26, 60)).toEqual(RED_PIXEL);
  expect(pixel(el, 58, 60)[3]).toBeLessThan(100);

  const two = host();
  let chart!: Internals;
  plot(two, {
    ...ZONED,
    dim: 0.3,
    marks: [series('A', 0.25), series('B', 0.5), zone({ y1: 0.8, y2: 1, color: BLUE, alpha: 1 })],
    use: [grab(c => (chart = c))],
  });
  chart.focus('B');
  expect(pixel(two, 50, chart.yPx(0.25))[3]).toBeLessThan(100);
  expect(pixel(two, 50, chart.yPx(0.9))).toEqual([0, 0, 255, 255]);
});

test('a grouped backdrop stays under the other marks when its group is focused', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...ZONED,
    dim: 0.3,
    marks: [
      { ...zone({ y1: 0, y2: 1, color: BLUE, alpha: 1 }), group: 'A' },
      { ...line({ x: [0, 10], y: [0.5, 0.5], color: RED, width: 6 }), group: 'B' },
    ],
    use: [grab(c => (chart = c))],
  });
  chart.focus('A');
  expect(pixel(el, 50, 50)[0]).toBeGreaterThan(50);
  expect(pixel(el, 50, 30)).toEqual([0, 0, 255, 255]);
});

test('a zone seen as a thin sliver at the right or bottom edge drops its text', () => {
  const wide = { ...ZONED, width: 200, height: 200, margin: { top: 10, right: 60, bottom: 60, left: 10 } };
  const right = host();
  plot(right, {
    ...wide,
    view: { x: [0, 10] },
    marks: [zone({ x1: 9.85, x2: 12, color: BLUE, text: 'edge' })],
  });
  expect(labelsOf(right).map(d => d.textContent)).not.toContain('edge');
  const bottom = host();
  plot(bottom, {
    ...wide,
    y: { domain: [0, 10], label: '' },
    marks: [zone({ y1: -1, y2: 0.15, color: BLUE, text: 'edge' })],
  });
  expect(labelsOf(bottom).map(d => d.textContent)).not.toContain('edge');
  const inside = host();
  plot(inside, { ...wide, marks: [zone({ x1: 2, x2: 6, color: BLUE, text: 'edge' })] });
  expect(labelsOf(inside).map(d => d.textContent)).toContain('edge');
});

test('a radar draws its rings under its series whatever their order', () => {
  const el = host();
  const axes = ['A', 'B', 'C', 'D'];
  plot(el, {
    ...pie,
    marks: radar({ axes, max: 1, series: [{ values: [1, 1, 1, 1], color: RED }] }).reverse(),
  });
  expect(pixel(el, 50, 22)).toEqual(RED_PIXEL);
});

const RULED = { ...ZONED, y: { domain: [0, 10], label: '' } } satisfies Partial<Options>;
const rulesOf = (el: HTMLElement) =>
  [...el.querySelectorAll('div')].filter(d => d.style.borderTopWidth || d.style.borderLeftWidth);
const boxOf = (el: HTMLElement, d: Element) => {
  const [a, b] = [d.getBoundingClientRect(), el.firstElementChild!.getBoundingClientRect()];
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
};

test('a rule is a line across the plot at each of its values, in its colour, width and dash', () => {
  const el = host();
  plot(el, { ...RULED, marks: [rule({ y: 5, color: BLUE })] });
  const [one, ...rest] = rulesOf(el);
  expect(rest).toEqual([]);
  expect(boxOf(el, one!)).toEqual({ left: 10, top: 50, width: 80, height: 1 });
  expect(getComputedStyle(one!).borderTopColor).toBe('rgb(0, 0, 255)');
  expect(getComputedStyle(one!).borderTopStyle).toBe('solid');

  const styled = host();
  plot(styled, { ...RULED, marks: [rule({ x: 5, color: BLUE, width: 2, dashed: true })] });
  const upright = rulesOf(styled)[0]!;
  expect(getComputedStyle(upright).borderLeftWidth).toBe('2px');
  expect(getComputedStyle(upright).borderLeftStyle).toBe('dashed');
  expect(boxOf(styled, upright)).toEqual({ left: 49, top: 10, width: 2, height: 80 });

  const many = host();
  plot(many, { ...RULED, view: { y: [0, 6] }, marks: [rule({ y: [2, 4, 8], color: BLUE })] });
  expect(rulesOf(many).map(d => Math.round(boxOf(many, d).top))).toEqual([63, 36]);

  const edge = host();
  plot(edge, { ...RULED, marks: [rule({ y: 0, color: BLUE })] });
  expect(boxOf(edge, rulesOf(edge)[0]!).top).toBe(89);
});

test('a rule does not widen a fitted domain, nor take it over when every series is hidden', () => {
  let internals!: Internals;
  plot(host(), {
    ...ZONED,
    y: { domain: 'nice', label: '' },
    marks: [line({ x: [0, 10], y: [0, 3], color: RED, label: 'a' }), rule({ y: 10, color: BLUE })],
    use: [grab(c => (internals = c))],
  });
  expect(internals.domain().y).toEqual([0, 3]);
  internals.hide(['a']);
  expect(internals.domain().y).toEqual([0, 3]);
});

test('the rules lie over every canvas and under the axis text, whichever layer is made first', () => {
  const n = 20_000;
  const column = (at: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => at(i));
  const bars = bar({
    x1: column(i => (i / n) * 10),
    x2: column(i => ((i + 1) / n) * 10),
    y: column(() => 2),
    color: RED,
  });
  const check = (el: HTMLElement) => {
    const layers = [...el.firstElementChild!.children];
    const rules = layers.indexOf(rulesOf(el)[0]!.parentElement!);
    const canvases = [...el.querySelectorAll('canvas')].map(c => layers.indexOf(c));
    expect(canvases).toHaveLength(2);
    expect(Math.max(...canvases)).toBeLessThan(rules);
    expect(layers.slice(rules + 1).some(d => /\d/.test(d.textContent ?? ''))).toBe(true);
    expect(el.querySelectorAll('canvas')[1]!.style.display).toBe('');
    expect(losing(el).layer).toBe(el.querySelectorAll('canvas')[1]);
  };
  const first = host();
  plot(first, { ...RULED, marks: [bars, rule({ y: 5, color: BLUE })] });
  check(first);
  expect(rulesOf(first)[0]!.parentElement!.style.clipPath).toBe(
    first.querySelectorAll('canvas')[1]!.style.clipPath,
  );

  const later = host();
  const chart = plot(later, { ...RULED, marks: [rule({ y: 5, color: BLUE })] });
  chart.update({ marks: [bars, rule({ y: 5, color: BLUE })] });
  check(later);
  expect(rulesOf(later)[0]!.parentElement!.style.clipPath).toBe(
    later.querySelectorAll('canvas')[1]!.style.clipPath,
  );
});

test('the rules are clipped and faded with the WebGL layer during an entrance and follow a resize and a window', () => {
  fakeClock();
  const fading = host();
  plot(fading, {
    ...frame,
    marks: [pile(30_000), rule({ y: 0.5, color: BLUE })],
    use: [animate({ duration: 300, enter: 'fade' })],
  });
  const faded = rulesOf(fading)[0]!.parentElement!;
  expect(faded.style.opacity).toBe('0');
  vi.advanceTimersByTime(400);
  expect(faded.style.opacity).toBe('');

  const el = host();
  const chart = plot(el, {
    ...frame,
    marks: [pile(30_000), rule({ y: 0.5, color: BLUE })],
    use: [animate({ duration: 300 })],
  });
  const layer = rulesOf(el)[0]!.parentElement!;
  const gl = el.querySelectorAll('canvas')[1]!;
  expect(layer.style.clipPath).toContain('polygon');
  expect(layer.style.clipPath).toBe(gl.style.clipPath);
  vi.advanceTimersByTime(150);
  expect(layer.style.clipPath).toBe(gl.style.clipPath);
  vi.advanceTimersByTime(250);
  expect(layer.style.clipPath).toBe('inset(0px)');

  chart.update({ width: 200 });
  expect(boxOf(el, rulesOf(el)[0]!).width).toBe(200);
  chart.update({ view: { y: [0.25, 0.75] } });
  expect(boxOf(el, rulesOf(el)[0]!).top).toBe(50);
  chart.update({ view: { y: [0, 0.25] } });
  expect(rulesOf(el)).toEqual([]);

  const plain = host();
  plot(plain, { ...frame, marks: [rule({ y: 0.5, color: BLUE })], use: [animate({ duration: 300 })] });
  expect(rulesOf(plain)[0]!.parentElement!.style.clipPath).toContain('polygon');
});

test('a rule names itself at its end inside the plot, gives way to a stronger label, and is no series', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...RULED,
    dim: 0.3,
    marks: [
      series('A', 2),
      series('B', 8),
      rule({ y: 3, color: BLUE, text: 'goal' }),
      rule({ x: 5, color: BLUE, text: 'now' }),
    ],
    use: [legend(), grab(c => (chart = c))],
  });
  const goal = labelsOf(el).find(d => d.textContent === 'goal')!;
  const [across, upright] = rulesOf(el).map(d => boxOf(el, d));
  const box = boxOf(el, goal);
  expect(box.left + box.width).toBeLessThanOrEqual(across!.left + across!.width);
  expect(box.left + box.width).toBeGreaterThan(across!.left + across!.width - 10);
  expect(box.top + box.height).toBeLessThanOrEqual(across!.top);
  const now = boxOf(
    el,
    labelsOf(el).find(d => d.textContent === 'now')!,
  );
  expect(now.left).toBeGreaterThanOrEqual(upright!.left + upright!.width);
  expect(now.top).toBeGreaterThanOrEqual(upright!.top);
  expect(entriesOf(el).map(s => s.textContent)).toEqual(['A', 'B']);
  chart.focus('A');
  for (const d of rulesOf(el)) {
    let at: HTMLElement | null = d;
    for (; at && at !== el; at = at.parentElement) expect(getComputedStyle(at).opacity).toBe('1');
  }

  const beaten = host();
  const high = [{ x: 80, y: 41, text: 'high', priority: 1 }];
  plot(beaten, { ...RULED, marks: [rule({ y: 5, color: BLUE, text: 'goal' }), labelled(high)] });
  const texts = labelsOf(beaten).map(d => d.textContent);
  expect(texts).toContain('high');
  expect(texts).not.toContain('goal');
});

test('a rule colour cannot add other styles to its line', () => {
  const el = host();
  plot(el, { ...RULED, marks: [rule({ y: 5, color: 'red;background:red' })] });
  expect(rulesOf(el)[0]!.style.background).toBe('');
});

test('a rule near the top or right edge of the plot keeps its text inside the plot', () => {
  const margin = { top: 30, right: 30, bottom: 10, left: 10 };
  const top = host();
  plot(top, { ...RULED, margin, marks: [rule({ y: 9.8, color: BLUE, text: 'goal' })] });
  const across = boxOf(top, rulesOf(top)[0]!);
  const goal = boxOf(
    top,
    labelsOf(top).find(d => d.textContent === 'goal')!,
  );
  expect(goal.top).toBeGreaterThanOrEqual(margin.top);
  expect(goal.top).toBeGreaterThanOrEqual(across.top);
  const right = host();
  plot(right, { ...RULED, margin, marks: [rule({ x: 9.5, color: BLUE, text: 'now' })] });
  const upright = boxOf(right, rulesOf(right)[0]!);
  const now = boxOf(
    right,
    labelsOf(right).find(d => d.textContent === 'now')!,
  );
  expect(now.left + now.width).toBeLessThanOrEqual(upright.left);
  expect(now.left).toBeGreaterThanOrEqual(margin.left);
});

test('a rule draws its text wholly inside the plot or not at all, in either direction', () => {
  const long = 'fourteen chars';
  const cases = [
    {
      width: 200,
      margin: { top: 10, right: 40, bottom: 10, left: 80 },
      mark: { y: 5 },
      text: long,
      shown: false,
    },
    {
      width: 200,
      margin: { top: 10, right: 40, bottom: 10, left: 80 },
      mark: { y: 5 },
      text: 'goal',
      shown: true,
    },
    { height: 30, mark: { y: 5 }, text: 'goal', shown: false },
    { height: 50, mark: { y: 9 }, text: 'goal', shown: true },
    { height: 30, mark: { x: 5 }, text: 'now', shown: false },
    { mark: { x: 5 }, text: long, shown: false },
    { mark: { x: 2 }, text: 'now', shown: true },
  ] as const;
  for (const c of cases) {
    const el = host();
    const [width, height] = ['width' in c ? c.width : 100, 'height' in c ? c.height : 100];
    const margin = 'margin' in c ? c.margin : ZONED.margin;
    plot(el, { ...RULED, width, height, margin, marks: [rule({ ...c.mark, color: BLUE, text: c.text })] });
    const label = labelsOf(el).find(d => d.textContent === c.text);
    expect(!!label, JSON.stringify(c)).toBe(c.shown);
    if (!label) continue;
    const box = boxOf(el, label);
    expect(box.left).toBeGreaterThanOrEqual(margin.left);
    expect(box.top).toBeGreaterThanOrEqual(margin.top);
    expect(box.left + box.width).toBeLessThanOrEqual(width - margin.right);
    expect(box.top + box.height).toBeLessThanOrEqual(height - margin.bottom);
  }
});

const LOG_FRAME = { ...frame, x: bare([0, 10]) } satisfies Partial<Options>;
/** The y tick labels and their heights, on a chart whose x axis is bare. */
const yTicksOf = (el: HTMLElement) =>
  [...el.firstElementChild!.querySelector(':scope > div')!.children]
    .filter(d => d.textContent)
    .map(d => ({ label: d.textContent!, top: parseFloat((d as HTMLElement).style.top) }));

test('a log column keeps its array type, turns zero, negatives and NaN into NaN, and comes back through from', () => {
  const y = log({ label: '' });
  const typed = y.col(new Float64Array([1, 100, 0, -5, NaN]));
  expect(typed).toBeInstanceOf(Float64Array);
  expect([...typed]).toEqual([0, 2, NaN, NaN, NaN]);
  const plain = y.col([1000, 0]);
  expect(Array.isArray(plain)).toBe(true);
  expect(plain).toEqual([3, NaN]);
  for (const base of [10, 2, Math.E, 3]) {
    const a = log({ label: '', base });
    for (const v of [1e-7, 0.3, 1, 7, 123.456, 1e12]) {
      expect(+a.from!(a.to!(v, a), a).toPrecision(12), `${base} ${v}`).toBe(+v.toPrecision(12));
    }
  }
});

test('a nice log axis ticks each power evenly, adds 2 and 5 with room to spare, keeps exact data ends, and checks its domain', () => {
  const y = log({ label: '' });
  const ticked = (height: number, axis = y, values = [1, 1000]) => {
    const el = host();
    plot(el, {
      ...LOG_FRAME,
      height,
      y: axis,
      marks: [line({ x: [0, 10], y: axis.col(values), color: RED })],
    });
    return yTicksOf(el);
  };
  const decades = ticked(100);
  expect(decades.map(t => t.label)).toEqual(['1', '10', '100', '1000']);
  const tops = decades.map(t => t.top);
  for (let i = 1; i < 3; i++) expect(tops[i]! - tops[i + 1]!).toBeCloseTo(tops[0]! - tops[1]!, 2);
  expect(ticked(400).map(t => t.label)).toEqual([
    '1',
    '2',
    '5',
    '10',
    '20',
    '50',
    '100',
    '200',
    '500',
    '1000',
  ]);
  const two = log({ label: '', base: 2 });
  expect(ticked(400, two).map(t => t.label)).toEqual([
    '1',
    '2',
    '4',
    '8',
    '16',
    '32',
    '64',
    '128',
    '256',
    '512',
    '1024',
  ]);
  const exact = log({ label: '', domain: 'data' });
  const { internals } = windowed({
    ...LOG_FRAME,
    y: exact,
    marks: [line({ x: [0, 10], y: exact.col([2, 300]), color: RED })],
  });
  expect(internals.view().y).toEqual([Math.log10(2), Math.log10(300)]);
  expect(() => log({ label: '', domain: [0, 10] })).toThrow(/bound 0\b/);
  expect(() => log({ label: '', domain: [1, -5] })).toThrow(/bound -5\b/);
  expect(log({ label: '', domain: [1, 100] }).domain).toEqual([0, 2]);
});

test('a line on a log axis breaks at a zero as it does at NaN', () => {
  const y = log({ label: '', domain: [1, 100] });
  const drawn = (values: number[]) => {
    const el = host();
    plot(el, {
      ...LOG_FRAME,
      x: bare([0, 4]),
      y,
      marks: [line({ x: [0, 1, 2, 3, 4], y: y.col(values), color: RED, width: 4 })],
    });
    return el;
  };
  const zero = drawn([3, 3, 0, 3, 3]);
  const gap = drawn([3, 3, NaN, 3, 3]);
  expect(pixel(zero, 12, 76)).toEqual([255, 0, 0, 255]);
  expect(pixel(zero, 50, 76)[3]).toBe(0);
  for (const x of [12, 30, 50, 70, 88]) expect(pixel(zero, x, 76)).toEqual(pixel(gap, x, 76));
});

test('on a log axis every value the app is given or gives is a real one', async () => {
  const y = log({ label: '', domain: [1, 10000] });
  const options = { ...LOG_FRAME, y } satisfies Partial<Options>;
  const dot = dots({ x: [5], y: y.col([100]), r: [3], color: RED, label: 'dot' });
  const text = vi.fn(() => '');
  hover(windowed({ ...options, marks: [dot], use: [tooltip({ mode: 'nearest', text })] }).el, 50, 50);
  expect(text).toHaveBeenCalledWith('dot', 5, 100, 0);

  const [title, value] = [vi.fn(() => ''), vi.fn(() => '')];
  const flatLine = line({ x: [0, 10], y: y.col([100, 100]), color: RED, label: 'l' });
  hover(windowed({ ...options, marks: [flatLine], use: [tooltip({ mode: 'x', title, value })] }).el, 50, 50);
  expect(title).toHaveBeenCalledWith(5);
  expect(value).toHaveBeenCalledWith(100);

  const onClick = vi.fn();
  const onPointerChange = vi.fn();
  const onViewChange = vi.fn();
  const { el, internals } = windowed({ ...options, marks: [dot], onClick, onPointerChange, onViewChange });
  click(el, 50, 50);
  const [hit, at] = onClick.mock.calls.at(-1)! as [{ y: number }, { y: number }];
  expect(hit.y).toBe(100);
  expect(at.y).toBeCloseTo(100, 9);
  hover(el, 50, 25);
  expect(onPointerChange.mock.calls.at(-1)![0].y).toBeCloseTo(1000, 9);
  internals.propose({ y: [1, 2] });
  expect(onViewChange.mock.calls.at(-1)![0].y).toEqual([10, 100]);

  const onSelect = vi.fn();
  const brushed = windowed({ ...options, use: [brush({ axes: 'y', onSelect })] });
  drag(brushed.el, [50, 25], [50, 50]);
  const picked = onSelect.mock.calls.at(-1)![0].y as number[];
  expect(picked[0]).toBeCloseTo(100, 9);
  expect(picked[1]).toBeCloseTo(1000, 9);

  const shown = windowed({ ...options, view: { y: [10, 100] }, pointer: { x: 5, y: 100 } });
  expect(shown.internals.view().y).toEqual([1, 2]);
  expect(yTicksOf(shown.el).map(t => t.label)).toEqual(['10', '20', '50', '100']);
  expect(shown.internals.pointer()).toEqual({ x: 50, y: 0 });
});

test('on a log axis a band reports the real distance between its edges, a y-only area and a stacked bar their own value', () => {
  const y = log({ label: '', domain: [1, 10000] });
  const options = { ...LOG_FRAME, y } satisfies Partial<Options>;
  const band = area({ x: [0, 10], y1: y.col([10, 10]), y2: y.col([100, 100]), color: RED, label: 'band' });
  const value = vi.fn<(y: number) => string>(() => '');
  hover(
    windowed({ ...options, marks: [band], use: [tooltip({ mode: 'x', title: String, value })] }).el,
    50,
    50,
  );
  expect(value.mock.calls.at(-1)![0]).toBeCloseTo(90, 9);
  const plain = area({ x: [0, 10], y: y.col([100, 100]), color: RED, label: 'plain' });
  hover(
    windowed({ ...options, marks: [plain], use: [tooltip({ mode: 'x', title: String, value })] }).el,
    50,
    50,
  );
  expect(value.mock.calls.at(-1)![0]).toBeCloseTo(100, 9);

  const stacked = bar({ x: [5], y: y.col([1000]), stack: 's', color: RED, label: 'bar' });
  const text = vi.fn<(label: string, x: number, y: number) => string>(() => '');
  hover(windowed({ ...options, marks: [stacked], use: [tooltip({ mode: 'nearest', text })] }).el, 50, 50);
  expect(text.mock.calls.at(-1)![2]).toBeCloseTo(1000, 9);
  const onClick = vi.fn();
  click(windowed({ ...options, marks: [stacked], onClick }).el, 50, 50);
  expect(onClick.mock.calls.at(-1)![0].value).toBeCloseTo(1000, 9);
});

test('a wheel zoom on a log axis keeps the real value under the pointer and stays inside the limits', async () => {
  const y = log({ label: '', domain: [1, 10000] });
  const { el, internals } = windowed({ ...LOG_FRAME, y, use: [zoom({ axes: 'y' })] });
  const under = internals.real('y', internals.yValue(30));
  wheel(el, 50, 30, -200, { ctrlKey: true });
  await nextFrame();
  const [lo, hi] = internals.view().y;
  expect(hi! - lo!).toBeLessThan(4);
  expect(internals.real('y', internals.yValue(30))).toBeCloseTo(under, 6);
  wheel(el, 50, 30, 100000, { ctrlKey: true });
  await nextFrame();
  expect(internals.view().y).toEqual([0, 4]);
  expect(internals.real('y', internals.view().y[0]!)).toBe(1);

  const inside = windowed({ ...LOG_FRAME, y, view: { y: [20, 50] } });
  expect(yTicksOf(inside.el).length).toBeGreaterThan(1);
  const [a, b] = inside.internals.view().y;
  expect([10 ** a!, 10 ** b!].map(v => +v.toPrecision(12))).toEqual([20, 50]);
});

test('an update with an equal log axis prepares and paints nothing', () => {
  let prepares = 0;
  const mark: Mark = {
    type: 'counted',
    color: RED,
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => (prepares++, { paint() {} }),
  };
  const { chart, whys } = windowed({ y: log({ label: 'Y' }), marks: [mark] });
  const paints = whys.length;
  chart.update({ y: log({ label: 'Y' }) });
  expect(prepares).toBe(1);
  expect(whys).toHaveLength(paints);
  chart.update({ y: log({ label: 'Y', base: 2 }) });
  expect(whys.length).toBeGreaterThan(paints);
});

test('nice log bounds enclose data tightly straddling a power, keep a span, and stop at a power that is the data', () => {
  for (const base of [10, 2, 3, Math.E]) {
    const y = log({ label: '', base });
    for (const [a, b] of [
      [9.999999999, 10.000000001],
      [base * (1 - 1e-15), base * (1 + 1e-15)],
    ]) {
      const [lo, hi] = y.col([a!, b!]);
      const r = y.scale!(y, () => [lo!, hi!]);
      expect(r.lo, `${base} ${a}`).toBeLessThanOrEqual(lo!);
      expect(r.hi, `${base} ${b}`).toBeGreaterThanOrEqual(hi!);
      expect(r.hi).toBeGreaterThan(r.lo);
    }
    const [lo, hi] = y.col([1, base ** 5]);
    expect(y.scale!(y, () => [lo!, hi!])).toMatchObject({ lo: 0, hi: 5 });
  }
});

test('a log axis with a base close to 1 spreads its ticks over a wide domain', () => {
  const y = log({ label: '', base: 1.001, domain: [1, 1e6] });
  const [lo, hi] = y.domain as [number, number];
  const ticks = y.scale!(y, () => [lo, hi], { length: 600, horizontal: true }).ticks;
  expect(ticks.length).toBeGreaterThan(1);
  expect(ticks[0]!.value).toBe(lo);
  expect(ticks.at(-1)!.value).toBeGreaterThan(lo + (hi - lo) * 0.75);
});

test('a log axis with a base close to 1 ends its ticks on a narrow window at a huge exponent', () => {
  const y = log({ label: '', base: 1 + Number.EPSILON, domain: [100, 100.000000000001] });
  const [lo, hi] = y.domain as [number, number];
  const ticks = y.scale!(y, () => [lo, hi], { length: 600, horizontal: true }).ticks;
  expect(ticks.length).toBeGreaterThan(0);
  expect(new Set(ticks.map(t => t.value)).size).toBe(ticks.length);
  for (const t of ticks) expect(t.value >= lo && t.value <= hi).toBe(true);
});

test('a window a gesture wrote on a log axis keeps its real values after a change of base', () => {
  const ten = log({ label: '', domain: [1, 1e6] });
  const { chart, internals } = windowed({ ...LOG_FRAME, y: ten });
  internals.propose({ y: [1, 2] });
  expect(internals.view().y).toEqual([1, 2]);
  chart.update({ y: log({ label: '', base: 2, domain: [1, 1e6] }) });
  const [a, b] = internals.view().y.map(v => internals.real('y', v));
  expect(a).toBeCloseTo(10, 9);
  expect(b).toBeCloseTo(100, 9);
});

test("a custom mark's sample on a linear axis shows its own value", () => {
  const mark: Mark = {
    type: 'custom',
    color: RED,
    label: 'c',
    options: {},
    points: 0,
    channels: { x: [], y: [] },
    prepare: () => ({ paint() {} }),
    sampleAtX: () => ({ value: 2, y1: 10, y2: 12 }),
  };
  const value = vi.fn<(y: number) => string>(() => '');
  hover(
    windowed({
      y: { domain: [0, 20], label: '' },
      marks: [mark],
      use: [tooltip({ mode: 'x', title: String, value })],
    }).el,
    50,
    50,
  );
  expect(value).toHaveBeenLastCalledWith(2);
});

test('a pointer given at creation shows its tooltip on a chart of fixed size, before any update', () => {
  const el = host();
  plot(el, { ...frame, marks: twoLines(), pointer: { x: 3 }, use: [xTip()] });
  expect((el.firstElementChild as HTMLElement).innerText).toContain('x=3');
  expect(crossOf(el).style.display).toBe('');
});

test.each([1, 2, 12])(
  "fit: 'window' counts a heatmap of %i cells by its bounds where it reaches into the x window",
  cells => {
    const heat = heatmap({ values: days(cells, i => i), columns: cells, x: [0, 10], y: [100, 200] });
    const dot = dots({ x: [3, 15], y: [150, 500], r: [3, 3], color: RED });
    const fitted = (x: [number, number], marks: Mark[]) =>
      windowed({ x: { domain: [0, 20], label: '' }, y: fitY, view: { x }, marks }).internals.view().y;
    expect(fitted([1, 5], [heat, dot])).toEqual([100, 200]);
    expect(fitted([1, 5], [heat])).toEqual([100, 200]);
    expect(fitted([12, 18], [heat, dot])).toEqual(fitted([12, 18], [dot]));
  },
);

test('a window in real values on a log axis of base below 1 is shown in either order, on x and y', () => {
  for (const k of ['x', 'y'] as const) {
    const auto = log({ label: '', base: 0.1 });
    const given = log({ label: '', base: 0.1, domain: [1, 100] });
    const ten = log({ label: '', domain: [1, 100] });
    const shown = (axis: typeof auto, view: [number, number]) => {
      const logged = axis.col([1, 100]);
      const marks = [
        line({ ...(k === 'x' ? { x: logged, y: [0, 1] } : { x: [0, 10], y: logged }), color: RED }),
      ];
      const { internals } = windowed({ [k]: axis, marks, view: { [k]: view } });
      return internals.view()[k].map(v => +v.toFixed(9));
    };
    expect(shown(auto, [10, 100]), k).toEqual([-2, -1]);
    expect(shown(auto, [100, 10]), k).toEqual([-2, -1]);
    expect(shown(given, [10, 100]), k).toEqual([-1, -2]);
    expect(shown(given, [100, 10]), k).toEqual([-1, -2]);
    expect(shown(ten, [10, 100]), k).toEqual([1, 2]);
    expect(shown(ten, [100, 10]), k).toEqual([0, 2]);
  }
  const onViewChange = vi.fn();
  const y = log({ label: '', base: 0.1 });
  const { chart, internals } = windowed({
    ...LOG_FRAME,
    y,
    marks: [line({ x: [0, 10], y: y.col([1, 100]), color: RED })],
    onViewChange,
  });
  internals.propose({ y: [-2, -1] });
  const reported = onViewChange.mock.lastCall![0].y as [number, number];
  expect(reported.map(v => +v.toPrecision(12))).toEqual([100, 10]);
  chart.update({ view: { y: [...reported] } });
  expect(internals.view().y.map(v => +v.toFixed(9))).toEqual([-2, -1]);
});

test.each([
  [0.1, [1, 100], ['1', '10', '100']],
  [0.5, [1, 1024], ['1', '2', '4', '8', '16', '32', '64', '128', '256', '512', '1024']],
  [10, [1000, 1], ['1', '10', '100', '1000']],
] as const)(
  'a log axis of base %s over %j, descending in log space, has one tick per power',
  (base, domain, labels) => {
    const y = log({ label: '', base, domain: [...domain] });
    const ticks = y.scale!(y, () => [0, 1]).ticks.map(t => t.label);
    expect(ticks.sort((a, b) => +a - +b)).toEqual(labels);
  },
);

test('a fitted window of a log axis of base below 1 has one tick per power', () => {
  const y = log({ label: '', base: 0.1, domain: [1, 10000] });
  const { el } = windowed({
    ...LOG_FRAME,
    height: 300,
    y,
    view: { y: [10, 1000] },
    marks: [line({ x: [0, 10], y: y.col([1, 10000]), color: RED })],
  });
  expect(
    yTicksOf(el)
      .map(t => t.label)
      .sort((a, b) => +a - +b),
  ).toEqual(['10', '100', '1000']);
});

test('a window of a log axis of base below 1 inside one power of the base still has ticks', () => {
  const y = log({ label: '', base: 0.1, domain: [5, 2] });
  expect(y.scale!(y, () => [0, 1]).ticks.map(t => t.label)).toContain('3');
});

test('a log x of base below 1 widens its right margin to fit the label at its right edge', () => {
  const el = host();
  let chart!: Internals;
  const x = log({ label: '', base: 0.1, domain: [1, 1000], format: v => `${v.toFixed(6)} kg` });
  plot(el, {
    ...frame,
    width: 400,
    height: 300,
    margin: undefined,
    x,
    marks: [],
    use: [c => ((chart = c), { destroy() {} })],
  });
  const last = '1000.000000 kg';
  expect(chart.xPx(-3) + last.length * 3.5).toBeLessThanOrEqual(400);
  const root = el.firstElementChild!.getBoundingClientRect();
  expect(textOf(el, last).getBoundingClientRect().right).toBeLessThanOrEqual(root.left + 400);
});

test('a log axis inside one power of the base spreads its ticks over the axis without overlap', () => {
  const y = log({ label: '', domain: [2, 90] });
  const { lo, hi, ticks } = y.scale!(y, () => [0, 1], { length: 100, horizontal: false });
  const at = ticks.map(t => ((t.value - lo) / (hi - lo)) * 100);
  expect(at[0]).toBeLessThanOrEqual(25);
  expect(at.at(-1)).toBeGreaterThanOrEqual(75);
  for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(22);
});

test('a legend toggle after an update that dropped a mark still moves the restacked bars', () => {
  const layer = (label: string) => bar({ x: [0, 1], y: [1, 1], stack: 's', color: RED, label });
  const moves = (drop: boolean) => {
    const [a, b, c] = [layer('A'), layer('B'), dots({ x: [5], y: [0.5], r: [3], color: RED, label: 'C' })];
    const { chart, internals } = windowed({ y: { domain: [0, 3], label: '' }, marks: [a, b, c] });
    if (drop) chart.update({ marks: [a, b] });
    internals.hide(['A']);
    return internals.morph(0.5);
  };
  expect(moves(false)).toBe(true);
  expect(moves(true)).toBe(true);
});

test('a click on a polar or a blank frame calls onClick with the slice under it, and none in the margin', () => {
  for (const f of ['polar', 'blank'] as const) {
    const onClick = vi.fn();
    const slice = arcs({ values: [1], colors: [RED] });
    const { el } = windowed({
      frame: f,
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      marks: [slice],
      onClick,
    });
    click(el, 50, 50);
    click(el, 5, 50);
    expect(
      onClick.mock.calls.map(([hit]) => hit?.mark),
      f,
    ).toEqual([slice]);
  }
});

test.each(['down', 'right'] as const)(
  'a %s gradient on bars with values at or below zero on a log axis leaves gaps and draws the rest',
  toward => {
    const ax = log({ label: '', domain: [1, 100] });
    const [lows, highs] = [ax.col([0, 1, 0, 1]), ax.col([10, 0, -1, 10])];
    const [from, to] = [
      [0, 2, 4, 6],
      [1, 3, 5, 7],
    ];
    const upright = toward === 'down';
    const fill = gradient(RED, BLUE, toward);
    const marks = [
      bar(
        upright
          ? { x1: from, x2: to, y1: lows, y2: highs, fill, color: RED, label: 'a' }
          : { x1: lows, x2: highs, y1: from, y2: to, fill, color: RED, label: 'a' },
      ),
    ];
    const { el, internals } = windowed({
      dim: 0.3,
      ...(upright ? { y: ax } : { x: ax, y: { domain: [0, 10], label: '' } }),
      marks,
      selected: [{ id: 'a', rows: [0, 1, 2, 3] }],
    });
    const [drawn, gap] = upright
      ? [
          [65, 75],
          [5, 75],
        ]
      : [
          [25, 35],
          [25, 95],
        ];
    expect(pixel(el, drawn[0]!, drawn[1]!)[3]).toBe(255);
    expect(pixel(el, gap[0]!, gap[1]!)[3]).toBe(0);
    internals.focus(null, { mark: internals.marks()[0]!, row: 3 });
    expect(pixel(el, drawn[0]!, drawn[1]!)[3]).toBe(255);
  },
);

test('a step or a time unit too fine for the span gives way to the automatic ticks, and one just fine enough is kept', () => {
  const room = { length: 300, horizontal: true };
  const fine = scale([0, 989], [0, 1], room, { step: 1 });
  expect(fine.ticks).not.toEqual(scale([0, 989], [0, 1], room).ticks);
  expect(fine.ticks.at(-1)).toBeGreaterThan(800);
  for (const hi of [990, 5000])
    expect(scale([0, hi], [0, 1], room, { step: 1 }), String(hi)).toEqual(scale([0, hi], [0, 1], room));

  const lo = Date.UTC(2026, 0, 1);
  const ticks = (axis: ReturnType<typeof time>, s: number) =>
    axis.scale!(axis, () => [lo, lo + s], { length: 600, horizontal: true }).ticks;
  const auto = time({ label: '' });
  const seconds = time({ label: '', unit: 'second' });
  const kept = ticks(seconds, 989e3);
  expect(kept).not.toEqual(ticks(auto, 989e3));
  expect(kept.every(t => (t.value - lo) % 1e3 === 0)).toBe(true);
  expect(kept.at(-1)!.value - lo).toBeGreaterThanOrEqual(900e3);
  expect(ticks(seconds, 990e3)).toEqual(ticks(auto, 990e3));
  const fives = time({ label: '', unit: 'minute', every: 5 });
  expect(ticks(fives, 4950 * 6e4)).toEqual(ticks(auto, 4950 * 6e4));
  // @ts-expect-error every is read only with a unit
  time({ label: '', every: 3 });
});

test('time() and log() pass fit on to the axis, so a time x holds still and a log y fits the window', () => {
  const series = (label: string, to: number) => line({ x: [0, to], y: [0.5, 0.5], color: RED, label });
  for (const fit of ['all', undefined] as const) {
    const { internals } = windowed({
      x: time({ label: '', fit }),
      marks: [series('A', 10), series('B', 20)],
      hidden: ['B'],
    });
    expect(internals.view().x, String(fit)).toEqual(fit ? [0, 20] : [0, 10]);
  }
  for (const fit of ['window', undefined] as const) {
    const y = log({ label: '', domain: 'data', fit });
    const { internals } = windowed({
      x: { domain: [0, 20], label: '' },
      y,
      view: { x: [0, 5] },
      marks: [line({ x: [0, 10, 20], y: y.col([1, 10, 100]), color: RED })],
    });
    const [a, b] = internals.view().y;
    expect(a, String(fit)).toBeCloseTo(0, 9);
    expect(b, String(fit)).toBeCloseTo(fit ? 0.5 : 2, 9);
  }
});

test('log().col() types a readonly or Col-typed array by what it may return', () => {
  const y = log({ label: '' });
  const fixed: readonly number[] = [1, 10];
  const held: Col = [1, 10];
  expectTypeOf(y.col(fixed)).toEqualTypeOf<number[]>();
  expectTypeOf(y.col(new Float64Array(2))).toEqualTypeOf<Float64Array>();
  expectTypeOf(y.col(held)).toEqualTypeOf<number[] | Float64Array>();
  expect(y.col(fixed)).toEqual([0, 1]);
  expect(Array.isArray(y.col(held))).toBe(true);
  expect(y.col({ length: 1, 0: 100 })).toBeInstanceOf(Float64Array);
});
