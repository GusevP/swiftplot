<script setup lang="ts">
import { arcs, legend } from 'swiftplot';
import { ref } from 'vue';

import {
  AreaChart,
  BarChart,
  CandlestickChart,
  LineChart,
  PieChart,
  Plot,
  ScatterChart,
  SunburstChart,
  TreemapChart,
  type AreaChartProps,
  type BarChartProps,
  type LineChartProps,
  type PieChartProps,
  type PlotProps,
  type ScatterChartProps,
  type TreemapChartProps,
} from '../../src/index.js';

type Row = { date: string; api: number; note: string };
const rows: Row[] = [];
const columns = { t: new Float64Array(), v: [] as number[] };
const pairs: [number, number][] = [];
const view = ref<{ x?: [number, number]; y?: [number, number] }>();
const hidden = ref<string[]>([]);
const tree = { name: 'all', children: [{ name: 'a', value: 1 }] };
const pie = [arcs({ values: [1], colors: ['red'] })];
const props: [
  LineChartProps<Row[]>,
  AreaChartProps<Row[]>,
  BarChartProps<Row[]>,
  ScatterChartProps<Row[]>,
  PlotProps,
  PieChartProps<Row[]>,
  TreemapChartProps,
] = [
  { x: 'date' },
  { stack: true },
  { stack: true },
  { r: 'api' },
  { marks: pie, 'onUpdate:view': v => v.x },
  { label: 'note', value: 'api' },
  { data: tree, shade: 0.5 },
];
const hosts = [
  { marks: pie, id: 'detail' } satisfies Parameters<typeof Plot>[0],
  { data: rows, id: 'detail' } satisfies Parameters<typeof LineChart<Row[]>>[0],
];
</script>

<template>
  <LineChart :data="rows" x="date" y="api" v-model:view="view" v-model:hidden="hidden" class="c" />
  <AreaChart :data="rows" x="date" y="api" v-model:view="view" stack />
  <BarChart :data="rows" x="date" y="api" v-model:view="view" stack />
  <ScatterChart :data="rows" x="date" y="api" v-model:view="view" r="api" />
  <LineChart
    :data="rows"
    :x="d => d.date"
    :series="d => d.note"
    zoom
    @click="(hit, at) => at.x"
    @error="e => e"
  />
  <!-- @vue-expect-error not a field of the rows -->
  <LineChart :data="rows" x="nope" />
  <!-- @vue-expect-error a text field is not a y -->
  <LineChart :data="rows" y="note" />
  <!-- @vue-expect-error not a field of the rows -->
  <AreaChart :data="rows" x="nope" />
  <!-- @vue-expect-error a text field is not a y -->
  <BarChart :data="rows" y="note" />
  <!-- @vue-expect-error a text field is not an r -->
  <ScatterChart :data="rows" r="note" />
  <!-- @vue-expect-error one y per scatter chart -->
  <ScatterChart :data="rows" :y="['api']" />
  <LineChart :data="columns" x="t" y="v" />
  <!-- @vue-expect-error not a column -->
  <LineChart :data="columns" x="w" />
  <LineChart :data="[1, null, 3]" tooltip />
  <!-- @vue-expect-error a number array has no fields to name -->
  <LineChart :data="[1, 2]" y="value" />
  <LineChart :data="pairs" zoom />
  <!-- @vue-expect-error pairs have no fields to name -->
  <LineChart :data="pairs" x="x" />
  <LineChart x="date" y="api" />
  <!-- @vue-expect-error the core's callback is a listener here -->
  <LineChart :data="rows" :on-view-change="() => {}" />
  <PieChart :data="rows" label="note" value="api" :inner="0.6" v-model:hidden="hidden" class="c" text />
  <PieChart :data="rows" :label="d => d.note" :value="d => d.api" @click="(hit, at) => at.x" />
  <PieChart :data="[1, 2]" />
  <!-- @vue-expect-error not a field of the rows -->
  <PieChart :data="rows" label="nope" value="api" />
  <!-- @vue-expect-error a text field is not a value -->
  <PieChart :data="rows" label="note" value="date" />
  <!-- @vue-expect-error a pie has no x -->
  <PieChart :data="rows" x="note" />
  <!-- @vue-expect-error a pie has no view -->
  <PieChart :data="rows" v-model:view="view" />
  <CandlestickChart :data="rows" open="api" v-model:view="view" zoom />
  <TreemapChart :data="tree" :shade="0.5" class="c" />
  <SunburstChart :data="[{ name: 'a', value: 1 }]" text @error="e => e" />
  <!-- @vue-expect-error rows are not a tree -->
  <TreemapChart :data="rows" />
  <Plot frame="polar" :marks="pie" :use="[legend()]" v-model:view="view" />
  <Plot :marks="pie" @layout="l => l.xPx?.(1)" @hover="v => v?.hit?.row">
    <template #default="{ layout, hover }">
      <b :style="{ left: `${layout.xPx?.(1)}px` }">{{ hover?.hit?.row }}</b>
      <!-- @vue-expect-error xPx is there only with axes -->
      {{ layout.xPx(1) }}
      <!-- @vue-expect-error hover is null off the plot -->
      {{ hover.px }}
    </template>
  </Plot>
  <LineChart :data="rows" x="date" y="api" v-slot="{ layout, hover }">
    {{ layout.width.toFixed() }} {{ hover?.px }}
    <!-- @vue-expect-error not in the layout -->
    {{ layout.nope }}
  </LineChart>
  <LineChart :data="rows" x="date" y="api">
    <!-- @vue-expect-error not a slot -->
    <template #other />
  </LineChart>
  <!-- @vue-expect-error marks is required -->
  <Plot frame="polar" />
  <!-- @vue-expect-error not an option -->
  <Plot :marks="pie" :dim="'high'" />
</template>
