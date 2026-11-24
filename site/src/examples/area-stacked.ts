import { storage } from './data/storage';
import { example } from './define';

export default example({
  id: 'area-stacked',
  title: 'Stacked areas',
  summary: 'Three kinds of storage piled up week by week, so the top edge is the total.',
  group: 'Area',
  tags: ['time', 'stack'],
  chart: 'areaChart',
  data: { file: 'storage.json', rows: storage },
  props: {},
  switches: [
    { prop: 'stack', label: 'Stack', kind: 'boolean', value: true },
    { prop: 'curve', label: 'Curve', kind: 'choice', values: ['linear', 'smooth', 'step'], value: 'smooth' },
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
  ],
  notes: [
    'A stacked area counts a missing value as zero, so it has no gap where an unstacked one would.',
    'Turn Stack off and the areas overlap instead, half transparent.',
  ],
});
