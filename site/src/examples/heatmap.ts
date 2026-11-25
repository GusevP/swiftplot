import { hourly } from './data/hourly';
import { example } from './define';

export default example({
  id: 'heatmap',
  title: 'Heatmap',
  summary: 'Requests to a service in each hour of a week, busy on weekday afternoons and quiet at night.',
  group: 'Heatmap',
  tags: ['time'],
  chart: 'heatmapChart',
  palette: true,
  data: { file: 'hourly.json', rows: hourly },
  props: { x: 'hour', y: 'day', xAxis: { label: 'Hour' }, yAxis: { label: '' } },
  switches: [{ prop: 'legend', label: 'Colour legend', kind: 'boolean', value: true }],
  notes: [
    'Each row of the data is one cell, coloured by the only number column left, requests.',
    'x and y are named because the first text column would otherwise be x, and here that is day. Their values stand in the order they first appear, y from the bottom up.',
    'The cells run from pale to dark blue, from the smallest value to the largest, unless color gives another scale. The legend shows that run as a strip between the two.',
  ],
});
