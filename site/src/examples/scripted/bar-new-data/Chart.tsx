import { useState } from 'react';
import { BarChart } from '@swiftplot/react';

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

export function Chart() {
  const [rows, setRows] = useState(teams);
  return (
    <>
      <p style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setRows(rows.map(r => ({ ...r, points: Math.round(10 + Math.random() * 35) })))}
        >
          New scores
        </button>
        <button onClick={() => setRows([...rows].sort((a, b) => b.points - a.points))}>Sort</button>
      </p>
      <BarChart data={rows} x="team" y="points" height={320} />
    </>
  );
}
