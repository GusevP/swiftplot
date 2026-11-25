import { useMemo, useState } from 'react';
import { BarChart, LineChart } from '@swiftplot/react';

const days = Array.from({ length: 91 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 1 + i)),
  orders: Math.round(120 + 40 * Math.sin(i / 6) + (i % 7) * 6),
}));
const monthOf = (date: Date) => date.toLocaleString('en', { month: 'long', timeZone: 'UTC' });
const months = [...new Set(days.map(d => monthOf(d.date)))].map(month => ({
  month,
  orders: days.filter(d => monthOf(d.date) === month).reduce((sum, d) => sum + d.orders, 0),
}));

export function Chart() {
  const [row, setRow] = useState<number>();
  const month = row === undefined ? undefined : months[row]?.month;
  const inMonth = useMemo(() => days.filter(d => monthOf(d.date) === month), [month]);
  return (
    <>
      <BarChart
        data={months}
        x="month"
        y="orders"
        height={220}
        selected={row === undefined ? null : [{ id: 'orders', rows: [row] }]}
        onClick={hit => setRow(hit?.row)}
      />
      {month !== undefined && <LineChart data={inMonth} x="date" y="orders" height={220} />}
    </>
  );
}
