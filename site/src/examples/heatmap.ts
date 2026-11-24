import { days, hourly, hours } from './data/hourly';
import { example } from './define';
import { axis, call, col, feature, mark, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'band', { label: 'Hour', categories: hours }),
    y: axis('y', 'band', { label: '', categories: days }),
  },
  marks: [
    mark('heat', 'heatmap', {
      values: col('requests'),
      columns: 24,
      color: call('sequential', []),
      label: 'Requests',
    }),
  ],
  use: [feature('legend', 'legend')],
} satisfies Tree;

export default example({
  id: 'heatmap',
  title: 'Heatmap',
  summary: 'Requests to a service in each hour of a week, busy on weekday afternoons and quiet at night.',
  group: 'Heatmap',
  tags: ['time'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'hourly.json', rows: hourly },
  switches: [{ id: 'legend', label: 'Colour legend', target: 'legend.on', kind: 'boolean', value: true }],
  notes: [
    'values is one column read a row of the grid at a time: columns says how many cells a row holds, and row 0 lies at the bottom.',
    'Cell (c, r) is centred on x = c, y = r, so the grid sits on two band axes that name the hours and the days.',
    "sequential() runs the values through its stops, pale to dark blue when left out, from the smallest to the largest unless domain fixes the ends; legend() shows that run as a strip beside the mark's label, between the lowest and the highest value.",
  ],
});
