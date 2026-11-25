import { barChart } from 'swiftplot/charts';

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

/** @param {HTMLElement} el */
export function mount(el) {
  const box = el.appendChild(document.createElement('div'));
  const row = box.appendChild(document.createElement('p'));
  const host = box.appendChild(document.createElement('div'));
  box.style.cssText = 'display: flex; flex-direction: column; height: 100%';
  row.style.cssText = 'display: flex; gap: 8px; margin: 0 0 8px';
  host.style.cssText = 'flex: 1; min-height: 0';

  let rows = teams;
  const chart = barChart(host, { data: rows, x: 'team', y: 'points' });
  /** @param {string} label @param {() => typeof teams} next */
  const button = (label, next) => {
    const b = row.appendChild(document.createElement('button'));
    b.textContent = label;
    b.onclick = () => chart.update({ data: (rows = next()) });
  };
  button('New scores', () => rows.map(r => ({ ...r, points: Math.round(10 + Math.random() * 35) })));
  button('Sort', () => [...rows].sort((a, b) => b.points - a.points));
  return {
    destroy() {
      chart.destroy();
      box.remove();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
