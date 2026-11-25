<script setup lang="ts">
import { ref } from 'vue';
import { LineChart } from '@swiftplot/vue';

const names = ['api', 'web', 'jobs'];
const days = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 10, 1 + i)),
  api: Math.round(120 + i * 3 + 30 * Math.sin(i / 3)),
  web: Math.round(80 + i * 1.5 + 18 * Math.cos(i / 4)),
  jobs: Math.round(40 + 12 * Math.sin(i / 2) + i),
}));

const hidden = ref(['jobs']);
const toggle = (name: string, shown: boolean) =>
  (hidden.value = shown ? hidden.value.filter(h => h !== name) : [...hidden.value, name]);
</script>

<template>
  <p style="display: flex; gap: 16px">
    <label v-for="name in names" :key="name">
      <input
        type="checkbox"
        :checked="!hidden.includes(name)"
        @change="toggle(name, ($event.target as HTMLInputElement).checked)"
      />
      {{ name }}
    </label>
  </p>
  <LineChart v-model:hidden="hidden" :data="days" x="date" :height="320" />
</template>
