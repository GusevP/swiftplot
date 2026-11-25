import { lineChart } from 'swiftplot/charts';

const days = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 9, 1 + i)),
  visits: Math.round(900 + 260 * Math.sin(i / 5) + (i % 7) * 35),
  errors: Math.round(14 + 9 * Math.cos(i / 4) + (i === 37 ? 30 : 0)),
}));

/** @param {HTMLElement} el */
export function mount(el) {
  const box = el.appendChild(document.createElement('div'));
  const top = box.appendChild(document.createElement('div'));
  const below = box.appendChild(document.createElement('div'));
  box.style.cssText = 'display: flex; flex-direction: column; height: 100%';
  top.style.cssText = below.style.cssText = 'flex: 1; min-height: 0';

  const visits = lineChart(top, {
    data: days,
    x: 'date',
    y: 'visits',
    onPointerChange: p => errors.update({ pointer: p && { x: p.x } }),
  });
  const errors = lineChart(below, {
    data: days,
    x: 'date',
    y: 'errors',
    onPointerChange: p => visits.update({ pointer: p && { x: p.x } }),
  });
  return {
    destroy() {
      visits.destroy();
      errors.destroy();
      box.remove();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
