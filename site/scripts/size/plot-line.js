import { line, plot } from 'swiftplot';

plot(document.body, { marks: [line({ x: [0, 1], y: [0, 1] })] });
