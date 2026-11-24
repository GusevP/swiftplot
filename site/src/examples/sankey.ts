import { budget } from './data/budget';
import { example } from './define';
import { call, dataset, mark, omit, ref, spread, type Tree } from './tree';

const tree = {
  frame: { frame: 'blank' },
  marks: [mark('flow', 'sankey', spread(call('fromLinks', [dataset()])), { colors: ref('palette') })],
} satisfies Tree;

export default example({
  id: 'sankey',
  title: 'Sankey',
  summary: "Where a month's income of 5,000 goes, from two sources through a budget to what it is spent on.",
  group: 'Flow',
  tags: ['share'],
  kind: 'plot',
  tree,
  data: { kind: 'json', file: 'budget.json', value: budget },
  switches: [
    {
      id: 'blend',
      label: 'Blended ribbons',
      target: 'flow.blend',
      kind: 'boolean',
      value: false,
      puts: { on: true, off: omit },
    },
  ],
  notes: [
    'fromLinks() turns links that name their ends into the columns sankey() takes, listing the nodes as it first meets them.',
    'Each ribbon is as wide as its value, and each node as tall as the larger of what flows in and what flows out.',
    'blend runs each ribbon from the colour of the node it leaves into the colour of the one it reaches; left out, a ribbon keeps the colour it leaves.',
  ],
});
