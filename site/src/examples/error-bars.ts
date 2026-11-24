import { siteColors } from '../codegen/index';
import { doses } from './data/doses';
import { example } from './define';
import { axis, col, mark, omit, type Tree } from './tree';

const at = [0, 1, 2, 3, 4];
const dose = axis('dose', 'band', { label: 'Caffeine', categories: doses.map(d => d.dose) });

const tree = {
  frame: { x: dose },
  marks: [
    mark('bars', 'errorBars', {
      x: at,
      y1: col('low'),
      y2: col('high'),
      color: siteColors[1]!,
      label: 'Spread',
    }),
    mark('means', 'dots', {
      x: at,
      y: col('mean'),
      r: [4, 4, 4, 4, 4],
      color: siteColors[0]!,
      label: 'Mean',
    }),
  ],
} satisfies Tree;

export default example({
  id: 'error-bars',
  title: 'Error bars',
  summary:
    'Made-up mean reaction times in milliseconds at five doses of caffeine, with one standard deviation either side.',
  group: 'Distribution',
  tags: ['compare'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'doses.json', rows: doses },
  switches: [
    {
      id: 'bars',
      label: 'Bars',
      kind: 'choice',
      values: ['upright', 'lying down'],
      value: 'upright',
      sets: {
        upright: [],
        'lying down': [
          { target: 'frame.x', value: omit },
          { target: 'frame.y', value: dose },
          { target: 'bars.x', value: omit },
          { target: 'bars.y1', value: omit },
          { target: 'bars.y2', value: omit },
          { target: 'bars.y', value: at },
          { target: 'bars.x1', value: col('low') },
          { target: 'bars.x2', value: col('high') },
          { target: 'means.x', value: col('mean') },
          { target: 'means.y', value: at },
        ],
      },
    },
    {
      id: 'caps',
      label: 'Caps',
      target: 'bars.cap',
      kind: 'boolean',
      value: true,
      puts: { on: omit, off: 0 },
    },
  ],
  notes: [
    'errorBars() draws a line from y1 to y2 at each x; dots() after it draws the means on top.',
    'Category i of a band axis sits at i, so both marks stand at 0 to 4 and the axis names the doses.',
    'Given y, x1 and x2 in place of x, y1 and y2, the bars lie down and run along x; the dots and the band axis move to y with them.',
    'cap is half the width of the line across each end, in CSS pixels, 4 when left out; 0 leaves the bare line.',
  ],
});
