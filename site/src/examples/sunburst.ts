import { siteColors } from '../codegen/index';
import { disk } from './data/disk';
import { example } from './define';
import { call, dataset, mark, omit, ref, spread, type Tree } from './tree';

const tree = {
  frame: { frame: 'polar' },
  marks: [mark('rings', 'sunburst', spread(call('fromTree', [dataset()])), { colors: ref('palette') })],
} satisfies Tree;

export default example({
  id: 'sunburst',
  title: 'Sunburst',
  summary: 'The same laptop disk as the treemap, as rings: folders at the centre, the files in them outside.',
  group: 'Hierarchy',
  tags: ['share'],
  kind: 'plot',
  tree,
  data: { kind: 'json', file: 'disk.json', value: disk },
  switches: [
    {
      id: 'shade',
      label: 'Shade',
      target: 'rings.shade',
      kind: 'choice',
      values: ['none', '0.3'],
      value: 'none',
      puts: { none: omit, '0.3': 0.3 },
    },
    {
      id: 'colors',
      label: 'Colours',
      target: 'rings.colors',
      kind: 'choice',
      values: ['palette', 'site'],
      value: 'palette',
      puts: { palette: ref('palette'), site: [...siteColors, '#d97706'] },
    },
  ],
  notes: [
    "The roots make the inner ring, and each node's children the next ring out, sharing its part of the turn by their sizes.",
    "The data is a list of four roots, so each root has a colour from colors, and the rings under it are lighter steps of it: core's palette by default, or the site's three colours and an amber.",
    'Shade replaces the lighter steps with one smooth run from the full colour at the centre to that opacity at the rim.',
  ],
});
