import { animate, legend, line, plot, tooltip, zoom } from 'swiftplot';

plot(document.body, {
  marks: [line({ x: [0, 1], y: [0, 1] })],
  use: [tooltip(), legend(), zoom(), animate()],
});
