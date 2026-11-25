import { expect, test, type Locator, type Page } from '@playwright/test';

export const watch = (page: Page) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(request.url()));
  const origin = new URL(test.info().project.use.baseURL!).origin;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== origin) errors.push(`another origin: ${url}`);
  });
  return errors;
};

export const chartOf = (scope: Locator) => scope.locator('[data-example] .chart');
export const codeOf = (scope: Locator) => scope.locator('code[data-live]:visible').textContent();
export const drawing = (chart: Locator) =>
  chart.locator('canvas').evaluateAll(cs => cs.map(c => (c as HTMLCanvasElement).toDataURL()).join());

export async function mountCharts(page: Page) {
  for (const chart of await page.locator('.chart, #million-chart, #first-draw').all()) {
    await chart.scrollIntoViewIfNeeded();
    await expect(chart.locator('canvas').first()).toBeAttached();
  }
  await page.waitForLoadState('networkidle');
}

export const countWebgl = (page: Page) =>
  page.addInitScript(() => {
    const contexts: WebGLRenderingContext[] = [];
    let peak = 0;
    const live = () => contexts.filter(c => !c.isContextLost()).length;
    const get = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!.value as (
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
      const context = get.apply(this, args);
      if (
        String(args[0]).startsWith('webgl') &&
        context &&
        !contexts.includes(context as WebGLRenderingContext)
      ) {
        contexts.push(context as WebGLRenderingContext);
        peak = Math.max(peak, live());
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
    Object.assign(window, { liveWebgl: live, peakWebgl: () => peak });
  });

export const liveWebgl = (page: Page) =>
  page.evaluate(() => (window as unknown as { liveWebgl(): number }).liveWebgl());

export const peakWebgl = (page: Page) =>
  page.evaluate(() => (window as unknown as { peakWebgl(): number }).peakWebgl());

async function shot(page: Page, chart: Locator, scroll: boolean) {
  const mask = { mask: [chart.locator('span')], maskColor: '#808080' };
  if (scroll) return chart.screenshot(mask);
  const box = (await chart.boundingBox())!;
  const view = page.viewportSize()!;
  const x = Math.max(box.x, 0);
  const y = Math.max(box.y, 0);
  const width = Math.min(box.x + box.width, view.width) - x;
  const height = Math.min(box.y + box.height, view.height) - y;
  return page.screenshot({ ...mask, clip: { x, y, width, height } });
}

export const colouredPixels = async (page: Page, chart: Locator, scroll = true) => {
  const png = (await shot(page, chart, scroll)).toString('base64');
  return page.evaluate(async png => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), {
      width: image.width,
      height: image.height,
    });
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4)
      if (
        Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!) >
        80
      )
        count++;
    return count;
  }, png);
};

/** With `scroll: false` it checks only the part of the chart already in the viewport, leaving the scroll where it is. */
export async function expectChartDrawn(page: Page, chart: Locator, { scroll = true } = {}) {
  if (scroll) await chart.scrollIntoViewIfNeeded();
  await expect.poll(() => colouredPixels(page, chart, scroll)).toBeGreaterThan(50);
}

/** The chart's screenshot once two in a row are the same, with the pointer moved off it. */
export async function settled(chart: Locator) {
  await chart.page().mouse.move(0, 0);
  let last = await chart.screenshot();
  await expect
    .poll(async () => {
      const now = await chart.screenshot();
      const same = now.equals(last);
      last = now;
      return same;
    })
    .toBe(true);
  return last;
}

export const xTicks = (chart: Locator) =>
  chart.evaluate(el =>
    [...el.querySelectorAll<HTMLElement>('div')]
      .filter(d => /^translate\(-50%, 0(px)?\)$/.test(d.style.transform))
      .map(d => d.textContent),
  );

export const yTicks = (chart: Locator) =>
  chart.evaluate(el =>
    [...el.querySelectorAll<HTMLElement>('div')]
      .filter(d => /^translate\(-100%, -50%\)$/.test(d.style.transform))
      .map(d => d.textContent),
  );

export const span = (ticks: (string | null)[]) => {
  const values = ticks.map(t => Number(t?.replace(/,/g, '')));
  return Math.max(...values) - Math.min(...values);
};

export const days = (ticks: (string | null)[]) => {
  const day = (label: string | null | undefined) => Number(label?.replace('Nov ', ''));
  return day(ticks.at(-1)) - day(ticks[0]);
};

export const seriesPixels = (chart: Locator) =>
  chart.evaluate(el => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--c1').trim();
    const want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const canvas = el.querySelector('canvas');
    if (!canvas) return '';
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const at: number[] = [];
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] === 255 && want.every((v, c) => Math.abs(data[i + c]! - v) <= 8)) at.push(i / 4);
    return at.join();
  });

export async function zoomIn(page: Page, chart: Locator) {
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -600);
  await page.keyboard.up('Control');
}

export const tooltipOf = (chart: Locator) => chart.locator('div[style*="z-index: 100"]');

export async function hover(page: Page, chart: Locator) {
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 3);
}

/** Counts the one-second timers of the live definitions; in dev, Vite's client also runs a timer, to ping its server. */
export const countIntervals = (page: Page) =>
  page.addInitScript(() => {
    const active = new Set<unknown>();
    const { setInterval: set, clearInterval: clear } = globalThis;
    globalThis.setInterval = ((...args: Parameters<typeof set>) => {
      const id = set(...args);
      if (args[1] === 1000) active.add(id);
      return id;
    }) as typeof set;
    globalThis.clearInterval = (id => {
      active.delete(id);
      clear(id);
    }) as typeof clear;
    Object.assign(window, { intervals: () => [...active].map(String) });
  });

export const timers = (page: Page) =>
  page.evaluate(() => (window as unknown as { intervals(): string[] }).intervals());
