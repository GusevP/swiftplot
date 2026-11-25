<script setup lang="ts">
import { shallowRef } from 'vue';
import { BarChart } from '@swiftplot/vue';

const teams = [
  { team: 'Amber', points: 34 },
  { team: 'Birch', points: 27 },
  { team: 'Cobalt', points: 41 },
  { team: 'Dune', points: 18 },
  { team: 'Ember', points: 30 },
  { team: 'Fjord', points: 23 },
  { team: 'Garnet', points: 38 },
  { team: 'Heron', points: 15 },
];

const rows = shallowRef(teams);
const rescore = () =>
  (rows.value = rows.value.map(r => ({ ...r, points: Math.round(10 + Math.random() * 35) })));
const sort = () => (rows.value = [...rows.value].sort((a, b) => b.points - a.points));
</script>

<template>
  <p style="display: flex; gap: 8px">
    <button @click="rescore">New scores</button>
    <button @click="sort">Sort</button>
  </p>
  <BarChart :data="rows" x="team" y="points" :height="320" />
</template>
