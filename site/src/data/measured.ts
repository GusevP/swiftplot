import sizes from '../../scripts/size/sizes.json';

export const source = 'https://github.com/GusevP/swiftplot#measured';
export const machine = 'Chrome on an Apple M3 Pro';

export const pan = { date: '2026-11-22', row: 'line, whole', points: '1,000,000', ms: 5.1 };

export const firstDraw = {
  date: '2026-11-26',
  cases: [
    { row: 'survival, 3 × 200 points', label: '600', chart: 'line', ms: 6.3 },
    { row: 'survival, 6 × 1,000', label: '6k', chart: 'line', ms: 9.1 },
    { row: 'survival, 10 × 10,000', label: '100k', chart: 'line', ms: 18.5 },
    { row: 'scatter, 500', label: '500', chart: 'scatter', ms: 4.7 },
    { row: 'scatter, 10,000', label: '10k', chart: 'scatter', ms: 7.7 },
    { row: 'scatter, 100,000', label: '100k', chart: 'scatter', ms: 15.6 },
  ],
} as const;

const entry = 'plot-line';
export const shipped = { date: '2026-11-26', entry, kb: sizes[entry] } as const;
