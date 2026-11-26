import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import sizes from '../scripts/size/sizes.json';
import { firstDraw, pan } from '../src/data/measured';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const measured = readme.slice(readme.indexOf('## Measured'), readme.indexOf('## Licence'));

const tableAfter = (intro: string) => {
  const lines = measured.slice(measured.indexOf(intro)).split('\n');
  const start = lines.findIndex(line => line.startsWith('|'));
  const end = lines.findIndex((line, i) => i > start && !line.startsWith('|'));
  const [head, , ...rows] = lines.slice(start, end).map(r =>
    r
      .split('|')
      .slice(1, -1)
      .map(c => c.trim()),
  );
  return {
    intro: lines[0]!,
    rows,
    cell: (row: string, column: string) => rows.find(r => r[0] === row)?.[head!.indexOf(column)],
  };
};

test('the pan step is the README figure for a million-point line at its whole domain', () => {
  const table = tableAfter('Script time of one pan step');
  expect(table.intro).toContain(pan.date);
  expect(table.cell(pan.row, pan.points)).toBe(String(pan.ms));
});

test("each first draw is the README's script time for swiftplot", () => {
  const table = tableAfter("Time until the chart's own code has finished");
  expect(measured.slice(0, measured.indexOf("Time until the chart's own code"))).toContain(firstDraw.date);
  for (const c of firstDraw.cases) expect(table.cell(c.row, 'swiftplot'), c.row).toBe(c.ms.toFixed(1));
});

test('the size table is sizes.json, one row per entry', () => {
  const table = tableAfter('Gzip size of the minified bundle');
  expect(table.rows).toHaveLength(Object.keys(sizes).length);
  for (const [entry, kb] of Object.entries(sizes)) expect(table.cell(entry, 'KB'), entry).toBe(kb.toFixed(1));
});
