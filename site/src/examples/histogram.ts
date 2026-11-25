import { siteColors } from '../codegen/index';
import { loads } from './data/loads';
import { example } from './define';

export default example({
  id: 'histogram',
  title: 'Histogram',
  summary: 'Four hundred made-up page load times, counted into bins of equal width.',
  group: 'Distribution',
  tags: ['rows'],
  chart: 'histogramChart',
  data: { file: 'loads.json', rows: loads },
  props: { xAxis: { label: 'Load time (ms)' }, yAxis: { label: 'Pages' }, colors: [siteColors[1]!] },
  switches: [
    {
      prop: 'bins',
      label: 'Bins',
      kind: 'choice',
      values: ['10', '20', '40'],
      value: '20',
      puts: { '10': 10, '20': 20, '40': 40 },
    },
  ],
  notes: [
    'The only number column is counted: its range is split into bins of equal width, one bar per bin.',
    'Given edges in place of a count, bins uses them as they are, for bins of uneven width.',
    'The load times are random, made up for this page.',
  ],
});
