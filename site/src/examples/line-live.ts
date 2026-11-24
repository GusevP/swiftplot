import { siteColors } from '../codegen/index';
import { pulse } from './data/pulse';
import { example } from './define';
import { axis, col, feature, fn, mark, type Rows, type Tree } from './tree';

const step = fn(
  'rows => [...rows.slice(1), ...rows.slice(0, 1).map(r => ({ ...r, s: r.s + rows.length }))]',
  (rows: Rows) => [
    ...rows.slice(1),
    ...rows.slice(0, 1).map(r => ({ ...r, s: (r.s as number) + rows.length })),
  ],
);

const tree = {
  frame: {
    x: axis('x', 'linear', { label: 'Seconds', domain: 'data' }),
    y: axis('y', 'linear', { label: 'Reading', domain: [0, 100] }),
  },
  marks: [mark('reading', 'line', { x: col('s'), y: col('v'), color: siteColors[0]!, label: 'Reading' })],
  use: [feature('animate', 'animate')],
  live: { every: 1000, step },
} satisfies Tree;

export default example({
  id: 'line-live',
  title: 'Live updates',
  summary: 'A minute of made-up readings that moves on by one every second, as a feed would.',
  group: 'Line',
  tags: ['time'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'pulse.json', rows: pulse },
  switches: [{ id: 'animate', label: 'Animate', target: 'animate.on', kind: 'boolean', value: true }],
  notes: [
    'A timer gives the chart new rows every second: update() with the new options redraws it, and destroy() stops the timer.',
    'animate() moves or cross-fades the marks between updates; without it each update shows at once.',
    'step drops the oldest reading and adds it again a minute later, so the readings repeat every minute.',
    'The readings are made up for this page.',
  ],
});
