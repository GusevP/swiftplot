import { requests } from './data/requests';
import { example } from './define';

export default example({
  id: 'landing-features',
  title: 'Switch things on',
  summary: 'The tooltip, legend, zoom and animation, each one prop on the chart.',
  group: 'Line',
  tags: ['time'],
  chart: 'lineChart',
  data: { file: 'requests.json', rows: requests },
  props: {},
  switches: [
    { prop: 'tooltip', label: 'Tooltip', kind: 'boolean', value: true },
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
    { prop: 'zoom', label: 'Zoom and pan', kind: 'boolean', value: false },
    { prop: 'animate', label: 'Animation', kind: 'boolean', value: true },
  ],
  notes: [],
});
