import { siteColors } from '../codegen/index';
import { sensor } from './data/sensor';
import { example } from './define';

export default example({
  id: 'line-gaps',
  title: 'Line across gaps',
  summary: 'A made-up sensor that lost six readings: the line breaks at each, or is drawn straight across.',
  group: 'Line',
  tags: ['rows'],
  chart: 'lineChart',
  data: { file: 'sensor.json', rows: sensor },
  props: {
    x: 'minute',
    y: 'celsius',
    xAxis: { label: 'Minute' },
    yAxis: { label: '°C' },
    colors: [siteColors[0]!],
  },
  switches: [
    { prop: 'join', label: 'Join across gaps', kind: 'boolean', value: false },
    { prop: 'curve', label: 'Curve', kind: 'choice', values: ['linear', 'smooth', 'step'], value: 'linear' },
  ],
  notes: [
    'A reading that is null, missing, an empty string or NaN is a gap: the line stops before it and starts again after it.',
    'join draws straight across each gap, whatever the curve, and the tooltip has no value there.',
    'Three readings are lost alone and three more in a row.',
    'The readings are made up for this page.',
  ],
});
