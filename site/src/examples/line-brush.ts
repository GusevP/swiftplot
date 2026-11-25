import { siteColors } from '../codegen/index';
import { requests } from './data/requests';
import { example } from './define';

export default example({
  id: 'line-brush',
  title: 'Brush to zoom',
  summary: 'A month of made-up API requests: drag across the plot to zoom into the days you mark out.',
  group: 'Line',
  tags: ['time', 'zoom'],
  chart: 'lineChart',
  data: { file: 'requests.json', rows: requests },
  props: { y: 'api', xAxis: { label: '' }, yAxis: { label: 'Requests' }, colors: [siteColors[0]!] },
  switches: [
    {
      id: 'axes',
      label: 'Brushed axes',
      kind: 'choice',
      values: ['x', 'y', 'xy'],
      value: 'x',
      sets: {
        x: [
          { prop: 'brush', value: true },
          { prop: 'zoom', value: true },
        ],
        y: [
          { prop: 'brush', value: { axes: 'y' } },
          { prop: 'zoom', value: { axes: 'y' } },
        ],
        xy: [
          { prop: 'brush', value: { axes: 'xy' } },
          { prop: 'zoom', value: { axes: 'xy' } },
        ],
      },
    },
  ],
  notes: [
    'Drag over the plot to mark out a range; with zoom beside brush, the release shows it.',
    'axes picks what the drag marks out: x, when left out, a span of days, y a span of values, xy a rectangle.',
    'zoom, on the same axes, brings their whole range back on a double-click, pans them on shift and a drag, and zooms them on ctrl and the wheel or a pinch.',
    'The requests are made up for this page.',
  ],
});
