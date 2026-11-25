import { siteColors } from '../codegen/index';
import { disk } from './data/disk';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'treemap',
  title: 'Treemap',
  summary: 'What fills a laptop disk, in gigabytes, from four folders down to the files in them.',
  group: 'Hierarchy',
  tags: ['share'],
  chart: 'treemapChart',
  palette: true,
  data: { kind: 'json', file: 'disk.json', value: disk },
  props: {},
  switches: [
    {
      prop: 'shade',
      label: 'Shade',
      kind: 'choice',
      values: ['none', '0.4'],
      value: 'none',
      puts: { none: omit, '0.4': 0.4 },
    },
    {
      prop: 'colors',
      label: 'Colours',
      kind: 'choice',
      values: ['palette', 'site'],
      value: 'palette',
      puts: { palette: omit, site: [...siteColors, '#d97706'] },
    },
  ],
  notes: [
    'The data is nested objects of a name and either a value or children; only a node without children has a value, and a folder is as large as what is in it.',
    "The data is a list of four roots, so each root has a colour from colors and everything under it shares it: core's palette by default, or the site's three colours and an amber.",
    'Shade starts each branch at that opacity at the top of its room and reaches its full colour at the bottom.',
  ],
});
