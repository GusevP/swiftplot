import { siteColors } from '../codegen/index';
import { signups } from './data/signups';
import { example } from './define';
import { call, col, mark, omit, ref, type Tree } from './tree';

const tree = {
  frame: { frame: 'blank' },
  marks: [
    mark('funnel', 'funnel', {
      values: col('people'),
      labels: col('stage', 'text'),
      colors: ref('palette'),
      text: true,
    }),
  ],
} satisfies Tree;

export default example({
  id: 'funnel',
  title: 'Funnel',
  summary: 'How many of a thousand visitors reach each stage, from a first visit to a renewal.',
  group: 'Flow',
  tags: ['share', 'gradient'],
  kind: 'plot',
  tree,
  data: { kind: 'rows', file: 'signups.json', rows: signups },
  switches: [
    {
      id: 'gradient',
      label: 'Gradient',
      target: 'funnel.fill',
      kind: 'boolean',
      value: false,
      puts: { on: call('gradient', [siteColors[0]!, siteColors[2]!]), off: omit },
    },
  ],
  notes: [
    'Every stage is as tall as the others and as wide as its value against the largest.',
    'With text: true each stage shows its name and its share of the first stage.',
    'A fill gradient runs one blend down the whole funnel in place of a colour per stage; colors still name the stages in a legend.',
  ],
});
