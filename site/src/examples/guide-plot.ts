import { siteColors } from '../codegen/index';
import { ratings } from './data/ratings';
import { example } from './define';
import { col, feature, mark, type Tree } from './tree';

const tree = {
  frame: { frame: 'polar' },
  marks: [
    mark('radar', 'radar', {
      axes: col('feature', 'text'),
      series: [
        { values: col('phoneA'), color: siteColors[0]!, label: 'Phone A' },
        { values: col('phoneB'), color: siteColors[2]!, label: 'Phone B' },
      ],
      max: 10,
    }),
  ],
  use: [feature('legend', 'legend')],
} satisfies Tree;

export default example({
  id: 'guide-plot',
  title: 'A radar through plot()',
  summary: 'Two phones rated from 0 to 10 on six features, as marks given to plot().',
  group: 'Pie and polar',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: {
    kind: 'rows',
    file: 'phones.json',
    rows: ratings.map(({ feature, 'Phone A': phoneA, 'Phone B': phoneB }) => ({ feature, phoneA, phoneB })),
  },
  switches: [{ id: 'legend', label: 'Legend', target: 'legend.on', kind: 'boolean', value: true }],
  notes: [],
});
