import * as React from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { host } from '../../core/test/helpers.js';

export * from '../../core/test/helpers.js';

// React 18.3.0, the peer floor, exports act only as unstable_act; act itself came in 18.3.1.
export const act: typeof React.act =
  React.act ?? (React as unknown as { unstable_act: typeof React.act }).unstable_act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function render(node: ReactNode, container: HTMLElement = host()) {
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    /** The host div. */
    get el() {
      return container.firstElementChild as HTMLElement;
    },
    rerender: (next: ReactNode) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
}
