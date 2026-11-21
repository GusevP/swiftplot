# swiftplot

Small, fast charts on Canvas 2D and WebGL2. MIT, TypeScript, ESM only, no dependencies.

**Status: prototype.** It draws lines and areas (straight or stepped), bars, box plots, error bars, heatmaps, tick marks and scatter dots on linear, time and category axes, and pies, donuts, funnels and sankey diagrams, with a hover tooltip, dim-the-others on hover and optional animation. A chart can be updated and follows its container when no size is given. There is a legend; there is no zoom or pan yet.

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

- **Marks** are imported functions: `line`, `area`, `bar`, `box`, `errorBars`, `heatmap`, `ticks`, `dots`, `arcs`, `funnel`, `sankey`. Only the ones you import are bundled.
- **Lines and areas** are straight between points unless `curve: 'step'`. `area({ x, y })` fills from zero; `area({ x, y1, y2 })` is a band.
- **Bars** have explicit bounds, `bar({ x1, x2, y1, y2 })`, so vertical, horizontal, grouped and stacked bars are the same mark. A single `y` (or `x`) starts at zero. On a category axis `const [x1, x2] = bands(7)` gives the bounds, and `bands(7, { slot: 0, of: 2 })` those of one series of a grouped chart.
- **Box plots** take the five numbers as columns: `box({ x, ...fiveNumbers(groups), color })`. The whiskers go to the minimum and maximum; leave outliers out and draw them with `dots`.
- **Heatmaps** are `heatmap({ values, columns, color: sequential({ stops }) })`, with cell (c, r) centred on x = c, y = r so it sits on band axes; `x` and `y` give the grid's outer edges instead. Create the colour scale once, outside the update, or every update repaints the grid.
- **Pies and donuts** are `plot(el, { frame: 'polar', marks: [arcs({ values, colors, labels, inner: 0.6, text: true })] })`. A polar frame has no axes; slices start at twelve o'clock and run clockwise. `labels` give the legend one entry per slice, and `text` writes each slice's share on it where there is room. With `animate()` a pie is revealed by a sweep round the clock.
- **Funnels** are `plot(el, { frame: 'blank', marks: [funnel({ values, colors, labels, text: true })] })`: equally tall stages, each as wide as its value against the largest.
- **Sankey diagrams** are `sankey({ ...fromLinks(links), colors })` in a blank frame, where `links` is a list of `{ source, target, value }`. A cycle, a link to itself or a link to an unknown node throws. A hit's row is the node, or `nodes.length` plus the link.
- **Labels on shapes** (slices, stages, nodes) are drawn where they fit and left out where they would overlap or run off the chart.
- **A colour legend** for a heatmap comes with `legend()`: a strip of its colours between the ends of its domain.
- **Error bars** are `errorBars({ x, y1, y2 })`, or `{ y, x1, x2 }` lying down.
- **Rows** need no helper: `Float64Array.from(rows, r => r.value)` makes a column and `Map.groupBy(rows, r => r.series)` splits rows into series.
- **Ticks** thin out to fit the axis, so a narrow chart shows fewer labels, not overlapping ones.
- **Accessibility:** the chart is exposed as an image with a label built from the axis labels and series names; set `description` to say what it shows. The data itself is not exposed yet.
- **Margins** are sized from the tick labels; pass `margin: { left: 80 }` to set a side yourself.
- **Legend** is a feature you import: `use: [legend()]` lists each labelled series above the plot and highlights it on hover.
- **Histograms and stacks** are plain functions feeding the marks: `bar({ ...bin(values, 20), color })`, and `stack([a, b, c])` gives each series the `y1` and `y2` of its layer, for `bar` or `area`.
- **Hover** highlights the series under the pointer and dims the others (`dim`). Where a chart has only one series, the hovered bar is picked out from the other bars instead.
- **Animation** is a feature you import: `use: [animate({ duration: 300 })]`. Marks are revealed from the left on the first paint (`enter: 'fade'` fades them in instead). When the data changes, bars move to their new values, row for row, and everything else cross-fades. It is skipped for a resize, with reduced motion, and while updates arrive faster than the duration.
- **Axes** are linear by default: `{ domain: 'nice' | 'data' | [lo, hi], label }`. `time({ label })` takes millisecond timestamps and puts ticks on calendar boundaries, in UTC unless `utc: false`. `band({ label, categories })` puts category `i` at `x = i`, owning `i - 0.5` to `i + 0.5`.
- **Columns** (`x`, `y`, `r`) are typed arrays or plain number arrays, one set per mark.
- **Size**: leave out `width` or `height` and the chart follows its container, which must then have a size of its own (a container with no height gives an empty chart).
- **Updates**: a mark whose options are unchanged keeps its geometry, so passing a fresh `marks` array is cheap. Columns are compared by identity: after writing new values into the same array, pass a new array or view of it (`x.subarray(0)`).
- **Your own mark** is an object with the `Mark` shape from the package's types.

## Why it is fast

Each point comes from profiling uPlot, the fastest of thirteen libraries in [chart-bench](https://github.com/gusevp/chart-bench), and timing the alternative in `experiments/`.

- **Axis text is DOM, not canvas text.** uPlot's axis drawing cost 17–21 ms at 4× CPU slowdown at every data size.
- **Each mark has its own x column.** No aligned table, so no join step.
- **Step lines and bands are reduced to one min/max per pixel column** before the path is built.
- **Typed-array columns in, scale maths inlined** in the draw loops.
- **Scatter switches to WebGL2 points at 30,000 points.** Raw WebGL2 set-up cost about 5 ms; Canvas 2D wins or ties below roughly 10k points.
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

## Develop

```sh
pnpm install
pnpm exec playwright install chromium   # once, for the tests
pnpm build
pnpm test        # Vitest in a real browser
pnpm typecheck
pnpm lint        # oxlint, type-aware
pnpm format      # oxfmt
```
