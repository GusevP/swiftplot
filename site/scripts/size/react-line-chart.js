import { LineChart } from '@swiftplot/react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.body).render(createElement(LineChart, { data: [] }));
