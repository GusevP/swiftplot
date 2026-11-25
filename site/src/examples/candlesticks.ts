import { siteColors } from '../codegen/index';
import { prices } from './data/prices';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'candlesticks',
  title: 'Candlesticks',
  summary: 'A month of daily prices for a made-up share: where each day opened, closed and how far it swung.',
  group: 'Candlestick',
  tags: ['time'],
  chart: 'candlestickChart',
  data: { file: 'prices.json', rows: prices },
  props: { xAxis: { label: '' }, colors: [siteColors[0]!] },
  switches: [
    {
      prop: 'down',
      label: 'Colour falls',
      kind: 'boolean',
      value: true,
      puts: { on: siteColors[2]!, off: omit },
    },
  ],
  notes: [
    'Each candle has a wick from low to high and a body from open to close.',
    'open, high, low and close are the columns of those names, in any case, and x is the first column of dates. A candle is 0.6 as wide as the smallest gap between two of them.',
    'A candle whose close is below its open takes the down colour, and the others up; either is the first of colors when left out.',
    'The tooltip names the candle and writes its four prices.',
  ],
});
