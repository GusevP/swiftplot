import { barChart, lineChart } from 'swiftplot/charts';

const days = Array.from({ length: 91 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 1 + i)),
  orders: Math.round(120 + 40 * Math.sin(i / 6) + (i % 7) * 6),
}));
/** @param {Date} date */
const monthOf = date => date.toLocaleString('en', { month: 'long', timeZone: 'UTC' });
const months = [...new Set(days.map(d => monthOf(d.date)))].map(month => ({
  month,
  orders: days.filter(d => monthOf(d.date) === month).reduce((sum, d) => sum + d.orders, 0),
}));

/** @param {HTMLElement} el */
export function mount(el) {
  const box = el.appendChild(document.createElement('div'));
  const top = box.appendChild(document.createElement('div'));
  const below = box.appendChild(document.createElement('div'));
  box.style.cssText = 'display: flex; flex-direction: column; height: 100%';
  top.style.cssText = below.style.cssText = 'flex: 1; min-height: 0';
  below.hidden = true;

  const detail = lineChart(below, { data: days, x: 'date', y: 'orders' });
  const bars = barChart(top, {
    data: months,
    x: 'month',
    y: 'orders',
    onClick(hit) {
      const row = hit?.row;
      const month = row === undefined ? undefined : months[row]?.month;
      bars.update({ selected: row === undefined ? null : [{ id: 'orders', rows: [row] }] });
      below.hidden = month === undefined;
      if (month !== undefined) detail.update({ data: days.filter(d => monthOf(d.date) === month) });
    },
  });
  return {
    destroy() {
      bars.destroy();
      detail.destroy();
      box.remove();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
