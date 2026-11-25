import { siteColors } from '../codegen/index';
import { disk } from './data/disk';
import { example } from './define';
import { omit } from './tree';

export default example({
  id: 'sunburst',
  title: 'Sunburst',
  summary: 'The same laptop disk as the treemap, as rings: folders at the centre, the files in them outside.',
  group: 'Hierarchy',
  tags: ['share'],
  chart: 'sunburstChart',
  palette: true,
  data: { kind: 'json', file: 'disk.json', value: disk },
  props: {},
  switches: [
    {
      prop: 'shade',
      label: 'Shade',
      kind: 'choice',
      values: ['none', '0.3'],
      value: 'none',
      puts: { none: omit, '0.3': 0.3 },
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
    "The roots make the inner ring, and each node's children the next ring out, sharing its part of the turn by their sizes.",
    "The data is a list of four roots, so each root has a colour from colors, and the rings under it are lighter steps of it: core's palette by default, or the site's three colours and an amber.",
    'Shade replaces the lighter steps with one smooth run from the full colour at the centre to that opacity at the rim.',
  ],
});
