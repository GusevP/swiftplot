import { goals } from './data/goals';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'radial-bars',
  title: 'Radial bars',
  summary: 'How far along four goals are, out of 100, each as a bar bent round the centre.',
  group: 'Pie and polar',
  tags: ['compare', 'gradient'],
  chart: 'radialBarChart',
  palette: true,
  data: { file: 'goals.json', rows: goals },
  props: { max: 100, legend: false },
  switches: [
    {
      prop: 'sweep',
      label: 'Sweep',
      kind: 'boolean',
      value: false,
      puts: { on: 0.35, off: omit },
    },
  ],
  notes: [
    'Each bar has a ring of its own, the first outermost. Three quarters of a turn stand for max, and the last quarter holds the names, so the legend is off.',
    'Sweep starts each bar at that opacity and brings it to its full colour at its end.',
  ],
});
