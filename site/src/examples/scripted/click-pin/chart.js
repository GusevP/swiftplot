import { scatterChart } from 'swiftplot/charts';

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

/** @param {HTMLElement} el */
export function mount(el) {
  const box = el.appendChild(document.createElement('div'));
  const host = box.appendChild(document.createElement('div'));
  const note = box.appendChild(document.createElement('p'));
  box.style.cssText = 'display: flex; flex-direction: column; height: 100%';
  host.style.cssText = 'flex: 1; min-height: 0';
  note.style.cssText = 'margin: 8px 0 0; min-height: 1.5em';
  note.textContent = 'Click a dot to pin it.';

  /** @type {number[]} */
  let pinned = [];
  const chart = scatterChart(host, {
    data: cafes,
    x: 'price',
    y: 'rating',
    r: 6,
    onClick(hit) {
      const row = hit?.row;
      if (row === undefined) return;
      pinned = pinned.includes(row) ? pinned.filter(r => r !== row) : [...pinned, row];
      chart.update({ selected: [{ id: 'rating', rows: pinned }] });
      note.textContent = pinned.length
        ? `Pinned: ${pinned.map(i => cafes[i]?.name).join(', ')}`
        : 'Click a dot to pin it.';
    },
  });
  return {
    destroy() {
      chart.destroy();
      box.remove();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
