import { arcs, dots, legend, zoom, type Feature, type Hover, type Layout } from 'swiftplot';
import {
  createApp,
  createSSRApp,
  defineComponent,
  h,
  inject,
  nextTick,
  provide,
  ref,
  shallowRef,
  type Component,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, expect, test, vi } from 'vitest';

import { bind, type Declared } from '../src/bind.js';
import { HistogramChart, LineChart, PieChart, Plot, ScatterChart } from '../src/index.js';
import {
  click,
  drag,
  entriesOf,
  failingOnB,
  fake,
  host,
  hover,
  middleOf,
  nextFrame,
  pixel,
  render,
  tipOf,
  twoFrames,
  wheel,
} from './helpers.js';

type Props = {
  data?: unknown;
  label?: string;
  zoom?: boolean | { axes: string };
  tooltip?: boolean;
  width?: number;
  height?: number;
};
type Row = { x: number; a: number };

const flag = { type: [Boolean, Object], default: undefined };
const declared: Declared<Props> = {
  data: null,
  label: null,
  zoom: flag,
  tooltip: { type: Boolean, default: undefined },
  width: null,
  height: null,
};
/** The red line covers the pixel at least mostly (its edges are blended with the background). */
const red = (p: number[]) => p[0]! > 200 && p[1]! < 120 && p[2]! < 120;
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
const rows = (f: (x: number) => number): Row[] => Array.from({ length: 11 }, (_, x) => ({ x, a: f(x) }));
// Drawn at once: these tests read pixels straight after the chart is made.
const look = { colors: ['#ff0000'], yAxis: { domain: [0, 1] }, margin: ZERO, animate: false };
const canvasOf = (el: HTMLElement) => el.querySelector('canvas')!;
const heightOf = (el: HTMLElement) => [el.clientHeight, canvasOf(el).style.height];

const styles = document.head.appendChild(document.createElement('style'));
styles.textContent =
  '.tall, #detail { height: 450px } .over { height: 450px !important } .padded { padding: 16px 0 }' +
  ' .responsive { max-width: 100%; max-height: 100% }';

const mounted: (() => void)[] = [];
const mount = (C: Component, props: () => Record<string, unknown>, container?: HTMLElement) => {
  const r = render(() => h(C, props()), container);
  mounted.push(r.unmount);
  return r;
};
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

test('bind(fake) renders one div, creates the chart on it after mount and destroys it on unmount', () => {
  const { mount: chart, calls } = fake<Props>();
  const data = [1, 2];
  const r = render(() => h(bind(chart, declared), { data, zoom: true }));
  expect([...r.container.children].map(c => c.tagName)).toEqual(['DIV']);
  expect(calls.create).toHaveLength(1);
  expect(calls.create[0]!.el).toBe(r.el);
  expect(calls.create[0]!.props).toStrictEqual({ data, zoom: true });
  r.unmount();
  expect(calls.destroy).toBe(1);
  expect(r.container.innerHTML).toBe('');
});

test('changes in one tick give one update; a prop set back to undefined is sent as undefined; no change, no call', async () => {
  const { mount: chart, calls } = fake<Props>();
  const Chart = bind(chart, declared);
  const label = ref('a');
  const zoom = ref<boolean>();
  const tick = ref(0);
  const data = [1];
  mount(Chart, () => (tick.value, { data, label: label.value, zoom: zoom.value }));
  tick.value++;
  await nextTick();
  expect(calls.update).toEqual([]);
  label.value = 'b';
  zoom.value = true;
  await nextTick();
  expect(calls.update).toStrictEqual([{ label: 'b', zoom: true }]);
  zoom.value = undefined;
  await nextTick();
  expect(calls.update).toStrictEqual([{ label: 'b', zoom: true }, { zoom: undefined }]);
});

test('class, style and id go to the host only, and changing them calls no update', async () => {
  const { mount: chart, calls } = fake<Props>();
  const cls = ref('a');
  const data = [1];
  const r = mount(bind(chart, declared), () => ({
    data,
    class: cls.value,
    style: { color: 'red' },
    id: 'c',
  }));
  expect([r.el.className, r.el.style.color, r.el.id]).toEqual(['a', 'red', 'c']);
  expect(calls.create[0]!.props).toStrictEqual({ data });
  cls.value = 'b';
  await nextTick();
  expect(r.el.className).toBe('b');
  expect(calls.update).toEqual([]);
});

test("the chart gets the app's own array, not a proxy, and a re-render with the same ref sends nothing", async () => {
  const { mount: chart, calls } = fake<Props>();
  const made = [{ x: 1, a: 1 }];
  const data = ref(made);
  const tick = ref(0);
  mount(bind(chart, declared), () => (tick.value, { data: data.value }));
  expect(calls.create[0]!.props.data).toBe(made);
  tick.value++;
  await nextTick();
  expect(calls.update).toEqual([]);
});

test('with a shallowRef, replacing the array redraws and changing it in place does not until dataVersion changes', async () => {
  const data = shallowRef(rows(() => 0.5));
  const dataVersion = ref(0);
  const r = mount(LineChart, () => ({
    data: data.value,
    dataVersion: dataVersion.value,
    width: 100,
    height: 100,
    ...look,
  }));
  expect(red(pixel(r.el, 50, 50))).toBe(true);
  data.value = rows(() => 0.25);
  await nextTick();
  expect(red(pixel(r.el, 50, 75))).toBe(true);
  data.value.splice(0, Infinity, ...rows(() => 0.5));
  await nextTick();
  expect(red(pixel(r.el, 50, 75))).toBe(true);
  dataVersion.value++;
  await nextTick();
  expect(red(pixel(r.el, 50, 50))).toBe(true);
});

test('booleans: a bare zoom attribute is true, an absent tooltip is undefined, an object zoom passes as it is', () => {
  const { mount: chart, calls } = fake<Props>();
  const Chart = bind(chart, declared);
  mount(Chart, () => ({ zoom: '' }));
  mount(Chart, () => ({ zoom: { axes: 'xy' } }));
  expect(calls.create.map(c => c.props)).toStrictEqual([{ zoom: true }, { zoom: { axes: 'xy' } }]);
});

test('a bare zoom attribute zooms the real chart and an absent tooltip still shows', async () => {
  const step = rows(x => (x <= 5 ? 0.5 : 0.25));
  const r = mount(LineChart, () => ({ data: step, zoom: '', width: 100, height: 100, ...look }));
  expect(red(pixel(r.el, 50, 50))).toBe(true);
  wheel(r.el, 80, 50, -300, { ctrlKey: true });
  await twoFrames();
  expect(red(pixel(r.el, 50, 75))).toBe(true);

  const tipped = mount(LineChart, () => ({ data: step, width: 100, height: 100, ...look }));
  const shown = tipOf(tipped.el);
  hover(tipped.el, 50, 50);
  expect(shown()).toBe(true);
});

test('the declared props must name every chart prop but the callbacks, and nothing else', () => {
  const { mount: chart } = fake<Props & { onClick?: () => void }>();
  // @ts-expect-error -- label is missing
  bind(chart, { data: null, zoom: flag, tooltip: flag, width: null, height: null });
  // @ts-expect-error -- extra is not a chart prop
  bind(chart, { data: null, label: null, zoom: flag, tooltip: flag, width: null, height: null, extra: null });
  const more = { extra: null };
  // @ts-expect-error -- nor when it is spread in
  bind(chart, { ...declared, ...more });
  expect(bind(chart, declared)).toBeTypeOf('object');
});

test('bind(lineChart) draws the data', () => {
  const r = mount(LineChart, () => ({ data: rows(() => 0.5), width: 100, height: 100, ...look }));
  expect(red(pixel(r.el, 50, 50))).toBe(true);
});

test('width and height size the host and the chart; a height from style wins over the prop, from a class over the fallback', async () => {
  const data = rows(() => 0.5);
  const sized = mount(LineChart, () => ({ data, width: 400, height: 200 }));
  expect([sized.el.style.width, sized.el.style.height]).toEqual(['400px', '200px']);
  expect([canvasOf(sized.el).style.width, canvasOf(sized.el).style.height]).toEqual(['400px', '200px']);

  expect(heightOf(mount(LineChart, () => ({ data, style: { height: '400px' } })).el)).toEqual([400, '400px']);
  expect(heightOf(mount(LineChart, () => ({ data, style: 'height: 380px' })).el)).toEqual([380, '380px']);
  expect(heightOf(mount(LineChart, () => ({ data, class: 'tall' })).el)).toEqual([450, '450px']);

  const height = ref(200);
  const style = ref<{ height: string }>();
  style.value = { height: '400px' };
  const both = mount(LineChart, () => ({ data, height: height.value, style: style.value }));
  expect(heightOf(both.el)).toEqual([400, '400px']);
  height.value = 250;
  await nextTick();
  await twoFrames();
  expect(heightOf(both.el)).toEqual([400, '400px']);
  style.value = { height: '350px' };
  await nextTick();
  await twoFrames();
  expect(heightOf(both.el)).toEqual([350, '350px']);
  style.value = undefined;
  await nextTick();
  await twoFrames();
  expect(heightOf(both.el)).toEqual([250, '250px']);
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
    LineChart,
    () => ({ data: rows(() => 0.5), width: 400, height: 200, class: 'responsive' }),
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
  expect(heightOf(mount(LineChart, () => ({ data: rows(() => 0.5) }), parent).el)).toEqual([240, '240px']);

  const bare = mount(LineChart, () => ({ data: rows(() => 0.5), ...look }));
  expect(heightOf(bare.el)).toEqual([300, '300px']);
  expect(red(pixel(bare.el, 50, 150))).toBe(true);
  expect(heightOf(mount(LineChart, () => ({ data: rows(() => 0.5), class: 'padded' })).el)).toEqual([
    332,
    '300px',
  ]);

  const { mount: chart, calls } = fake<Props>();
  const sized = host();
  sized.style.height = '240px';
  mount(bind(chart, declared), () => ({}), sized);
  mount(bind(chart, declared), () => ({}));
  expect(calls.create.map(c => c.height)).toEqual([240, 300]);
});

test('the fallback gives way to a height a media query gives later with no prop change, and comes back when it goes', async () => {
  const later = document.head.appendChild(document.createElement('style'));
  const r = mount(LineChart, () => ({ data: rows(() => 0.5), class: 'later' }));
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
    LineChart,
    () => ({ data: rows(() => 0.5) }),
    shadow().appendChild(document.createElement('div')),
  );
  expect(heightOf(inShadow.el)).toEqual([300, '300px']);
  const containers = [document.createElement('div'), document.createElement('div')];
  const detached = containers.map(c => mount(LineChart, () => ({ data: rows(() => 0.5) }), c));
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
    LineChart,
    () => ({ data: rows(() => 0.5), class: 'layered' }),
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
    LineChart,
    () => ({ data: rows(() => 0.5), class: 'layered' }),
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
    LineChart,
    () => ({ data: rows(() => 0.5) }),
    root.appendChild(document.createElement('div')),
  );
  const b = mount(
    other(fake<Props>().mount, declared),
    () => ({}),
    root.appendChild(document.createElement('div')),
  );
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
    LineChart,
    () => ({ data: rows(() => 0.5), class: 'sized' }),
    root.appendChild(document.createElement('div')),
  );
  expect(heightOf(r.el)).toEqual([200, '200px']);
  expect(root.querySelectorAll('style')).toHaveLength(1);
});

test('a re-render that changes no sizing keeps the fallback height', async () => {
  const data = shallowRef(rows(() => 0.5));
  const bare = mount(LineChart, () => ({ data: data.value }));
  const parent = host();
  parent.style.height = '240px';
  const filled = mount(LineChart, () => ({ data: data.value }), parent);
  data.value = rows(() => 0.25);
  await nextTick();
  await twoFrames();
  expect(heightOf(bare.el)).toEqual([300, '300px']);
  expect(heightOf(filled.el)).toEqual([240, '240px']);
});

test('a re-render keeps the fallback and the height prop when the style has unset height entries', async () => {
  const data = shallowRef(rows(() => 0.5));
  const expanded = ref(false);
  const conditional = mount(LineChart, () => ({
    data: data.value,
    style: { height: expanded.value ? '400px' : undefined },
  }));
  const nulls = mount(LineChart, () => ({
    data: data.value,
    height: 200,
    style: [{ height: null }, 'height: ;', { height: '' }],
  }));
  expect(heightOf(conditional.el)).toEqual([300, '300px']);
  expect(heightOf(nulls.el)).toEqual([200, '200px']);
  data.value = rows(() => 0.25);
  await nextTick();
  await twoFrames();
  expect(heightOf(conditional.el)).toEqual([300, '300px']);
  expect(heightOf(nulls.el)).toEqual([200, '200px']);
  expanded.value = true;
  await nextTick();
  await twoFrames();
  expect(heightOf(conditional.el)).toEqual([400, '400px']);
  expanded.value = false;
  await nextTick();
  await twoFrames();
  expect(heightOf(conditional.el)).toEqual([300, '300px']);
});

test('a class height that beats the height prop sizes host and canvas alike, and the prop returns when it goes', async () => {
  const cls = ref<string>();
  const r = mount(LineChart, () => ({ data: rows(() => 0.5), height: 200, class: cls.value }));
  expect(heightOf(r.el)).toEqual([200, '200px']);
  cls.value = 'over';
  await nextTick();
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);
  cls.value = undefined;
  await nextTick();
  await twoFrames();
  expect(heightOf(r.el)).toEqual([200, '200px']);
  expect(
    heightOf(mount(LineChart, () => ({ data: rows(() => 0.5), height: 200, class: 'over' })).el),
  ).toEqual([450, '450px']);
});

test('the fallback gives way to a class or id added later, comes back when the id goes and when the height prop goes', async () => {
  const data = rows(() => 0.5);
  const cls = ref<string>();
  const r = mount(LineChart, () => ({ data, class: cls.value }));
  expect(heightOf(r.el)).toEqual([300, '300px']);
  cls.value = 'tall';
  await nextTick();
  await twoFrames();
  expect(heightOf(r.el)).toEqual([450, '450px']);

  const id = ref<string>();
  const byId = mount(LineChart, () => ({ data, id: id.value }));
  id.value = 'detail';
  await nextTick();
  await twoFrames();
  expect(heightOf(byId.el)).toEqual([450, '450px']);
  id.value = undefined;
  await nextTick();
  await twoFrames();
  expect(heightOf(byId.el)).toEqual([300, '300px']);

  const height = ref<number>();
  height.value = 200;
  const prop = mount(LineChart, () => ({ data, height: height.value }));
  expect(heightOf(prop.el)).toEqual([200, '200px']);
  height.value = undefined;
  await nextTick();
  await twoFrames();
  expect(heightOf(prop.el)).toEqual([300, '300px']);
});

const unguessable = (): Row[] => [{ name: 'a' }, { name: 'b' }] as unknown as Row[];
const canvases = (el: Element) => el.querySelectorAll('canvas').length;
const settle = async () => {
  await nextTick();
  await twoFrames();
};
const anyRed = (el: HTMLElement) => {
  const column = document.createElement('canvas').getContext('2d')!;
  column.canvas.width = 1;
  column.canvas.height = 100 * devicePixelRatio;
  column.drawImage(
    canvasOf(el),
    50 * devicePixelRatio,
    0,
    1,
    column.canvas.height,
    0,
    0,
    1,
    column.canvas.height,
  );
  const { data } = column.getImageData(0, 0, 1, column.canvas.height);
  return Array.from({ length: 100 }, (_, y) => Math.floor(y * devicePixelRatio) * 4).some(i =>
    red([...data.subarray(i, i + 4)]),
  );
};

test('v-model:view follows a wheel zoom and moves the chart; every handler of a merged listener is called', async () => {
  const view = ref<{ x: number[] }>();
  const also = vi.fn();
  const step = rows(x => (x <= 5 ? 0.5 : 0.25));
  const r = mount(LineChart, () => ({
    data: step,
    zoom: true,
    width: 100,
    height: 100,
    ...look,
    view: view.value,
    'onUpdate:view': [(v: { x: number[] }) => (view.value = v), also],
  }));
  wheel(r.el, 50, 50, -300, { ctrlKey: true });
  await settle();
  const zoomed = view.value!.x;
  expect(zoomed[1]! - zoomed[0]!).toBeLessThan(10);
  expect(also).toHaveBeenCalledWith(view.value);
  view.value = { x: [6, 10] };
  await settle();
  expect(red(pixel(r.el, 50, 50))).toBe(false);
  expect(red(pixel(r.el, 50, 75))).toBe(true);
});

test('v-model:hidden follows a legend click and hides the series; unbound, the legend hides it itself', async () => {
  const data = rows(() => 0.5).map(r => ({ ...r, b: 0.25 }));
  const hidden = ref<string[]>();
  const props = {
    data,
    y: ['a', 'b'],
    legend: true,
    width: 100,
    height: 100,
    ...look,
    colors: ['#ff0000', '#0000ff'],
  };
  const hideFirst = (el: HTMLElement) => {
    const entry = entriesOf(el)[0]!;
    entry.dispatchEvent(new MouseEvent('click', middleOf(entry)));
  };
  const r = mount(LineChart, () => ({
    ...props,
    hidden: hidden.value,
    'onUpdate:hidden': (h: string[]) => (hidden.value = h),
  }));
  expect(anyRed(r.el)).toBe(true);
  hideFirst(r.el);
  await settle();
  expect(hidden.value).toEqual(['a']);
  expect(anyRed(r.el)).toBe(false);
  hidden.value = [];
  await settle();
  expect(anyRed(r.el)).toBe(true);

  const free = mount(LineChart, () => props);
  hideFirst(free.el);
  await settle();
  expect(anyRed(free.el)).toBe(false);
});

test('v-model:pointer follows the hover and setting it shows the tooltip', async () => {
  const pointer = ref<{ x: number } | null>();
  const r = mount(LineChart, () => ({
    data: rows(() => 0.5),
    width: 100,
    height: 100,
    ...look,
    pointer: pointer.value,
    'onUpdate:pointer': (p: { x: number } | null) => (pointer.value = p),
  }));
  const shown = tipOf(r.el);
  expect(shown()).toBe(false);
  pointer.value = { x: 5 };
  await settle();
  expect(shown()).toBe(true);
  hover(r.el, 20, 50);
  await nextTick();
  expect(pointer.value!.x).toBeCloseTo(2, 0);
});

test('bind(pieChart) and bind(histogramChart) draw, redraw new data and follow a prop of their own', async () => {
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
  const data = shallowRef(parts(1, 1));
  const inner = ref<number>();
  const pie = mount(PieChart, () => ({ ...props, data: data.value, text: false, inner: inner.value }));
  const redAt = (x: number, y: number) => red(pixel(pie.el, x, y));
  expect([redAt(60, 40), redAt(78, 78), redAt(30, 50)]).toEqual([true, true, false]);
  data.value = parts(1, 3);
  await nextTick();
  expect([redAt(60, 40), redAt(78, 78)]).toEqual([true, false]);
  inner.value = 0.6;
  await nextTick();
  expect([redAt(60, 40), redAt(78, 22)]).toEqual([false, true]);

  const values = [0, 0.1, 0.2, 10];
  const bins = ref([0, 10]);
  const bars = mount(HistogramChart, () => ({ ...props, data: values, bins: bins.value }));
  expect(red(pixel(bars.el, 75, 90))).toBe(true);
  bins.value = [0, 5, 9.9, 10];
  await nextTick();
  expect(red(pixel(bars.el, 25, 90))).toBe(true);
  expect(red(pixel(bars.el, 75, 90))).toBe(false);
});

test('@brush gets the range dragged with a bare brush prop, and rules arrive as a prop', async () => {
  const onBrush = vi.fn();
  const r = mount(LineChart, () => ({
    data: rows(() => 0.5),
    width: 100,
    height: 100,
    ...look,
    brush: '',
    rules: [{ y: 0.5, text: 'half' }],
    onBrush,
  }));
  await settle();
  expect(r.el.textContent).toContain('half');
  drag(r.el, [20, 50], [60, 50]);
  expect(onBrush).toHaveBeenCalledTimes(1);
  const { x } = onBrush.mock.calls[0]![0];
  expect(x[0]).toBeCloseTo(2, 0);
  expect(x[1]).toBeCloseTo(6, 0);
});

test('@click gets the core payload; selected is a plain prop', () => {
  const onClick = vi.fn();
  const r = mount(ScatterChart, () => ({ data: rows(() => 0.5), width: 100, height: 100, ...look, onClick }));
  click(r.el, 50, 50);
  expect(onClick).toHaveBeenCalledOnce();
  const [hit, at] = onClick.mock.calls[0]!;
  expect(hit).toMatchObject({ mark: expect.anything() });
  expect(at).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });

  const { mount: chart, calls } = fake<Props & { selected?: unknown }>();
  const selected = [{ id: 'a', rows: [1] }];
  mount(bind(chart, { ...declared, selected: null }), () => ({ selected }));
  expect(calls.create[0]!.props).toStrictEqual({ selected });
});

test('@click reaches the chart only while bound: absent, present, absent', async () => {
  const onClick = vi.fn();
  const bound = ref(false);
  const data = rows(() => 0.5);
  const r = mount(ScatterChart, () => ({
    data,
    width: 100,
    height: 100,
    ...look,
    onClick: bound.value ? onClick : undefined,
  }));
  const cursorAt = () => hover(r.el, 50, 50).style.cursor;
  expect(cursorAt()).toBe('');
  bound.value = true;
  await nextTick();
  expect(cursorAt()).toBe('pointer');
  click(r.el, 50, 50);
  expect(onClick).toHaveBeenCalledOnce();
  bound.value = false;
  await nextTick();
  expect(cursorAt()).toBe('');
  click(r.el, 50, 50);
  expect(onClick).toHaveBeenCalledOnce();
});

test('a click after @click is unbound while an update is failed reaches no handler and throws nothing', async () => {
  const onClick = vi.fn();
  const bound = ref(true);
  const data = shallowRef(rows(() => 0.5));
  const r = mount(ScatterChart, () => ({
    data: data.value,
    width: 100,
    height: 100,
    ...look,
    onError: () => {},
    onClick: bound.value ? onClick : undefined,
  }));
  data.value = unguessable();
  await nextTick();
  bound.value = false;
  await nextTick();
  const errors: unknown[] = [];
  const onWindowError = (e: ErrorEvent) => {
    e.preventDefault();
    errors.push(e.error);
  };
  window.addEventListener('error', onWindowError);
  try {
    click(r.el, 50, 50);
  } finally {
    window.removeEventListener('error', onWindowError);
  }
  expect(errors).toEqual([]);
  expect(onClick).not.toHaveBeenCalled();
});

test('an update that throws goes to @error, the previous chart stays drawn, and the next good props draw', async () => {
  const onError = vi.fn();
  const data = shallowRef(rows(() => 0.5));
  const r = mount(LineChart, () => ({ data: data.value, width: 100, height: 100, onError, ...look }));
  data.value = unguessable();
  await settle();
  expect(onError).toHaveBeenCalledOnce();
  expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
  expect(red(pixel(r.el, 50, 50))).toBe(true);
  data.value = rows(() => 0.25);
  await settle();
  expect(red(pixel(r.el, 50, 75))).toBe(true);
});

test('with no @error the failure reaches app.config.errorHandler', async () => {
  const errors: unknown[] = [];
  const data = shallowRef(rows(() => 0.5));
  const app = createApp({ render: () => h(LineChart<Row[]>, { data: data.value }) });
  app.config.errorHandler = e => void errors.push(e);
  app.mount(host());
  mounted.push(() => app.unmount());
  expect(errors).toEqual([]);
  data.value = unguessable();
  await nextTick();
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
});

test('a listener that throws or rejects reaches app.config.errorHandler and the merged listeners after it still run', async () => {
  const errors: unknown[] = [];
  const after = vi.fn();
  const [thrown, rejected, failed] = [new Error('click'), new Error('async click'), new Error('async error')];
  const data = shallowRef(rows(() => 0.5));
  const app = createApp({
    render: () =>
      h(ScatterChart as Component, {
        data: data.value,
        width: 100,
        height: 100,
        ...look,
        onClick: [
          () => {
            throw thrown;
          },
          () => Promise.reject(rejected),
          after,
        ],
        onError: () => Promise.reject(failed),
      }),
  });
  app.config.errorHandler = e => void errors.push(e);
  const el = host();
  app.mount(el);
  mounted.push(() => app.unmount());
  click(el.firstElementChild as HTMLElement, 50, 50);
  expect(after).toHaveBeenCalledOnce();
  data.value = unguessable();
  await nextTick();
  await Promise.resolve();
  expect(errors).toEqual([thrown, rejected, failed]);
});

test('a first mount that throws goes to @error with an empty host, and the next prop change creates the chart', async () => {
  const onError = vi.fn();
  const data = shallowRef(unguessable());
  const r = mount(LineChart, () => ({ data: data.value, onError }));
  expect(onError).toHaveBeenCalledOnce();
  expect(r.el.children).toHaveLength(0);
  data.value = rows(() => 0.5);
  await nextTick();
  expect(canvases(r.el)).toBe(1);
});

test('no loop: inline props and an @error that writes state report a failure once', async () => {
  const err = ref<unknown>();
  const onError = vi.fn();
  const data = [{ x: 1, c: 1 }];
  let renders = 0;
  mount(LineChart, () => {
    renders++;
    void err.value;
    return {
      data,
      y: ['a', 'b'],
      onClick: () => {},
      onError: (e: unknown) => {
        onError(e);
        err.value = e;
      },
    };
  });
  for (let i = 0; i < 5; i++) await nextTick();
  expect(onError).toHaveBeenCalledOnce();
  expect(renders).toBeLessThanOrEqual(3);
});

test('no loop: data and typed arrays rebuilt from the same rows on every render report once; new rows report again', async () => {
  const err = ref<unknown>();
  const onError = vi.fn();
  const source = shallowRef<object[]>([{ x: 1 }]);
  const Chart = bind<Props & { column?: Float64Array }>(
    () => {
      throw new Error('bad');
    },
    { ...declared, column: null },
  );
  let renders = 0;
  mount(Chart, () => {
    renders++;
    void err.value;
    return {
      data: source.value.filter(() => true),
      column: new Float64Array([1, 2]),
      onError: (e: unknown) => {
        onError(e);
        err.value = e;
      },
    };
  });
  for (let i = 0; i < 5; i++) await nextTick();
  expect(onError).toHaveBeenCalledOnce();
  expect(renders).toBeLessThanOrEqual(3);
  source.value = [{ x: 1 }, { x: 2 }];
  for (let i = 0; i < 5; i++) await nextTick();
  expect(onError).toHaveBeenCalledTimes(2);
});

/** A column the core reads by its length, not an array or a typed array. */
class Column {
  length: number;
  constructor(length: number) {
    this.length = length;
  }
}

/** Renders data(n) into a chart that always throws, with an @error that writes state. */
async function reportsOf(data: (n: number) => unknown) {
  const err = ref<unknown>();
  const onError = vi.fn();
  const n = ref(2);
  const Chart = bind<Props>(() => {
    throw new Error('bad');
  }, declared);
  let renders = 0;
  mount(Chart, () => {
    renders++;
    void err.value;
    return {
      data: data(n.value),
      onError: (e: unknown) => {
        onError(e);
        err.value = e;
      },
    };
  });
  for (let i = 0; i < 5; i++) await nextTick();
  const calls = [onError.mock.calls.length, renders <= 3];
  n.value = 1;
  for (let i = 0; i < 5; i++) await nextTick();
  return [...calls, onError.mock.calls.length];
}

test('no loop: an object of columns, copied rows and pairs rebuilt on every render report once; a new length reports again', async () => {
  const xs = [1, 2];
  expect(await reportsOf(n => ({ x: xs.slice(0, n), y: xs.slice(0, n) }))).toEqual([1, true, 2]);
  expect(await reportsOf(n => xs.slice(0, n).map(x => ({ x })))).toEqual([1, true, 2]);
  expect(await reportsOf(n => xs.slice(0, n).map(x => [x, x]))).toEqual([1, true, 2]);
  expect(await reportsOf(n => ({ x: new Column(n) }))).toEqual([1, true, 2]);
});

test('a replaced accessor that throws another error is reported again; one that throws the same error is not', async () => {
  const onError = vi.fn();
  const data = rows(() => 0.5);
  const thrower = (message: string) => () => {
    throw new Error(message);
  };
  const y = shallowRef(thrower('first'));
  mount(LineChart, () => ({ data: data.filter(() => true), y: y.value, onError }));
  y.value = thrower('first');
  await nextTick();
  expect(onError).toHaveBeenCalledOnce();
  y.value = thrower('second');
  await nextTick();
  expect(onError).toHaveBeenCalledTimes(2);
  expect(String(onError.mock.calls[1]![0])).toContain('second');
});

test('@click.once and @error.once listeners are called once', async () => {
  const [onClick, onError] = [vi.fn(), vi.fn()];
  const data = shallowRef(rows(() => 0.5));
  const r = mount(ScatterChart, () => ({
    data: data.value,
    width: 100,
    height: 100,
    ...look,
    onClickOnce: onClick,
    onErrorOnce: onError,
  }));
  click(r.el, 50, 50);
  click(r.el, 50, 50);
  expect(onClick).toHaveBeenCalledOnce();
  data.value = unguessable();
  await nextTick();
  expect(onError).toHaveBeenCalledOnce();
});

test('after an @error.once listener has run, a later failure reaches app.config.errorHandler', async () => {
  const errors: unknown[] = [];
  const onError = vi.fn();
  const data = shallowRef(rows(() => 0.5));
  const app = createApp({
    render: () => h(LineChart as Component, { data: data.value, onErrorOnce: onError }),
  });
  app.config.errorHandler = e => void errors.push(e);
  app.mount(host());
  mounted.push(() => app.unmount());
  data.value = unguessable();
  await nextTick();
  expect([onError.mock.calls.length, errors.length]).toEqual([1, 0]);
  data.value = [...unguessable(), ...unguessable()];
  await nextTick();
  expect([onError.mock.calls.length, errors.length]).toEqual([1, 1]);
});

test('a listener added in an update that fails reaches the last good chart', async () => {
  const { chart, calls } = failingOnB<Props>();
  const label = ref('A');
  const onClick = ref<() => void>();
  mount(bind(chart, declared), () => ({ label: label.value, onError: () => {}, onClick: onClick.value }));
  label.value = 'B';
  onClick.value = () => {};
  await nextTick();
  expect(calls.update).toStrictEqual([
    { label: 'B', onClick: expect.any(Function) },
    { onClick: expect.any(Function) },
  ]);
});

test('an @error bound after the chart mounted is the one a later failure calls', async () => {
  const [first, second] = [vi.fn(), vi.fn()];
  const onError = ref<(e: unknown) => void>();
  const data = shallowRef(rows(() => 0.5));
  mount(LineChart, () => ({ data: data.value, onError: onError.value }));
  onError.value = first;
  await nextTick();
  onError.value = second;
  await nextTick();
  data.value = unguessable();
  await nextTick();
  expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 1]);
});

test('replacing a throwing y accessor alone recovers the chart; a change of @click alone makes no attempt and sends @click alone', async () => {
  const onError = vi.fn();
  const bad = () => {
    throw new Error('bad');
  };
  const y = ref<(r: Row) => number>(bad);
  const data = rows(() => 0.5);
  const r = mount(LineChart, () => ({
    data,
    y: y.value,
    width: 100,
    height: 100,
    onError,
    ...look,
  }));
  expect(onError).toHaveBeenCalledOnce();
  y.value = (row: Row) => row.a;
  await settle();
  expect(red(pixel(r.el, 50, 50))).toBe(true);

  const { chart, calls } = failingOnB<Props>();
  const Chart = bind(chart, declared);
  const label = ref('A');
  const onClick = ref<() => void>();
  mount(Chart, () => ({ label: label.value, onError, onClick: onClick.value }));
  label.value = 'B';
  await nextTick();
  expect([calls.update.length, onError.mock.calls.length]).toEqual([1, 2]);
  onClick.value = () => {};
  await nextTick();
  onClick.value = () => {};
  await nextTick();
  expect(calls.update).toStrictEqual([{ label: 'B' }, { onClick: expect.any(Function) }]);
});

test('going back to the last drawn props after a failed update sends an empty update; bad B, good A, bad B reports twice', async () => {
  const { chart, calls } = failingOnB<Props>();
  const onError = vi.fn();
  const label = ref('A');
  mount(bind(chart, declared), () => ({ label: label.value, onError }));
  for (const l of ['B', 'A', 'B']) {
    label.value = l;
    await nextTick();
  }
  expect(calls.update).toEqual([{ label: 'B' }, {}, { label: 'B' }]);
  expect(onError).toHaveBeenCalledTimes(2);
});

test('Plot draws a pie and its legend', () => {
  const r = mount(Plot, () => ({
    width: 100,
    height: 124,
    margin: ZERO,
    frame: 'polar',
    marks: [arcs({ values: [1, 1], colors: ['#ff0000', '#0000ff'], labels: ['one', 'two'] })],
    use: [legend()],
  }));
  expect(r.el.textContent).toBe('onetwo');
  const middle = (canvasOf(r.el).height / devicePixelRatio + 24) / 2;
  expect(red(pixel(r.el, 70, middle))).toBe(true);
  expect(red(pixel(r.el, 30, middle))).toBe(false);
});

test('server markup hydrates without a warning and then draws', async () => {
  const data = rows(() => 0.5);
  const cases = [
    { props: { data, width: 400, height: 200 }, height: 200 },
    { props: { data }, height: 300 },
  ];
  const warnings = vi.spyOn(console, 'warn');
  const errors = vi.spyOn(console, 'error');
  for (const { props, height } of cases) {
    const view = () => h(LineChart<Row[]>, props);
    const container = host();
    container.innerHTML = await renderToString(createSSRApp({ render: view }));
    const served = container.firstElementChild as HTMLElement;
    const app = createSSRApp({ render: view });
    app.mount(container);
    mounted.push(() => app.unmount());
    expect(container.firstElementChild).toBe(served);
    expect(canvasOf(served)).not.toBeNull();
    expect(served.clientHeight).toBe(height);
  }
  expect([warnings.mock.calls, errors.mock.calls]).toEqual([[], []]);
  warnings.mockRestore();
  errors.mockRestore();
});

type Scope = { layout: Layout; hover: Hover | null };
type Draw = (scope: Scope) => unknown;
const dot = () => [dots({ x: [5], y: [0.5], r: [4], color: '#ff0000' })];
const span = (hi: number) => ({ label: '', domain: [0, hi] as [number, number] });
const axes = { x: span(10), y: span(1) };
const size = { width: 200, height: 100 };
const plotted = { ...size, margin: ZERO, ...axes };
const px = (left: number, top: number) => ({
  position: 'absolute' as const,
  left: `${left}px`,
  top: `${top}px`,
});
const marked: Draw = ({ layout, hover: at }) => [
  h('b', { style: px(layout.xPx!(5), layout.yPx!(0.5)) }),
  at?.hit && h('i', { style: px(at.hit.px, at.hit.py) }),
  at && h('u', JSON.stringify([at.px, at.py, !!at.hit])),
];
/** As a template compiles it: the parent's render gives no new slot, and what the slot reads makes it draw again. */
const stable = (draw: Draw) => ({ $stable: true, default: draw });
const slotted = (
  C: Component,
  props: () => object,
  slots: () => object | undefined,
  container?: HTMLElement,
) => {
  const r = render(() => h(C, props(), slots() as never), container);
  mounted.push(r.unmount);
  return r;
};
const spot = (el: Element, tag: string) => {
  const e = el.querySelector<HTMLElement>(tag);
  return e && [parseFloat(e.style.left), parseFloat(e.style.top)];
};
const near = (got: number[] | null, want: number[]) => {
  expect(got).toHaveLength(2);
  want.forEach((v, i) => expect(got![i]).toBeCloseTo(v, 1));
};
const text = (el: Element) => el.querySelector('i')!.textContent;
const point = (el: HTMLElement, x: number, y: number) => (hover(el, x, y), nextTick());
const leave = (el: HTMLElement) => (
  el.firstElementChild!.dispatchEvent(new PointerEvent('pointerleave')),
  nextTick()
);

test('a slot renders inside the overlay of a Plot, reaches injections, and follows a resize and a zoom in its frame', async () => {
  const marks = dot();
  const use = [zoom()];
  const width = ref(200);
  const Injected = defineComponent(() => {
    const name = inject('name');
    return () => h('s', name as string);
  });
  const App = defineComponent(() => {
    provide('name', 'app');
    return () =>
      h(Plot, { ...plotted, width: width.value, marks, use }, {
        default: (s: Scope) => [marked(s), h(Injected)],
      } as never);
  });
  const r = mount(App, () => ({}));
  await nextTick();
  const marker = r.el.querySelector('b')!;
  const overlay = marker.parentElement!;
  expect(overlay.parentElement).toBe(canvasOf(r.el).parentElement);
  expect(overlay.style.pointerEvents).toBe('none');
  expect(overlay.querySelector('s')!.textContent).toBe('app');
  near(spot(r.el, 'b'), [100, 50]);
  width.value = 400;
  await twoFrames();
  near(spot(r.el, 'b'), [200, 50]);
  wheel(r.el, 0, 50, -100, { ctrlKey: true });
  await nextFrame();
  expect(spot(r.el, 'b')![0]).toBeGreaterThan(210);
  expect(r.el.querySelector('b')).toBe(marker);
});

test('a hovered dot shows the slot tooltip at its anchor until the pointer leaves; a line hovers with no hit', async () => {
  const data = rows(() => 0.5);
  const inPlot = slotted(
    Plot,
    () => ({ ...plotted, marks: dot() }),
    () => ({ default: marked }),
  );
  const scatter = slotted(
    ScatterChart,
    () => ({ data, ...size, ...look }),
    () => ({ default: marked }),
  );
  await nextTick();
  for (const { el } of [inPlot, scatter]) {
    near(spot(el, 'b'), [100, 50]);
    await point(el, 103, 52);
    near(spot(el, 'i'), [100, 50]);
    expect(el.querySelector('u')!.textContent).toBe('[103,52,true]');
    await leave(el);
    expect([spot(el, 'i'), spot(el, 'u')]).toEqual([null, null]);
  }
  const line = slotted(
    LineChart,
    () => ({ data, ...size, ...look }),
    () => ({ default: marked }),
  );
  await point(line.el, 103, 52);
  expect(line.el.querySelector('u')!.textContent).toBe('[103,52,false]');
});

test('@layout and @hover fire while bound, with a slot and without one', async () => {
  const marks = dot();
  for (const slots of [undefined, { default: marked }]) {
    const [onLayout, onHover] = [vi.fn(), vi.fn()];
    const own = ref({});
    const r = slotted(
      Plot,
      () => ({ ...plotted, marks, ...own.value }),
      () => slots,
    );
    await point(r.el, 103, 52);
    expect([onLayout.mock.calls.length, onHover.mock.calls.length]).toEqual([0, 0]);
    own.value = { onLayout, onHover };
    await nextTick();
    await leave(r.el);
    await point(r.el, 103, 52);
    expect(onHover.mock.lastCall![0]).toMatchObject({ px: 103, py: 52, hit: { row: 0 } });
    r.el.style.width = '300px';
    await twoFrames();
    expect(onLayout.mock.lastCall![0].width).toBe(300);
    own.value = {};
    await nextTick();
    const counts = [onLayout.mock.calls.length, onHover.mock.calls.length];
    await leave(r.el);
    r.el.style.width = '200px';
    await twoFrames();
    expect([onLayout.mock.calls.length, onHover.mock.calls.length]).toEqual(counts);
  }
});

test('the host is the same with and without a slot, and a slot that comes and goes recreates nothing', async () => {
  let made = 0;
  const counted: Feature = () => (made++, { destroy() {} });
  const shell = (el: Element) => (el.cloneNode(false) as Element).outerHTML;
  for (const own of [{}, { onLayout: () => {}, onHover: () => {} }]) {
    made = 0;
    const props = { ...plotted, marks: dot(), use: [counted], class: 'c', ...own };
    const on = ref(false);
    const width = ref(200);
    const r = slotted(
      Plot,
      () => ({ ...props, width: width.value }),
      () => (on.value ? { default: marked } : undefined),
    );
    const { el } = r;
    const [canvas, html] = [canvasOf(el), shell(el)];
    expect(spot(el, 'b')).toBeNull();
    await point(el, 103, 52);
    on.value = true;
    await nextTick();
    near(spot(el, 'b'), [100, 50]);
    near(spot(el, 'i'), [100, 50]);
    expect([shell(el), el.children.length]).toEqual([html, 1]);
    on.value = false;
    await nextTick();
    expect(spot(el, 'b')).toBeNull();
    await leave(el);
    width.value = 400;
    await twoFrames();
    on.value = true;
    await nextTick();
    near(spot(el, 'b'), [200, 50]);
    expect(spot(el, 'i')).toBeNull();
    expect([r.container.children.length, r.el, canvasOf(el), made]).toEqual([1, el, canvas, 1]);
  }
});

test('a slot that comes and goes while an update is failing makes no other attempt', async () => {
  const { chart, calls } = failingOnB<Props>();
  const label = ref('A');
  const on = ref(false);
  const onError = vi.fn();
  slotted(
    bind(chart, declared),
    () => ({ label: label.value, onError }),
    () => (on.value ? { default: () => [] } : undefined),
  );
  label.value = 'B';
  await nextTick();
  on.value = true;
  await nextTick();
  const forwarded = { onLayout: expect.any(Function), onHover: expect.any(Function) };
  expect(calls.update).toEqual([{ label: 'B' }, forwarded]);
  on.value = false;
  await nextTick();
  expect(calls.update).toEqual([{ label: 'B' }, forwarded, { onLayout: undefined, onHover: undefined }]);
  expect(onError).toHaveBeenCalledOnce();
});

test('going back to the last drawn props after a failed update calls the slot once the chart is restored', async () => {
  const { chart } = failingOnB<Props & { onLayout?: (layout: Layout) => void }>();
  const log: string[] = [];
  const Chart = bind((el: HTMLElement, props: Props & { onLayout?: (layout: Layout) => void }) => {
    const c = chart(el, props);
    el.append(c.overlay);
    props.onLayout?.({} as Layout);
    const update: typeof c.update = partial => (log.push('update'), c.update(partial));
    return { ...c, update };
  }, declared);
  const label = ref('A');
  slotted(
    Chart,
    () => ({ label: label.value, onError: () => {} }),
    () => ({ default: () => (log.push('draw'), []) }),
  );
  await nextTick();
  for (const l of ['B', 'A']) {
    label.value = l;
    await nextTick();
  }
  expect(log).toEqual(['draw', 'update', 'update', 'draw']);
});

test('a slot that comes back after a resize is first called with the layout as it is now', async () => {
  const marks = dot();
  const state = shallowRef({ width: 200, on: true });
  const seen: number[] = [];
  slotted(
    Plot,
    () => ({ ...plotted, width: state.value.width, marks }),
    () => (state.value.on ? { default: (s: Scope) => (seen.push(s.layout.width), []) } : undefined),
  );
  for (const next of [
    { width: 200, on: false },
    { width: 400, on: false },
    { width: 400, on: true },
  ]) {
    await twoFrames();
    seen.length = 0;
    state.value = next;
  }
  await twoFrames();
  expect([...new Set(seen)]).toEqual([400]);
});

test('slot nodes survive a feature change that makes the chart again, and the tooltip of the old chart goes', async () => {
  const data = rows(() => 0.5);
  const zooms = ref(false);
  const r = slotted(
    ScatterChart,
    () => ({ data, ...size, ...look, zoom: zooms.value, tooltip: false }),
    () => ({ default: marked }),
  );
  await point(r.el, 103, 52);
  const [canvas, marker] = [canvasOf(r.el), r.el.querySelector('b')!];
  expect(spot(r.el, 'i')).not.toBeNull();
  zooms.value = true;
  await nextTick();
  expect(canvasOf(r.el)).not.toBe(canvas);
  expect(r.el.querySelector('b')).toBe(marker);
  expect(marker.isConnected).toBe(true);
  expect(spot(r.el, 'i')).toBeNull();
});

const naming =
  (data: () => Row[]): Draw =>
  ({ layout, hover: at }) =>
    h('i', `${layout.width} ${at?.hit ? data()[at.hit.row!]!.x : 'none'}`);
/** The slot as a template compiles it, and as a render function makes it anew. */
const kinds = [
  (draw: () => Draw) => {
    const slots = stable(s => draw()(s));
    return () => slots;
  },
  (draw: () => Draw) => () => ({ default: draw() }),
];

test('a slot that indexes the app rows by the hovered row never meets rows or a frame the chart has not taken', async () => {
  const few = [{ x: 0, a: 0.5 }];
  const many = rows(() => 0.5);
  const marksOf = (data: Row[]) => [
    dots({ x: data.map(d => d.x), y: data.map(d => d.a), r: data.map(() => 4), color: '#ff0000' }),
  ];
  for (const kind of kinds) {
    for (const plain of [true, false]) {
      const data = shallowRef(many);
      const r = slotted(
        plain ? Plot : ScatterChart,
        () => (plain ? { ...plotted, marks: marksOf(data.value) } : { data: data.value, ...size, ...look }),
        kind(() => {
          const taken = data.value;
          return naming(() => taken);
        }),
      );
      await point(r.el, 198, 50);
      expect(text(r.el)).toBe('200 10');
      data.value = few;
      await nextTick();
      expect(text(r.el)).toBe('200 none');
      data.value = many;
      await nextTick();
      expect(text(r.el)).toBe('200 10');
      r.el.querySelector('i')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, buttons: 1 }));
      data.value = few;
      await nextTick();
      expect(text(r.el)).toBe('200 none');
    }

    const flat = ref(false);
    const round = {
      ...size,
      marks: [arcs({ values: [1, 2], colors: ['#ff0000', '#0000ff'] })],
      frame: 'polar',
    };
    const r = slotted(
      Plot,
      () => (flat.value ? { ...plotted, marks: dot() } : round),
      kind(() => (flat.value ? marked : ({ layout }) => h('i', layout.frame))),
    );
    await nextTick();
    expect(text(r.el)).toBe('polar');
    flat.value = true;
    await nextTick();
    near(spot(r.el, 'b'), [100, 50]);
  }
});

test('while an update fails the slot stays as it was drawn until its hover goes, whatever it reads, and draws again with the next good props', async () => {
  for (const kind of kinds) {
    const onError = vi.fn();
    const data = shallowRef(rows(() => 0.5));
    const note = ref('');
    const calls: string[] = [];
    const r = slotted(
      ScatterChart,
      () => ({ data: data.value, ...size, ...look, onError }),
      kind(() => {
        const [taken, n] = [data.value, note.value];
        return s => (calls.push(n), naming(() => taken)(s));
      }),
    );
    await point(r.el, 198, 50);
    data.value = unguessable();
    await nextTick();
    expect(onError).toHaveBeenCalledOnce();
    calls.length = 0;
    note.value = 'failing';
    await nextTick();
    expect([text(r.el), calls]).toEqual(['200 10', []]);
    await leave(r.el);
    expect([r.el.querySelector('i'), calls]).toEqual([null, []]);
    data.value = [{ x: 0, a: 0.5 }];
    await nextTick();
    expect(text(r.el)).toBe('200 none');
    expect(calls).toEqual(['failing']);
    note.value = 'good';
    await nextTick();
    expect(calls).toEqual(['failing', 'good']);
  }
});

test('a failing update hides a slot whose hover goes in the same tick, and keeps one drawn with no hover', async () => {
  for (const kind of kinds) {
    for (const hovered of [true, false]) {
      const data = shallowRef(rows(() => 0.5));
      const r = slotted(
        ScatterChart,
        () => ({ data: data.value, ...size, ...look, onError: () => {} }),
        kind(() => {
          const taken = data.value;
          return naming(() => taken);
        }),
      );
      await nextTick();
      if (hovered) await point(r.el, 198, 50);
      data.value = unguessable();
      if (hovered) await leave(r.el);
      else await point(r.el, 198, 50);
      await nextTick();
      expect(r.el.querySelector('i')?.textContent).toBe(hovered ? undefined : '200 none');
      data.value = rows(() => 0.5);
      await nextTick();
      expect(text(r.el)).toBe(hovered ? '200 none' : '200 10');
    }
  }
});

test('a failing update that makes the last good chart again keeps a slot drawn with no hover', async () => {
  for (const kind of kinds) {
    const onError = vi.fn();
    const onLayout = vi.fn();
    const bad = ref(false);
    const width = ref(200);
    const marks = dot();
    const good = { ...plotted, marks, onError, onLayout };
    const scale = () => {
      throw new Error('scale');
    };
    const r = slotted(
      Plot,
      () => ({ ...good, width: width.value, ...(bad.value && { x: { ...span(10), scale } }) }),
      kind(() => marked),
    );
    await nextTick();
    const marker = r.el.querySelector('b');
    bad.value = true;
    await nextTick();
    expect(onError).toHaveBeenCalledOnce();
    expect(onLayout).toHaveBeenCalledTimes(2);
    expect(r.el.querySelector('b')).toBe(marker);
    near(spot(r.el, 'b'), [100, 50]);
    width.value = 400;
    await twoFrames();
    expect(spot(r.el, 'b')).toBeNull();
    bad.value = false;
    await nextTick();
    near(spot(r.el, 'b'), [200, 50]);
  }
});

test('a failing update hides a slot drawn for a layout that a resize or a zoom replaces, until the next good props', async () => {
  for (const kind of kinds) {
    for (const zooms of [false, true]) {
      const data = shallowRef(rows(() => 0.5));
      const width = ref(200);
      const r = slotted(
        ScatterChart,
        () => ({ data: data.value, ...size, width: width.value, ...look, zoom: true, onError: () => {} }),
        kind(() => {
          const taken = data.value;
          return s => [taken.length, marked(s)];
        }),
      );
      await nextTick();
      near(spot(r.el, 'b'), [100, 50]);
      data.value = unguessable();
      await nextTick();
      near(spot(r.el, 'b'), [100, 50]);
      if (zooms) wheel(r.el, 0, 50, -100, { ctrlKey: true });
      else width.value = 400;
      await twoFrames();
      expect(spot(r.el, 'b')).toBeNull();
      data.value = rows(() => 0.5);
      await twoFrames();
      const [left] = spot(r.el, 'b')!;
      if (zooms) expect(left).toBeGreaterThan(105);
      else expect(left).toBeCloseTo(200, 1);
    }
  }
});

test('a slot given while the chart has no room or failed to mount shows once it draws', async () => {
  const hidden = host();
  hidden.style.display = 'none';
  const r = slotted(
    Plot,
    () => ({ marks: dot(), ...axes, margin: ZERO }),
    () => ({ default: marked }),
    hidden,
  );
  await nextTick();
  expect(spot(r.el, 'b')).toBeNull();
  hidden.style.display = '';
  await twoFrames();
  expect(spot(r.el, 'b')![1]).toBeGreaterThan(0);

  const data = shallowRef(unguessable());
  const failed = slotted(
    LineChart,
    () => ({ data: data.value, ...size, ...look, onError: () => {} }),
    () => ({ default: marked }),
  );
  await nextTick();
  expect(spot(failed.el, 'b')).toBeNull();
  data.value = rows(() => 0.5);
  await nextTick();
  near(spot(failed.el, 'b'), [100, 50]);
});

test('a slot for another frame, given as the chart loses its room, waits for the layout of that frame', async () => {
  const round = {
    ...size,
    marks: [arcs({ values: [1, 2], colors: ['#ff0000', '#0000ff'] })],
    frame: 'polar',
  };
  const gone = { style: { display: 'none' } };
  for (const kind of kinds) {
    for (const byResize of [true, false]) {
      const frames: string[] = [];
      const state = shallowRef({ flat: false, gone: false });
      const r = slotted(
        Plot,
        () => ({
          ...(state.value.flat ? { ...plotted, frame: 'axes', marks: dot() } : round),
          ...(state.value.gone && gone),
        }),
        kind(() => {
          const { flat } = state.value;
          return s => {
            if (flat) frames.push(s.layout.frame);
            return flat ? marked(s) : h('i', s.layout.frame);
          };
        }),
      );
      await nextTick();
      expect(text(r.el)).toBe('polar');
      state.value = { flat: true, gone: true };
      await nextTick();
      await twoFrames();
      expect([frames, spot(r.el, 'b')]).toEqual([[], null]);
      if (byResize) r.el.style.display = '';
      else state.value = { flat: true, gone: false };
      await twoFrames();
      near(spot(r.el, 'b'), [100, 50]);
      expect(new Set(frames)).toEqual(new Set(['axes']));
    }
  }
});

test('a slot taken away while the chart has no room stays away when it draws', async () => {
  const marks = dot();
  const on = ref(true);
  const gone = ref(false);
  const r = slotted(
    Plot,
    () => ({ ...plotted, marks, onLayout: () => {}, ...(gone.value && { style: { display: 'none' } }) }),
    () => (on.value ? { default: marked } : undefined),
  );
  gone.value = true;
  await twoFrames();
  on.value = false;
  await nextTick();
  gone.value = false;
  await twoFrames();
  expect(spot(r.el, 'b')).toBeNull();
});

test('a slot is called once for a hover, for a render of the app and for a change of what it reads', async () => {
  const props = { ...plotted, marks: dot() };
  const note = ref('a');
  const tick = ref(0);
  const draw = vi.fn(() => h('i', note.value));
  const r = slotted(
    Plot,
    () => (tick.value, props),
    () => ({ default: () => draw() }),
  );
  await nextTick();
  for (const change of [() => hover(r.el, 103, 52), () => tick.value++, () => (note.value = 'b')]) {
    draw.mockClear();
    change();
    await nextTick();
    expect(draw).toHaveBeenCalledOnce();
  }
  expect(text(r.el)).toBe('b');
});

test('the server renders the host alone with a slot, it hydrates without a warning, and unmounting leaves nothing', async () => {
  const view = () => h(Plot, { ...plotted, marks: dot() }, { default: marked } as never);
  const bare = () => h(Plot, { ...plotted, marks: dot() });
  const html = await renderToString(createSSRApp({ render: view }));
  expect(html).toBe(await renderToString(createSSRApp({ render: bare })));
  const warnings = vi.spyOn(console, 'warn');
  const errors = vi.spyOn(console, 'error');
  const container = host();
  container.innerHTML = html;
  const app = createSSRApp({ render: view });
  app.mount(container);
  await nextTick();
  near(spot(container, 'b'), [100, 50]);
  app.unmount();
  expect(container.querySelector('b')).toBeNull();
  expect([warnings.mock.calls, errors.mock.calls]).toEqual([[], []]);
  warnings.mockRestore();
  errors.mockRestore();
});

test('no loop: an inline slot, listeners that set state, marks and axis conversions rebuilt in every render', async () => {
  let [renders, draws] = [0, 0];
  const App = defineComponent(() => {
    const layout = shallowRef<Layout>();
    const at = shallowRef<Hover | null>(null);
    return () => {
      renders++;
      return h(
        Plot,
        {
          ...plotted,
          marks: dot(),
          'data-seen': [layout.value?.width, at.value?.px].join(),
          onLayout: (l: Layout) => (layout.value = l),
          onHover: (v: Hover | null) => (at.value = v),
        } as never,
        { default: (s: Scope) => (draws++, marked(s)) } as never,
      );
    };
  });
  const r = mount(App, () => ({}));
  await twoFrames();
  const settled = [renders, draws];
  hover(r.el, 103, 52);
  await twoFrames();
  near(spot(r.el, 'i'), [100, 50]);
  expect(settled[0]).toBeLessThanOrEqual(3);
  expect(renders - settled[0]!).toBeLessThanOrEqual(2);
  expect(draws - settled[1]!).toBeLessThanOrEqual(2);

  draws = 0;
  const tick = ref(0);
  // Conversions made anew are a new layout to the core, which an app that keeps it in its state would render for.
  const inline = slotted(
    Plot,
    () => (
      tick.value,
      { ...plotted, x: { ...span(10), to: (v: number) => v, from: (v: number) => v }, marks: dot() }
    ),
    () => ({ default: (s: Scope) => (draws++, marked(s)) }),
  );
  await twoFrames();
  const before = draws;
  tick.value++;
  await twoFrames();
  near(spot(inline.el, 'b'), [100, 50]);
  expect(draws - before).toBe(1);
});
