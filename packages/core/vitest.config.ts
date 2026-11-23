import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ contextOptions: { timezoneId: 'America/New_York' } }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
