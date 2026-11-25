import type { ScriptedExample } from '../define';

const page = { kind: 'scripted', group: 'Interaction', tags: ['click'] } as const;

export const scripted: readonly ScriptedExample[] = [
  {
    kind: 'scripted',
    group: 'Bar',
    tags: ['compare'],
    id: 'bar-new-data',
    title: 'Bars that move to new data',
    summary:
      'Eight made-up teams and their points: give them new scores or sort them, and the bars move to their places.',
    notes: [
      'A chart animates unless told not to: given new data, bars move to their new heights, row for row.',
      'Pass a new array each time. The chart compares what it is given with what it drew, not the rows inside.',
      'animate takes a duration in milliseconds, and false draws each change at once.',
    ],
  },
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
  {
    ...page,
    id: 'overlay-tooltip',
    title: 'Your own markers and tooltip',
    summary:
      'Made-up cafes by price and rating: the name tags and the tooltip are the page’s own elements, kept over the chart.',
    notes: [
      'The chart keeps an overlay element for your own DOM. React children and the Vue slot render into it.',
      'onLayout gives the functions from values to pixels, first with the chart and again whenever its geometry changes.',
      'onHover gives what is under the pointer and the point to anchor a tooltip at, and null once the pointer leaves.',
    ],
  },
  {
    kind: 'scripted',
    group: 'Bar',
    tags: ['compare'],
    id: 'css-variables',
    title: 'Light and dark by CSS variables',
    summary:
      'Five made-up teams and their points: the bars and the theme name CSS variables, and a button changes them.',
    notes: [
      'A colour given as var(--name) is read where the chart stands, so it can come from any element around it.',
      'A changed variable is seen once theme is replaced with another object, even one of the same colours.',
      'In React keep the theme objects outside the component: one made in each render has the variables read each time.',
    ],
  },
];
