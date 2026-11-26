import { expect, test, type Page } from '@playwright/test';
import { site } from './built';

const kinds = [
  '/',
  '/guides/getting-started',
  '/examples',
  '/examples/area-stacked',
  '/reference',
  '/reference/area-chart',
  '/reference/area',
  '/changelog',
  '/status',
  '/404',
];

const content = (page: Page, selector: string) => page.locator(selector).getAttribute('content');

for (const path of kinds)
  test(`${path} has the link-preview tags`, async ({ page, request }) => {
    await page.goto(path);
    const description = await content(page, 'meta[name="description"]');
    expect(description).toBeTruthy();
    expect(await content(page, 'meta[property="og:title"]')).toBe(await page.title());
    expect(await content(page, 'meta[property="og:description"]')).toBe(description);
    expect(await content(page, 'meta[property="og:url"]')).toBe(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
    );
    expect(await content(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
    const image = new URL((await content(page, 'meta[property="og:image"]'))!);
    expect(image.origin).toBe(site);
    const response = await request.get(image.pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\//);
  });

test('a guide and an example are described by their own summary', async ({ page }) => {
  await page.goto('/');
  const landing = await content(page, 'meta[name="description"]');
  for (const path of ['/guides/getting-started', '/examples/area-stacked']) {
    await page.goto(path);
    const description = await content(page, 'meta[name="description"]');
    expect(description, path).toBe(await page.locator('p.intro').textContent());
    expect(description, path).not.toBe(landing);
  }
});
