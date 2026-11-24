import guide from '../../../llms-full.txt?raw';
import type { ChartName } from '../examples/define';

export type ErrorRow = { messages: string[]; cause: string; fix: string };

const spans = (cell: string) => cell.split('`').filter((_, i) => i % 2);

export function parse(text: string): ErrorRow[] {
  const section = text.split('### Errors and their fixes')[1]?.split('\n### ')[0] ?? '';
  return section
    .split('\n')
    .filter(l => l.startsWith('| `'))
    .map(l => {
      const [message = '', cause = '', fix = ''] = l
        .slice(1, -1)
        .split(' | ')
        .map(c => c.trim());
      return { messages: spans(message), cause, fix };
    });
}

export const table = parse(guide);

export const xyOnly = [
  'there is no field of numbers for y',
  '"<name>" is text, so the rows look like long data',
  'with series there is one y',
];

export function errorsFor(chart: ChartName): ErrorRow[] {
  const applies =
    chart === 'scatterChart'
      ? (m: string) => !xyOnly.includes(m)
      : (m: string) => !m.includes('a scatter chart');
  return table
    .map(row => ({ ...row, messages: row.messages.filter(applies) }))
    .filter(row => row.messages.length);
}
