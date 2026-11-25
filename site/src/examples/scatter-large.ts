import { points } from './data/points';
import { example } from './define';

export default example({
  id: 'scatter-large',
  title: 'Scatter of 40,000 points',
  summary:
    'Forty thousand random dots that stay quick to zoom and pan, because WebGL draws them where the browser has it.',
  group: 'Scatter',
  tags: ['large', 'zoom'],
  chart: 'scatterChart',
  data: { file: 'points.json', rows: points },
  props: { r: 1.5 },
  switches: [
    { prop: 'zoom', label: 'Zoom', kind: 'boolean', value: true },
    { prop: 'tooltip', label: 'Tooltip', kind: 'boolean', value: true },
  ],
  notes: [
    'With no x or y, the first number field is x and the next one y.',
    'From 20,000 dots the chart draws them with WebGL, and on a canvas where there is no WebGL2, when zoomed in past 4,096 times, or if the browser takes the WebGL context away.',
    'Hold Ctrl or Cmd and scroll over the plot to zoom, or pinch on a touch screen; drag to pan.',
  ],
});
