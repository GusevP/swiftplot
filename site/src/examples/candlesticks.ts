import { siteColors } from '../codegen/index';
import { prices } from './data/prices';
import { example } from './define';
import { axis, col, feature, fn, mark, omit, type Tree } from './tree';

const closing = fn(
  '(label, x, y) => `${new Date(x).toISOString().slice(0, 10)}: closed at ${y.toFixed(2)}`',
  (_label: string, x: number, y: number) =>
    `${new Date(x).toISOString().slice(0, 10)}: closed at ${y.toFixed(2)}`,
);

const tree = {
  frame: { x: axis('x', 'time', { label: '' }) },
  marks: [
    mark('candles', 'candlestick', {
      x: col('date', 'time'),
      open: col('open'),
      high: col('high'),
      low: col('low'),
      close: col('close'),
      width: 51_840_000,
      color: siteColors[0]!,
      down: siteColors[2]!,
      label: 'Price',
    }),
  ],
  use: [feature('tip', 'tooltip', { mode: 'nearest', text: closing })],
} satisfies Tree;

export default example({
  id: 'candlesticks',
  title: 'Candlesticks',
  summary: 'A month of daily prices for a made-up share: where each day opened, closed and how far it swung.',
  group: 'Candlestick',
  tags: ['time'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'prices.json', rows: prices },
  switches: [
    {
      id: 'down',
      label: 'Colour falls',
      target: 'candles.down',
      kind: 'boolean',
      value: true,
      puts: { on: siteColors[2]!, off: omit },
    },
  ],
  notes: [
    'Each candle has a wick from low to high and a body from open to close.',
    'width is in x units, and on a time axis those are milliseconds: 51,840,000 is 0.6 of a day.',
    'A candle whose close is below its open takes the down colour, and the others up; either is color when left out.',
    'The nearest tooltip calls text with the x and y of the candle hit, its date and close; its fourth argument is the row, to read the other columns.',
  ],
});
