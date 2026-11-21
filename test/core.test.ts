import { afterEach, expect, test, vi } from 'vitest';

import {
  animate,
  arcs,
  area,
  band,
  bands,
  bare,
  brand,
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
  line,
  plot,
  radar,
  radialBars,
  sankey,
  sequential,
  stack,
  sunburst,
  time,
  tooltip,
  treemap,
} from '../src/index.js';
import type { Axis, Internals, Mark, Options } from '../src/index.js';
import { columns } from '../src/marks/common.js';
import { scale } from '../src/scale.js';

const RED = '#ff0000';
const frame = {
  width: 100,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  x: { domain: [0, 10], label: '' },
  y: { domain: [0, 1], label: '' },
} satisfies Partial<Options>;

function host() {
  return document.body.appendChild(document.createElement('div'));
}

/** RGBA of the CSS pixel (x, y) of the nth canvas. A WebGL canvas must be read in the task that drew it. */
function pixel(el: HTMLElement, x: number, y: number, nth = 0) {
  const source = el.querySelectorAll('canvas')[nth]!;
  const copy = document.createElement('canvas').getContext('2d')!;
  copy.drawImage(source, x * devicePixelRatio, y * devicePixelRatio, 1, 1, 0, 0, 1, 1);
  return [...copy.getImageData(0, 0, 1, 1).data];
}

function hover(el: HTMLElement, x: number, y: number) {
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  root.dispatchEvent(
    new PointerEvent('pointermove', { pointerType: 'mouse', clientX: box.left + x, clientY: box.top + y }),
  );
  return root;
}

/** What a finger lifted from target sends: the leave reaches every element it was over. */
function touch(target: Element, clientX = 0, clientY = 0) {
  const init = { bubbles: true, composed: true, pointerType: 'touch', clientX, clientY };
  target.dispatchEvent(new PointerEvent('pointerdown', init));
  target.dispatchEvent(new PointerEvent('pointerup', init));
  for (let e: Element | null = target; e; e = e.parentElement) {
    e.dispatchEvent(new PointerEvent('pointerleave', { ...init, bubbles: false }));
  }
}

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
    [0, 2, 3],
    [2, 4, 2],
    [4, 5, 1],
  ]);
  expect([...c.col.subarray(0, 5)]).toEqual([0, 1, 1, 2, 4]);
  expect([...c.lo.subarray(0, 5)]).toEqual([1, 5, 3, 7, 8]);
  expect([...c.hi.subarray(0, 5)]).toEqual([6, 5, 3, 7, 8]);
  expect([...c.first.subarray(0, 5)]).toEqual([1, 5, 3, 7, 8]);
  expect([...c.last.subarray(0, 5)]).toEqual([6, 5, 3, 7, 8]);
  expect(columns([0, 1, 2], [1, 1, 1], 0, 1, 10, 1, false, [0, NaN, 0]).runs).toEqual([
    [0, 1, 1],
    [1, 2, 1],
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
  const { width: _w, height: _h, ...rest } = frame;
  plot(el, { ...rest, marks: [flat(0.5)] });
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
  const { width: _w, height: _h, ...rest } = frame;
  const chart = plot(el, { ...rest, marks: [flat(0.5)] });
  const canvas = el.querySelector('canvas')!;
  const sizes: string[] = [];
  for (let i = 0; i < 3; i++) {
    await new Promise(requestAnimationFrame);
    sizes.push(`${canvas.style.width}x${canvas.style.height}`);
  }
  return { outer, el, canvas, chart, sizes };
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
  const { width: _w, height: _h, ...rest } = frame;
  let chart!: Internals;
  plot(el, { ...rest, margin: undefined, marks: [flat(0.5)], use: [c => ((chart = c), { destroy() {} })] });
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
  const { width: _w, height: _h, ...rest } = frame;
  let chart!: Internals;
  plot(el, {
    ...rest,
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

test('a tapped tooltip stays after the finger lifts, until the touch is cancelled or the page is tapped elsewhere', () => {
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
    plot(el, { ...frame, marks, use: [tip] });
    const root = el.firstElementChild as HTMLElement;
    const box = root.getBoundingClientRect();
    const tap = () => touch(root, box.left + at[0]!, box.top + at[1]!);
    tap();
    expect(root.innerText).toContain(text);
    root.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch' }));
    expect(root.innerText).not.toContain(text);
    tap();
    expect(root.innerText).toContain(text);
    const control = host();
    control.addEventListener('pointerdown', e => e.stopPropagation());
    control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    expect(root.innerText).not.toContain(text);
  }
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
    'Feb 29',
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
  expect(weeks.ticks.map(t => t.label)).toEqual(['Jan 22', 'Jan 29', 'Feb 1', 'Feb 8', 'Feb 15']);
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

test('one legend label longer than the chart is cut at its edge, on one row', () => {
  const el = host();
  let chart!: Internals;
  plot(el, {
    ...frame,
    width: 400,
    height: 300,
    marks: [line({ x: [0, 10], y: [0.5, 0.5], color: RED, label: 'x'.repeat(80) })],
    use: [legend(), c => ((chart = c), { destroy() {} })],
  });
  expect(chart.margin().top).toBe(24);
  const root = el.firstElementChild!.getBoundingClientRect();
  const item = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const row = item.parentElement!;
  expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(root.left + 400);
  expect(item.getBoundingClientRect().right).toBeGreaterThan(root.left + 400);
  expect(getComputedStyle(row).overflow).toBe('hidden');
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

test('a tapped legend entry keeps its series highlighted after the finger lifts, until the page is tapped elsewhere', () => {
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
    use: [legend(), c => ((internals = c), { destroy() {} })],
  });
  const first = [...el.querySelectorAll('span')].find(s => s.children.length)!;
  const spot = first.getBoundingClientRect();
  touch(first, spot.left + spot.width / 2, spot.top + spot.height / 2);
  expect(pixel(el, 150, internals.yPx(0.75))[3]).toBeLessThan(100);
  expect(pixel(el, 150, internals.yPx(0.25))).toEqual([255, 0, 0, 255]);
  const control = host();
  control.addEventListener('pointerdown', e => e.stopPropagation());
  control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  expect(pixel(el, 150, internals.yPx(0.75))).toEqual([255, 0, 0, 255]);
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
  'in a %s shadow root a tapped tooltip and legend entry stay after the finger lifts and a resize',
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
        legend(),
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
    expect(pixel(el, 150, internals.yPx(0.25))[3]).toBeLessThan(100);
  },
);

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
  expect(days.scale!(days, () => span, { length: 200, horizontal: true }).ticks.map(t => t.label)).toEqual([
    'Jan 1',
    'Jan 8',
  ]);

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
    plot(tall, { ...frame, width: 200, height: 220, marks: [0, 1, 2, 3, 4].map(named), use });
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
