import { requests } from './data/requests';
import { example } from './define';

export default example({
  id: 'guide-fields',
  title: 'Name the fields yourself',
  summary: 'The same rows with x and y named: one line, for api.',
  group: 'Line',
  tags: ['rows', 'time'],
  chart: 'lineChart',
  data: { file: 'requests.json', rows: requests },
  props: { x: 'date', y: ['api'] },
  switches: [],
  notes: [],
});
