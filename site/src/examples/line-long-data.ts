import { latency } from './data/latency';
import { example } from './define';

export default example({
  id: 'line-long-data',
  title: 'Line chart from long data',
  summary: 'One row per region and day: series names the column whose values each become a line.',
  group: 'Line',
  tags: ['rows', 'time'],
  chart: 'lineChart',
  data: { file: 'latency.json', rows: latency },
  props: { series: 'region' },
  switches: [
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
    { prop: 'tooltip', label: 'Tooltip', kind: 'boolean', value: true },
    { prop: 'curve', label: 'Curve', kind: 'choice', values: ['linear', 'smooth', 'step'], value: 'linear' },
  ],
  notes: [
    'Without series the text column is left over and the chart throws, naming series as the prop to pass.',
    'The dates become a time axis and the one number column the y of every line.',
  ],
});
