import { lineChart } from 'swiftplot/charts';

const names = ['api', 'web', 'jobs'];
const days = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 10, 1 + i)),
  api: Math.round(120 + i * 3 + 30 * Math.sin(i / 3)),
  web: Math.round(80 + i * 1.5 + 18 * Math.cos(i / 4)),
  jobs: Math.round(40 + 12 * Math.sin(i / 2) + i),
}));

/** @param {HTMLElement} el */
export function mount(el) {
  const box = el.appendChild(document.createElement('div'));
  const row = box.appendChild(document.createElement('p'));
  const host = box.appendChild(document.createElement('div'));
  box.style.cssText = 'display: flex; flex-direction: column; height: 100%';
  row.style.cssText = 'display: flex; gap: 16px; margin: 0 0 8px';
  host.style.cssText = 'flex: 1; min-height: 0';

  let hidden = ['jobs'];
  /** @param {string[]} next */
  const show = next => {
    hidden = next;
    chart.update({ hidden });
    for (const { name, input } of boxes) input.checked = !hidden.includes(name);
  };
  const boxes = names.map(name => {
    const label = row.appendChild(document.createElement('label'));
    const input = label.appendChild(document.createElement('input'));
    input.type = 'checkbox';
    input.checked = !hidden.includes(name);
    input.onchange = () => show(input.checked ? hidden.filter(h => h !== name) : [...hidden, name]);
    label.append(` ${name}`);
    return { name, input };
  });
  const chart = lineChart(host, { data: days, x: 'date', hidden, onHiddenChange: show });
  return {
    destroy() {
      chart.destroy();
      box.remove();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
