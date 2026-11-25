import { useState } from 'react';
import { LineChart } from '@swiftplot/react';

const names = ['api', 'web', 'jobs'];
const days = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 10, 1 + i)),
  api: Math.round(120 + i * 3 + 30 * Math.sin(i / 3)),
  web: Math.round(80 + i * 1.5 + 18 * Math.cos(i / 4)),
  jobs: Math.round(40 + 12 * Math.sin(i / 2) + i),
}));

export function Chart() {
  const [hidden, setHidden] = useState(['jobs']);
  return (
    <>
      <p style={{ display: 'flex', gap: 16 }}>
        {names.map(name => (
          <label key={name}>
            <input
              type="checkbox"
              checked={!hidden.includes(name)}
              onChange={e => setHidden(e.target.checked ? hidden.filter(h => h !== name) : [...hidden, name])}
            />{' '}
            {name}
          </label>
        ))}
      </p>
      <LineChart data={days} x="date" height={320} hidden={hidden} onHiddenChange={setHidden} />
    </>
  );
}
