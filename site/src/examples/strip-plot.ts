import { siteColors } from '../codegen/index';
import { couriers, deliveries } from './data/deliveries';
import { example } from './define';
import { axis, col, mark, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'linear', { label: 'Minutes', domain: 'nice' }),
    y: axis('y', 'band', { label: '', categories: couriers }),
  },
  marks: [
    mark('times', 'ticks', {
      x: col('minutes'),
      y: col('at'),
      size: 10,
      color: siteColors[0]!,
      alpha: 0.6,
      label: 'Delivery',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'strip-plot',
  title: 'Strip plot',
  summary: 'Fifty made-up delivery times for each of four couriers, one tick per delivery.',
  group: 'Distribution',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'deliveries.json', rows: deliveries },
  switches: [
    {
      id: 'size',
      label: 'Tick size',
      target: 'times.size',
      kind: 'choice',
      values: ['4', '10', '16'],
      value: '10',
      puts: { '4': 4, '10': 10, '16': 16 },
    },
  ],
  notes: [
    'ticks() draws a short vertical line at each point, reaching size CSS pixels above and below it.',
    'Category i of a band axis sits at i, so each row carries its courier’s place in at, and the y axis names the couriers.',
    'All the ticks are stroked as one shape, so ticks on the same minute fall on one another and show as one: the plot hides how many deliveries took the same time.',
    'The delivery times are random, made up for this page.',
  ],
});
