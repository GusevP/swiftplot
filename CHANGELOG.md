# Changelog

## Unreleased

- Charts on Canvas 2D and WebGL2, in TypeScript, ESM only, with no dependencies: lines and areas (straight, smooth or stepped), bars, box plots, error bars, heatmaps, tick marks and scatter dots on linear, log, time and category axes.
- Pies, donuts, radars, radial bars, funnels, sankey diagrams, treemaps and sunbursts.
- A hover and touch tooltip, dim-the-others on hover, optional animation, a legend that hides and shows series, zoom and pan, a brush, a click event, and the pointer from code for linked charts.
- Light and dark themes, a palette, reference lines and zones, and tick steps and formats.
- Charts follow their container when no size is given, draw large data with WebGL and fall back to canvas when a WebGL context is lost.
- `swiftplot/charts`: `lineChart`, `areaChart`, `barChart` and `scatterChart` draw a chart from the data alone, guessing the fields and letting every default be overridden; `.spec()` returns the explicit options, and `mount()` runs the explicit API behind the same update controller.
- `@swiftplot/react` and `@swiftplot/vue`: `LineChart`, `AreaChart`, `BarChart`, `ScatterChart` and `Plot` components, with typed props, controlled state, error handling and server rendering.
