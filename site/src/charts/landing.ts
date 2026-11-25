import {
  arcs,
  area,
  band,
  bands,
  bar,
  bare,
  bin,
  box,
  dark,
  dots,
  errorBars,
  fiveNumbers,
  fromLinks,
  fromTree,
  funnel,
  heatmap,
  legend,
  light,
  line,
  plot,
  radar,
  radialBars,
  rule,
  sankey,
  sequential,
  sunburst,
  tooltip,
  treemap,
  zoom,
  type Chart,
  type Options,
} from 'swiftplot';
import { firstDraw } from '../data/measured';
import { seeded } from '../examples/data/seeded';
import type { State } from '../examples/define';
import { load, mountExample } from './mount';

type Look = { c: string[]; dark: boolean };
type Build = (look: Look) => Partial<Options> & Pick<Options, 'marks'>;

const root = document.documentElement;
const random = seeded(7);
const seq = (n: number, f: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => f(i));
const whole = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

const look = (): Look => {
  const style = getComputedStyle(root);
  return {
    c: ['--c1', '--c2', '--c3', '--c4', '--c5'].map(name => style.getPropertyValue(name).trim()),
    dark: root.dataset.theme === 'dark',
  };
};

const redraws: (() => void)[] = [];
new MutationObserver(() => {
  for (const redraw of redraws) redraw();
}).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

function draw(el: HTMLElement, build: Build, fixed: Omit<Options, 'marks'> = {}): Chart {
  const options = () => {
    const now = look();
    return { ...fixed, ...build(now), theme: now.dark ? dark : light };
  };
  const chart = plot(el, options());
  redraws.push(() => chart.update(options()));
  return chart;
}

function walk(n: number) {
  const next = seeded(42);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0, v = 0; i < n; i++) {
    v += next() - 0.5;
    x[i] = i;
    y[i] = v;
  }
  return { x, y };
}

let millionWalk: ReturnType<typeof walk> | undefined;
const aMillion = () => (millionWalk ??= walk(1_000_000));

const t = seq(40, i => i);
const grid = seq(16 * 9, i => Math.sin((i % 16) / 3) + Math.cos(Math.floor(i / 16) / 2));
const heat = {
  dark: sequential({ stops: ['#0e1524', '#2563eb', '#22d3ee'] }),
  light: sequential({ stops: ['#e4e8f0', '#22d3ee', '#2563eb', '#9333ea'] }),
};
const links = fromLinks([
  { source: 'Visits', target: 'Sign-ups', value: 6 },
  { source: 'Visits', target: 'Left', value: 4 },
  { source: 'Sign-ups', target: 'Paid', value: 2 },
  { source: 'Sign-ups', target: 'Free', value: 4 },
]);
const five = fiveNumbers(
  Array.from({ length: 6 }, (_, g) =>
    Array.from({ length: 40 }, () => 4 + g * 0.5 + (random() - 0.5) * (3 + g)),
  ),
);
const branches = [
  {
    name: 'A',
    children: [
      { name: 'A1', value: 6 },
      { name: 'A2', value: 3 },
      { name: 'A3', value: 2 },
    ],
  },
  {
    name: 'B',
    children: [
      { name: 'B1', value: 4 },
      { name: 'B2', value: 4 },
    ],
  },
  {
    name: 'C',
    children: [
      { name: 'C1', value: 3 },
      { name: 'C2', value: 1 },
      { name: 'C3', value: 1 },
    ],
  },
];
const binned = bin(
  seq(2000, () => (random() + random() + random() + random()) / 4),
  22,
);
const mid = seq(40, i => 5 + 2 * Math.sin(i / 6));
const bubbles = [
  seq(36, () => random() * 10),
  seq(36, () => random() * 10),
  seq(36, () => 4 + random() * 12),
];
const ex = seq(10, i => i);
const ey = seq(10, i => 3 + Math.sin(i / 2) * 2 + i * 0.2);
const spread = [seq(10, i => ey[i]! - 0.6 - random()), seq(10, i => ey[i]! + 0.6 + random())];

const tiles: Record<string, Build> = {
  heat: ({ dark }) => ({
    marks: [heatmap({ values: grid, columns: 16, color: dark ? heat.dark : heat.light })],
  }),
  radar: ({ c }) => ({
    frame: 'polar',
    marks: radar({
      axes: ['A', 'B', 'C', 'D', 'E', 'F'],
      series: [
        { values: [5, 3, 4, 2, 4, 3], color: c[0]!, label: 'One' },
        { values: [2, 4, 3, 5, 2, 4], color: c[2]!, label: 'Two' },
      ],
    }),
  }),
  donut: ({ c }) => ({
    frame: 'polar',
    marks: [arcs({ values: [5, 3, 2, 1.5, 1], colors: c, inner: 0.62 })],
  }),
  box: ({ c }) => ({ marks: [box({ x: seq(6, i => i), ...five, color: c[0]! })] }),
  sankey: ({ c }) => ({ frame: 'blank', marks: [sankey({ ...links, colors: c, blend: true })] }),
  treemap: ({ c }) => ({ frame: 'blank', marks: [treemap({ ...fromTree(branches), colors: c })] }),
  sunburst: ({ c }) => ({ frame: 'polar', marks: [sunburst({ ...fromTree(branches), colors: c })] }),
  hist: ({ c }) => ({ marks: [bar({ ...binned, color: c[1]!, gap: 2 })] }),
  bubble: ({ c }) => ({
    marks: [dots({ x: bubbles[0]!, y: bubbles[1]!, r: bubbles[2]!, color: c[2]!, alpha: 0.6 })],
  }),
  radial: ({ c }) => ({
    frame: 'polar',
    marks: [radialBars({ values: [82, 64, 47, 30], max: 100, colors: c })],
  }),
  band: ({ c }) => ({
    marks: [
      area({
        x: t,
        y1: seq(40, i => mid[i]! - 1.2 - i * 0.03),
        y2: seq(40, i => mid[i]! + 1.2 + i * 0.03),
        color: c[0]!,
        alpha: 0.3,
      }),
      line({ x: t, y: mid, color: c[0]!, width: 2.5 }),
    ],
  }),
  funnel: ({ c }) => ({ frame: 'blank', marks: [funnel({ values: [100, 72, 45, 24, 12], colors: c })] }),
  pie: ({ c }) => ({ frame: 'polar', marks: [arcs({ values: [4, 3, 2, 2, 1], colors: c })] }),
  error: ({ c }) => ({
    marks: [
      errorBars({ x: ex, y1: spread[0]!, y2: spread[1]!, color: c[1]! }),
      dots({ x: ex, y: ey, r: new Float64Array(10).fill(4), color: c[0]! }),
    ],
  }),
  big: ({ c }) => ({ marks: [line({ ...aMillion(), color: c[0]! })] }),
};

export function tile(el: HTMLElement): void {
  const { example, state, tile: id } = el.dataset;
  if (example) {
    void load(example).then(definition =>
      mountExample(el, definition, JSON.parse(state ?? '{}') as State, { legend: false }),
    );
    return;
  }
  draw(el, tiles[id!]!, { x: bare(), y: bare(), dim: 0.35 });
}

export function million(el: HTMLElement, count: HTMLElement, sizes: readonly HTMLButtonElement[]): void {
  let shown = aMillion();
  const build: Build = ({ c }) => ({
    marks: [line({ ...shown, color: c[0]!, label: 'Walk' })],
    description: `A random walk of ${whole(shown.x.length)} points`,
  });
  const chart = draw(el, build, {
    x: { domain: 'data', label: 'Step', format: whole },
    y: { domain: 'nice', label: 'Value', fit: 'window' },
    use: [zoom({ wheel: 'plain' }), tooltip({ mode: 'x', title: whole, value: v => v.toFixed(2) })],
  });
  for (const button of sizes)
    button.addEventListener('click', () => {
      const n = Number(button.dataset.n);
      shown = n === 1_000_000 ? aMillion() : walk(n);
      chart.update({ ...build(look()), view: {} });
      count.textContent = `${whole(n)} points`;
      for (const other of sizes) other.setAttribute('aria-pressed', String(other === button));
    });
}

export function firstDrawChart(el: HTMLElement): void {
  const { cases } = firstDraw;
  const [x1, x2] = bands(cases.length);
  const series = (chart: string, colour: string, label: string) =>
    bar({
      x1: x1.filter((_, i) => cases[i]!.chart === chart),
      x2: x2.filter((_, i) => cases[i]!.chart === chart),
      y: cases.filter(c => c.chart === chart).map(c => c.ms),
      color: colour,
      radius: 3,
      label,
    });
  draw(
    el,
    ({ c }) => ({
      marks: [
        series('line', c[0]!, 'Line'),
        series('scatter', c[2]!, 'Scatter'),
        rule({ y: 1000 / 60, color: c[4]!, dashed: true, text: 'One frame at 60 Hz' }),
      ],
    }),
    {
      x: band({ label: 'First draw, by chart and total points', categories: cases.map(c => c.label) }),
      y: { domain: [0, 20], label: 'Milliseconds' },
      use: [
        legend(),
        tooltip({
          mode: 'nearest',
          text: (label, x, y) => `${cases[Math.round(x)]?.row ?? label}: ${y.toFixed(1)} ms`,
        }),
      ],
    },
  );
}
