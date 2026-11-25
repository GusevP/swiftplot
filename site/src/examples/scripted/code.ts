import type { Framework } from '../../scripts/preferences';
import variablesReact from './css-variables/Chart.tsx?raw';
import variablesVue from './css-variables/Chart.vue?raw';
import variablesJs from './css-variables/chart.js?raw';
import overlayReact from './overlay-tooltip/Chart.tsx?raw';
import overlayVue from './overlay-tooltip/Chart.vue?raw';
import overlayJs from './overlay-tooltip/chart.js?raw';
import drillReact from './bar-drill-down/Chart.tsx?raw';
import newDataReact from './bar-new-data/Chart.tsx?raw';
import newDataVue from './bar-new-data/Chart.vue?raw';
import newDataJs from './bar-new-data/chart.js?raw';
import drillVue from './bar-drill-down/Chart.vue?raw';
import drillJs from './bar-drill-down/chart.js?raw';
import pinReact from './click-pin/Chart.tsx?raw';
import pinVue from './click-pin/Chart.vue?raw';
import pinJs from './click-pin/chart.js?raw';
import linkedReact from './linked-crosshairs/Chart.tsx?raw';
import linkedVue from './linked-crosshairs/Chart.vue?raw';
import linkedJs from './linked-crosshairs/chart.js?raw';
import hiddenReact from './series-hidden/Chart.tsx?raw';
import hiddenVue from './series-hidden/Chart.vue?raw';
import hiddenJs from './series-hidden/chart.js?raw';

/** The files of each hand-written example, as the page shows them. */
export const scriptedCode: Readonly<Record<string, Readonly<Record<Framework, string>>>> = {
  'bar-new-data': { js: newDataJs, react: newDataReact, vue: newDataVue },
  'click-pin': { js: pinJs, react: pinReact, vue: pinVue },
  'bar-drill-down': { js: drillJs, react: drillReact, vue: drillVue },
  'linked-crosshairs': { js: linkedJs, react: linkedReact, vue: linkedVue },
  'series-hidden': { js: hiddenJs, react: hiddenReact, vue: hiddenVue },
  'overlay-tooltip': { js: overlayJs, react: overlayReact, vue: overlayVue },
  'css-variables': { js: variablesJs, react: variablesReact, vue: variablesVue },
};
