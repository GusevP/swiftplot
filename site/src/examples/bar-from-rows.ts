import { siteColors } from '../codegen/index';
import { languages } from './data/languages';
import { example } from './define';

export default example({
  id: 'bar-from-rows',
  title: 'Bar chart from rows',
  summary: 'A made-up survey of the languages developers use, one bar for each, from an array of rows.',
  group: 'Bar',
  tags: ['compare', 'rows'],
  chart: 'barChart',
  data: { file: 'languages.json', rows: languages },
  props: { yAxis: { label: 'Developers (%)' }, colors: [siteColors[0]!] },
  switches: [{ prop: 'tooltip', label: 'Tooltip', kind: 'boolean', value: true }],
  notes: [
    'With no fields named, the text column gives the categories and the number column the height of each bar.',
    'The bars stand in the order of the rows: sort the rows to rank them.',
    'Point at a bar and the others fade; dim: false leaves them as they are.',
    'The shares are made up for this page.',
  ],
});
