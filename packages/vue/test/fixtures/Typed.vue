<script setup lang="ts">
import { arcs, legend } from 'swiftplot';
import { ref } from 'vue';

import {
  AreaChart,
  BarChart,
  LineChart,
  Plot,
  ScatterChart,
  type AreaChartProps,
  type BarChartProps,
  type LineChartProps,
  type PlotProps,
  type ScatterChartProps,
} from '../../src/index.js';

type Row = { date: string; api: number; note: string };
const rows: Row[] = [];
const columns = { t: new Float64Array(), v: [] as number[] };
const pairs: [number, number][] = [];
const view = ref<{ x?: [number, number]; y?: [number, number] }>();
const hidden = ref<string[]>([]);
const pie = [arcs({ values: [1], colors: ['red'] })];
const props: [
  LineChartProps<Row[]>,
  AreaChartProps<Row[]>,
  BarChartProps<Row[]>,
  ScatterChartProps<Row[]>,
  PlotProps,
] = [
  { x: 'date' },
  { stack: true },
  { stack: true },
  { r: 'api' },
  { marks: pie, 'onUpdate:view': v => v.x },
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
  <Plot frame="polar" :marks="pie" :use="[legend()]" v-model:view="view" />
  <!-- @vue-expect-error marks is required -->
  <Plot frame="polar" />
  <!-- @vue-expect-error not an option -->
  <Plot :marks="pie" :dim="'high'" />
</template>
