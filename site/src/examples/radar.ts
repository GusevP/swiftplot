import { siteColors } from '../codegen/index';
import { ratings } from './data/ratings';
import { example } from './define';
import { col, feature, mark, omit, type Tree } from './tree';

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
  id: 'radar',
  title: 'Radar',
  summary: 'Two phones rated from 0 to 10 on six features, one spoke a feature.',
  group: 'Pie and polar',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'ratings.json', rows: ratings },
  switches: [
    { id: 'legend', label: 'Legend', target: 'legend.on', kind: 'boolean', value: true },
    {
      id: 'fill',
      label: 'Fill',
      target: 'radar.fill',
      kind: 'boolean',
      value: true,
      puts: { on: omit, off: 0 },
    },
  ],
  notes: [
    'radar() returns several marks: the rings and spokes, then one for each series, so the legend names and hides a series as it would a line.',
    'The rim stands for max; left out, it is the largest value rounded up.',
    "fill is the opacity of each series' filling, 0.15 when left out; 0 leaves only the outline.",
  ],
});
