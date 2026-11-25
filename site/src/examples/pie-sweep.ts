import { traffic } from './data/traffic';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'pie-sweep',
  title: 'Donut with a sweep',
  summary:
    'Visits by source as a ring whose slices each fade in from their start, so the eye follows them round.',
  group: 'Pie and polar',
  tags: ['share', 'gradient'],
  chart: 'pieChart',
  palette: true,
  data: { file: 'traffic.json', rows: traffic },
  props: { inner: 0.6 },
  switches: [
    {
      prop: 'sweep',
      label: 'Sweep',
      kind: 'choice',
      values: ['0.35', '0.6', 'none'],
      value: '0.35',
      puts: { '0.35': 0.35, '0.6': 0.6, none: omit },
    },
    { prop: 'text', label: 'Share text', kind: 'boolean', value: true },
  ],
  notes: [
    'sweep is the opacity each slice starts at: it reaches its full colour at its end.',
    'Left out, every slice is one solid colour.',
    'inner is the hole’s share of the radius.',
  ],
});
