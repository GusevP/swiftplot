import { hourly } from './data/hourly';
import { example } from './define';
import { call, omit } from './tree';

export default example({
  id: 'heatmap-colours',
  title: 'Heatmap with your own colours',
  summary: 'The requests of each hour of a week again, coloured from cold to hot instead of in blues.',
  group: 'Heatmap',
  tags: ['time', 'gradient'],
  chart: 'heatmapChart',
  palette: true,
  data: { file: 'hourly.json', rows: hourly },
  props: { x: 'hour', y: 'day', xAxis: { label: 'Hour' }, yAxis: { label: '' } },
  switches: [
    {
      prop: 'color',
      label: 'Colours',
      kind: 'choice',
      values: ['cold to hot', 'greens', 'blues'],
      value: 'cold to hot',
      puts: {
        'cold to hot': call('sequential', [{ stops: ['#1e3a8a', '#fde68a', '#b91c1c'] }]),
        greens: call('sequential', [{ stops: ['#ecfdf5', '#047857'] }]),
        blues: omit,
      },
    },
    { prop: 'legend', label: 'Colour legend', kind: 'boolean', value: true },
  ],
  notes: [
    'color takes a scale: sequential() runs through its stops in equal steps, from the smallest value drawn to the largest.',
    'Two stops blend one colour into another; three put a middle colour halfway.',
    'Left out, the cells run from pale to dark blue.',
  ],
});
