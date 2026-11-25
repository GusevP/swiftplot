import { siteColors } from '../codegen/index';
import { profit } from './data/profit';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'bar-negative',
  title: 'Bars above and below zero',
  summary: 'A made-up company’s profit each month of a year, in thousands: some months it loses money.',
  group: 'Bar',
  tags: ['compare'],
  chart: 'barChart',
  data: { file: 'profit.json', rows: profit },
  props: { xAxis: { label: '' }, yAxis: { label: 'Profit (k)' }, colors: [siteColors[0]!] },
  switches: [
    {
      prop: 'rules',
      label: 'Zero line',
      kind: 'boolean',
      value: true,
      puts: { on: [{ y: 0 }], off: omit },
    },
  ],
  notes: [
    'A bar runs from zero to its value, so a negative one hangs below the line.',
    'The y axis is widened to whole steps either side of zero.',
    'A rule at y 0 draws the zero line across the plot in the text colour.',
    'The profits are made up for this page.',
  ],
});
