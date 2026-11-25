import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  countWebgl,
  days,
  expectChartDrawn,
  hover,
  liveWebgl,
  seriesPixels,
  tooltipOf,
  watch,
  xTicks,
  zoomIn,
} from './charts';

const hero = '.hero .swarm';
// One sample screenshots and decodes ~200k points, which takes ~3 s when the suite's workers share the GPU.
const sampling = { timeout: 15_000 };

const pixelsByColour = async (page: Page, swarm: Locator) => {
  const png = (
    await swarm.screenshot({ mask: [page.locator('.lead, .live')], maskColor: '#000000' })
  ).toString('base64');
  return page.evaluate(
    async ({ png, selector }) => {
      const hue = (r: number, g: number, b: number) => {
        const max = Math.max(r, g, b);
        const d = max - Math.min(r, g, b);
        const h = max === r ? (g - b) / d : max === g ? 2 + (b - r) / d : 4 + (r - g) / d;
        return (h * 60 + 360) % 360;
      };
      const style = getComputedStyle(document.querySelector(selector)!);
      const wanted = ['--c1', '--c2', '--c3'].map(name => {
        const hex = style.getPropertyValue(name).trim();
        return hue(...([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]));
      });
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
      const counts = wanted.map(() => 0);
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
        if (Math.max(r, g, b) - Math.min(r, g, b) < 80) continue;
        const h = hue(r, g, b);
        const k = wanted.findIndex(w => Math.min(Math.abs(h - w), 360 - Math.abs(h - w)) < 12);
        if (k >= 0) counts[k]!++;
      }
      return counts;
    },
    { png, selector: hero },
  );
};

test('the first screen draws its points in the three chart colours, with no error', async ({ page }) => {
  const errors = watch(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('swiftplot');
  await expect(page.getByRole('link', { name: 'Get started' })).toHaveAttribute(
    'href',
    '/guides/getting-started',
  );
  await expect
    .poll(async () => Math.min(...(await pixelsByColour(page, page.locator(hero)))), sampling)
    .toBeGreaterThan(200);
  await page.locator('.close .swarm').scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Math.min(...(await pixelsByColour(page, page.locator('.close .swarm')))), sampling)
    .toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test('the install line follows the framework and Copy copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const select = page.getByLabel('Framework');
  for (const [fw, line] of [
    ['js', 'npm i swiftplot'],
    ['react', 'npm i swiftplot @swiftplot/react'],
    ['vue', 'npm i swiftplot @swiftplot/vue'],
  ] as const) {
    await select.selectOption(fw);
    const shown = page.locator('.cp:visible');
    await expect(shown.locator('code')).toHaveText([line], { useInnerText: true });
    await shown.getByRole('button', { name: 'Copy' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(line);
  }
});

const twoShots = async (page: Page) => {
  const swarm = page.locator(hero);
  await expect
    .poll(async () => Math.min(...(await pixelsByColour(page, swarm))), sampling)
    .toBeGreaterThan(200);
  const first = await swarm.screenshot();
  await page.waitForTimeout(1000);
  return [first, await swarm.screenshot()] as const;
};

test('the points move, and stand still under reduced motion', async ({ page }) => {
  await page.goto('/');
  const [moving, later] = await twoShots(page);
  expect(moving.equals(later)).toBe(false);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const [still, after] = await twoShots(page);
  expect(still.equals(after)).toBe(true);
});

test('at 390 px wide nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const fw of ['js', 'react', 'vue']) {
    await page.goto(`/?fw=${fw}`);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  }
});

test('at 360 px wide the first-draw chart and the reasons stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => {
    const edge = document.documentElement.clientWidth;
    return [...document.querySelectorAll('.why, .why *')]
      .map(el => el.getBoundingClientRect().right - edge)
      .filter(over => over > 0.5);
  });
  expect(overflow).toEqual([]);
});

for (const width of [1440, 1024, 768, 430, 390, 360])
  test(`at ${width} px each headline number stays on one line`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const lines = await page.locator('.big3 b').evaluateAll(numbers =>
      numbers.map(b => {
        const range = document.createRange();
        range.selectNodeContents(b);
        const fits = range.getBoundingClientRect().width <= b.clientWidth + 0.5;
        return fits ? new Set([...range.getClientRects()].map(r => Math.round(r.top))).size : 0;
      }),
    );
    expect(lines).toEqual([1, 1, 1]);
  });

for (const [width, shown] of [
  [490, true],
  [480, false],
] as const) {
  test(`at ${width} px the wordmark is ${shown ? 'shown' : 'hidden'} and the home link keeps its name`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    const home = page.locator('header').getByRole('link', { name: 'swiftplot', exact: true });
    await expect(home).toBeVisible();
    const box = await home.locator('span').boundingBox();
    expect(box!.width > 1).toBe(shown);
  });
}

test('the wall, the million points, the first-draw chart and the two code demos all draw, within eight WebGL contexts', async ({
  page,
}) => {
  const errors = watch(page);
  await countWebgl(page);

  await page.goto('/');
  const tiles = page.locator('.wall a');
  await expect(tiles).toHaveCount(21);
  for (const href of await tiles.evaluateAll(as => as.map(a => a.getAttribute('href')!)))
    expect(href).toMatch(/^\/examples(\/[a-z-]+(\?[\w.=&]+)?)?$/);
  await expect(page.locator('.wall a[href^="/examples/"]')).toHaveCount(19);

  for (const chart of [
    ...(await page.locator('.wall .chart').all()),
    page.locator('#million-chart'),
    page.locator('#first-draw'),
    page.locator('#features .chart'),
    page.locator('#out-chart'),
  ])
    await expectChartDrawn(page, chart);
  await expect(page.locator('.wall [aria-pressed]')).toHaveCount(0);
  expect(await liveWebgl(page)).toBeGreaterThanOrEqual(3);
  expect(await liveWebgl(page)).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
});

test('every wall tile links to a page that exists', async ({ page }) => {
  await page.goto('/');
  const links = new Set(
    await page.locator('.wall a').evaluateAll(as => as.map(a => a.getAttribute('href')!)),
  );
  for (const href of links) expect((await page.request.get(href)).status(), href).toBe(200);
  expect(links).toContain('/examples/line-zoom?curve=step');
  expect(links).toContain('/examples/pie-donut?inner=0.6');

  await page.locator('.wall a', { hasText: 'Stacked bars' }).click();
  await expect(page).toHaveURL(/\/examples\/bar-grouped\?stack=true$/);
  await expect(page.getByLabel('Stack')).toBeChecked();
});

test('each code demo links the data its code imports, as a download of valid JSON', async ({ page }) => {
  await page.goto('/');
  for (const section of ['#features', '#code']) {
    const link = page.locator(`${section} .out a[download]`);
    await expect(link).toHaveAttribute('download', 'requests.json');
    await expect(page.locator(`${section} code`).first()).toContainText('./requests.json');
    const response = await page.request.get((await link.getAttribute('href'))!);
    expect(response.status()).toBe(200);
    expect(Array.isArray(await response.json())).toBe(true);
  }
});

for (const width of [1440, 430, 390])
  test(`the first-draw chart labels every case on its x axis at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const chart = page.locator('#first-draw');
    await chart.scrollIntoViewIfNeeded();
    for (const [label, count] of [
      ['600', 1],
      ['6k', 1],
      ['500', 1],
      ['10k', 1],
      ['100k', 2],
    ] as const) {
      const ticks = chart.getByText(label, { exact: true });
      await expect(ticks).toHaveCount(count);
      for (const tick of await ticks.all()) await expect(tick).toBeVisible();
    }
    for (const kind of ['Line', 'Scatter'])
      await expect(chart.getByText(kind, { exact: true })).toBeVisible();
  });

test('the size buttons change the point count shown and the chart', async ({ page }) => {
  await page.goto('/');
  const chart = page.locator('#million-chart');
  await expectChartDrawn(page, chart);
  await expect(page.locator('#count')).toHaveText('1,000,000 points');
  const canvas = chart.locator('canvas[aria-label]');
  await expect(canvas).toHaveAttribute('aria-label', 'A random walk of 1,000,000 points');
  let before = await chart.screenshot();
  for (const [name, count] of [
    ['10k', '10,000 points'],
    ['100k', '100,000 points'],
    ['1M', '1,000,000 points'],
  ] as const) {
    const button = page.getByRole('button', { name, exact: true });
    await button.click();
    await expect(page.locator('#count')).toHaveText(count);
    await expect(canvas).toHaveAttribute('aria-label', `A random walk of ${count}`);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sizes [aria-pressed="true"]')).toHaveCount(1);
    await expect.poll(async () => (await chart.screenshot()).equals(before)).toBe(false);
    before = await chart.screenshot();
  }
  await page.getByRole('button', { name: '10k', exact: true }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(canvas).toHaveAttribute('aria-label', 'A random walk of 10,000 points');
});

const pixelsOverFrames = (page: Page, label: string) =>
  page.evaluate(
    async ({ label }) => {
      const section = document.getElementById('features')!;
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--c1').trim();
      const want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const count = () => {
        const canvas = section.querySelector<HTMLCanvasElement>('.chart canvas')!;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let n = 0;
        for (let i = 0; i < data.length; i += 4)
          if (want.every((v, c) => Math.abs(data[i + c]! - v) <= 8)) n++;
        return n;
      };
      [...section.querySelectorAll('label')].find(l => l.textContent?.trim() === label)!.click();
      const counts: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 600) {
        await new Promise(requestAnimationFrame);
        counts.push(count());
      }
      return counts;
    },
    { label },
  );

test('each feature switch changes what it should, and the code with it', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');
  const features = page.locator('#features');
  const chart = features.locator('.chart');
  const shown = () => features.locator('code[data-live]:visible').textContent();
  await chart.scrollIntoViewIfNeeded();
  expect(await shown()).toContain("lineChart(el, {\n    data: rows,\n    colors: ['#");

  await expect.poll(() => xTicks(chart).then(t => t.length)).toBeGreaterThan(1);
  const before = await xTicks(chart);
  await zoomIn(page, chart);
  await page.waitForTimeout(300);
  expect(await xTicks(chart)).toEqual(before);
  await features.getByLabel('Zoom and pan').check();
  expect(await shown()).toContain('zoom: true');
  await expect.poll(() => xTicks(chart).then(t => t.length)).toBeGreaterThan(1);
  const whole = days(await xTicks(chart));
  await zoomIn(page, chart);
  await expect.poll(() => xTicks(chart).then(days)).toBeLessThan(whole);

  await page.reload();
  await chart.scrollIntoViewIfNeeded();
  const tip = tooltipOf(chart);
  await expect.poll(() => seriesPixels(chart).then(p => p.length)).toBeGreaterThan(0);
  await hover(page, chart);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('api');
  await page.mouse.move(0, 0);
  await features.getByLabel('Tooltip').uncheck();
  expect(await shown()).toContain('tooltip: false');
  await hover(page, chart);
  await page.waitForTimeout(300);
  await expect(tip).toBeHidden();
  await page.mouse.move(0, 0);

  const entries = chart.locator('[aria-pressed]');
  await expect(entries).toHaveText(['api', 'web', 'jobs']);
  await features.getByLabel('Legend').uncheck();
  await expect(entries).toHaveCount(0);
  expect(await shown()).toContain('legend: false');

  await pixelsOverFrames(page, 'Animation');
  expect(await shown()).toContain('animate: false');
  const atOnce = await pixelsOverFrames(page, 'Tooltip');
  expect(new Set(atOnce.slice(2)).size).toBe(1);
  const revealed = await pixelsOverFrames(page, 'Animation');
  expect(Math.min(...revealed)).toBeLessThan(Math.max(...revealed) * 0.8);
  expect(await shown()).not.toContain('animate');

  expect(errors).toEqual([]);
});

test('the framework buttons and the top-bar select change both code blocks, and stay in step', async ({
  page,
}) => {
  await page.goto('/');
  const buttons = page.getByRole('group', { name: 'Code for' });
  const select = page.getByLabel('Framework');
  const data = page.locator('#code .snip:visible');
  const features = page.locator('#features .snip:visible');
  for (const [label, fw, file, marker] of [
    ['React', 'react', 'Chart.tsx', '<LineChart data={rows} colors={['],
    ['Vue', 'vue', 'Chart.vue', '<LineChart :data="rows" :colors="['],
    ['JavaScript', 'js', 'chart.js', 'lineChart(el, {'],
  ] as const) {
    await buttons.getByRole('button', { name: label }).click();
    await expect(buttons.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(select).toHaveValue(fw);
    for (const snip of [data, features]) {
      await expect(snip.locator('header span')).toHaveText([file]);
      await expect(snip.locator('code')).toContainText(marker);
    }
  }
  await select.selectOption('vue');
  await expect(buttons.getByRole('button', { name: 'Vue' })).toHaveAttribute('aria-pressed', 'true');
});

test('"Start with one line" shows the install line of each framework', async ({ page }) => {
  await page.goto('/');
  const lines = page.locator('#start code');
  await expect(lines).toHaveText(
    ['npm i swiftplot', 'npm i swiftplot @swiftplot/react', 'npm i swiftplot @swiftplot/vue'],
    { useInnerText: true },
  );
});

test('the package manager picked rewrites every install line, is what Copy copies, and is kept', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const hero = page.locator('.cp:visible');
  await page.locator('.lead').getByRole('button', { name: 'pnpm' }).click();
  await expect(hero.locator('code')).toHaveText('pnpm add swiftplot', { useInnerText: true });
  await expect(page.locator('#start code').first()).toHaveText('pnpm add swiftplot', { useInnerText: true });
  await hero.getByRole('button', { name: 'Copy' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('pnpm add swiftplot');

  await page.goto('/examples/line-zoom');
  const install = page.locator('.snip:visible').first();
  await expect(install.locator('code')).toHaveText('pnpm add swiftplot', { useInnerText: true });
  await expect(install.getByRole('button', { name: 'pnpm' })).toHaveAttribute('aria-pressed', 'true');
  await install.getByRole('button', { name: 'bun' }).click();
  await expect(install.locator('code')).toHaveText('bun add swiftplot', { useInnerText: true });
});
