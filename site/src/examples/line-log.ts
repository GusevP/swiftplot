import { siteColors } from '../codegen/index';
import { growth } from './data/growth';
import { example } from './define';
import { fn } from './tree';

export default example({
  id: 'line-log',
  title: 'Log scale',
  summary:
    'A made-up app’s weekly users over its first year, from forty to over a hundred thousand, on a log axis.',
  group: 'Line',
  tags: ['time'],
  chart: 'lineChart',
  data: { file: 'growth.json', rows: growth },
  props: {
    xAxis: { label: 'Week', domain: [0, 51] },
    yAxis: {
      label: 'Weekly users',
      scale: 'log',
      format: fn("v => v.toLocaleString('en')", (v: number) => v.toLocaleString('en')),
    },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'yAxis.scale',
      label: 'Scale',
      kind: 'choice',
      values: ['log', 'linear'],
      value: 'log',
    },
  ],
  notes: [
    'On a log axis each step up multiplies, so steady growth is a straight line and a slowdown bends it.',
    "yAxis takes scale: 'log'; a value at or below zero becomes a gap. format writes the ticks and the values in the tooltip.",
    'On the linear axis the first months flatten along the bottom under the last.',
    'The users are made up for this page.',
  ],
});
