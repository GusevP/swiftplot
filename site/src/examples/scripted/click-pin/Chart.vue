<script setup lang="ts">
import { computed, ref } from 'vue';
import { ScatterChart } from '@swiftplot/vue';

const cafes = [
  { name: 'Alba', price: 2.4, rating: 3.9 },
  { name: 'Brew Lab', price: 3.1, rating: 4.4 },
  { name: 'Corner', price: 2.0, rating: 3.2 },
  { name: 'Drip', price: 3.6, rating: 4.7 },
  { name: 'Elm Street', price: 2.8, rating: 4.1 },
  { name: 'Fika', price: 3.9, rating: 4.2 },
  { name: 'Grind', price: 2.2, rating: 3.6 },
  { name: 'Harbour', price: 4.3, rating: 4.6 },
  { name: 'Ink', price: 3.3, rating: 3.8 },
  { name: 'Juniper', price: 4.0, rating: 4.9 },
];

const pinned = ref<number[]>([]);
const selected = computed(() => [{ id: 'rating', rows: pinned.value }]);

function toggle(hit: { row?: number } | null) {
  const row = hit?.row;
  if (row === undefined) return;
  pinned.value = pinned.value.includes(row) ? pinned.value.filter(r => r !== row) : [...pinned.value, row];
}
</script>

<template>
  <ScatterChart
    :data="cafes"
    x="price"
    y="rating"
    :r="6"
    :height="320"
    :selected="selected"
    @click="toggle"
  />
  <p>
    {{ pinned.length ? `Pinned: ${pinned.map(i => cafes[i]?.name).join(', ')}` : 'Click a dot to pin it.' }}
  </p>
</template>
