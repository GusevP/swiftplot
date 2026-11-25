import { siteColors } from '../codegen/index';
import { doses } from './data/doses';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'bar-error-bars',
  title: 'Bars with error bars',
  summary:
    'Made-up mean reaction times at five doses of caffeine as bars, each with its spread drawn over it.',
  group: 'Bar',
  tags: ['compare'],
  chart: 'barChart',
  data: { file: 'doses.json', rows: doses },
  props: {
    x: 'dose',
    y: 'mean',
    errorBars: { low: 'low', high: 'high' },
    xAxis: { label: 'Caffeine' },
    yAxis: { label: 'Reaction time (ms)' },
    colors: [siteColors[0]!],
  },
  switches: [
    {
      prop: 'errorBars.cap',
      label: 'Caps',
      kind: 'boolean',
      value: true,
      puts: { on: omit, off: 0 },
    },
  ],
  notes: [
    'errorBars names the columns each bar’s spread runs between, as values on the y axis and not distances from the bar.',
    'y is named, as the columns of the spread are numbers too and would otherwise become bars.',
    'Over bars the error bars are drawn in the text colour, so they show against the fill.',
    'The times are made up for this page.',
  ],
});
