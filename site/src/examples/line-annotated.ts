import { siteColors } from '../codegen/index';
import { cpu } from './data/cpu';
import { example } from './define';
import { call, omit } from './tree';

export default example({
  id: 'line-annotated',
  title: 'Annotated line',
  summary:
    'A made-up server’s CPU load over a day, with the working hours shaded and the alert level ruled across.',
  group: 'Line',
  tags: ['time', 'gradient'],
  chart: 'lineChart',
  data: { file: 'cpu.json', rows: cpu },
  props: {
    rules: [{ y: 80, color: siteColors[2]!, dashed: true, text: 'Alert at 80%' }],
    zones: [{ x: [9, 17], color: siteColors[1]!, text: 'Working hours' }],
    xAxis: { label: 'Hour of the day', domain: [0, 23.5] },
    yAxis: { label: 'CPU load (%)', domain: [0, 100] },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'fill',
      label: 'Gradient fill',
      kind: 'boolean',
      value: true,
      puts: { on: call('gradient', [0.4, 0]), off: omit },
    },
  ],
  notes: [
    'Each of zones shades a band between two x values, or two y values, across the whole plot, under the data.',
    'Each of rules is a line at an x or a y across the whole plot, over the data; text is written beside it where it fits.',
    'fill shades under the line; gradient(0.4, 0) fades it from 0.4 opacity at the top to none at the bottom.',
    'The load is made up for this page.',
  ],
});
