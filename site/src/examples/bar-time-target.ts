import { siteColors } from '../codegen/index';
import { orders } from './data/orders';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'bar-time-target',
  title: 'Bars over time with a target',
  summary: 'A made-up shop’s orders on each day of a month, against the 180 it aims for.',
  group: 'Bar',
  tags: ['time', 'zoom'],
  chart: 'barChart',
  data: { file: 'orders.json', rows: orders },
  props: {
    xAxis: { label: '' },
    yAxis: { label: 'Orders' },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'rules',
      label: 'Target',
      kind: 'boolean',
      value: true,
      puts: { on: [{ y: 180, color: siteColors[2]!, dashed: true, text: 'Target 180' }], off: omit },
    },
    { prop: 'zoom', label: 'Zoom', kind: 'boolean', value: true },
  ],
  notes: [
    'A column of dates as x gives one bar a day, named by its date.',
    'Each of rules is a line at a y, or an x, across the whole plot, with its text beside it where it fits.',
    'With zoom, hold Ctrl or Cmd and scroll over the plot, or pinch; drag to pan.',
    'The orders are made up for this page.',
  ],
});
