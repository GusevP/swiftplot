import { afterEach, expect, test } from 'vitest';

import { dots, line, plot, tooltip } from '../src/index.js';
import type { Internals, Mark, Options } from '../src/index.js';
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
  root.dispatchEvent(new MouseEvent('mousemove', { clientX: box.left + x, clientY: box.top + y }));
  return root;
}

const flat = (y: number) => line({ x: [0, 10], y: [y, y], curve: 'step', color: RED, width: 4 });
const pile = (n: number, color = RED) =>
  dots({
    x: new Float64Array(n).fill(5),
    y: new Float64Array(n).fill(0.5),
    r: new Float64Array(n).fill(3),
    color,
  });

afterEach(() => document.body.replaceChildren());

test('columns keeps the min, max and last y of each pixel column', () => {
  const c = columns([0, 0.1, 0.2, 5], [1, 9, 4, 2], 0, 1, 10, 1);
  expect(c.n).toBe(2);
  expect([...c.col.subarray(0, 2)]).toEqual([0, 5]);
  expect([...c.lo.subarray(0, 2)]).toEqual([1, 8]);
  expect([...c.hi.subarray(0, 2)]).toEqual([9, 8]);
  expect([...c.last.subarray(0, 2)]).toEqual([6, 8]);
});

test('a nice domain widens to whole steps and an explicit one is kept', () => {
  expect(scale('nice', [[3, 97]])).toEqual({
    lo: 0,
    hi: 100,
    ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  });
  expect(scale([0, 1], [[5, 50]])).toEqual({
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
  expect(scale('nice', [[5, 5]])).toEqual({
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
  const chart = plot(el, { ...frame, x: { domain: [0.1, 9.9], label: '' }, marks: [] });
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
  root.dispatchEvent(new MouseEvent('mouseleave'));
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
  root.dispatchEvent(new MouseEvent('mouseleave'));
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
