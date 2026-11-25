import { plants } from './data/plants';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'scatter-groups',
  title: 'Scatter by group',
  summary:
    'Seventy-two made-up plants of three kinds, by height and leaf length: each kind in its own colour.',
  group: 'Scatter',
  tags: ['compare', 'rows'],
  chart: 'scatterChart',
  data: { file: 'plants.json', rows: plants },
  props: {
    x: 'height',
    y: 'leaf',
    series: 'kind',
    alpha: 0.8,
    xAxis: { label: 'Height (cm)' },
    yAxis: { label: 'Leaf length (cm)' },
  },
  switches: [
    { prop: 'legend', label: 'Legend', kind: 'boolean', value: true },
    {
      prop: 'ring',
      label: 'Rings',
      kind: 'boolean',
      value: false,
      puts: { on: 2, off: omit },
    },
  ],
  notes: [
    'series names the column that splits the rows into groups, each drawn in the next colour and listed in the legend.',
    'Point at a dot or a legend entry and the other groups fade; click an entry to hide its group.',
    'The plants are made up for this page.',
  ],
});
