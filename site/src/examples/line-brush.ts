import { siteColors } from '../codegen/index';
import { requests } from './data/requests';
import { example } from './define';
import { axis, col, feature, mark, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'time', { label: '' }),
    y: axis('y', 'linear', { label: 'Requests', domain: 'nice' }),
  },
  marks: [
    mark('api', 'line', { x: col('date', 'time'), y: col('api'), color: siteColors[0]!, label: 'API' }),
  ],
  use: [feature('brush', 'brush', { zoom: true, axes: 'x' }), feature('zoom', 'zoom', { axes: 'x' })],
} satisfies Tree;

export default example({
  id: 'line-brush',
  title: 'Brush to zoom',
  summary: 'A month of made-up API requests: drag across the plot to zoom into the days you mark out.',
  group: 'Line',
  tags: ['time', 'zoom'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'requests.json', rows: requests },
  switches: [
    {
      id: 'axes',
      label: 'Brushed axes',
      kind: 'choice',
      values: ['x', 'y', 'xy'],
      value: 'x',
      sets: {
        x: [
          { target: 'brush.axes', value: 'x' },
          { target: 'zoom.axes', value: 'x' },
        ],
        y: [
          { target: 'brush.axes', value: 'y' },
          { target: 'zoom.axes', value: 'y' },
        ],
        xy: [
          { target: 'brush.axes', value: 'xy' },
          { target: 'zoom.axes', value: 'xy' },
        ],
      },
    },
  ],
  notes: [
    'Drag over the plot to mark out a range; on release, brush({ zoom: true }) shows it.',
    'axes picks what the drag marks out: x a span of days, y a span of values, xy a rectangle.',
    'zoom() beside it, on the same axes, brings their whole range back on a double-click, pans them on shift and a drag, and zooms them on ctrl and the wheel or a pinch.',
    'The requests are made up for this page.',
  ],
});
