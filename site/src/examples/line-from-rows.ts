import { requests } from './data/requests';
import { example } from './define';

export default example({
  id: 'line-from-rows',
  title: 'Line chart from rows',
  summary: 'An array of row objects is all a line chart needs: it finds the dates and the series itself.',
  group: 'Line',
  tags: ['rows', 'time'],
  chart: 'lineChart',
  data: { file: 'requests.json', rows: requests },
  props: {},
  switches: [],
  notes: [
    'With no x or y, the column of ISO dates becomes a time axis and every other column of numbers a line.',
  ],
});
