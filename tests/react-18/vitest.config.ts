import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import base from '../../packages/react/vitest.config.js';

export default defineConfig({
  ...base,
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { ...base.resolve, dedupe: ['react', 'react-dom'] },
  test: {
    ...base.test,
    dir: fileURLToPath(new URL('../../packages/react', import.meta.url)),
    // Types are checked by tsc against the wrapper's @types/react 19; at run time expectTypeOf checks nothing.
    exclude: [...(base.test?.exclude ?? []), 'test/types.test.tsx'],
    env: { VITE_PEER: '18.3.0' },
  },
});
