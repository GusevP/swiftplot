import { useState } from 'react';
import { LineChart } from '@swiftplot/react';

const days = Array.from({ length: 60 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 9, 1 + i)),
  visits: Math.round(900 + 260 * Math.sin(i / 5) + (i % 7) * 35),
  errors: Math.round(14 + 9 * Math.cos(i / 4) + (i === 37 ? 30 : 0)),
}));

export function Chart() {
  const [pointer, setPointer] = useState<{ x: number } | null>(null);
  const follow = (p: { x: number } | null) => setPointer(p && { x: p.x });
  return (
    <>
      <LineChart data={days} x="date" y="visits" height={200} pointer={pointer} onPointerChange={follow} />
      <LineChart data={days} x="date" y="errors" height={200} pointer={pointer} onPointerChange={follow} />
    </>
  );
}
