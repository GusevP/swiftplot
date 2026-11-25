import { siteColors } from '../codegen/index';
import { signups } from './data/signups';
import { example } from './define';
import { call, omit } from './tree';

export default example({
  id: 'funnel',
  title: 'Funnel',
  summary: 'How many of a thousand visitors reach each stage, from a first visit to a renewal.',
  group: 'Flow',
  tags: ['share', 'gradient'],
  chart: 'funnelChart',
  palette: true,
  data: { file: 'signups.json', rows: signups },
  props: { legend: false },
  switches: [
    {
      prop: 'fill',
      label: 'Gradient',
      kind: 'boolean',
      value: false,
      puts: { on: call('gradient', [siteColors[0]!, siteColors[2]!]), off: omit },
    },
  ],
  notes: [
    'Every stage is as tall as the others and as wide as its value against the largest.',
    'Each stage shows its name and its share of the first stage, so the legend is off.',
    'A fill gradient runs one blend down the whole funnel in place of a colour per stage.',
  ],
});
