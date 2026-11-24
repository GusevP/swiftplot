import { requests } from './data/requests';
import { example } from './define';

export default example({
  id: 'line-zoom',
  title: 'Line chart with zoom',
  summary:
    'Three series over a month that you can zoom, hover for values, and filter by clicking a legend entry.',
  group: 'Line',
  tags: ['time', 'zoom'],
  chart: 'lineChart',
  data: { file: 'requests.json', rows: requests },
  props: {},
  switches: [
    { prop: 'zoom', label: 'Zoom', kind: 'boolean', value: true },
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
    { prop: 'tooltip', label: 'Tooltip', kind: 'boolean', value: true },
    { prop: 'curve', label: 'Curve', kind: 'choice', values: ['linear', 'smooth', 'step'], value: 'linear' },
  ],
  notes: ['Hold Ctrl or Cmd and scroll over the plot to zoom, or pinch on a touch screen; drag to pan.'],
});
