import { siteColors } from '../codegen/index';
import { loads } from './data/loads';
import { example } from './define';
import { axis, call, col, mark, param, spread, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'linear', { label: 'Load time (ms)', domain: 'nice' }),
    y: axis('y', 'linear', { label: 'Pages', domain: 'nice' }),
  },
  marks: [
    mark('bars', 'bar', spread(call('bin', [col('ms'), param('bins', 20)])), {
      color: siteColors[1]!,
      gap: 1,
      label: 'Pages',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'histogram',
  title: 'Histogram',
  summary: 'Four hundred made-up page load times, counted into bins of equal width.',
  group: 'Distribution',
  tags: ['rows'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'loads.json', rows: loads },
  switches: [
    {
      id: 'bins',
      label: 'Bins',
      target: 'params.bins',
      kind: 'choice',
      values: ['10', '20', '40'],
      value: '20',
      puts: { '10': 10, '20': 20, '40': 40 },
    },
  ],
  notes: [
    'bin() splits the range of the values into so many bins of equal width and returns x1, x2, y1 and y2 for bar(), one bar per bin.',
    'Given edges in place of a count, bin() uses them as they are, for bins of uneven width.',
    'gap takes a pixel off each bar, so bins that touch stay apart.',
    'The load times are random, made up for this page.',
  ],
});
