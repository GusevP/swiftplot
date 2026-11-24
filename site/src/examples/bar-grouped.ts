import { sales } from './data/sales';
import { example } from './define';

export default example({
  id: 'bar-grouped',
  title: 'Grouped and stacked bars',
  summary: 'Sales by region for each quarter, side by side or stacked into one bar a quarter.',
  group: 'Bar',
  tags: ['compare', 'stack'],
  chart: 'barChart',
  data: { file: 'sales.json', rows: sales },
  props: {},
  switches: [
    { prop: 'stack', label: 'Stack', kind: 'boolean', value: false },
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
    { prop: 'tooltip', label: 'Tooltip', kind: 'boolean', value: true },
  ],
  notes: [
    'The text column becomes the categories, one per row, and every number column a series.',
    'Unstacked bars stand side by side; Stack piles them into one bar per quarter.',
  ],
});
