import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chartNames, referencePath } from '../../src/examples/define';
import { watch } from './charts';

const entry = JSON.parse(
  readFileSync(new URL('../../dist/pagefind/pagefind-entry.json', import.meta.url), 'utf8'),
) as {
  languages: Record<string, { page_count: number }>;
};

const charts = chartNames.map(referencePath);
const onAnyChart = (anchor: string) => charts.map(path => `${path}#${anchor}`);

const field = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const results = (page: Page) => page.locator('#search-results a');

async function search(page: Page, query: string) {
  await field(page).fill(query);
  return found(page);
}

async function found(page: Page) {
  await expect(page.getByRole('status')).toHaveText(/^\d+ results?$/);
  const hrefs = await results(page).evaluateAll(as => as.map(a => a.getAttribute('href')!));
  for (const href of hrefs) expect(href).toMatch(/^\/([^./#]+(\/[^./#]+)*)?(#[^/]+)?$/);
  return hrefs;
}

test('searching "zoom" from the landing finds the zoom example, and the keyboard reaches and opens it', async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/');
  expect(await search(page, 'zoom')).toContain('/examples/line-zoom');

  await page.keyboard.press('ArrowDown');
  await expect(results(page).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-results')).toBeHidden();
  await expect(field(page)).toBeFocused();

  await field(page).fill('');
  const at = (await search(page, 'zoom')).indexOf('/examples/line-zoom');
  expect(at, '/examples/line-zoom is not in the results').toBeGreaterThanOrEqual(0);
  for (let i = 0; i <= at; i++) await page.keyboard.press('ArrowDown');
  await expect(page.locator('#search-results a[href="/examples/line-zoom"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/examples\/line-zoom$/);
  await expect(page.locator('h1')).toHaveText('Line chart with zoom');
  expect(errors).toEqual([]);
});

test("a second query clears the first one's results at once, so the keyboard cannot open a stale one", async ({
  page,
}) => {
  await page.goto('/');
  expect(await search(page, 'zoom')).toContain('/examples/line-zoom');
  let release!: () => void;
  const held = new Promise<void>(resolve => (release = resolve));
  await page.route('**/pagefind/fragment/**', async route => {
    await held;
    await route.continue();
  });
  const requested = page.waitForRequest('**/pagefind/fragment/**');
  await field(page).fill('dataVersion');
  await requested;
  await expect(page.locator('#search-results')).toBeHidden();
  await expect(results(page)).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(field(page)).toBeFocused();
  release();
  const hrefs = await found(page);
  expect(onAnyChart('dataVersion')).toContain(hrefs[0]);
  expect(hrefs).not.toContain('/examples/line-zoom');
});

test('a prop name finds its row in the reference, and the chart name before it finds the row of that chart', async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto('/examples');
  for (const prop of ['curve', 'dataVersion']) {
    const href = `${referencePath('lineChart')}#${prop}`;
    const bare = await search(page, prop);
    expect(
      onAnyChart(prop).some(row => bare.includes(row)),
      prop,
    ).toBe(true);
    expect(await search(page, `lineChart ${prop}`)).toContain(href);
    await page.locator(`#search-results a[href="${href}"]`).click();
    await expect(page.locator(`[id="${prop}"]`)).toBeInViewport();
  }
  expect(errors).toEqual([]);
});

test('terms documented only per framework are found through the neutral line beside them', async ({
  page,
}) => {
  await page.goto('/');
  for (const term of ['useMemo', 'shallowRef']) {
    const hrefs = await search(page, term);
    expect(
      hrefs.map(h => h.split('#')[0]),
      term,
    ).toContain('/guides/getting-started');
  }
  for (const [term, section] of [
    ['destroy', 'returns'],
    ['onError', 'errors'],
    ['error boundary', 'errors'],
  ] as const) {
    const bare = await search(page, term);
    expect(
      onAnyChart(section).some(h => bare.includes(h)),
      term,
    ).toBe(true);
  }
  expect(await search(page, 'lineChart destroy')).toContain(`${referencePath('lineChart')}#returns`);
  expect(await search(page, 'lineChart onError')).toContain(`${referencePath('lineChart')}#errors`);
});

test('the results close when focus leaves the search box', async ({ page }) => {
  await page.goto('/');
  const list = page.locator('#search-results');
  await search(page, 'zoom');
  await page.keyboard.press('Shift+Tab');
  await expect(list).toBeHidden();

  await field(page).fill('');
  await search(page, 'zoom');
  const count = await results(page).count();
  await field(page).focus();
  for (let i = 0; i < count; i++) await page.keyboard.press('Tab');
  await expect(results(page).last()).toBeFocused();
  await expect(list).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(list).toBeHidden();
});

test('pressing a result keeps focus in the field, so the list stays open until the click lands', async ({
  page,
}) => {
  await page.goto('/');
  await search(page, 'zoom');
  const target = page.locator('#search-results a[href="/examples/line-zoom"]');
  await target.hover();
  await page.mouse.down();
  await expect(field(page)).toBeFocused();
  await expect(page.locator('#search-results')).toBeVisible();
  await page.mouse.up();
  await expect(page).toHaveURL(/\/examples\/line-zoom$/);
});

test('no indexed word comes only from a framework-specific region, on any indexed page', async ({ page }) => {
  await page.goto('/');
  const indexed = await page.evaluate(async () => {
    const bundle = '/pagefind/pagefind.js';
    const pagefind = await import(/* @vite-ignore */ bundle);
    const all = await pagefind.search(null);
    return Promise.all(
      all.results.map(async (r: { data(): Promise<{ url: string; content: string }> }) => {
        const { url, content } = await r.data();
        return { url, content };
      }),
    );
  });
  expect(indexed).toHaveLength(entry.languages.en!.page_count);

  const tokens = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}_$@-]+/u)
        .filter(Boolean),
    );
  let checked = 0;
  for (const { url, content } of indexed) {
    await page.goto(url.replace(/\.html$/, ''));
    const { regions, hidden, rest } = await page.locator('[data-pagefind-body]').evaluate(main => {
      const text = (root: Node) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const parts: string[] = [];
        while (walker.nextNode()) parts.push(walker.currentNode.nodeValue!);
        return parts.join(' ');
      };
      const found = [...main.querySelectorAll('[data-for]')];
      const clone = main.cloneNode(true) as HTMLElement;
      for (const e of clone.querySelectorAll('[data-for]')) e.remove();
      return { regions: found.length, hidden: found.map(text).join(' '), rest: text(clone) };
    });
    if (!regions) continue;
    const visible = tokens(rest);
    const only = [...tokens(hidden)].filter(t => !visible.has(t));
    expect(only.length, url).toBeGreaterThan(0);
    const words = tokens(content);
    expect(
      only.filter(t => words.has(t)),
      url,
    ).toEqual([]);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

test('dismissing the search before the first results arrive keeps the list closed', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', route =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export const debouncedSearch = async () => ({
        results: [{ data: () => new Promise(resolve => {
          window.deliver = () => resolve({
            meta: { title: 'Zoom' },
            sub_results: [{ title: 'Zoom', url: '/examples/line-zoom.html', plain_excerpt: '' }],
          });
        }) }],
      });`,
    }),
  );
  const list = page.locator('#search-results');
  const search = async (dismiss?: () => Promise<void>) => {
    await page.goto('/');
    await field(page).fill('zoom');
    await page.waitForFunction(() => 'deliver' in window);
    await dismiss?.();
    // A timer runs after every promise callback of the search handler.
    await page.evaluate(() => {
      (window as unknown as { deliver(): void }).deliver();
      return new Promise(resolve => setTimeout(resolve));
    });
  };
  await search();
  await expect(list).toBeVisible();
  for (const dismiss of [() => page.keyboard.press('Shift+Tab'), () => page.mouse.click(5, 400)]) {
    await search(dismiss);
    expect(await list.isHidden()).toBe(true);
  }
});

test('no results and an unavailable index are shown beside the field until the search closes', async ({
  page,
}) => {
  await page.route('**/pagefind/pagefind.js', route =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export const debouncedSearch = async () => ({ results: [] });',
    }),
  );
  const status = page.getByRole('status');
  await page.goto('/');
  for (const text of ['No results', 'Search is unavailable']) {
    await field(page).fill('zoom');
    await expect(status).toHaveText(text);
    expect((await status.boundingBox())!.height).toBeGreaterThan(20);
    await page.keyboard.press('Escape');
    expect((await status.boundingBox())!.height).toBeLessThan(2);
    await page.route('**/pagefind/pagefind.js', route => route.abort());
    await page.reload();
  }
});
