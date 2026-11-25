import { ratings } from './data/ratings';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'radar',
  title: 'Radar',
  summary: 'Two phones rated from 0 to 10 on six features, one spoke a feature.',
  group: 'Pie and polar',
  tags: ['compare'],
  chart: 'radarChart',
  data: { file: 'ratings.json', rows: ratings },
  props: { max: 10 },
  switches: [
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
    { prop: 'fill', label: 'Fill', kind: 'boolean', value: true, puts: { on: omit, off: 0 } },
  ],
  notes: [
    'The text column names the spokes, one per row, and every number column is a shape the legend names and hides.',
    'The rim stands for max; left out, it is the largest value rounded up.',
    "fill is the opacity of each shape's filling, 0.15 when left out; 0 leaves only the outline.",
  ],
});
