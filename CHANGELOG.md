# Changelog

## Unreleased

## 0.4.0 - 2026-11-25

- Hovering a dot of a scatter with one series fades its other dots, as a bar does, on the canvas and on WebGL; and with an x tooltip a bar under the pointer is focused, so hovering the bars of a combo chart fades its other series.

- Pointing inside several overlapping areas focuses the lowest one there, where it always took the one drawn last: each of unstacked areas can now be picked out.

- The easy charts animate by default and take `dim`: marks are revealed on the first paint and move or cross-fade on new data, and everything else fades to 0.3 while one series or part is pointed at. `animate: false` and `dim: false` turn them off.
- Bars, error bars, box plots and candlesticks drawn by WebGL fill their buffer several times faster: 100,000 stacked bars mount in about 10 ms where they took 17.

## 0.3.0 - 2026-11-25

- Label widths are measured where they were taken as 7 px a character: category ticks, the margins beside a text axis, legend entries and the labels on slices, stages, nodes, spokes and rules, so long, capital or CJK names no longer overlap or clip. Plain numbers and the time axis's own labels keep the estimate, as the first measurement on a page costs about 3 ms.
- `scatterChart` draws error bars lying down: `errorBars: { low, high, axis: 'x' }` reads `low` and `high` as values on a number x, and a text `y` implies it.

## 0.2.0 - 2026-11-25

- A second y axis: `y2` in the options draws an axis on the right, and a mark with `yAxis: 'y2'` is drawn against it, so bars and a line in two units share a chart. Each axis fits its own marks; a zoom or a pan on y moves both; `view`, `onViewChange`, `onClick`, `pointer`, `onPointerChange` and the brush's range carry `y2`; a tooltip's `value` is told the axis.
- `swiftplot/charts` draws every chart type from data: `comboChart` (bars and lines together, on one or two y axes), `pieChart`, `funnelChart`, `radialBarChart`, `radarChart`, `heatmapChart`, `histogramChart`, `boxPlotChart`, `candlestickChart`, `sankeyChart`, `treemapChart` and `sunburstChart`, each with `.spec()`, and a component of the same name in `@swiftplot/react` and `@swiftplot/vue`.
- `lineChart`, `areaChart`, `barChart` and `scatterChart` take `y2` with `y2Axis`, `rules`, `zones`, and `brush` with `onBrush`; line and scatter take `scale: 'log'` on a y axis; line, bar and scatter take `errorBars`; line takes `fill`; scatter takes `alpha`, `ring`, `shape: 'tick'` and a text `y`.
- `bar({ x, y, width })` with `stack` or `dodge` sets how much of x the bars of one place take; `tooltip({ mode: 'x', snap })` reads the title and the marks at another x, such as the nearest row's.
- An error bar with a missing end or place no longer stretches an automatic axis, a radar's hit carries the value of its spoke, and a treemap or a sunburst of a single node takes the first colour.
- `candlestick({ x, open, high, low, close })`: a wick and a body per x in a rising and a falling colour (`up`, `down`), answering a pointer anywhere on the candle; drawn by WebGL from 10,000 candles.
- With `zoom({ axes: 'xy' })` a mouse drag pans x alone until it has moved 8 px up or down, and a side a gesture proposes just as it is shown is not held, so a level mouse pan leaves a `fit: 'window'` axis fitting; panning up or down, or zooming y, gives both y axes a window of their own.
- Scatter switches to WebGL at 20,000 points instead of 10,000: below that the canvas mounts sooner.

## 0.1.1 - 2026-11-23

- First version on npm: `swiftplot`, `@swiftplot/react` and `@swiftplot/vue`.

## 0.1.0 - 2026-11-23

- Charts on Canvas 2D and WebGL2, in TypeScript, ESM only, with no dependencies: lines and areas (straight, smooth or stepped), bars, box plots, error bars, heatmaps, tick marks and scatter dots on linear, log, time and category axes.
- Pies, donuts, radars, radial bars, funnels, sankey diagrams, treemaps and sunbursts.
- A hover and touch tooltip, dim-the-others on hover, optional animation, a legend that hides and shows series, zoom and pan, a brush, a click event, and the pointer from code for linked charts.
- Light and dark themes, a palette, reference lines and zones, and tick steps and formats.
- Charts follow their container when no size is given, draw large data with WebGL and fall back to canvas when a WebGL context is lost.
- `swiftplot/charts`: `lineChart`, `areaChart`, `barChart` and `scatterChart` draw a chart from the data alone, guessing the fields and letting every default be overridden; `.spec()` returns the explicit options, and `mount()` runs the explicit API behind the same update controller.
- `@swiftplot/react` and `@swiftplot/vue`: `LineChart`, `AreaChart`, `BarChart`, `ScatterChart` and `Plot` components, with typed props, controlled state, error handling and server rendering.
