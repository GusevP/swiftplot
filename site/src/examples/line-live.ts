import { siteColors } from '../codegen/index';
import { pulse } from './data/pulse';
import { example } from './define';
import { fn, type Rows } from './tree';

const step = fn(
  'rows => [...rows.slice(1), ...rows.slice(0, 1).map(r => ({ ...r, s: r.s + rows.length }))]',
  (rows: Rows) => [
    ...rows.slice(1),
    ...rows.slice(0, 1).map(r => ({ ...r, s: (r.s as number) + rows.length })),
  ],
);

export default example({
  id: 'line-live',
  title: 'Live updates',
  summary: 'A minute of made-up readings that moves on by one every second, as a feed would.',
  group: 'Line',
  tags: ['time'],
  chart: 'lineChart',
  data: { file: 'pulse.json', rows: pulse },
  props: {
    xAxis: { label: 'Seconds', domain: 'data' },
    yAxis: { label: 'Reading', domain: [0, 100] },
    colors: [siteColors[0]!],
  },
  live: { every: 1000, step },
  switches: [{ prop: 'animate', label: 'Animate', kind: 'boolean', value: true }],
  notes: [
    'A timer gives the chart new rows every second, and stops when the chart goes away.',
    'animate moves or cross-fades the marks between updates; without it each update shows at once.',
    "xAxis takes domain: 'data', so the axis ends at the oldest and the newest reading rather than at whole steps.",
    'step drops the oldest reading and adds it again a minute later, so the readings repeat every minute.',
    'The readings are made up for this page.',
  ],
});
