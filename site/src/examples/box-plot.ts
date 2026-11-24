import { siteColors } from '../codegen/index';
import { commute, weekdays } from './data/commute';
import { example } from './define';
import { axis, call, dataset, mark, omit, spread, type Tree } from './tree';

const tree = {
  frame: { x: axis('x', 'band', { label: '', categories: weekdays }) },
  marks: [
    mark('box', 'box', spread(call('fiveNumbers', [dataset()])), {
      x: [0, 1, 2, 3, 4],
      color: siteColors[1]!,
      label: 'Minutes',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'box-plot',
  title: 'Box plot',
  summary: 'Forty commutes on each weekday, in minutes: the middle half in the box and the median across it.',
  group: 'Distribution',
  tags: ['compare', 'gradient'],
  kind: 'plot',
  tree,
  data: { kind: 'json', file: 'commute.json', value: commute },
  switches: [
    {
      id: 'gradient',
      label: 'Gradient fill',
      target: 'box.fill',
      kind: 'boolean',
      value: false,
      puts: { on: call('gradient', [0.6, 0.05]), off: omit },
    },
  ],
  notes: [
    'fiveNumbers() turns a list of groups into the min, q1, median, q3 and max columns box() takes, one box per group.',
    'The whiskers reach the smallest and the largest value; to show outliers, leave them out of the groups and draw them with dots().',
    "A gradient with numbers for stops blends the box's own colour from that opacity at the top to the other at the bottom; left out, the box is filled faintly in its colour.",
  ],
});
