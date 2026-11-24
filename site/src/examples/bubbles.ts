import { siteColors } from '../codegen/index';
import { cafes } from './data/cafes';
import { example } from './define';
import { axis, col, mark, omit, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'linear', { label: 'Seats', domain: 'nice' }),
    y: axis('y', 'linear', { label: 'Cups a day', domain: 'nice' }),
  },
  marks: [
    mark('cafes', 'dots', {
      x: col('seats'),
      y: col('cups'),
      r: col('r'),
      color: siteColors[0]!,
      alpha: 0.7,
      label: 'Cafés',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'bubbles',
  title: 'Bubbles',
  summary: 'Twenty-four made-up cafés: seats against cups sold a day, each bubble as large as its staff.',
  group: 'Scatter',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'cafes.json', rows: cafes },
  switches: [
    {
      id: 'rings',
      label: 'Rings',
      target: 'cafes.ring',
      kind: 'boolean',
      value: false,
      puts: { on: 2, off: omit },
    },
  ],
  notes: [
    'dots() takes a radius per point in r, in CSS pixels; the data holds it ready, the square root of the staff times five, so a bubble’s area grows with the staff.',
    'ring draws each bubble as a ring that many pixels wide, which keeps overlapping bubbles readable.',
    'The data is random, made up for this page.',
  ],
});
