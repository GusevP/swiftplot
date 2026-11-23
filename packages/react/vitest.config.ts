// @ts-expect-error -- no @types/node in this workspace; the config runs in Node, where this resolves.
import { fileURLToPath } from 'node:url';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const core = (path: string) => fileURLToPath(new URL(`../core/src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^swiftplot$/, replacement: core('index.ts') },
      { find: /^swiftplot\/charts$/, replacement: core('charts/index.ts') },
    ],
  },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-dom/server', 'react/jsx-dev-runtime'] },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ contextOptions: { timezoneId: 'America/New_York' } }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
