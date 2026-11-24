import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { dist, pages, site } from './built';

const read = (file: string) => readFileSync(new URL(file, dist), 'utf8');

const problem = (link: string, from: string): string | undefined => {
  const url = new URL(link, new URL(from, site));
  if (url.origin !== site) return;
  const path = decodeURI(url.pathname);
  if (path.endsWith('.html') || (path !== '/' && path.endsWith('/')))
    return `${from}: ${link} is not in the extensionless form`;
  const file = pages.get(path) ?? path.slice(1);
  if (!existsSync(new URL(file, dist)) || statSync(new URL(file, dist)).isDirectory())
    return `${from}: ${link} has no page`;
  const id = decodeURIComponent(url.hash.slice(1));
  if (id && file.endsWith('.html') && !read(file).includes(` id="${id}"`))
    return `${from}: ${link} has no element with that id`;
};

test('every internal link and asset in the built site resolves', () => {
  const problems = [...pages].flatMap(([path, file]) =>
    [...read(file).matchAll(/\s(?:href|src)="([^"]*)"/g)].map(m => problem(m[1]!, path)),
  );
  expect(problems.filter(Boolean)).toEqual([]);
  expect(pages.size).toBeGreaterThan(10);
});

test('every page names its own https://swiftplot.dev URL as canonical', () => {
  for (const [path, file] of pages) {
    const canonical = [...read(file).matchAll(/<link rel="canonical" href="([^"]*)"/g)].map(m => m[1]);
    expect(canonical, file).toEqual([new URL(path, site).href]);
  }
});

test('the sitemap lists every page but the 404, in the extensionless form', () => {
  const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]!);
  const urls = locs(read('sitemap-index.xml')).flatMap(index => locs(read(new URL(index).pathname.slice(1))));
  expect(urls.toSorted()).toEqual(
    [...pages.keys()]
      .filter(p => p !== '/404')
      .map(p => new URL(p, site).href)
      .toSorted(),
  );
});

test('every swiftplot.dev URL in /llms.txt is a page or file the build produces', () => {
  const urls = [...read('llms.txt').matchAll(/\]\((https:\/\/swiftplot\.dev[^)]*)\)/g)].map(m => m[1]!);
  expect(urls.length).toBeGreaterThan(10);
  expect(urls.map(u => problem(u, '/llms.txt')).filter(Boolean)).toEqual([]);
  expect(read('llms-full.txt')).toBe(
    readFileSync(new URL('../../../llms-full.txt', import.meta.url), 'utf8'),
  );
});

test('_headers caches for a year only the content-hashed files', () => {
  const blocks = read('_headers')
    .split(/\n(?=\/)/)
    .map(block => block.split('\n').filter(line => line.trim() && !line.startsWith('#')));
  expect(blocks[0]).toEqual(['/*', '  Cache-Control: public, max-age=0, must-revalidate']);
  const long = blocks.filter(([, ...lines]) => lines.some(l => l.includes('immutable')));
  const hashed = ['_astro/', 'pagefind/fragment/', 'pagefind/index/'];
  expect(long.map(([path]) => path)).toEqual(hashed.map(dir => `/${dir}*`));
  for (const [, ...lines] of long)
    expect(lines.map(l => l.trim())).toEqual([
      '! Cache-Control',
      'Cache-Control: public, max-age=31536000, immutable',
    ]);
  const files = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter(f =>
    statSync(new URL(f, dist)).isFile(),
  );
  for (const dir of hashed)
    expect(
      files.some(f => f.startsWith(dir)),
      dir,
    ).toBe(true);
});
