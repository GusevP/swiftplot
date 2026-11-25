import { barChart } from 'swiftplot/charts';

const teams = [
  { team: 'Amber', points: 34 },
  { team: 'Birch', points: 27 },
  { team: 'Cobalt', points: 41 },
  { team: 'Dune', points: 18 },
  { team: 'Ember', points: 30 },
];

const day = {
  '--chart-bar': '#0891b2',
  '--chart-text': '#334155',
  '--chart-muted': '#94a3b8',
  '--chart-grid': '#e2e8f0',
  '--chart-surface': '#ffffff',
};
const night = {
  '--chart-bar': '#22d3ee',
  '--chart-text': '#cbd5e1',
  '--chart-muted': '#64748b',
  '--chart-grid': '#1e293b',
  '--chart-surface': '#0f172a',
};
const colors = ['var(--chart-bar)'];
const theme = {
  text: 'var(--chart-text)',
  muted: 'var(--chart-muted)',
  grid: 'var(--chart-grid)',
  surface: 'var(--chart-surface)',
  border: 'var(--chart-grid)',
};

/** @param {HTMLElement} el */
export function mount(el) {
  const box = el.appendChild(document.createElement('div'));
  const button = box.appendChild(document.createElement('button'));
  const host = box.appendChild(document.createElement('div'));
  box.style.cssText =
    'display: flex; flex-direction: column; height: 100%; box-sizing: border-box; padding: 12px; background: var(--chart-surface)';
  button.style.cssText = 'align-self: start; margin: 0 0 8px';
  host.style.cssText = 'flex: 1; min-height: 0';

  let dark = false;
  const paint = () => {
    for (const [name, value] of Object.entries(dark ? night : day)) box.style.setProperty(name, value);
    button.textContent = dark ? 'Light' : 'Dark';
  };
  paint();
  const chart = barChart(host, { data: teams, x: 'team', y: 'points', colors, theme });
  button.onclick = () => {
    dark = !dark;
    paint();
    chart.update({ theme: { ...theme } });
  };
  return {
    destroy() {
      chart.destroy();
      box.remove();
    },
  };
}

const el = document.getElementById('chart');
export const chart = el ? mount(el) : undefined;
