import { goals } from './data/goals';
import { example } from './define';
import { col, mark, omit, ref, type Tree } from './tree';

const tree = {
  frame: { frame: 'polar' },
  marks: [
    mark('bars', 'radialBars', {
      values: col('done'),
      labels: col('goal', 'text'),
      colors: ref('palette'),
      max: 100,
    }),
  ],
} satisfies Tree;

export default example({
  id: 'radial-bars',
  title: 'Radial bars',
  summary: 'How far along four goals are, out of 100, each as a bar bent round the centre.',
  group: 'Pie and polar',
  tags: ['compare', 'gradient'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'goals.json', rows: goals },
  switches: [
    {
      id: 'sweep',
      label: 'Sweep',
      target: 'bars.sweep',
      kind: 'boolean',
      value: false,
      puts: { on: 0.35, off: omit },
    },
  ],
  notes: [
    'Each bar has a ring of its own, the first outermost. Three quarters of a turn stand for max, and the last quarter holds the names.',
    'Sweep starts each bar at that opacity and brings it to its full colour at its end.',
  ],
});
