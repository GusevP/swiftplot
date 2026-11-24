import { siteColors } from '../codegen/index';
import { disk } from './data/disk';
import { example } from './define';
import { call, dataset, mark, omit, ref, spread, type Tree } from './tree';

const tree = {
  frame: { frame: 'blank' },
  marks: [mark('map', 'treemap', spread(call('fromTree', [dataset()])), { colors: ref('palette') })],
} satisfies Tree;

export default example({
  id: 'treemap',
  title: 'Treemap',
  summary: 'What fills a laptop disk, in gigabytes, from four folders down to the files in them.',
  group: 'Hierarchy',
  tags: ['share'],
  kind: 'plot',
  tree,
  data: { kind: 'json', file: 'disk.json', value: disk },
  switches: [
    {
      id: 'shade',
      label: 'Shade',
      target: 'map.shade',
      kind: 'choice',
      values: ['none', '0.4'],
      value: 'none',
      puts: { none: omit, '0.4': 0.4 },
    },
    {
      id: 'colors',
      label: 'Colours',
      target: 'map.colors',
      kind: 'choice',
      values: ['palette', 'site'],
      value: 'palette',
      puts: { palette: ref('palette'), site: [...siteColors, '#d97706'] },
    },
  ],
  notes: [
    'fromTree() turns nested objects into the columns treemap() takes; only a node without children has a value, and a folder is as large as what is in it.',
    "The data is a list of four roots, so each root has a colour from colors and everything under it shares it: core's palette by default, or the site's three colours and an amber.",
    'Shade starts each branch at that opacity at the top of its room and reaches its full colour at the bottom.',
  ],
});
