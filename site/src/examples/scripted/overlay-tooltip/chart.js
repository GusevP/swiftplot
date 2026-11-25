import { scatterChart } from 'swiftplot/charts';

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

/** @param {HTMLElement} el */
export function mount(el) {
  const chart = scatterChart(el, { data: cafes, x: 'price', y: 'rating', r: 6, tooltip: false });
  const markers = picks.map(cafe => {
    const marker = chart.overlay.appendChild(document.createElement('span'));
    marker.textContent = cafe.name;
    marker.style.cssText =
      'position:absolute;transform:translate(-50%,-100%);margin-top:-10px;padding:1px 7px;border-radius:9px;background:#b45309;color:#fff;white-space:nowrap';
    return { cafe, style: marker.style };
  });
  const tip = chart.overlay.appendChild(document.createElement('div'));
  tip.style.cssText =
    'position:absolute;padding:8px 12px;border:1px solid;border-radius:8px;background:Canvas;color:CanvasText;white-space:nowrap';
  tip.hidden = true;
  const name = tip.appendChild(document.createElement('b'));
  const figures = tip.appendChild(document.createElement('div'));
  const note = tip.appendChild(document.createElement('i'));

  // Set after the handle is there: given to scatterChart(), onLayout would first run before it returns.
  chart.update({
    onLayout({ xPx, yPx }) {
      if (!xPx || !yPx) return;
      for (const { cafe, style } of markers) {
        style.left = `${xPx(cafe.price)}px`;
        style.top = `${yPx(cafe.rating)}px`;
      }
    },
    onHover(hover) {
      const hit = hover?.hit;
      const cafe = cafes[hit?.row ?? -1];
      tip.hidden = !cafe;
      if (!hit || !cafe) return;
      name.textContent = cafe.name;
      figures.textContent = `€${cafe.price.toFixed(2)}, rated ${cafe.rating}`;
      note.textContent = cafe.note;
      const left = hit.px > chart.overlay.clientWidth / 2;
      tip.style.left = `${hit.px}px`;
      tip.style.top = `${hit.py}px`;
      tip.style.transform = `translate(${left ? 'calc(-100% - 12px)' : '12px'}, -50%)`;
    },
  });
  return chart;
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
