import { siteColors } from '../codegen/index';
import { sensor } from './data/sensor';
import { example } from './define';

export default example({
  id: 'area-curves',
  title: 'Stepped and smooth areas',
  summary:
    'A made-up sensor with six lost readings, as an area that steps, curves or runs straight between them.',
  group: 'Area',
  tags: ['rows'],
  chart: 'areaChart',
  data: { file: 'sensor.json', rows: sensor },
  props: {
    x: 'minute',
    y: 'celsius',
    xAxis: { label: 'Minute' },
    yAxis: { label: '°C' },
    colors: [siteColors[0]!],
  },
  switches: [
    { prop: 'curve', label: 'Curve', kind: 'choice', values: ['step', 'linear', 'smooth'], value: 'step' },
    { prop: 'join', label: 'Join across gaps', kind: 'boolean', value: false },
  ],
  notes: [
    'curve sets how the top edge runs from point to point: in steps that hold each value, straight, or smoothly.',
    'A missing reading leaves a gap in an unstacked area; join fills straight across it.',
    'An area is filled from zero, so the y axis starts there.',
    'The readings are made up for this page.',
  ],
});
