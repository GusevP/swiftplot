import { services } from './data/services';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'legend-rows',
  title: 'Legend with many series',
  summary:
    'Twelve services in one chart: the legend keeps to the rows it is given and folds the rest behind a count.',
  group: 'Line',
  tags: ['rows', 'time'],
  chart: 'lineChart',
  data: { file: 'services.json', rows: services },
  props: { series: 'service', legend: { rows: 1 } },
  palette: true,
  switches: [
    {
      id: 'rows',
      label: 'Legend rows',
      kind: 'choice',
      values: ['one', 'two', 'automatic'],
      value: 'one',
      sets: {
        one: [],
        two: [{ prop: 'legend', value: { rows: 2 } }],
        automatic: [{ prop: 'legend', value: omit }],
      },
    },
  ],
  notes: [
    'Left alone the legend takes up to a third of the chart’s height, and names what does not fit behind “+N more”: point at it to read them.',
    'legend takes rows to cap it lower: with one row the names that do not fit are counted at its end.',
    'Click an entry to hide its series; point at one to pick its line out.',
    'With more series than the site has colours, colors is left to the chart, which gives out its palette in order.',
    'The requests are made up for this page.',
  ],
});
