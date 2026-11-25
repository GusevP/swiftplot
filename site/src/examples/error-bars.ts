import { siteColors } from '../codegen/index';
import { doses } from './data/doses';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'error-bars',
  title: 'Error bars',
  summary:
    'Made-up mean reaction times in milliseconds at five doses of caffeine, with one standard deviation either side.',
  group: 'Distribution',
  tags: ['compare'],
  chart: 'scatterChart',
  data: { file: 'doses.json', rows: doses },
  props: {
    x: 'dose',
    errorBars: { low: 'low', high: 'high' },
    xAxis: { label: 'Caffeine' },
    yAxis: { label: '' },
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
    'errorBars names the columns each bar runs between, as values on the y axis; lineChart and barChart take it too.',
    'x is a column of text, so the axis gives each dose a place; y is the only column of numbers the error bars leave.',
    'cap is half the width of the line across each end, in CSS pixels, 4 when left out; 0 leaves the bare line.',
  ],
});
