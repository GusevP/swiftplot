import { siteColors } from '../codegen/index';
import { growth } from './data/growth';
import { example } from './define';
import { axis, col, fn, mark, scaled, type Tree } from './tree';

const format = fn("v => v.toLocaleString('en')", (v: number) => v.toLocaleString('en'));

const tree = {
  frame: {
    x: axis('x', 'linear', { label: 'Week', domain: [0, 51] }),
    y: axis('y', 'log', { label: 'Weekly users', format }),
  },
  marks: [
    mark('users', 'line', {
      x: col('week'),
      y: scaled('y', col('users')),
      color: siteColors[0]!,
      label: 'Users',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'line-log',
  title: 'Log scale',
  summary:
    'A made-up app’s weekly users over its first year, from forty to over a hundred thousand, on a log axis.',
  group: 'Line',
  tags: ['time'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'growth.json', rows: growth },
  switches: [
    {
      id: 'scale',
      label: 'Scale',
      kind: 'choice',
      values: ['log', 'linear'],
      value: 'log',
      sets: {
        log: [],
        linear: [
          { target: 'y', value: axis('y', 'linear', { label: 'Weekly users', domain: 'nice', format }) },
          { target: 'users.y', value: col('users') },
        ],
      },
    },
  ],
  notes: [
    'On a log axis each step up multiplies, so steady growth is a straight line and a slowdown bends it.',
    'A mark on a log axis is given its values through the axis: y.col(users) takes their logarithms, and a value at or below zero becomes a gap.',
    'On the linear axis the first months flatten along the bottom under the last.',
    'The users are made up for this page.',
  ],
});
