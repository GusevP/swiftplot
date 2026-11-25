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
  id: 'guide-ticks',
  title: 'Strip plot',
  summary: 'Fifty made-up delivery times for each of four couriers, one tick per delivery.',
  group: 'Distribution',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: {
    kind: 'rows',
    file: 'delivery-places.json',
    rows: deliveries.map(({ courier, minutes }) => ({ at: couriers.indexOf(courier), minutes })),
  },
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
  notes: [],
});
