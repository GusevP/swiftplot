import areaStacked from './area-stacked';
import axisTicks from './axis-ticks';
import barGrouped from './bar-grouped';
import boxPlot from './box-plot';
import bubbles from './bubbles';
import candlesticks from './candlesticks';
import { registry, type Example, type ScriptedExample } from './define';
import { scripted } from './scripted/index';
import errorBars from './error-bars';
import funnel from './funnel';
import guideAnnotated from './guide-annotated';
import guideFields from './guide-fields';
import guideLog from './guide-log';
import guidePlot from './guide-plot';
import guideTicks from './guide-ticks';
import guideTwoAxes from './guide-two-axes';
import heatmap from './heatmap';
import legendRows from './legend-rows';
import lineGaps from './line-gaps';
import histogram from './histogram';
import landingFeatures from './landing-features';
import lineAnnotated from './line-annotated';
import lineBrush from './line-brush';
import lineFromRows from './line-from-rows';
import lineLive from './line-live';
import lineLog from './line-log';
import lineLongData from './line-long-data';
import lineZoom from './line-zoom';
import pieDonut from './pie-donut';
import radar from './radar';
import radialBars from './radial-bars';
import sankey from './sankey';
import scatterLarge from './scatter-large';
import stripPlot from './strip-plot';
import sunburst from './sunburst';
import treemap from './treemap';
import twoYAxes from './two-y-axes';

export const examples = registry([
  lineFromRows,
  lineZoom,
  lineLongData,
  lineAnnotated,
  lineLog,
  lineGaps,
  axisTicks,
  legendRows,
  lineBrush,
  lineLive,
  twoYAxes,
  areaStacked,
  barGrouped,
  scatterLarge,
  bubbles,
  pieDonut,
  radar,
  radialBars,
  funnel,
  sankey,
  treemap,
  sunburst,
  histogram,
  boxPlot,
  stripPlot,
  errorBars,
  heatmap,
  candlesticks,
]);

export { scripted };
/** Every example the site lists, in the order it lists them. */
export const listed: readonly (Example | ScriptedExample)[] = [...examples.values(), ...scripted];

export const unlisted = [
  landingFeatures,
  guideFields,
  guidePlot,
  guideTwoAxes,
  guideAnnotated,
  guideLog,
  guideTicks,
];
