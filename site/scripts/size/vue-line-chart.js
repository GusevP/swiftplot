import { LineChart } from '@swiftplot/vue';
import { createApp, h } from 'vue';

createApp({ render: () => h(LineChart, { data: [] }) }).mount(document.body);
