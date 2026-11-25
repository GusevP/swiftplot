import { siteColors } from '../codegen/index';
import { deliveries } from './data/deliveries';
import { example } from './define';

export default example({
  id: 'strip-plot',
  title: 'Strip plot',
  summary: 'Fifty made-up delivery times for each of four couriers, one tick per delivery.',
  group: 'Distribution',
  tags: ['compare'],
  chart: 'scatterChart',
  data: { file: 'deliveries.json', rows: deliveries },
  props: {
    x: 'minutes',
    y: 'courier',
    shape: 'tick',
    alpha: 0.6,
    xAxis: { label: 'Minutes' },
    yAxis: { label: '' },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'r',
      label: 'Tick size',
      kind: 'choice',
      values: ['4', '10', '16'],
      value: '10',
      puts: { '4': 4, '10': 10, '16': 16 },
    },
  ],
  notes: [
    "shape: 'tick' draws a short vertical line at each point, reaching r CSS pixels above and below it.",
    'y is a column of text, so each courier is a band of the y axis, in order of first appearance.',
    'All the ticks are stroked as one shape, so ticks on the same minute fall on one another and show as one: the plot hides how many deliveries took the same time.',
    'The delivery times are random, made up for this page.',
  ],
});
