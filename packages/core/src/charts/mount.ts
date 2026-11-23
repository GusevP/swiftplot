import { light } from '../theme.js';
import type { Options } from '../types.js';
import { create, PASSED, type Built, type EasyChart } from './controller.js';

export type Mount<P> = (el: HTMLElement, props: P) => EasyChart<P>;

/** plot() behind the easy charts' controller: an update sends the core only the options that changed. */
export const mount: Mount<Options> = (el, options) => {
  const use = options.use ?? [];
  const c = create<Options>(el, { ...options, theme: options.theme ?? light }, props => {
    const { use: _, ...rest } = props;
    for (const k of PASSED) delete rest[k as keyof typeof rest];
    return { options: rest as Built['options'], features: null, use: () => use };
  });
  return {
    get chart() {
      return c.chart;
    },
    update(partial) {
      c.update('theme' in partial ? { ...partial, theme: partial.theme ?? light } : partial);
    },
    destroy: () => c.destroy(),
  };
};
