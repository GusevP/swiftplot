<script setup lang="ts">
import { ScatterChart } from '@swiftplot/vue';
import type { Hover, Layout } from 'swiftplot';

const cafes = [
  { name: 'Alba', price: 2.4, rating: 3.9, note: 'Opens at six' },
  { name: 'Brew Lab', price: 3.1, rating: 4.4, note: 'Roasts its own', pick: true },
  { name: 'Corner', price: 2.0, rating: 3.2, note: 'Standing room only' },
  { name: 'Drip', price: 3.6, rating: 4.7, note: 'Filter only' },
  { name: 'Elm Street', price: 2.8, rating: 4.1, note: 'A garden at the back', pick: true },
  { name: 'Harbour', price: 4.3, rating: 4.6, note: 'A view of the boats' },
  { name: 'Juniper', price: 4.0, rating: 4.9, note: 'Pastry from next door', pick: true },
];
const picks = cafes.filter(c => c.pick);

const markerAt = ({ xPx, yPx }: Layout, price: number, rating: number) =>
  xPx && yPx ? { left: `${xPx(price)}px`, top: `${yPx(rating)}px` } : {};

function tipOf(layout: Layout, hover: Hover | null) {
  const hit = hover?.hit;
  const cafe = cafes[hit?.row ?? -1];
  if (!hit || !cafe) return [];
  const shift = hit.px > layout.width / 2 ? 'calc(-100% - 12px)' : '12px';
  const style = { left: `${hit.px}px`, top: `${hit.py}px`, transform: `translate(${shift}, -50%)` };
  return [{ ...cafe, style }];
}
</script>

<template>
  <ScatterChart
    :data="cafes"
    x="price"
    y="rating"
    :r="6"
    :height="320"
    :tooltip="false"
    v-slot="{ layout, hover }"
  >
    <span v-for="c in picks" :key="c.name" class="marker" :style="markerAt(layout, c.price, c.rating)">
      {{ c.name }}
    </span>
    <div v-for="t in tipOf(layout, hover)" :key="t.name" class="tip" :style="t.style">
      <b>{{ t.name }}</b>
      <div>€{{ t.price.toFixed(2) }}, rated {{ t.rating }}</div>
      <i>{{ t.note }}</i>
    </div>
  </ScatterChart>
</template>

<style scoped>
.marker {
  position: absolute;
  transform: translate(-50%, -100%);
  margin-top: -10px;
  padding: 1px 7px;
  border-radius: 9px;
  background: #b45309;
  color: #fff;
  white-space: nowrap;
}

.tip {
  position: absolute;
  padding: 8px 12px;
  border: 1px solid;
  border-radius: 8px;
  background: Canvas;
  color: CanvasText;
  white-space: nowrap;
}
</style>
