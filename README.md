# swiftplot

Small, fast charts on Canvas 2D and WebGL2. MIT, TypeScript, ESM only, no dependencies.

**Status: prototype.** It draws lines and areas (straight or stepped), bars, tick marks and scatter dots on linear, time and category axes, with a hover tooltip, dim-the-others on hover and optional animation. A chart can be updated and follows its container when no size is given. There is a legend; there is no zoom or pan yet.

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

- **Marks** are imported functions: `line`, `area`, `bar`, `ticks`, `dots`. Only the ones you import are bundled.
- **Lines and areas** are straight between points unless `curve: 'step'`. `area({ x, y })` fills from zero; `area({ x, y1, y2 })` is a band.
- **Bars** have explicit bounds, `bar({ x1, x2, y1, y2 })`, so vertical, horizontal, grouped and stacked bars are the same mark. A single `y` (or `x`) starts at zero. On a category axis `const [x1, x2] = bands(7)` gives the bounds, and `bands(7, { slot: 0, of: 2 })` those of one series of a grouped chart.
- **Rows** need no helper: `Float64Array.from(rows, r => r.value)` makes a column and `Map.groupBy(rows, r => r.series)` splits rows into series.
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

Mount time in chart-bench, median ms over nine loads, 2026-11-20, Apple M3 Pro that was not idle. 4× is Chrome's CPU slowdown. At native speed on the two smaller sizes every arm sits at the empty-page floor (about 27 ms), so only the other columns separate them.

| case                     | swiftplot | uPlot | swiftplot, 4× | uPlot, 4× |
| ------------------------ | --------: | ----: | ------------: | --------: |
| survival, 3 × 200 points |      27.9 |  29.8 |          36.4 |      57.0 |
| survival, 6 × 1,000      |      29.6 |  28.2 |          40.1 |      69.8 |
| survival, 10 × 10,000    |      26.0 |  54.1 |          72.7 |     225.4 |
| scatter, 500             |      30.0 |  28.9 |          39.7 |      53.2 |
| scatter, 10,000          |      26.7 |  28.9 |          40.6 |      62.6 |
| scatter, 100,000         |      27.7 |  35.1 |          59.4 |     158.8 |

- The 100k scatter runs on WebGL, where the draw call returns before the GPU finishes. Forcing the GPU to finish gave 31.3 ms native and 81.4 ms at 4×.
- uPlot has no built-in scatter, so its scatter numbers include circle-drawing code written for the benchmark.
- uPlot ships far more features in its 23.9 KB gzip; this prototype is about 5 KB because it does much less.

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
