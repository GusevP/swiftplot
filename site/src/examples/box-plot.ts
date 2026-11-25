import { siteColors } from '../codegen/index';
import { commute } from './data/commute';
import { example } from './define';
import { call, omit } from './tree';

export default example({
  id: 'box-plot',
  title: 'Box plot',
  summary: 'Forty commutes on each weekday, in minutes: the middle half in the box and the median across it.',
  group: 'Distribution',
  tags: ['compare', 'gradient'],
  chart: 'boxPlotChart',
  data: { file: 'commute.json', rows: commute },
  props: { xAxis: { label: '' }, yAxis: { label: '' }, colors: [siteColors[1]!] },
  switches: [
    {
      prop: 'fill',
      label: 'Gradient fill',
      kind: 'boolean',
      value: false,
      puts: { on: call('gradient', [0.6, 0.05]), off: omit },
    },
  ],
  notes: [
    'Each row of the data is one commute: the text column says which box it belongs to, and the number column is what the box sums up.',
    'The whiskers reach the smallest and the largest value.',
    "A gradient with numbers for stops blends the box's own colour from that opacity at the top to the other at the bottom; left out, the box is filled faintly in its colour.",
  ],
});
