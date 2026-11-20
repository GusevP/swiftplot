import { afterEach, expect, test } from 'vitest';

import { area, band, bar, bin, dots, line, plot, stack, time, tooltip } from '../src/index.js';
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
  expect([...columns([0, 0.1, 0.2, 5], [1, 9, 4, 2], 0, 1, 10, 1, true).first.subarray(0, 2)]).toEqual([
    9, 8,
  ]);
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
  expect(scale('data', [[3, 97]])).toEqual({ lo: 3, hi: 97, ticks: [10, 20, 30, 40, 50, 60, 70, 80, 90] });
});

test('time ticks fall on calendar boundaries and name the day at midnight', () => {
  const axis = time({ label: '' });
  const hours = axis.scale!(axis, [[Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)]]);
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

  const months = axis.scale!(axis, [[Date.UTC(2025, 10, 15), Date.UTC(2026, 3, 15)]]);
  expect(months.ticks.map(t => t.label)).toEqual(['Dec', '2026', 'Feb', 'Mar', 'Apr']);
  expect(months.ticks.map(t => t.value)).toEqual([11, 12, 13, 14, 15].map(m => Date.UTC(2025, m, 1)));

  const years = axis.scale!(axis, [[Date.UTC(2023, 5, 1), Date.UTC(2029, 5, 1)]]);
  expect(years.ticks.map(t => t.label)).toEqual(['2024', '2025', '2026', '2027', '2028', '2029']);
  expect(years.ticks.map(t => t.value)).toEqual(
    [2024, 2025, 2026, 2027, 2028, 2029].map(y => Date.UTC(y, 0, 1)),
  );

  const leap = axis.scale!(axis, [[Date.UTC(2024, 1, 20), Date.UTC(2024, 2, 5)]]);
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
  const year50 = axis.scale!(axis, [[early.getTime(), early.getTime() + 90 * 864e5]]);
  expect(year50.ticks.map(t => t.label)).toEqual(['Feb', 'Mar', 'Apr']);
  expect(new Date(year50.ticks[0]!.value).getUTCFullYear()).toBe(50);

  const weeks = axis.scale!(axis, [[Date.UTC(2026, 0, 20), Date.UTC(2026, 1, 20)]]);
  expect(weeks.ticks.map(t => t.label)).toEqual(['Jan 22', 'Jan 29', 'Feb 1', 'Feb 8', 'Feb 15']);
});

// The test browser runs in America/New_York (vitest.config.ts), where clocks went back on 2024-11-03 at 06:00 UTC.
test('local time ticks keep both occurrences of the hour a clock change repeats', () => {
  const axis = time({ label: '', utc: false });
  const { ticks } = axis.scale!(axis, [[Date.UTC(2024, 10, 3, 5, 10), Date.UTC(2024, 10, 3, 6, 40)]]);
  expect(ticks.map(t => t.label)).toEqual(['01:15', '01:30', '01:45', '01:00', '01:15', '01:30']);
});

test('local time ticks sit on local clock hours', () => {
  const axis = time({ label: '', utc: false });
  const { ticks } = axis.scale!(axis, [[Date.UTC(2026, 0, 1, 1, 20), Date.UTC(2026, 0, 2, 1, 20)]]);
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
  const scale: Options['x']['scale'] = axis => ({
    lo: 0,
    hi: 1,
    ticks: [{ value: 0.5, label: `tick of ${axis.label}` }],
  });
  const x = (label: string): Options['x'] => ({ domain: [0, 1], label, scale });
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
