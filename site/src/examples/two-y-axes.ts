import { siteColors } from '../codegen/index';
import { weather } from './data/weather';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'two-y-axes',
  title: 'Two y axes',
  summary: 'A made-up town’s year: the mean temperature each month on the left axis, the rain on the right.',
  group: 'Line',
  tags: ['compare'],
  chart: 'comboChart',
  data: { file: 'weather.json', rows: weather },
  props: {
    lines: 'temperature',
    y2Bars: 'rain',
    xAxis: { label: '' },
    yAxis: { label: 'Temperature (°C)' },
    y2Axis: { label: 'Rain (mm)' },
    colors: [siteColors[0]!, siteColors[1]!],
  },
  switches: [
    {
      id: 'y2',
      label: 'Second axis',
      kind: 'boolean',
      value: true,
      sets: {
        on: [],
        off: [
          { prop: 'y2Bars', value: omit },
          { prop: 'y2Axis', value: omit },
          { prop: 'bars', value: 'rain' },
          { prop: 'yAxis.label', value: '°C and mm' },
        ],
      },
    },
  ],
  notes: [
    'lines and bars name the fields drawn against the left axis, y2Lines and y2Bars those against a second one on the right; each axis fits its own marks.',
    'Without the second axis the bars share the left one, and the temperatures flatten along the bottom under the rain.',
    'x is the month, the first column of text.',
    'The weather is made up for this page.',
  ],
});
