import { bare, dark, dots, plot } from 'swiftplot';
import { normal, seeded } from '../examples/data/seeded';
import { whileVisible } from './visible';

const random = seeded(5);
const gauss = normal(random);
const wave = (u: number) =>
  0.5 + 0.24 * Math.sin((2 * Math.PI * u) / 1.5) + 0.1 * Math.sin((4 * Math.PI * u) / 1.5 + 1);

export function swarm(el: HTMLElement, perColour: number, top: number, period: number): void {
  const style = getComputedStyle(el);
  const marks = ['--c1', '--c2', '--c3'].map((name, k) => {
    const x = new Float64Array(perColour);
    const y = new Float64Array(perColour);
    const r = new Float64Array(perColour);
    for (let i = 0; i < perColour; i++) {
      x[i] = random() * 3;
      y[i] = wave(x[i]!) + (k - 1) * 0.11 + gauss() * (0.05 + 0.1 * random() * random());
      r[i] = random() < 0.02 ? 3 + random() * 5 : 0.8 + random() * 1.4;
    }
    return dots({ x, y, r, color: style.getPropertyValue(name).trim(), alpha: 0.55 });
  });
  const chart = plot(el, { x: bare([0, 3]), y: bare([0, top]), marks, theme: dark, view: { x: [0, 1.5] } });
  let start: number | undefined;
  whileVisible(el, now => {
    start ??= now;
    const at = 0.75 + 0.75 * Math.sin((now - start) / period);
    chart.update({ view: { x: [at, at + 1.5] } });
  });
}
