import { latency } from './data/latency';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'area-long-data',
  title: 'Areas from long data',
  summary: 'Made-up response times in three regions, one row per region and day, with a slow week shaded.',
  group: 'Area',
  tags: ['rows', 'time'],
  chart: 'areaChart',
  data: { file: 'latency.json', rows: latency },
  props: { series: 'region', yAxis: { label: 'Response time (ms)' } },
  switches: [
    {
      prop: 'zones',
      label: 'Shade the slow week',
      kind: 'boolean',
      value: true,
      puts: {
        on: [{ x: ['2026-11-10', '2026-11-17'], text: 'Slow week' }],
        off: omit,
      },
    },
    { prop: 'stack', label: 'Stack', kind: 'boolean', value: false },
  ],
  notes: [
    'series names the column whose values each become an area; the dates are x and the one number column y.',
    'Unstacked, the areas overlap, half transparent, each filled down to zero.',
    'Each of zones shades a band between two x values, or two y values, under the data.',
    'The times are made up for this page.',
  ],
});
