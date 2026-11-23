# swiftplot

<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg" />
    <img src="assets/logo.svg" alt="swiftplot" height="64" />
  </picture>
</p>

Small, fast charts on Canvas 2D and WebGL2. MIT, TypeScript, ESM only, no dependencies.

**Status: prototype.** It draws lines and areas (straight or stepped), bars, box plots, error bars, heatmaps, tick marks and scatter dots on linear, time and category axes, and pies, donuts, radars, radial bars, funnels, sankey diagrams, treemaps and sunbursts, with a hover tooltip, dim-the-others on hover and optional animation. A chart can be updated and follows its container when no size is given. `swiftplot/charts` builds line, area, bar and scatter charts from the data alone. There is a legend that hides and shows series, zoom and pan, a brush, a click event, the pointer from code for linked charts, light and dark themes, reference lines and zones, log axes, and tick steps and formats. The repository is a pnpm workspace with the package in `packages/core`; nothing is published yet.

## Charts from data

`swiftplot/charts` draws a chart from the data alone and lets every default be overridden. It is a second entry of the same package, built on the API under "Use", which it leaves unchanged.

```ts
import { lineChart } from 'swiftplot/charts';

const chart = lineChart(el, { data: rows }); // fields guessed; axes, colours, tooltip and legend by default
chart.update({ data: next }); // only what changed reaches the chart
chart.destroy();
```

- **Charts:** `lineChart`, `areaChart`, `barChart` and `scatterChart`. Each returns `{ update(props), destroy(), chart }`; `update` takes only the props that change, and `chart` is the underlying chart.
- **Data** is row objects, an object of columns (arrays or typed arrays, all of one length), a plain number array (`y` against its index, as the series `value`), or `[x, y]` pairs (the series `y`; a row of any other length throws). Long rows, `{ date, service, value }`, take `series: 'service'` and give one series per distinct value. `data` missing, `null` or empty draws an empty frame and never throws, so a chart can be created before its data arrives.
- **Values:** a number, a `Date`, an ISO 8601 string (`2026-11-22`, `2026-11-22T10:00` or with a space, optional seconds and fraction, and `Z` or `+02:00` after a time) or other text. A field's first value that is not missing (`null`, `undefined`, `''`, `NaN`, an infinite number) decides its kind; later values of another kind, an invalid `Date` and an impossible date (`2026-13-40`, `T24:00`) are missing. Numbers held as text (`"12.5"`) are text and are not converted. A field of booleans or objects cannot be plotted.
- **Dates** without a zone are read as UTC, so the same data draws the same chart on every machine; `xAxis: { utc: false }` reads them, and shows the axis, in local time.
- **Fields** are named by `x`, `y` (one field or a list) and `series`, by name or, on row objects only, by an accessor `(row, index) => value`. A named field is never second-guessed. What is not named is guessed, in field order (the keys of the first 100 rows, or of the columns object): `x` is the first date field, else the first text field, else the first number field when a `y` is named or another number field is left, else the row index; `y` is every number field left, one series each. A scatter chart takes the first date field, else the first number field, as `x` and the next number field as its one `y`.
- **Errors** name the chart; an error about fields also names the fields with their kinds and the prop to pass. Guessing throws when no number field is left for `y` (naming any field of numbers held as text), when a text field is left over without `series` (the rows look like long data, even with `x` and `y` named), for a named field that does not exist or is not numbers where numbers are needed, and for a scatter chart without two usable fields or with more than one `y`. An update that throws leaves the chart as it was.
- **Rows:** line and area charts sort rows by x (stably); bar and scatter charts keep the given order. A row with a missing x (or, on a scatter, a missing `r`) is dropped; a missing y is a gap.
- **Axes:** settings go under `xAxis` and `yAxis`. Which x settings apply depends on the x field:

  | x                   | axis     | settings                                                                                           |
  | ------------------- | -------- | -------------------------------------------------------------------------------------------------- |
  | numbers, row index  | linear   | `label`, `domain` (`'nice'` by default), `step`, `format`, `fit`                                   |
  | dates               | time     | `label`, `utc`, `unit` and `every`, `format`, `fit`, `domain` as `[from, to]` in milliseconds only |
  | text, and every bar | category | `label` only                                                                                       |

  `yAxis` takes `label`, `domain`, `step`, `format` and `fit`. Bars put each row (or, with `series`, each distinct x in order of first appearance) in a category of its own, dates included, labelled in UTC whatever `utc` says.

- **Defaults:**

  | Thing               | Default                                                                   | Override                               |
  | ------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
  | Axis labels         | the field's name; none for the row index, an accessor or several y fields | `xAxis.label`, `yAxis.label`           |
  | Colours             | `palette` in order, `paletteDark` on the dark theme                       | `colors`                               |
  | Tooltip             | on; text in the y axis format, else two decimals at most                  | `tooltip: false`                       |
  | Legend              | on with two or more series                                                | `legend: false` or `legend()` options  |
  | Zoom                | off                                                                       | `zoom: true` or `zoom()` options       |
  | Animation           | off                                                                       | `animate: true` or `animate()` options |
  | Theme               | follows the page                                                          | `theme: 'light' \| 'dark' \| Theme`    |
  | Size                | follows the container                                                     | `width`, `height`, `margin`            |
  | Several y on areas  | overlapping, half transparent                                             | `stack: true`                          |
  | Several y on bars   | side by side                                                              | `stack: true`                          |
  | Line and area shape | straight, with gaps                                                       | `curve`, `join`                        |
  | Scatter radius      | 4 px                                                                      | `r`: a number or a field               |

- **Stacking** counts a missing value as zero, so a stacked area has no gap where an unstacked one would. Long series are stacked over the union of their x values.
- **Interaction state** (`view`, `hidden`, `selected`, `pointer`) is kept by the chart unless the prop is given; `onViewChange`, `onHiddenChange`, `onClick` and `onPointerChange` report it as in the explicit API. Changing `tooltip`, `legend`, `zoom` or `animate` creates the chart again and keeps a zoomed window and hidden series.
- **`dataVersion`:** conversion is cached on the data's identity and length (each column's, for an object of columns). Pass new data, or after changing values in place, bump `dataVersion`: `chart.update({ dataVersion: ++version })`.
- **Theme:** `theme` defaults to `'auto'`, which follows the computed CSS `color-scheme` of the chart's element: `dark` gives the dark theme, `light dark` follows the system setting and switches with it, anything else gives light. It is read when the chart is created, when the system setting changes and when the `theme` prop changes.
- **`.spec()`** is the way out to the explicit API: `lineChart.spec({ data: rows, x: 'date', y: ['api', 'web'] })` returns the `plot()` options the chart would use. It needs no element and runs in Node; with the `'auto'` theme it gives no theme and the light palette.

## Use

```ts
import { dots, plot, tooltip } from 'swiftplot';

const chart = plot(document.getElementById('chart')!, {
  width: 900,
  height: 600,
  x: { domain: 'nice', label: 'X' },
  y: { domain: 'nice', label: 'Y' },
  marks: [dots({ x, y, r, color: '#2563eb', alpha: 0.7, label: 'Group 1' })],
  use: [tooltip({ mode: 'nearest', text: (label, x, y) => `${label}: (${x.toFixed(1)}, ${y.toFixed(1)})` })],
  dim: 0.3,
});

chart.update({ marks: [dots({ x, y: y2, r, color: '#2563eb', label: 'Group 1' })] });
chart.destroy();
```

- **Marks** are imported functions: `line`, `area`, `bar`, `box`, `errorBars`, `heatmap`, `ticks`, `dots`, `arcs`, `radar`, `radialBars`, `funnel`, `sankey`, `treemap`, `sunburst`. Only the ones you import are bundled.
- **Lines and areas** are straight between points unless `curve: 'step'` or `curve: 'smooth'`, which curves through the points without overshooting them. `area({ x, y })` fills from zero; `area({ x, y1, y2 })` is a band. A `y` that is `NaN` or infinite leaves a gap: nothing is joined across it, and a lone point between two gaps draws nothing; `join: true` draws a line or fills an area straight across instead. `x` must be finite and ascending.
- **Bars** have explicit bounds, `bar({ x1, x2, y1, y2 })`, so vertical, horizontal, grouped and stacked bars are the same mark. A single `y` (or `x`) starts at zero. On a category axis `const [x1, x2] = bands(7)` gives the bounds. Grouped bars are `bar({ x, y, dodge: 'years' })` for each series, `x` being the category's place: the chart gives the shown series of that id a slot each, in the order listed, so hiding one widens the others. `bands(7, { slot: 0, of: 2 })` gives one series' bounds for a chart that never hides it.
- **Box plots** take the five numbers as columns: `box({ x, ...fiveNumbers(groups), color })`. The whiskers go to the minimum and maximum; leave outliers out and draw them with `dots`.
- **Heatmaps** are `heatmap({ values, columns, color: sequential({ stops }) })`, with cell (c, r) centred on x = c, y = r so it sits on band axes; `x` and `y` give the grid's outer edges instead. Create the colour scale once, outside the update, or every update repaints the grid.
- **Pies and donuts** are `plot(el, { frame: 'polar', marks: [arcs({ values, colors, labels, inner: 0.6, text: true })] })`. A polar frame has no axes; slices start at twelve o'clock and run clockwise. `labels` give the legend one entry per slice, and `text` writes each slice's share on it where there is room. With `animate()` a pie is revealed by a sweep round the clock.
- **Radars** are `plot(el, { frame: 'polar', marks: radar({ axes, series: [{ values, color, label }] }) })`. `radar()` returns several marks: the rings and spokes, then one per series, so series are named in a legend and dimmed like lines, and a hit's row is the spoke. The rim is `max`, or the largest value rounded up.
- **Radial bars** are `plot(el, { frame: 'polar', marks: [radialBars({ values, max, colors, labels })] })`: one bar per value on its own ring, from twelve o'clock clockwise. Three quarters of a turn stand for `max`; the last quarter holds the names.
- **Treemaps and sunbursts** take a tree in columns, `{ nodes, parent, value }`, or `fromTree()` of nested `{ name, value, children }` objects: `plot(el, { frame: 'blank', marks: [treemap({ ...fromTree(tree), colors })] })` and `plot(el, { frame: 'polar', marks: [sunburst({ ...fromTree(tree), colors })] })`. Only the values of nodes without children count. Each root gets a colour, or each child of a single root. A treemap draws the leaves; a sunburst draws every node, a single root as a disc in the middle.
- **Funnels** are `plot(el, { frame: 'blank', marks: [funnel({ values, colors, labels, text: true })] })`: equally tall stages, each as wide as its value against the largest.
- **Sankey diagrams** are `sankey({ ...fromLinks(links), colors })` in a blank frame, where `links` is a list of `{ source, target, value }`. A cycle, a link to itself or a link to an unknown node throws. A hit's row is the node, or `nodes.length` plus the link.
- **Labels on shapes** (slices, stages, nodes) are drawn where they fit and left out where they would overlap or run off the chart.
- **A colour legend** for a heatmap comes with `legend()`: a strip of its colours between the ends of its domain.
- **Error bars** are `errorBars({ x, y1, y2 })`, or `{ y, x1, x2 }` lying down.
- **Colours:** `palette` is eight series colours to give out in order, and `brand` the cyan-to-violet blend. `gradient(from, to, 'down' | 'up' | 'right' | 'left')` makes a blend of two colours; a number stands for the mark's own colour at that opacity. `line({ fill: true })` puts a faint fade of the line's colour under it. A blend goes in `area({ fill })`, `bar({ fill })`, `line({ stroke })` and `line({ fill })`, so `area({ x, y, color, fill: gradient(0.4, 0) })` fades an area out towards its baseline. `color` stays the one colour a legend and a tooltip show.
- **Blends on other charts:** `sankey({ blend: true })` runs each ribbon from its source's colour into its target's; `funnel({ fill: gradient(a, b) })` puts one blend down the whole funnel; `arcs({ sweep: 0.8 })` and `radialBars({ sweep: 0.35 })` start each slice or bar at that opacity and bring it to full colour at its end; `treemap({ shade: 0.7 })` starts each branch at that opacity at its top, and `sunburst({ shade: 0.7 })` ends each at that opacity at the rim.
- **Box plots** take `radius`, `medianWidth`, `whiskers` (their opacity) and `fill`: `box({ ..., radius: 4, medianWidth: 2.5, whiskers: 0.5, fill: gradient(0.4, 0.1) })`.
- **Rounded bars and ringed points:** `bar({ radius: 6 })` rounds the value end of a bar that starts at zero, or all corners of one that floats, and `bar({ gap: 2 })` sets touching bars such as a histogram's two pixels apart; `dots({ ring: 2 })` draws rings round a white middle.
- **No axes:** `x: bare()` and `y: bare([0, 100])` place the marks and draw no ticks, grid or label, for a chart inside a card.
- **Rows** need no helper: `Float64Array.from(rows, r => r.value)` makes a column and `Map.groupBy(rows, r => r.series)` splits rows into series.
- **Ticks** thin out to fit the axis, so a narrow chart shows fewer labels, not overlapping ones.
- **Accessibility:** the chart is exposed as an image with a label built from the axis labels and series names; set `description` to say what it shows. The data itself is not exposed yet.
- **Margins** are sized from the tick labels; pass `margin: { left: 80 }` to set a side yourself.
- **Legend** is a feature you import: `use: [legend()]` lists each labelled series above the plot, highlights it on hover, and hides or shows it on a click, a tap, Enter or Space (`legend({ toggle: false })` turns that off). A label wider than the plot ends in an ellipsis. Rows are capped at what fits in a third of the chart's height, or at `legend({ rows: 2 })`, and the entries left over go behind "+N more".
- **Zoom and pan** is a feature you import: `use: [zoom()]`. Ctrl or cmd and the wheel (a trackpad pinch) zoom about the pointer, a drag pans, and a double click or double tap shows the whole domain again; on a touch screen two fingers pinch and pan and one scrolls the page. `zoom({ axes: 'xy', wheel: 'plain', drag: 'shift' })` zooms both axes, zooms on a plain wheel and pans only with shift held. Over the plot a ctrl or cmd wheel never reaches the page unless `wheel: false`, and with `wheel: 'plain'` a plain one reaches it only when the view cannot move further. The window is the `view` option, `{ x?: [lo, hi], y?: [lo, hi] }` in axis values, shown clamped to the domain; `onViewChange` reports it after a gesture, never for `update()`. `y: { domain: 'nice', label, fit: 'window' }` fits y to what the x window shows.
- **A brush** reports a range: `use: [brush({ onSelect: range => ... })]`. A drag draws a rectangle and `onSelect` gets `{ x, y }` in axis values on release, then `null` once it is cleared; `brush({ zoom: true })` shows the range brushed. With a brush beside `zoom()`, a plain drag brushes and shift and a drag pans. Mouse and pen only.
- **Hidden series:** `hidden: ['Group 1']` leaves out the series a legend lists under that id (a mark's `group`, or its `label`), from the start or from code, and `onHiddenChange(hidden)` reports a change the legend made. An automatic domain fits what is shown; `fit: 'all'` on an axis holds it still. The chart restacks layers given a `stack` id and re-dodges bars given a `dodge` id; the layers `stack()` returns are computed by the app, so it restacks in `onHiddenChange`.
- **Clicks and the pointer:** `onClick(hit, at)` gets what is within 20 px of a click on the plot, or `null`, and the axis values at the click; a click that ends a drag is not one. `selected: [{ id: 'Group 1', rows: [3] }]` picks rows out. `pointer: { x, y }` shows a tooltip as if the user's pointer were there, and `onPointerChange` reports the user's, with `null` as it leaves, so two charts can follow each other:

  ```ts
  const charts = [a, b].map((el, i) =>
    plot(el, {
      ...options,
      onPointerChange: p => charts[1 - i]!.update({ pointer: p }),
      use: [tooltip(tip)],
    }),
  );
  ```

- **Themes:** `theme: dark` colours the text, grid, tick marks and tooltip for a dark page; `light` is the default. The core never guesses dark mode: the app switches it, and `paletteDark` gives series colours for a dark surface. The charts of `swiftplot/charts` follow the page's `color-scheme` instead.

  ```ts
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const chart = plot(el, { ...options, theme: scheme.matches ? dark : light });
  scheme.addEventListener('change', e => chart.update({ theme: e.matches ? dark : light }));
  ```

- **Reference lines and zones:** `rule({ y: 50, color: '#dc2626', dashed: true, text: 'Target' })` draws a line across the plot at each value, and `zone({ x1, x2, color, text })` a band between two values. A rule is always above the data and a zone under it, wherever they are in `marks`; neither widens a domain or counts as a series.
- **Tick step and format:** an axis's `step` puts ticks on multiples of it, thinned when their labels do not fit, and `format` labels them; `time({ label, every: 3, unit: 'month', format })` does the same on a time axis. Define `format` once, outside the update: a new function each time counts as a new axis and prepares every mark again.

  ```ts
  const percent = (v: number) => `${v * 100}%`;
  chart.update({ y: { domain: 'nice', label: 'Share', step: 0.25, format: percent } });
  ```

- **Log axes:** `const y = log({ label: 'Count' })` (`base` defaults to 10, `domain` takes real values above zero). Marks take their columns through it, `line({ x, y: y.col(counts), color })`, and a value at or below zero becomes a gap. Everything the app is given or gives (`view`, `pointer`, callbacks, tooltip text) is a real value; a rule or zone takes `y.to(v, y)`. Bars need both ends given, `bar({ x1, x2, y1: y.col(lows), y2: y.col(highs), color })` with `[x1, x2]` from `bands()`, since zero has no place on a log axis, and nothing is stacked on one.
- **Histograms and stacks** are plain functions feeding the marks: `bar({ ...bin(values, 20), color })`, and `area({ x, y, stack: 'traffic' })` or `bar({ x, y, stack: 'traffic' })` for each series stacks the shown series of that id in the order listed, negative values downwards, so hiding one closes the gap; a tooltip and `onClick` report a layer's own value. `stack([a, b, c])` gives each series the `y1` and `y2` of its layer once, for a chart that never hides one. A `NaN` in a layer counts as zero: that layer has no thickness there.
- **Hover** highlights the series under the pointer and dims the others (`dim`). Where a chart has only one series, the hovered bar is picked out from the other bars instead.
- **Touch:** a tap shows the tooltip, and it stays after the finger lifts until a tap elsewhere or the next update or resize of the chart, which lets it go. A pen behaves as a mouse. Without `zoom()` the chart adds no listener that blocks the page from scrolling; with it the chart takes `touch-action: pan-x pan-y`, so one finger still scrolls the page.
- **Animation** is a feature you import: `use: [animate({ duration: 300 })]`. Marks are revealed from the left on the first paint (`enter: 'fade'` fades them in instead). When the data changes, bars move to their new values, row for row, and everything else cross-fades. It is skipped for a resize, with reduced motion, and while updates arrive faster than the duration.
- **Axes** are linear by default: `{ domain: 'nice' | 'data' | [lo, hi], label }`. `time({ label })` takes millisecond timestamps and puts ticks on calendar boundaries, in UTC unless `utc: false`. `log({ label })` is a log axis. `step` and `format` set the ticks, and `fit` which marks an automatic domain is fitted to. `band({ label, categories })` puts category `i` at `x = i`, owning `i - 0.5` to `i + 0.5`.
- **Columns** (`x`, `y`, `r`) are typed arrays or plain number arrays, one set per mark.
- **Size**: leave out `width` or `height` and the chart follows its container, which must then have a size of its own (a container with no height gives an empty chart, which draws once the container gets a height).
- **Updates**: a mark whose options are unchanged keeps its geometry, so passing a fresh `marks` array is cheap. Columns are compared by identity: after writing new values into the same array, pass a new array or view of it (`x.subarray(0)`).
- **Without a DOM:** the package imports in Node, and marks and transforms such as `bin` and `stack` run there; `plot()` needs a browser.
- **Your own mark** is an object with the `Mark` shape from the package's types.

## Why it is fast

Each point comes from profiling uPlot, the fastest of thirteen libraries in [chart-bench](https://github.com/gusevp/chart-bench), and timing the alternative in `experiments/`.

- **Axis text is DOM, not canvas text.** uPlot's axis drawing cost 17–21 ms at 4× CPU slowdown at every data size.
- **Each mark has its own x column.** No aligned table, so no join step.
- **Step lines and bands are reduced to one min/max per pixel column** before the path is built.
- **Typed-array columns in, scale maths inlined** in the draw loops.
- **Scatter, bars, error bars and box plots switch to WebGL2 at 10,000 points, and a sankey at 1,000 nodes and links together.** Raw WebGL2 set-up cost about 5 ms; Canvas 2D wins or ties below roughly 10k points. When the browser takes a WebGL context away, as it does with many WebGL charts on one page, that chart falls back to Canvas 2D.
- **Paths and GPU buffers are kept,** so a hover repaint never touches the data again.

## Measured

Mount time in chart-bench, median ms, 2026-11-20, Apple M3 Pro that was not idle. Each cell is the mean of two runs of nine loads, with the two libraries taking turns to go first. 4× is Chrome's CPU slowdown. At native speed every case but uPlot's largest sits at the empty-page floor (about 27 ms), so only the other columns separate them.

| case                     | swiftplot | uPlot | swiftplot, 4× | uPlot, 4× |
| ------------------------ | --------: | ----: | ------------: | --------: |
| survival, 3 × 200 points |      29.3 |  25.9 |          33.5 |      53.3 |
| survival, 6 × 1,000      |      28.3 |  24.7 |          37.9 |      68.8 |
| survival, 10 × 10,000    |      31.6 |  55.2 |          67.1 |     196.9 |
| scatter, 500             |      27.8 |  25.2 |          33.7 |      46.0 |
| scatter, 10,000          |      25.1 |  26.6 |          38.9 |      55.7 |
| scatter, 100,000         |      30.6 |  34.3 |          56.8 |     129.0 |

Time until the chart's own code has finished, which leaves out the wait for the next frame:

| case                     | swiftplot | uPlot | swiftplot, 4× | uPlot, 4× |
| ------------------------ | --------: | ----: | ------------: | --------: |
| survival, 3 × 200 points |       4.0 |  10.7 |          14.4 |      41.7 |
| survival, 6 × 1,000      |       5.7 |  14.2 |          20.6 |      55.8 |
| survival, 10 × 10,000    |      14.3 |  50.6 |          48.2 |     181.6 |
| scatter, 500             |       3.1 |   9.3 |          12.2 |      35.4 |
| scatter, 10,000          |       5.9 |  12.9 |          21.3 |      44.6 |
| scatter, 100,000         |      14.5 |  28.6 |          39.6 |     111.2 |

- The 100k scatter runs on WebGL, where the draw call returns before the GPU finishes, so its numbers flatter swiftplot.
- uPlot has no built-in scatter, so its scatter numbers include circle-drawing code written for the benchmark.
- Only these two chart types are in the benchmark. Bars, areas, the time axis, the legend and animation are not measured against uPlot.
- uPlot ships far more features in its 23.6 KB gzip (plus a stylesheet); the swiftplot code these two charts pull in is 7.2 KB gzip.

Script time of one pan step, `propose()` of a window moved by a hundredth of its width (at the whole domain, one narrowed by a thousandth), median ms of 50, on an 800 × 400 chart, 2026-11-22, Apple M3 Pro, Chrome on Metal. Before → after is the remedy of the same date: a line or an area reads only the rows its window shows, and points on the canvas skip those that cannot reach the plot.

| case               |    100,000 |   1,000,000 |
| ------------------ | ---------: | ----------: |
| line, whole        |        0.9 |         5.1 |
| line, 10×          |        0.2 |         0.8 |
| line, 5000×        |  3.5 → 0.1 |  40.0 → 0.1 |
| area, whole        |        0.8 |         5.0 |
| area, 10×          |        0.2 |         0.8 |
| area, 5000×        |  5.0 → 0.0 |  55.8 → 0.1 |
| filled line, whole |        0.9 |         5.0 |
| filled line, 10×   |        0.2 |         0.9 |
| filled line, 5000× |        0.1 |         0.1 |
| filled area, whole |        0.8 |         4.9 |
| filled area, 10×   |        0.2 |         0.8 |
| filled area, 5000× |        0.0 |         0.1 |
| bars, whole        |        0.1 |         0.0 |
| bars, 10×          |        0.0 |         0.1 |
| bars, 5000×        |        4.9 |        61.0 |
| points, whole      |        0.1 |         0.0 |
| points, 10×        |        0.0 |         0.0 |
| points, 5000×      | 13.3 → 0.2 | 156.9 → 1.9 |

- Bars and points of 10,000 rows or more are drawn by WebGL, whose draw call returns before the GPU finishes, so their whole and 10× cells leave the drawing out. Magnified past 4096 times every mark is drawn on the canvas.
- A million bars at 5000× is over the 16 ms budget: the canvas still walks every bar.

The same step at 1,000,000 points with `fit: 'window'` on the y axis, 2026-11-22, beside the step without it in the same run (mean of two runs each). At the whole domain two windows narrowed by a thousandth and by two take turns, since one window repeated would be fitted once and kept.

| case          | without | with fit |
| ------------- | ------: | -------: |
| line, whole   |     4.8 |      7.0 |
| line, 10×     |     0.8 |      1.3 |
| line, 5000×   |     0.1 |      0.1 |
| area, whole   |     4.8 |      7.0 |
| area, 10×     |     0.9 |      1.3 |
| area, 5000×   |     0.1 |      0.1 |
| bars, whole   |     0.0 |      8.4 |
| bars, 10×     |     0.0 |      5.2 |
| bars, 5000×   |    55.4 |     63.8 |
| points, whole |     0.0 |      7.4 |
| points, 10×   |     0.1 |      3.8 |
| points, 5000× |     1.9 |      5.0 |

- A line or an area finds the rows in its window by binary search, so the fit costs the rows the window holds. Bars and points need not be in x order, so the fit reads every row.

## Develop

From the repository root:

```sh
pnpm install
pnpm --filter swiftplot exec playwright install chromium   # once, for the tests
pnpm build
pnpm test:import # imports packages/core/dist/ in Node, after pnpm build
pnpm test        # Vitest in a real browser
pnpm typecheck
pnpm lint        # oxlint, type-aware
pnpm format      # oxfmt
```

## Licence

The code is MIT. The swiftplot name and logo are not covered by that licence.
