import { expect, test, type Locator, type Page } from '@playwright/test';
import { scripted } from '../../src/examples/index';
import { tooltipOf, watch } from './charts';

const demo = (page: Page) => page.locator('[data-scripted] .chart');

/** The middle of the first run of strongly coloured pixels on a canvas, in CSS pixels from its corner: somewhere on a mark. */
const onMark = (canvas: Locator) =>
  canvas.evaluate((c: HTMLCanvasElement) => {
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    const scale = c.width / c.clientWidth;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (data[i + 3] !== 255 || Math.max(r, g, b) - Math.min(r, g, b) < 80) continue;
      const at = i / 4;
      return { x: ((at % c.width) + 2) / scale, y: (Math.floor(at / c.width) + 2) / scale };
    }
    throw new Error('nothing is drawn');
  });

/** A click at a point of a canvas: the chart listens above its canvases, which take no pointer events. */
async function clickAt(page: Page, canvas: Locator, at: { x: number; y: number }) {
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + at.x, box.y + at.y);
}

async function open(page: Page, id: string) {
  await page.goto(`/examples/${id}`);
  const canvas = demo(page).locator('canvas').first();
  await expect.poll(() => onMark(canvas).catch(() => null)).not.toBeNull();
  await page.waitForTimeout(600);
  return canvas;
}

test('every hand-written example is listed, shows its three files and one at a time', async ({ page }) => {
  for (const { id, title } of scripted) {
    await page.goto(`/examples/${id}`);
    await expect(page.locator('h1')).toHaveText(title);
    const files = page.locator('.snip', {
      has: page.locator('header span', { hasText: /^(chart\.js|Chart\.tsx|Chart\.vue)$/ }),
    });
    await expect(files).toHaveCount(3);
    await expect(files.locator('visible=true')).toHaveCount(1);
    await expect(files.locator('visible=true').locator('code')).toContainText('swiftplot');
  }
});

test('/examples/bar-new-data redraws its bars for each button', async ({ page }) => {
  const errors = watch(page);
  const canvas = await open(page, 'bar-new-data');
  const drawn = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  for (const name of ['New scores', 'Sort']) {
    const before = await drawn();
    await demo(page).getByRole('button', { name }).click();
    await expect.poll(drawn).not.toBe(before);
    await page.waitForTimeout(500);
  }
  expect(errors).toEqual([]);
});

test('/examples/click-pin pins the dot clicked and lets it go on a second click', async ({ page }) => {
  const errors = watch(page);
  const canvas = await open(page, 'click-pin');
  const note = demo(page).locator('p');
  await expect(note).toHaveText('Click a dot to pin it.');
  await clickAt(page, canvas, await onMark(canvas));
  await expect(note).toHaveText(/^Pinned: \S/);
  await page.mouse.move(0, 0);
  await clickAt(page, canvas, await onMark(canvas));
  await expect(note).toHaveText('Click a dot to pin it.');
  expect(errors).toEqual([]);
});

test('/examples/bar-drill-down draws the days of the bar clicked', async ({ page }) => {
  const errors = watch(page);
  const canvas = await open(page, 'bar-drill-down');
  const below = demo(page).locator('canvas').nth(1);
  await expect(below).toBeHidden();
  await clickAt(page, canvas, await onMark(canvas));
  await expect(below).toBeVisible();
  await expect.poll(() => onMark(below).catch(() => null)).not.toBeNull();
  expect(errors).toEqual([]);
});

test('/examples/linked-crosshairs shows the day pointed at in both charts', async ({ page }) => {
  const errors = watch(page);
  const canvas = await open(page, 'linked-crosshairs');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2);
  const tips = tooltipOf(demo(page));
  await expect(tips).toHaveCount(2);
  const day = (text: string) => text.match(/\d{4}-\d\d-\d\d/)?.[0];
  const [first, second] = (await tips.allTextContents()).map(day);
  expect(first).toBeDefined();
  expect(second).toBe(first);
  expect(errors).toEqual([]);
});

test('/examples/series-hidden keeps its checkboxes and the legend in step', async ({ page }) => {
  const errors = watch(page);
  await open(page, 'series-hidden');
  const box = (name: string) => demo(page).locator('label', { hasText: name }).locator('input');
  const entry = (name: string) => demo(page).locator('[aria-pressed]', { hasText: name });
  await expect(entry('jobs')).toHaveAttribute('aria-pressed', 'false');
  await box('web').uncheck();
  await expect(entry('web')).toHaveAttribute('aria-pressed', 'false');
  await entry('api').click();
  await expect(box('api')).not.toBeChecked();
  await entry('jobs').click();
  await expect(box('jobs')).toBeChecked();
  expect(errors).toEqual([]);
});

test('/examples/overlay-tooltip shows its own markers, and a tooltip by the dot pointed at', async ({
  page,
}) => {
  const errors = watch(page);
  const canvas = await open(page, 'overlay-tooltip');
  for (const name of ['Brew Lab', 'Elm Street', 'Juniper'])
    await expect(demo(page).locator('span', { hasText: name })).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const at = await onMark(canvas);
  const tip = demo(page).getByText('rated 4.9').locator('..');
  await expect(tip).toBeHidden();
  await page.mouse.move(box.x + at.x, box.y + at.y);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Juniper');
  const { x, y, width, height } = (await tip.boundingBox())!;
  expect(Math.abs(x + width + 12 - box.x - at.x)).toBeLessThan(12);
  expect(Math.abs(y + height / 2 - box.y - at.y)).toBeLessThan(12);
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  expect(errors).toEqual([]);
});

test('/examples/css-variables repaints its bars and text from the variables changed', async ({ page }) => {
  const errors = watch(page);
  const canvas = await open(page, 'css-variables');
  const at = await onMark(canvas);
  const colours = async () => ({
    bar: await canvas.evaluate((c: HTMLCanvasElement, { x, y }) => {
      const scale = c.width / c.clientWidth;
      return [...c.getContext('2d')!.getImageData((x + 10) * scale, (y + 10) * scale, 1, 1).data];
    }, at),
    text: await demo(page)
      .getByText('Cobalt')
      .evaluate(e => getComputedStyle(e).color),
  });
  await expect.poll(colours).toEqual({ bar: [8, 145, 178, 255], text: 'rgb(51, 65, 85)' });
  await demo(page).getByRole('button', { name: 'Dark' }).click();
  await expect.poll(colours).toEqual({ bar: [34, 211, 238, 255], text: 'rgb(203, 213, 225)' });
  await demo(page).getByRole('button', { name: 'Light' }).click();
  await expect.poll(colours).toEqual({ bar: [8, 145, 178, 255], text: 'rgb(51, 65, 85)' });
  expect(errors).toEqual([]);
});
