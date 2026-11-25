import { act, Component, createElement as h, createRef, StrictMode, useState, type ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { arcs, legend, type Feature } from 'swiftplot';
import { afterEach, expect, test, vi } from 'vitest';

import { bind } from '../src/bind.js';
import { LineChart, PieChart, Plot, ScatterChart } from '../src/index.js';
import { failingOnB, fake, host, hover, pixel, render, twoFrames, wheel } from './helpers.js';

type Props = {
  data?: unknown;
  label?: string;
  zoom?: boolean;
  width?: number;
  height?: number;
  onClick?: () => void;
};
type Row = { x: number; a: number };

/** The red line covers the pixel at least mostly (its edges are blended with the background). */
const red = (p: number[]) => p[0]! > 200 && p[1]! < 120 && p[2]! < 120;
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
const rows = (f: (x: number) => number): Row[] => Array.from({ length: 11 }, (_, x) => ({ x, a: f(x) }));
// Drawn at once: these tests read pixels straight after the chart is made.
const look = {
  colors: ['#ff0000'],
  yAxis: { domain: [0, 1] as [number, number] },
  margin: ZERO,
  animate: false,
};
const canvasOf = (el: HTMLElement) => el.querySelector('canvas')!;
const heightOf = (el: HTMLElement) => [el.clientHeight, canvasOf(el).style.height];

const styles = document.head.appendChild(document.createElement('style'));
styles.textContent =
  '.tall, #detail { height: 450px } .over { height: 450px !important } .padded { padding: 16px 0 }' +
  ' .responsive { max-width: 100%; max-height: 100% }';

const mounted: (() => void)[] = [];
const mount = (node: ReactNode, container?: HTMLElement) => {
  const r = render(node, container);
  mounted.push(r.unmount);
  return r;
};
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

test('bind(fake) renders one div, creates the chart on it after mount and destroys it on unmount', () => {
  const { mount: chart, calls } = fake<Props>();
  const Chart = bind(chart);
  const props = { data: [1, 2], zoom: true };
  const r = render(h(Chart, props));
  expect([...r.container.children].map(c => c.tagName)).toEqual(['DIV']);
  expect(calls.create).toHaveLength(1);
  expect(calls.create[0]!.el).toBe(r.el);
  expect(calls.create[0]!.props).toStrictEqual(props);
  r.unmount();
  expect(calls.destroy).toBe(1);
  expect(r.container.innerHTML).toBe('');
});

test('update gets only the props that are other objects than last time, and undefined for a dropped one', () => {
  const { mount: chart, calls } = fake<Props>();
  const Chart = bind(chart);
  const props = { data: [1, 2], label: 'a', zoom: true };
  const r = mount(h(Chart, props));
  r.rerender(h(Chart, props));
  r.rerender(h(Chart, { ...props }));
  expect(calls.update).toEqual([]);
  r.rerender(h(Chart, { ...props, label: 'b' }));
  expect(calls.update).toStrictEqual([{ label: 'b' }]);
  r.rerender(h(Chart, { data: props.data, label: 'b' }));
  expect(calls.update).toStrictEqual([{ label: 'b' }, { zoom: undefined }]);
});

test('className, style and id go to the host only; ref and key never reach the chart', () => {
  const { mount: chart, calls } = fake<Props>();
  const Chart = bind(chart);
  const ref = createRef<HTMLDivElement>();
  const props = { data: [1], className: 'a', style: { color: 'red' }, id: 'c', ref, key: 'k' };
  const r = mount(h(Chart, props as Props));
  expect([r.el.className, r.el.style.color, r.el.id]).toEqual(['a', 'red', 'c']);
  expect(calls.create[0]!.props).toStrictEqual({ data: props.data });
  r.rerender(h(Chart, { ...props, className: 'b' } as Props));
  expect(r.el.className).toBe('b');
  expect(calls.update).toEqual([]);
});

test('under StrictMode the discarded mount is destroyed and one chart is left', () => {
  const { mount: chart, calls } = fake<Props>();
  const Chart = bind(chart);
  const r = mount(h(StrictMode, null, h(Chart, { label: 'a' })));
  expect(calls.create).toHaveLength(2);
  expect(calls.destroy).toBe(1);
  expect(r.el.querySelectorAll('[data-fake]')).toHaveLength(1);
  r.rerender(h(StrictMode, null, h(Chart, { label: 'b' })));
  expect(r.el.querySelectorAll('[data-fake]')).toHaveLength(1);
  expect(calls.update).toStrictEqual([{ label: 'b' }]);
});

test('bind(lineChart) draws the data, redraws new data, reports and follows the view', async () => {
  const r = mount(h(LineChart<Row[]>, { data: rows(() => 0.5), width: 100, height: 100, ...look }));
  expect(red(pixel(r.el, 50, 50))).toBe(true);
  r.rerender(h(LineChart<Row[]>, { data: rows(() => 0.25), width: 100, height: 100, ...look }));
  expect(red(pixel(r.el, 50, 50))).toBe(false);
  expect(red(pixel(r.el, 50, 75))).toBe(true);

  const onViewChange = vi.fn();
  const zoomed = mount(
    h(LineChart<Row[]>, {
      data: rows(() => 0.5),
      width: 100,
      height: 100,
      margin: ZERO,
      zoom: true,
      onViewChange,
    }),
  );
  wheel(zoomed.el, 50, 50, -300, { ctrlKey: true });
  await twoFrames();
  expect(onViewChange).toHaveBeenCalled();

  const step = rows(x => (x <= 5 ? 0.5 : 0.25));
  const viewed = (x: [number, number]) =>
    h(LineChart<Row[]>, { data: step, width: 100, height: 100, view: { x }, ...look });
  const v = mount(viewed([0, 4]));
  expect(red(pixel(v.el, 50, 50))).toBe(true);
  v.rerender(viewed([6, 10]));
  expect(red(pixel(v.el, 50, 50))).toBe(false);
  expect(red(pixel(v.el, 50, 75))).toBe(true);
});

test('bind(pieChart) draws its parts, redraws new data and follows a prop of its own', () => {
  const parts = (a: number, b: number) => [
    { page: 'one', visits: a },
    { page: 'two', visits: b },
  ];
  const props = {
    width: 100,
    height: 100,
    margin: ZERO,
    colors: ['#ff0000', '#0000ff'],
    legend: false,
    animate: false,
  };
  const pie = (data: ReturnType<typeof parts>, inner?: number) =>
    h(PieChart<ReturnType<typeof parts>>, { ...props, data, text: false, inner });
  const redAt = (el: HTMLElement) => [red(pixel(el, 60, 40)), red(pixel(el, 78, 78)), red(pixel(el, 30, 50))];
  const r = mount(pie(parts(1, 1)));
  expect(redAt(r.el)).toEqual([true, true, false]);
  const next = parts(1, 3);
  r.rerender(pie(next));
  expect(redAt(r.el)).toEqual([true, false, false]);
  r.rerender(pie(next, 0.6));
  expect(red(pixel(r.el, 60, 40))).toBe(false);
  expect(red(pixel(r.el, 78, 22))).toBe(true);
});

test('onClick reaches the chart only while given: the cursor over a point is a pointer with it, not without', () => {
  const props = { data: rows(() => 0.5), width: 100, height: 100, ...look };
  const r = mount(h(ScatterChart<Row[]>, { ...props, onClick: () => {} }));
  const cursorAt = () => hover(r.el, 50, 50).style.cursor;
  expect(cursorAt()).toBe('pointer');
  r.rerender(h(ScatterChart<Row[]>, props));
  expect(cursorAt()).toBe('');
});

test('width and height size the host and the chart; a height from style wins over the prop, from a class over the fallback', async () => {
  const data = rows(() => 0.5);
  const sized = mount(h(LineChart<Row[]>, { data, width: 400, height: 200 }));
  expect([sized.el.style.width, sized.el.style.height]).toEqual(['400px', '200px']);
  expect([canvasOf(sized.el).style.width, canvasOf(sized.el).style.height]).toEqual(['400px', '200px']);

  expect(heightOf(mount(h(LineChart<Row[]>, { data, style: { height: 400 } })).el)).toEqual([400, '400px']);
  expect(heightOf(mount(h(LineChart<Row[]>, { data, className: 'tall' })).el)).toEqual([450, '450px']);

  const both = mount(h(LineChart<Row[]>, { data, height: 200, style: { height: 400 } }));
  expect(heightOf(both.el)).toEqual([400, '400px']);
  both.rerender(h(LineChart<Row[]>, { data, height: 250, style: { height: 400 } }));
  await twoFrames();
  expect(heightOf(both.el)).toEqual([400, '400px']);
  both.rerender(h(LineChart<Row[]>, { data, height: 250, style: { height: 350 } }));
  await twoFrames();
  expect(heightOf(both.el)).toEqual([350, '350px']);
  both.rerender(h(LineChart<Row[]>, { data, height: 250 }));
  await twoFrames();
  expect(heightOf(both.el)).toEqual([250, '250px']);
});

test('a class height that beats the height prop sizes host and canvas alike, and the prop returns when it goes', async () => {
  const data = rows(() => 0.5);
  const r = mount(h(LineChart<Row[]>, { data, height: 200 }));
  expect(heightOf(r.el)).toEqual([200, '200px']);
  r.rerender(h(LineChart<Row[]>, { data, height: 200, className: 'over' }));
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);
  r.rerender(h(LineChart<Row[]>, { data, height: 200 }));
  await twoFrames();
  expect(heightOf(r.el)).toEqual([200, '200px']);
  expect(heightOf(mount(h(LineChart<Row[]>, { data, height: 200, className: 'over' })).el)).toEqual([
    450,
    '450px',
  ]);
});

test('a parent resize alone that CSS passes to the host resizes the canvas on both axes', async () => {
  const sizeOf = (el: HTMLElement) => [
    el.clientWidth,
    el.clientHeight,
    canvasOf(el).style.width,
    canvasOf(el).style.height,
  ];
  const parent = host();
  parent.style.cssText = 'width: 500px; height: 300px';
  const r = mount(
    h(LineChart<Row[]>, { data: rows(() => 0.5), width: 400, height: 200, className: 'responsive' }),
    parent,
  );
  expect(sizeOf(r.el)).toEqual([400, 200, '400px', '200px']);
  parent.style.cssText = 'width: 250px; height: 100px';
  await twoFrames();
  expect(sizeOf(r.el)).toEqual([250, 100, '250px', '100px']);
});

test('with no height anywhere the host fills a parent that has one, else is 300 px, before the chart is created', () => {
  const parent = host();
  parent.style.height = '240px';
  const filled = mount(h(LineChart<Row[]>, { data: rows(() => 0.5) }), parent);
  expect(heightOf(filled.el)).toEqual([240, '240px']);

  const bare = mount(h(LineChart<Row[]>, { data: rows(() => 0.5), ...look }));
  expect(heightOf(bare.el)).toEqual([300, '300px']);
  expect(red(pixel(bare.el, 50, 150))).toBe(true);
  expect(heightOf(mount(h(LineChart<Row[]>, { data: rows(() => 0.5), className: 'padded' })).el)).toEqual([
    332,
    '300px',
  ]);

  const { mount: chart, calls } = fake<Props>();
  const sized = host();
  sized.style.height = '240px';
  mount(h(bind(chart), {}), sized);
  mount(h(bind(chart), {}));
  expect(calls.create.map(c => c.height)).toEqual([240, 300]);
});

test('the fallback gives way to a class or id added later, comes back when the id goes and when the height prop goes', async () => {
  const data = rows(() => 0.5);
  const r = mount(h(LineChart<Row[]>, { data }));
  expect(heightOf(r.el)).toEqual([300, '300px']);
  r.rerender(h(LineChart<Row[]>, { data, className: 'tall' }));
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);

  const byId = mount(h(LineChart<Row[]>, { data }));
  byId.rerender(h(LineChart<Row[]>, { data, id: 'detail' }));
  await twoFrames();
  expect(heightOf(byId.el)).toEqual([450, '450px']);
  byId.rerender(h(LineChart<Row[]>, { data }));
  await twoFrames();
  expect(heightOf(byId.el)).toEqual([300, '300px']);

  const prop = mount(h(LineChart<Row[]>, { data, height: 200 }));
  expect(heightOf(prop.el)).toEqual([200, '200px']);
  prop.rerender(h(LineChart<Row[]>, { data }));
  await twoFrames();
  expect(heightOf(prop.el)).toEqual([300, '300px']);
});

test('the fallback gives way to a height a media query gives later with no prop change, and comes back when it goes', async () => {
  const later = document.head.appendChild(document.createElement('style'));
  const r = mount(h(LineChart<Row[]>, { data: rows(() => 0.5), className: 'later' }));
  expect(heightOf(r.el)).toEqual([300, '300px']);
  later.textContent = '@media (min-width: 0px) { .later { height: 450px } }';
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);
  later.remove();
  await twoFrames();
  expect(heightOf(r.el)).toEqual([300, '300px']);
});

test('a host in a shadow root, or mounted detached and attached later to the page or a shadow root, falls back to 300 px', async () => {
  const shadow = () => host().attachShadow({ mode: 'open' });
  const inShadow = mount(
    h(LineChart<Row[]>, { data: rows(() => 0.5) }),
    shadow().appendChild(document.createElement('div')),
  );
  expect(heightOf(inShadow.el)).toEqual([300, '300px']);
  const containers = [document.createElement('div'), document.createElement('div')];
  const detached = containers.map(c => mount(h(LineChart<Row[]>, { data: rows(() => 0.5) }), c));
  expect(detached.map(d => canvases(d.el))).toEqual([1, 1]);
  document.body.append(containers[0]!);
  shadow().append(containers[1]!);
  await twoFrames();
  for (const d of detached) expect(heightOf(d.el)).toEqual([300, '300px']);
});

const TAILWIND = '@layer theme, base, components, utilities;';
const UTILITY = ' @layer utilities { .layered { height: 450px } }';

test('the fallback gives way to a height from a cascade layer the app declared before the first chart, as Tailwind does', async () => {
  const root = host().attachShadow({ mode: 'open' });
  const app = root.appendChild(document.createElement('style'));
  app.textContent = TAILWIND;
  const r = mount(
    h(LineChart<Row[]>, { data: rows(() => 0.5), className: 'layered' }),
    root.appendChild(document.createElement('div')),
  );
  expect(heightOf(r.el)).toEqual([300, '300px']);
  app.textContent = TAILWIND + UTILITY;
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);
});

test('the fallback gives way to a layered height from a sheet put first after the chart mounted', async () => {
  const root = host().attachShadow({ mode: 'open' });
  const r = mount(
    h(LineChart<Row[]>, { data: rows(() => 0.5), className: 'layered' }),
    root.appendChild(document.createElement('div')),
  );
  expect(heightOf(r.el)).toEqual([300, '300px']);
  root.prepend(Object.assign(document.createElement('style'), { textContent: TAILWIND + UTILITY }));
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);
});

test('two copies of the wrapper share one fallback style and a script keeping its own sheet first does not spin', async () => {
  const copy = '../src/bind.js?copy';
  const other = ((await import(/* @vite-ignore */ copy)) as typeof import('../src/bind.js')).bind;
  expect(other).not.toBe(bind);
  const root = host().attachShadow({ mode: 'open' });
  const a = mount(
    h(LineChart<Row[]>, { data: rows(() => 0.5) }),
    root.appendChild(document.createElement('div')),
  );
  const b = mount(h(other(fake<Props>().mount)), root.appendChild(document.createElement('div')));
  expect(root.querySelectorAll('style[data-swiftplot-fallback-layer]')).toHaveLength(1);
  expect(root.firstChild).toBe(root.querySelector('style[data-swiftplot-fallback-layer]'));
  expect([a.el.clientHeight, b.el.clientHeight]).toEqual([300, 300]);
  const rival = document.createElement('style');
  new MutationObserver(() => root.firstChild !== rival && root.prepend(rival)).observe(root, {
    childList: true,
  });
  root.prepend(rival);
  await twoFrames();
  expect(root.firstChild).toBe(rival);
});

test('a chart given a height by CSS inserts no fallback style', () => {
  const root = host().attachShadow({ mode: 'open' });
  root.appendChild(document.createElement('style')).textContent = '.sized { height: 200px }';
  const r = mount(
    h(LineChart<Row[]>, { data: rows(() => 0.5), className: 'sized' }),
    root.appendChild(document.createElement('div')),
  );
  expect(heightOf(r.el)).toEqual([200, '200px']);
  expect(root.querySelectorAll('style')).toHaveLength(1);
});

const unguessable = (): Row[] => [{ name: 'a' }, { name: 'b' }] as unknown as Row[];
const canvases = (el: Element) => el.querySelectorAll('canvas').length;

class Boundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  override state: { error?: unknown } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    return this.state.error ? h('p', null, 'failed') : this.props.children;
  }
}

test('an update that throws goes to onError, the previous chart stays drawn, and the next good props draw', () => {
  const onError = vi.fn();
  const props = { width: 100, height: 100, onError, ...look };
  const r = mount(h(LineChart<Row[]>, { data: rows(() => 0.5), ...props }));
  r.rerender(h(LineChart<Row[]>, { data: unguessable(), ...props }));
  expect(onError).toHaveBeenCalledOnce();
  expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
  expect(red(pixel(r.el, 50, 50))).toBe(true);
  r.rerender(h(LineChart<Row[]>, { data: rows(() => 0.25), ...props }));
  expect(red(pixel(r.el, 50, 75))).toBe(true);
});

test('with no onError the nearest error boundary catches the error and no chart root is left', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const r = mount(h(Boundary, null, h(LineChart<Row[]>, { data: rows(() => 0.5) })));
  expect(canvases(r.container)).toBe(1);
  r.rerender(h(Boundary, null, h(LineChart<Row[]>, { data: unguessable() })));
  expect(r.container.innerHTML).toBe('<p>failed</p>');
  errors.mockRestore();
});

test('a failure already reported to onError reaches the boundary once onError is removed', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const onError = vi.fn();
  const data = unguessable();
  const x = (r: Row) => r.x;
  const r = mount(h(Boundary, null, h(LineChart<Row[]>, { data, x, onError })));
  expect(onError).toHaveBeenCalledOnce();
  r.rerender(h(Boundary, null, h(LineChart<Row[]>, { data, x })));
  expect(r.container.innerHTML).toBe('<p>failed</p>');
  errors.mockRestore();
});

test('a first mount that throws goes to onError with an empty host, and the next prop change creates the chart', () => {
  const onError = vi.fn();
  const r = mount(h(LineChart<Row[]>, { data: unguessable(), onError }));
  expect(onError).toHaveBeenCalledOnce();
  expect(r.el.children).toHaveLength(0);
  r.rerender(h(LineChart<Row[]>, { data: rows(() => 0.5), onError }));
  expect(canvases(r.el)).toBe(1);
});

test('onError is called once per failed attempt, not on later renders with the same props', () => {
  const onError = vi.fn();
  const data = unguessable();
  const r = mount(h(LineChart<Row[]>, { data, onError }));
  r.rerender(h(LineChart<Row[]>, { data, onError }));
  r.rerender(h(LineChart<Row[]>, { data, onError: (e: unknown) => onError(e) }));
  expect(onError).toHaveBeenCalledOnce();
  r.rerender(h(LineChart<Row[]>, { data: [...unguessable(), ...unguessable()], onError }));
  expect(onError).toHaveBeenCalledTimes(2);
});

test('no loop: inline props and an onError that sets state report a failure once; other fields report again', () => {
  const onError = vi.fn();
  const data = [{ x: 1, c: 1 }] as unknown as Row[];
  let renders = 0;
  function App({ y }: { y: string[] }) {
    const [, setFailures] = useState(0);
    renders++;
    return h(LineChart<Row[]>, {
      data,
      x: (r: Row) => r.x,
      y: [...y] as never,
      xAxis: { format: (v: unknown) => String(v) },
      onClick: () => {},
      onError: (e: unknown) => {
        onError(e);
        setFailures(n => n + 1);
      },
    });
  }
  const r = mount(h(App, { y: ['a', 'b'] }));
  expect(onError).toHaveBeenCalledOnce();
  const settled = renders;
  r.rerender(h(App, { y: ['a', 'b'] }));
  expect(onError).toHaveBeenCalledOnce();
  expect(renders - settled).toBeLessThanOrEqual(2);
  r.rerender(h(App, { y: ['d', 'e'] }));
  expect(onError).toHaveBeenCalledTimes(2);
});

test('no loop: data and typed arrays rebuilt from the same rows on every render report once; new rows report again', () => {
  const onError = vi.fn();
  const Chart = bind<Props & { column?: Float64Array }>(() => {
    throw new Error('bad');
  });
  let renders = 0;
  function App({ source }: { source: object[] }) {
    const [, setFailures] = useState(0);
    renders++;
    return h(Chart, {
      data: source.filter(() => true),
      column: new Float64Array([1, 2]),
      onError: (e: unknown) => {
        onError(e);
        setFailures(n => n + 1);
      },
    });
  }
  const source = [{ x: 1 }];
  const r = mount(h(App, { source }));
  expect(onError).toHaveBeenCalledOnce();
  const settled = renders;
  r.rerender(h(App, { source }));
  expect(onError).toHaveBeenCalledOnce();
  expect(renders - settled).toBeLessThanOrEqual(2);
  r.rerender(h(App, { source: [{ x: 1 }, { x: 2 }] }));
  expect(onError).toHaveBeenCalledTimes(2);
});

/** A column the core reads by its length, not an array or a typed array. */
class Column {
  length: number;
  constructor(length: number) {
    this.length = length;
  }
}

/** Renders data(n) into a chart that always throws, with an onError that sets state. */
function reportsOf(data: (n: number) => unknown) {
  const onError = vi.fn();
  const Chart = bind<Props>(() => {
    throw new Error('bad');
  });
  let renders = 0;
  function App({ n }: { n: number }) {
    const [, setFailures] = useState(0);
    renders++;
    return h(Chart, {
      data: data(n),
      onError: (e: unknown) => {
        onError(e);
        setFailures(f => f + 1);
      },
    });
  }
  const r = mount(h(App, { n: 2 }));
  const settled = renders;
  r.rerender(h(App, { n: 2 }));
  const calls = [onError.mock.calls.length, renders - settled <= 2];
  r.rerender(h(App, { n: 1 }));
  return [...calls, onError.mock.calls.length];
}

test('no loop: an object of columns, copied rows and pairs rebuilt on every render report once; a new length reports again', () => {
  const xs = [1, 2];
  expect(reportsOf(n => ({ x: xs.slice(0, n), y: xs.slice(0, n) }))).toEqual([1, true, 2]);
  expect(reportsOf(n => xs.slice(0, n).map(x => ({ x })))).toEqual([1, true, 2]);
  expect(reportsOf(n => xs.slice(0, n).map(x => [x, x]))).toEqual([1, true, 2]);
  expect(reportsOf(n => ({ x: new Column(n) }))).toEqual([1, true, 2]);
});

test('a replaced accessor that throws another error is reported again; one that throws the same error is not', () => {
  const onError = vi.fn();
  const data = rows(() => 0.5);
  const thrower = (message: string) => () => {
    throw new Error(message);
  };
  const r = mount(h(LineChart<Row[]>, { data: data.filter(() => true), y: thrower('first'), onError }));
  r.rerender(h(LineChart<Row[]>, { data: data.filter(() => true), y: thrower('first'), onError }));
  expect(onError).toHaveBeenCalledOnce();
  r.rerender(h(LineChart<Row[]>, { data: data.filter(() => true), y: thrower('second'), onError }));
  expect(onError).toHaveBeenCalledTimes(2);
  expect(String(onError.mock.calls[1]![0])).toContain('second');
});

test('replacing a throwing accessor or formatter alone recovers the chart', () => {
  const onError = vi.fn();
  const data = rows(() => 0.5);
  const props = { data, width: 100, height: 100, onError, ...look };
  const bad = () => {
    throw new Error('bad');
  };
  const byY = mount(h(LineChart<Row[]>, { ...props, y: bad }));
  expect(onError).toHaveBeenCalledTimes(1);
  byY.rerender(h(LineChart<Row[]>, { ...props, y: (r: Row) => r.a }));
  expect(red(pixel(byY.el, 50, 50))).toBe(true);

  const byFormat = mount(h(LineChart<Row[]>, { ...props, xAxis: { format: bad } }));
  expect(onError).toHaveBeenCalledTimes(2);
  byFormat.rerender(h(LineChart<Row[]>, { ...props, xAxis: { format: String } }));
  expect(red(pixel(byFormat.el, 50, 50))).toBe(true);
});

test('after a failure a render that changes only a callback makes no attempt and sends the callback alone', () => {
  const { chart, calls } = failingOnB<Props>();
  const Chart = bind(chart);
  const onError = vi.fn();
  const r = mount(h(Chart, { label: 'A', onError }));
  r.rerender(h(Chart, { label: 'B', onError }));
  expect([calls.update.length, onError.mock.calls.length]).toEqual([1, 1]);
  const onClick = () => {};
  r.rerender(h(Chart, { label: 'B', onError, onClick }));
  r.rerender(h(Chart, { label: 'B', onError, onClick }));
  expect(calls.update).toStrictEqual([{ label: 'B' }, { onClick }]);
});

test('a callback replaced in an update that fails reaches the last good chart', () => {
  const { chart, calls } = failingOnB<Props>();
  const Chart = bind(chart);
  const onError = vi.fn();
  const onClick = () => {};
  const r = mount(h(Chart, { label: 'A', onError, onClick: () => {} }));
  r.rerender(h(Chart, { label: 'B', onError, onClick }));
  expect(calls.update).toStrictEqual([{ label: 'B', onClick }, { onClick }]);
});

test('going back to the last drawn props after a failed update sends an empty update so the chart is restored', () => {
  const { chart, calls } = failingOnB<Props>();
  const Chart = bind(chart);
  const onError = vi.fn();
  const r = mount(h(Chart, { label: 'A', onError }));
  r.rerender(h(Chart, { label: 'B', onError }));
  r.rerender(h(Chart, { label: 'A', onError }));
  expect(calls.update).toEqual([{ label: 'B' }, {}]);
  expect(onError).toHaveBeenCalledOnce();
});

test('bad B, good A, bad B reports both failures', () => {
  const { chart } = failingOnB<Props>();
  const Chart = bind(chart);
  const onError = vi.fn();
  const r = mount(h(Chart, { label: 'A', onError }));
  r.rerender(h(Chart, { label: 'B', onError }));
  r.rerender(h(Chart, { label: 'A', onError }));
  r.rerender(h(Chart, { label: 'B', onError }));
  expect(onError).toHaveBeenCalledTimes(2);
});

test('under StrictMode a failing first mount calls onError once', () => {
  const onError = vi.fn();
  mount(h(StrictMode, null, h(LineChart<Row[]>, { data: unguessable(), onError })));
  expect(onError).toHaveBeenCalledOnce();
});

test('the error key never walks data: rows with a cycle or a throwing getter are reported, not thrown', () => {
  const onError = vi.fn();
  const cyclic = () => {
    const row: Record<string, unknown> = { name: 'a' };
    row.self = row;
    const data: unknown[] = [row, row];
    data.push(data);
    return data as Row[];
  };
  const throwing = {
    get a(): number {
      throw new Error('getter');
    },
  } as unknown as Row;
  const r = mount(h(LineChart<Row[]>, { data: cyclic(), onError }));
  r.rerender(h(LineChart<Row[]>, { data: cyclic(), onError }));
  r.rerender(h(LineChart<Row[]>, { data: [throwing], onError }));
  r.rerender(h(LineChart<Row[]>, { data: [throwing], onError }));
  expect(onError).toHaveBeenCalledTimes(2);
});

test('a throwing getter in a non-data prop reaches onError as the original error', () => {
  const onError = vi.fn();
  const error = new Error('format');
  const xAxis = {
    get format(): (v: unknown) => string {
      throw error;
    },
  };
  mount(h(LineChart<Row[]>, { data: rows(() => 0.5), xAxis, onError }));
  expect(onError).toHaveBeenCalledExactlyOnceWith(error);
});

test('Plot draws a pie and its legend; new, equal mark objects send the core nothing', () => {
  let made = 0;
  const letGo = vi.fn();
  const counted: Feature = () => (made++, { letGo, destroy() {} });
  const slices = (values: number[]) =>
    arcs({ values, colors: ['#ff0000', '#0000ff'], labels: ['one', 'two'] });
  const pie = (mark: ReturnType<typeof slices>) =>
    h(Plot, {
      width: 100,
      height: 124,
      margin: ZERO,
      frame: 'polar',
      marks: [mark],
      use: [legend(), counted],
    });
  const r = mount(pie(slices([1, 1])));
  expect(r.el.textContent).toBe('onetwo');
  const middle = (canvasOf(r.el).height / devicePixelRatio + 24) / 2;
  expect(red(pixel(r.el, 70, middle))).toBe(true);
  expect(red(pixel(r.el, 30, middle))).toBe(false);

  const same = slices([1, 1]);
  const prepared = vi.spyOn(same, 'prepare');
  r.rerender(pie(same));
  expect(prepared).not.toHaveBeenCalled();
  expect(letGo).not.toHaveBeenCalled();
  const other = slices([1, 3]);
  const changed = vi.spyOn(other, 'prepare');
  r.rerender(pie(other));
  expect(changed).toHaveBeenCalled();
  expect(letGo).toHaveBeenCalled();
  expect(made).toBe(1);
});

test('server markup is one sized, empty div that hydrates without a warning and then draws', () => {
  const data = rows(() => 0.5);
  const cases = [
    {
      node: h(LineChart<Row[]>, { data, width: 400, height: 200 }),
      html: '<div style="width:400px;height:200px"></div>',
      height: 200,
    },
    { node: h(LineChart<Row[]>, { data }), html: '<div></div>', height: 300 },
  ];
  const errors = vi.spyOn(console, 'error');
  const warnings = vi.spyOn(console, 'warn');
  const onRecoverableError = vi.fn();
  for (const { node, html, height } of cases) {
    expect(renderToString(node)).toBe(html);
    const container = host();
    container.innerHTML = html;
    const served = container.firstElementChild;
    let root!: Root;
    act(() => void (root = hydrateRoot(container, node, { onRecoverableError })));
    mounted.push(() => act(() => root.unmount()));
    expect(container.firstElementChild).toBe(served);
    expect(canvasOf(served as HTMLElement)).not.toBeNull();
    expect(served!.clientHeight).toBe(height);
  }
  expect([errors.mock.calls, warnings.mock.calls, onRecoverableError.mock.calls]).toEqual([[], [], []]);
  errors.mockRestore();
  warnings.mockRestore();
});
