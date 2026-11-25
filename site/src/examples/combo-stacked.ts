import { revenue } from './data/revenue';
import { example } from './define';

export default example({
  id: 'combo-stacked',
  title: 'Stacked bars with a line',
  summary:
    'A made-up company’s revenue by channel each quarter, stacked, with the target for the total as a line.',
  group: 'Bar',
  tags: ['compare', 'stack'],
  chart: 'comboChart',
  data: { file: 'revenue.json', rows: revenue },
  props: {
    bars: ['online', 'retail', 'wholesale'],
    lines: 'target',
    xAxis: { label: '' },
    yAxis: { label: 'Revenue (k)' },
  },
  palette: true,
  switches: [{ prop: 'stack', label: 'Stack', kind: 'boolean', value: true }],
  notes: [
    'comboChart draws bars and lines over one x: bars and lines name the columns of each.',
    'stack piles the bars of an axis into one per quarter; its lines are never stacked.',
    'Unstacked, the bars stand side by side and the target sits far above any one of them.',
    'The revenue is made up for this page.',
  ],
});
