import { siteColors } from '../codegen/index';
import { cpu } from './data/cpu';
import { example } from './define';
import { axis, call, col, mark, omit, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'linear', { label: 'Hour of the day', domain: [0, 23.5] }),
    y: axis('y', 'linear', { label: 'CPU load (%)', domain: [0, 100] }),
  },
  marks: [
    mark('hours', 'zone', { x1: 9, x2: 17, color: siteColors[1]!, text: 'Working hours' }),
    mark('alert', 'rule', { y: 80, color: siteColors[2]!, dashed: true, text: 'Alert at 80%' }),
    mark('cpu', 'line', {
      x: col('hour'),
      y: col('cpu'),
      color: siteColors[0]!,
      label: 'CPU',
      fill: call('gradient', [0.4, 0]),
    }),
  ],
} satisfies Tree;

export default example({
  id: 'line-annotated',
  title: 'Annotated line',
  summary:
    'A made-up server’s CPU load over a day, with the working hours shaded and the alert level ruled across.',
  group: 'Line',
  tags: ['time', 'gradient'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'cpu.json', rows: cpu },
  switches: [
    {
      id: 'fill',
      label: 'Gradient fill',
      target: 'cpu.fill',
      kind: 'boolean',
      value: true,
      puts: { on: call('gradient', [0.4, 0]), off: omit },
    },
  ],
  notes: [
    'zone() shades a band between two x values, or two y values, across the whole plot, under the data.',
    'rule() draws a line at an x or a y across the whole plot, over the data; text is written beside it where it fits.',
    'gradient(0.4, 0) fills under the line from 0.4 opacity at the top to none at the bottom.',
    'The load is made up for this page.',
  ],
});
