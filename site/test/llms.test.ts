import { readFileSync } from 'node:fs';
import type { APIContext } from 'astro';
import { describe, expect, test } from 'vitest';
import { chartNames, referencePath } from '../src/examples/define';
import { examples, unlisted } from '../src/examples/index';
import { featureNames, markNames } from '../src/examples/tree';
import { type Guide, llms } from '../src/llms';
import { GET } from '../src/pages/llms-full.txt';

const frontmatter = import.meta.glob<Omit<Guide, 'id'>>('../src/content/guides/*.mdx', {
  eager: true,
  import: 'frontmatter',
});
const guides = Object.entries(frontmatter).map(([file, data]) => ({
  id: file.split('/').pop()!.replace('.mdx', ''),
  ...data,
}));

const site = new URL('https://swiftplot.dev');
const text = llms(site, guides);
const links = [...text.matchAll(/^- \[[^\]]+\]\(([^)]+)\): \S/gm)].map(m => m[1]);

describe('llms()', () => {
  test('is in the llms.txt form: a title, a summary, then sections of one-line links', () => {
    const [head, ...sections] = text.split(/^(?=## )/m);
    expect(head).toMatch(/^# swiftplot\n\n> \S/);
    expect(sections.map(s => s.split('\n')[0])).toEqual([
      '## Docs',
      '## Reference',
      '## Examples',
      '## Optional',
    ]);
    for (const s of sections)
      for (const line of s.split('\n').slice(1).filter(Boolean))
        expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/swiftplot\.dev\/[^)]*\): \S/);
  });

  test('links every listed example, every reference page and every guide, and no unlisted example', () => {
    expect(guides.length).toBeGreaterThan(0);
    const pages = links.map(l => new URL(l!).pathname);
    for (const id of examples.keys()) expect(pages).toContain(`/examples/${id}`);
    expect(chartNames).toHaveLength(16);
    expect(pages).toEqual(
      expect.arrayContaining([
        '/reference/radial-bar-chart',
        '/reference/pie-chart',
        '/reference/combo-chart',
      ]),
    );
    for (const name of [...chartNames, 'plot', 'scales', ...markNames, ...featureNames])
      expect(pages).toContain(referencePath(name));
    for (const g of guides) expect(pages).toContain(`/guides/${g.id}`);
    for (const e of unlisted) expect(pages).not.toContain(`/examples/${e.id}`);
    expect(pages).toContain('/llms-full.txt');
    expect(pages).toContain('/changelog');
  });

  test("describes each guide by its llms note, which leaves out the site's own controls", () => {
    for (const g of guides.filter(g => g.llms)) {
      expect(text).toContain(`/guides/${g.id}): ${g.llms}\n`);
      expect(text).not.toContain(g.summary);
    }
    expect(text).not.toMatch(/top bar/i);
  });
});

test('llms-full.txt gives the explicit API the overlay, its callbacks and the axis rule of onLayout', () => {
  const full = readFileSync(new URL('../../llms-full.txt', import.meta.url), 'utf8');
  const section = full.split(/^(?=## )/m).find(s => s.startsWith('## 5. The explicit API'));
  for (const name of ['overlay', 'onLayout', 'onHover', 'to', 'from'])
    expect(section).toContain(`\`${name}\``);
});

test('/llms-full.txt is the root llms-full.txt byte for byte', async () => {
  const response = await GET({} as APIContext);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(
    readFileSync(new URL('../../llms-full.txt', import.meta.url)),
  );
});
