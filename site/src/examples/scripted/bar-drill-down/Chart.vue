<script setup lang="ts">
import { computed, ref } from 'vue';
import { BarChart, LineChart } from '@swiftplot/vue';

const days = Array.from({ length: 91 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 1 + i)),
  orders: Math.round(120 + 40 * Math.sin(i / 6) + (i % 7) * 6),
}));
const monthOf = (date: Date) => date.toLocaleString('en', { month: 'long', timeZone: 'UTC' });
const months = [...new Set(days.map(d => monthOf(d.date)))].map(month => ({
  month,
  orders: days.filter(d => monthOf(d.date) === month).reduce((sum, d) => sum + d.orders, 0),
}));

const row = ref<number>();
const month = computed(() => (row.value === undefined ? undefined : months[row.value]?.month));
const inMonth = computed(() => days.filter(d => monthOf(d.date) === month.value));
const selected = computed(() => (row.value === undefined ? null : [{ id: 'orders', rows: [row.value] }]));
</script>

<template>
  <BarChart
    :data="months"
    x="month"
    y="orders"
    :height="220"
    :selected="selected"
    @click="hit => (row = hit?.row)"
  />
  <LineChart v-if="month !== undefined" :data="inMonth" x="date" y="orders" :height="220" />
</template>
