import { dots, type Feature } from 'swiftplot';
import { compile, createApp, nextTick, ref } from 'vue';
import { expect, test, vi } from 'vitest';

import { Plot } from '../src/index.js';
import { host, hover } from './helpers.js';

// @ts-expect-error the production build, with the compiler, has no types
vi.mock('vue', () => import('vue/dist/vue.esm-browser.prod.js'));

test('in a production build a compiled slot is noticed as it comes and goes, and never meets rows the chart has not taken', async () => {
  let made = 0;
  const counted: Feature = () => (made++, { destroy() {} });
  const many = Array.from({ length: 11 }, (_, x) => ({ x }));
  const data = ref(many);
  const on = ref(false);
  const errors = vi.fn();
  const marksOf = (d: { x: number }[]) => [
    dots({ x: d.map(v => v.x), y: d.map(() => 0.5), r: d.map(() => 4), color: '#ff0000' }),
  ];
  const marks = ref(marksOf(many));
  const options = {
    width: 200,
    height: 100,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    x: { label: '', domain: [0, 10] },
    y: { label: '', domain: [0, 1] },
    use: [counted],
  };
  const app = createApp({
    components: { Plot },
    setup: () => ({ data, on, marks, options }),
    render: compile(
      `<Plot v-bind="options" :marks="marks">
        <template v-if="on" #default="{ layout, hover }">
          <i>{{ layout.width }} {{ hover?.hit ? data[hover.hit.row].x : 'none' }}</i>
        </template>
      </Plot>`,
    ),
  });
  app.config.errorHandler = errors;
  const container = host();
  app.mount(container);
  const el = container.firstElementChild as HTMLElement;
  const text = () => el.querySelector('i')?.textContent;
  hover(el, 198, 50);
  await nextTick();
  expect(text()).toBeUndefined();
  for (let n = 0; n < 2; n++) {
    on.value = true;
    await nextTick();
    expect(text()).toBe('200 10');
    on.value = false;
    await nextTick();
    expect(text()).toBeUndefined();
  }
  on.value = true;
  await nextTick();
  data.value = many.slice(0, 1);
  marks.value = marksOf(many.slice(0, 1));
  await nextTick();
  expect(text()).toBe('200 none');
  expect([made, errors.mock.calls]).toEqual([1, []]);
  app.unmount();
});
