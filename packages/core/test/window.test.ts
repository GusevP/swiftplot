import { afterEach, expect, test, vi } from 'vitest';

import { animate, brush, dark, legend, line, plot, tooltip, zoom } from '../src/index.js';
import type { Feature, Internals, Options } from '../src/index.js';
import { lineChart } from '../src/charts/index.js';
import { other } from './helpers.js';

type View = Window & typeof globalThis;

const frame = {
  width: 100,
  height: 100,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  x: { domain: [0, 10], label: '' },
  y: { domain: [0, 1], label: '' },
} satisfies Partial<Options>;
const flat = (color = '#ff0000', label?: string) =>
  line({ x: [0, 10], y: [0.5, 0.5], curve: 'step', color, width: 4, label });

afterEach(() => vi.restoreAllMocks());

const grab = (): [Feature, () => Internals] => {
  let internals!: Internals;
  return [c => ((internals = c), { destroy() {} }), () => internals];
};

/** A mouse event of the iframe's window at the CSS pixel (x, y) of the chart in el. */
function fire(
  view: View,
  target: EventTarget,
  el: HTMLElement,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {},
) {
  const box = el.firstElementChild!.getBoundingClientRect();
  const e = new view.PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: box.left + x,
    clientY: box.top + y,
    pointerType: 'mouse',
    pointerId: 1,
    ...init,
  });
  target.dispatchEvent(e);
}

const frameOf = (view: View) => new Promise(r => view.requestAnimationFrame(r));
const adopted = (spy: { mock: { results: { value: unknown }[] } }, doc: Document) =>
  spy.mock.results.filter(r => (r.value as Node | undefined)?.ownerDocument === doc).length;

test("a chart in another window creates its nodes and reads its styles through that window's document", async () => {
  const { view, doc, el } = await other();
  el.style.setProperty('--ink', '#ff0000');
  const made = vi.spyOn(document, 'createElement');
  const fragments = vi.spyOn(document, 'createDocumentFragment');
  const styled = vi.spyOn(window, 'getComputedStyle');
  const own = vi.spyOn(doc, 'createElement');
  const [feature, internals] = grab();
  const chart = plot(el, {
    width: 100,
    height: 100,
    x: { domain: [0, 10], label: 'x' },
    y: { domain: [0, 1], label: 'y' },
    marks: [flat('var(--ink)')],
    use: [feature],
  });
  expect(adopted(made, doc)).toBe(0);
  expect(fragments).not.toHaveBeenCalled();
  expect(styled.mock.calls.filter(([e]) => e.ownerDocument === doc)).toEqual([]);
  expect(own).toHaveBeenCalled();
  const c = internals();
  const dpr = view.devicePixelRatio;
  const px = c.canvas.getContext('2d')!.getImageData(c.xPx(5) * dpr, c.yPx(0.5) * dpr, 1, 1).data;
  expect([...px]).toEqual([255, 0, 0, 255]);
  chart.destroy();
});

test('a zoom drag started in another window ends on a release there, and later moves pan nothing', async () => {
  const { view, doc, el } = await other();
  const [feature, internals] = grab();
  const chart = plot(el, { ...frame, view: { x: [2, 4] }, marks: [], use: [zoom(), feature] });
  const root = el.firstElementChild!;
  fire(view, root, el, 'pointerdown', 50, 50, { button: 0 });
  fire(view, doc.body, el, 'pointermove', 40, 50);
  fire(view, doc.body, el, 'pointermove', 30, 50);
  await frameOf(view);
  const panned = internals().view().x;
  expect(panned[0]).toBeCloseTo(2.4);
  fire(view, doc.body, el, 'pointerup', 30, 50);
  fire(view, doc.body, el, 'pointermove', 10, 50);
  await frameOf(view);
  expect(internals().view().x).toEqual(panned);
  chart.destroy();
});

test('a brush drag started in another window ends on a release there, and later moves change nothing', async () => {
  const { view, doc, el } = await other();
  const onSelect = vi.fn();
  const chart = plot(el, { ...frame, marks: [], use: [brush({ onSelect })] });
  const root = el.firstElementChild!;
  const shade = [...root.querySelectorAll('div')].find(d => d.style.opacity === '0.2')!;
  fire(view, root, el, 'pointerdown', 20, 50, { button: 0 });
  fire(view, doc.body, el, 'pointermove', 40, 50);
  fire(view, doc.body, el, 'pointerup', 60, 50);
  expect(onSelect).toHaveBeenCalledTimes(1);
  const [{ x }] = onSelect.mock.calls[0]!;
  expect(x[0]).toBeCloseTo(2);
  expect(x[1]).toBeCloseTo(6);
  const box = shade.style.cssText;
  fire(view, doc.body, el, 'pointermove', 90, 50);
  fire(view, doc.body, el, 'pointerup', 90, 50);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(shade.style.cssText).toBe(box);
  chart.destroy();
});

test("in another window a press on an overlay child keeps only its own pointer's click from onClick", async () => {
  const { view, doc, el } = await other();
  const onClick = vi.fn();
  const chart = plot(el, { ...frame, marks: [], onClick });
  const child = chart.overlay.appendChild(doc.createElement('div'));
  child.style.cssText = 'position:absolute;left:50px;top:50px;width:20px;height:20px;pointer-events:auto';
  const root = el.firstElementChild!;
  fire(view, child, el, 'pointerdown', 60, 60, { pointerId: 2, buttons: 1 });
  fire(view, root, el, 'click', 20, 20);
  expect(onClick).toHaveBeenCalledTimes(1);
  const box = root.getBoundingClientRect();
  root.dispatchEvent(
    new view.MouseEvent('click', { bubbles: true, clientX: box.left + 20, clientY: box.top + 20 }),
  );
  expect(onClick).toHaveBeenCalledTimes(1);
  chart.destroy();
});

test("with animate, frames and media queries are asked of the element's window", async () => {
  const { view, el } = await other();
  const [feature, internals] = grab();
  const ours = vi.spyOn(view, 'requestAnimationFrame');
  const theirs = vi.spyOn(window, 'requestAnimationFrame');
  const ourMedia = vi.spyOn(view, 'matchMedia');
  const theirMedia = vi.spyOn(window, 'matchMedia');
  const chart = plot(el, { ...frame, marks: [flat()], use: [feature, animate({ duration: 100 })] });
  const morph = vi.spyOn(internals(), 'morph');
  expect(theirs).not.toHaveBeenCalled();
  expect(theirMedia).not.toHaveBeenCalled();
  expect(ours).toHaveBeenCalledTimes(1);
  expect(ourMedia.mock.calls.map(c => c[0])).toEqual(
    expect.arrayContaining(['(prefers-reduced-motion: reduce)', expect.stringMatching(/^\(resolution: /)]),
  );
  const end = view.performance.now() + 100 + 100;
  while (!morph.mock.calls.length && view.performance.now() < end) await frameOf(view);
  expect(morph).toHaveBeenCalledWith(1);
  chart.destroy();
});

test("resizing another window's frame resizes the chart, through that window's ResizeObserver", async () => {
  const { iframe, view, el } = await other();
  const made: string[] = [];
  const [Ours, Theirs] = [view.ResizeObserver, window.ResizeObserver];
  view.ResizeObserver = class extends Ours {
    constructor(f: ResizeObserverCallback) {
      super(f);
      made.push('ours');
    }
  };
  window.ResizeObserver = class extends Theirs {
    constructor(f: ResizeObserverCallback) {
      super(f);
      made.push('theirs');
    }
  };
  try {
    const { width: _w, height: _h, ...unsized } = frame;
    const chart = plot(el, { ...unsized, marks: [], use: [legend()] });
    const canvas = el.querySelector('canvas')!;
    expect(canvas.style.width).toBe('200px');
    iframe.style.width = '300px';
    for (let i = 0; i < 10 && canvas.style.width !== '300px'; i++) await frameOf(view);
    expect(canvas.style.width).toBe('300px');
    expect(made).toEqual(['ours', 'ours']);
    chart.destroy();
  } finally {
    view.ResizeObserver = Ours;
    window.ResizeObserver = Theirs;
  }
});

test("a tooltip and a legend in another window create their elements through that window's document", async () => {
  const { view, doc, el } = await other();
  const made = vi.spyOn(document, 'createElement');
  const own = vi.spyOn(doc, 'createElement');
  const chart = plot(el, {
    ...frame,
    marks: [flat('#ff0000', 'A')],
    use: [tooltip({ mode: 'x', title: String, value: String }), legend()],
  });
  const root = el.firstElementChild!;
  fire(view, root, el, 'pointermove', 50, 70);
  expect(root.textContent).toContain('A: 0.5');
  expect(adopted(made, doc)).toBe(0);
  const tags = own.mock.results.map(r => (r.value as Element).tagName);
  expect(tags).toEqual(expect.arrayContaining(['SPAN', 'DIV']));
  chart.destroy();
});

test("destroy() removes every listener it added to another window's document and window, and leaves this one's alone", async () => {
  const { view, doc, el } = await other();
  const watch = (t: EventTarget) => ({
    add: vi.spyOn(t, 'addEventListener'),
    remove: vi.spyOn(t, 'removeEventListener'),
  });
  const [ourDoc, ourView, theirDoc, theirView] = [watch(doc), watch(view), watch(document), watch(window)];
  const chart = plot(el, {
    ...frame,
    marks: [flat('#ff0000', 'A')],
    use: [tooltip({ mode: 'x', title: String, value: String }), legend(), zoom(), brush()],
  });
  const root = el.firstElementChild!;
  fire(view, root, el, 'pointerdown', 20, 50, { button: 0 });
  fire(view, root, el, 'pointerdown', 30, 50, { button: 0, shiftKey: true, pointerId: 2 });
  fire(view, doc.body, el, 'pointermove', 40, 50);
  chart.destroy();
  const capture = (o: unknown) =>
    typeof o === 'boolean' ? o : !!(o as EventListenerOptions | undefined)?.capture;
  for (const { add, remove } of [ourDoc, ourView]) {
    const removed = ([type, f, o]: unknown[]) =>
      remove.mock.calls.some(([t, g, p]) => t === type && g === f && capture(p) === capture(o));
    expect(add.mock.calls.filter(c => !removed(c))).toEqual([]);
  }
  expect(ourDoc.add.mock.calls.length).toBeGreaterThanOrEqual(4);
  const chartLike = ([type, , o]: unknown[]) =>
    /^(pointer\w+|keydown|selectstart)$/.test(String(type)) && capture(o);
  for (const { add, remove } of [theirDoc, theirView]) {
    expect([...add.mock.calls, ...remove.mock.calls].filter(chartLike)).toEqual([]);
  }
});

test('an easy chart in another window takes its colour scheme from that window', async () => {
  const { view, doc, el } = await other();
  doc.documentElement.style.colorScheme = 'light dark';
  const query = '(prefers-color-scheme: dark)';
  const real = view.matchMedia.bind(view);
  // Chromium does not pass an iframe element's color-scheme on to its document's prefers-color-scheme.
  const ours = vi.spyOn(view, 'matchMedia').mockImplementation(q => {
    const list = real(q);
    return q === query ? Object.defineProperty(list, 'matches', { value: true }) : list;
  });
  const theirs = vi.spyOn(window, 'matchMedia');
  const chart = lineChart(el, {
    data: [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ],
  });
  expect(ours).toHaveBeenCalledWith(query);
  expect(theirs).not.toHaveBeenCalled();
  const axes = [...el.querySelectorAll('div')].find(d => d.ariaHidden === 'true')!;
  const probe = doc.createElement('i');
  probe.style.color = dark.text;
  expect(axes.style.color).toBe(probe.style.color);
  chart.destroy();
});
