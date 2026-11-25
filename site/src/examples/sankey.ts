import { budget } from './data/budget';
import { example } from './define';

export default example({
  id: 'sankey',
  title: 'Sankey',
  summary: "Where a month's income of 5,000 goes, from two sources through a budget to what it is spent on.",
  group: 'Flow',
  tags: ['share'],
  chart: 'sankeyChart',
  palette: true,
  data: { file: 'budget.json', rows: budget },
  props: {},
  switches: [{ prop: 'blend', label: 'Blended ribbons', kind: 'boolean', value: false }],
  notes: [
    'Each row of the data is one link: the first two text columns name the nodes it leaves and reaches, and the number column is its value.',
    'Each ribbon is as wide as its value, and each node as tall as the larger of what flows in and what flows out.',
    'blend runs each ribbon from the colour of the node it leaves into the colour of the one it reaches; left out, a ribbon keeps the colour it leaves.',
  ],
});
