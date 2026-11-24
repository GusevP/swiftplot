import { traffic } from './data/traffic';
import { example } from './define';
import { col, feature, mark, omit, ref, type Tree } from './tree';

const tree = {
  frame: { frame: 'polar' },
  marks: [
    mark('pie', 'arcs', {
      values: col('visits'),
      labels: col('source', 'text'),
      colors: ref('palette'),
      text: true,
    }),
  ],
  use: [feature('legend', 'legend')],
} satisfies Tree;

export default example({
  id: 'pie-donut',
  title: 'Pie and donut',
  summary: 'Visits by source as slices of a pie, or of a ring with a hole in the middle.',
  group: 'Pie and polar',
  tags: ['share'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'traffic.json', rows: traffic },
  switches: [
    {
      id: 'hole',
      label: 'Hole',
      target: 'pie.inner',
      kind: 'choice',
      values: ['none', '0.6'],
      value: 'none',
      puts: { none: omit, '0.6': 0.6 },
    },
    {
      id: 'share',
      label: 'Share text',
      target: 'pie.text',
      kind: 'boolean',
      value: true,
      puts: { on: true, off: omit },
    },
  ],
  notes: [
    "A polar frame has no axes. Slices start at twelve o'clock and run clockwise, each as wide as its share of the total.",
    "Hole sets inner, the hole's share of the radius: any number above 0 turns the pie into a donut.",
    'With text: true each slice shows its share where there is room for it.',
  ],
});
