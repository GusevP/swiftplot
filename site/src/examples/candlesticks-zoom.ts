import { siteColors } from '../codegen/index';
import { prices } from './data/prices';
import { example } from './define';

export default example({
  id: 'candlesticks-zoom',
  title: 'Candlesticks with zoom',
  summary:
    'The made-up share’s month of prices again, with rises and falls in their own colours and a zoom on the days.',
  group: 'Candlestick',
  tags: ['time', 'zoom'],
  chart: 'candlestickChart',
  data: { file: 'prices.json', rows: prices },
  props: { xAxis: { label: '' }, yAxis: { label: 'Price' }, up: siteColors[0]!, down: siteColors[2]! },
  palette: true,
  switches: [{ prop: 'zoom', label: 'Zoom', kind: 'boolean', value: true }],
  notes: [
    'up colours a candle whose close is not below its open, and down one whose close is.',
    'With zoom, hold Ctrl or Cmd and scroll over the plot, or pinch; drag to pan. The y axis follows the candles in view.',
    'The prices are made up for this page.',
  ],
});
