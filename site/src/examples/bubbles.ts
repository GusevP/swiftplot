import { siteColors } from '../codegen/index';
import { cafes } from './data/cafes';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'bubbles',
  title: 'Bubbles',
  summary: 'Twenty-four made-up cafés: seats against cups sold a day, each bubble as large as its staff.',
  group: 'Scatter',
  tags: ['compare'],
  chart: 'scatterChart',
  data: { file: 'cafes.json', rows: cafes },
  props: {
    r: 'r',
    alpha: 0.7,
    xAxis: { label: 'Seats' },
    yAxis: { label: 'Cups a day' },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'ring',
      label: 'Rings',
      kind: 'boolean',
      value: false,
      puts: { on: 2, off: omit },
    },
  ],
  notes: [
    'x and y are the first two columns of numbers, as neither is named.',
    'r names a column of radii in CSS pixels; the data holds it ready, the square root of the staff times five, so a bubble’s area grows with the staff.',
    'ring draws each bubble as a ring that many pixels wide, which keeps overlapping bubbles readable.',
    'The data is random, made up for this page.',
  ],
});
