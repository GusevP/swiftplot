import { useState, type CSSProperties } from 'react';
import { BarChart } from '@swiftplot/react';

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
const themes = { day: theme, night: { ...theme } };

export function Chart() {
  const [dark, setDark] = useState(false);
  const variables = (dark ? night : day) as CSSProperties;
  return (
    <div style={{ ...variables, padding: 12, background: 'var(--chart-surface)' }}>
      <button onClick={() => setDark(!dark)}>{dark ? 'Light' : 'Dark'}</button>
      <BarChart
        data={teams}
        x="team"
        y="points"
        height={320}
        colors={colors}
        theme={dark ? themes.night : themes.day}
      />
    </div>
  );
}
