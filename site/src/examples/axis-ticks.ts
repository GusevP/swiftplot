import { siteColors } from '../codegen/index';
import { errors } from './data/errors';
import { example } from './define';
import { fn, omit } from './tree';

export default example({
  id: 'axis-ticks',
  title: 'Tick step and format',
  summary:
    'A made-up share of failed requests over four weeks, with the ticks placed and written by the axes.',
  group: 'Line',
  tags: ['time'],
  chart: 'lineChart',
  data: { file: 'errors.json', rows: errors },
  props: {
    xAxis: { label: '', unit: 'day', every: 7 },
    yAxis: { label: 'Failed', domain: [0, 0.5] },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'yAxis.format',
      label: 'Percent',
      kind: 'boolean',
      value: true,
      puts: { on: fn('v => `${Math.round(v * 100)}%`', (v: number) => `${Math.round(v * 100)}%`), off: omit },
    },
    {
      prop: 'yAxis.step',
      label: 'Step',
      kind: 'choice',
      values: ['0.1', '0.25', 'automatic'],
      value: '0.1',
      puts: { '0.1': 0.1, '0.25': 0.25, automatic: omit },
    },
    {
      prop: 'xAxis.every',
      label: 'A tick every',
      kind: 'choice',
      values: ['7 days', '3 days'],
      value: '7 days',
      puts: { '7 days': 7, '3 days': 3 },
    },
  ],
  notes: [
    'yAxis.step puts a tick on each multiple of it; left out, the axis picks a 1, 2 or 5 step that fits.',
    'yAxis.format writes each tick, and the value in the tooltip.',
    'xAxis.unit puts the date ticks on the boundaries of that unit, and every on each so many of them.',
    'Ticks whose labels would collide are thinned, so a small step never crowds the axis.',
    'The shares are made up for this page.',
  ],
});
