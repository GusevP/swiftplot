import { traffic } from './data/traffic';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'pie-donut',
  title: 'Pie and donut',
  summary: 'Visits by source as slices of a pie, or of a ring with a hole in the middle.',
  group: 'Pie and polar',
  tags: ['share'],
  chart: 'pieChart',
  palette: true,
  data: { file: 'traffic.json', rows: traffic },
  props: {},
  switches: [
    {
      prop: 'inner',
      label: 'Hole',
      kind: 'choice',
      values: ['none', '0.6'],
      value: 'none',
      puts: { none: omit, '0.6': 0.6 },
    },
    { prop: 'text', label: 'Share text', kind: 'boolean', value: true },
  ],
  notes: [
    "The text column names the slices and the number column sizes them. Slices start at twelve o'clock and run clockwise, each as wide as its share of the total.",
    "Hole sets inner, the hole's share of the radius: any number above 0 turns the pie into a donut.",
    'Each slice shows its share where there is room for it, unless text is false.',
  ],
});
