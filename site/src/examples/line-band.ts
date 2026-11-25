import { siteColors } from '../codegen/index';
import { forecast } from './data/forecast';
import { example } from './define';
import { axis, col, mark, type Tree } from './tree';

const tree = {
  frame: {
    x: axis('x', 'time', { label: '' }),
    y: axis('y', 'linear', { label: '°C', domain: 'nice' }),
  },
  marks: [
    mark('band', 'area', {
      x: col('date', 'time'),
      y1: col('low'),
      y2: col('high'),
      color: siteColors[0]!,
      alpha: 0.2,
    }),
    mark('mean', 'line', {
      x: col('date', 'time'),
      y: col('mean'),
      color: siteColors[0]!,
      label: 'Forecast',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'line-band',
  title: 'A line with its range band',
  summary:
    'A made-up temperature forecast for a month: the expected value as a line, inside a band that widens with time.',
  group: 'Area',
  tags: ['time'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'forecast.json', rows: forecast },
  switches: [
    {
      id: 'curve',
      label: 'Smooth',
      kind: 'boolean',
      value: false,
      sets: {
        on: [
          { target: 'band.curve', value: 'smooth' },
          { target: 'mean.curve', value: 'smooth' },
        ],
        off: [],
      },
    },
    {
      id: 'alpha',
      label: 'Band',
      target: 'band.alpha',
      kind: 'choice',
      values: ['faint', 'strong'],
      value: 'faint',
      puts: { faint: 0.2, strong: 0.45 },
    },
  ],
  notes: [
    'area() given y1 and y2 fills between two columns, where the easy area chart fills from zero.',
    'The line is a mark of its own, drawn after the band and so over it.',
    'This one is built with plot(), as the easy charts have no band.',
    'The forecast is made up for this page.',
  ],
});
