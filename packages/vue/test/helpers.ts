import { createApp, type VNode } from 'vue';

import { host } from '../../core/test/helpers.js';

export * from '../../core/test/helpers.js';

/** Mounts an app rendering view(); change the refs it reads and await nextTick() to re-render. */
export function render(view: () => VNode, container: HTMLElement = host()) {
  const app = createApp({ render: view });
  app.mount(container);
  return {
    container,
    /** The host div. */
    get el() {
      return container.firstElementChild as HTMLElement;
    },
    unmount: () => app.unmount(),
  };
}
