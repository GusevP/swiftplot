import type { ScriptedExample } from '../define';

const page = { kind: 'scripted', group: 'Interaction', tags: ['click'] } as const;

export const scripted: readonly ScriptedExample[] = [
  {
    ...page,
    id: 'click-pin',
    title: 'Click to pin',
    summary: 'Ten made-up cafes by price and rating: click a dot to pin it, and again to let it go.',
    notes: [
      'onClick gets what is within 20 px of the click, or null: its row is the row of the data.',
      'selected names the rows to pick out, by the series they belong to: they are outlined and the rest fade.',
      'The chart keeps nothing of this itself. The list of pinned rows is yours, and the chart draws what it is given.',
    ],
  },
  {
    ...page,
    id: 'bar-drill-down',
    title: 'Click a bar to drill down',
    summary:
      'Made-up orders by month: click a month to see its days below, and the empty plot to put them away.',
    notes: [
      'onClick gives the row of the bar, and null for a click on nothing, which clears the choice.',
      'selected keeps the clicked bar picked out while the second chart shows its days.',
      'The second chart is a chart of its own, given the rows of that month.',
    ],
  },
  {
    ...page,
    id: 'linked-crosshairs',
    title: 'Linked crosshairs',
    summary:
      'Made-up visits and errors over the same sixty days: point at one chart and the other shows the same day.',
    notes: [
      'onPointerChange reports where the pointer is in the values of the axes, and null once it leaves.',
      'pointer shows a tooltip as if the pointer were there. Only x is passed on, as the two y axes measure different things.',
      'A chart shows the pointer it is given only while the reader’s own is not on it.',
    ],
  },
  {
    ...page,
    id: 'series-hidden',
    title: 'Hide series from code',
    summary:
      'Three made-up series with checkboxes of your own beside the legend: either hides a series, and both agree.',
    notes: [
      'hidden names the series not drawn. Left out, the chart keeps the list itself as legend entries are clicked.',
      'onHiddenChange reports a click on the legend, so the checkboxes can follow it.',
      'The y axis fits the series that are shown.',
    ],
  },
];
