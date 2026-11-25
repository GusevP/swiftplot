import type { CSSProperties } from 'react';
import { ScatterChart } from '@swiftplot/react';

const cafes = [
  { name: 'Alba', price: 2.4, rating: 3.9, note: 'Opens at six' },
  { name: 'Brew Lab', price: 3.1, rating: 4.4, note: 'Roasts its own', pick: true },
  { name: 'Corner', price: 2.0, rating: 3.2, note: 'Standing room only' },
  { name: 'Drip', price: 3.6, rating: 4.7, note: 'Filter only' },
  { name: 'Elm Street', price: 2.8, rating: 4.1, note: 'A garden at the back', pick: true },
  { name: 'Harbour', price: 4.3, rating: 4.6, note: 'A view of the boats' },
  { name: 'Juniper', price: 4.0, rating: 4.9, note: 'Pastry from next door', pick: true },
];
const picks = cafes.filter(c => c.pick);

const marker: CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -100%)',
  marginTop: -10,
  padding: '1px 7px',
  borderRadius: 9,
  background: '#b45309',
  color: '#fff',
  whiteSpace: 'nowrap',
};
const tip: CSSProperties = {
  position: 'absolute',
  padding: '8px 12px',
  border: '1px solid',
  borderRadius: 8,
  background: 'Canvas',
  color: 'CanvasText',
  whiteSpace: 'nowrap',
};

export function Chart() {
  return (
    <ScatterChart data={cafes} x="price" y="rating" r={6} height={320} tooltip={false}>
      {({ width, xPx, yPx }, hover) => {
        const hit = hover?.hit;
        const cafe = cafes[hit?.row ?? -1];
        return (
          <>
            {xPx &&
              yPx &&
              picks.map(c => (
                <span key={c.name} style={{ ...marker, left: xPx(c.price), top: yPx(c.rating) }}>
                  {c.name}
                </span>
              ))}
            {hit && cafe && (
              <div
                style={{
                  ...tip,
                  left: hit.px,
                  top: hit.py,
                  transform: `translate(${hit.px > width / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
                }}
              >
                <b>{cafe.name}</b>
                <div>
                  €{cafe.price.toFixed(2)}, rated {cafe.rating}
                </div>
                <i>{cafe.note}</i>
              </div>
            )}
          </>
        );
      }}
    </ScatterChart>
  );
}
