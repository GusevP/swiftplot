import { siteColors } from '../codegen/index';
import { months, weather } from './data/weather';
import { example } from './define';
import { axis, col, mark, omit, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'band', { label: '', categories: months }),
    y: axis('y', 'linear', { label: 'Temperature (°C)', domain: 'nice' }),
    y2: axis('y2', 'linear', { label: 'Rain (mm)', domain: 'nice' }),
  },
  marks: [
    mark('rain', 'bar', {
      x: col('at'),
      y: col('rain'),
      dodge: 'rain',
      yAxis: 'y2',
      color: siteColors[1]!,
      alpha: 0.6,
      label: 'Rain',
    }),
    mark('temperature', 'line', {
      x: col('at'),
      y: col('temperature'),
      color: siteColors[0]!,
      label: 'Temperature',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'guide-two-axes',
  title: 'Two y axes',
  summary: 'A made-up town’s year: the mean temperature each month on the left axis, the rain on the right.',
  group: 'Line',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'weather.json', rows: weather },
  switches: [
    {
      id: 'y2',
      label: 'Second axis',
      kind: 'boolean',
      value: true,
      sets: {
        on: [],
        off: [
          { target: 'frame.y2', value: omit },
          { target: 'rain.yAxis', value: omit },
          { target: 'y.label', value: '°C and mm' },
        ],
      },
    },
  ],
  notes: [],
});
