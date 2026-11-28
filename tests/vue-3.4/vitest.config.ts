import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import base from '../../packages/vue/vitest.config.js';

export default defineConfig({
  ...base,
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { ...base.resolve, dedupe: ['vue'] },
  test: {
    ...base.test,
    dir: fileURLToPath(new URL('../../packages/vue', import.meta.url)),
    env: { VITE_PEER: '3.4.0' },
  },
});
