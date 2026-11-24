import { defineConfig } from '@playwright/test';

const fixtures = '**/{plot,cards}.smoke.ts';

export default defineConfig({
  testDir: 'test/smoke',
  testMatch: '**/*.smoke.ts',
  reporter: 'list',
  projects: [
    {
      name: 'chromium',
      testIgnore: fixtures,
      use: { browserName: 'chromium', baseURL: 'http://localhost:4329' },
    },
    // The test definitions are served by `astro dev` alone, so the built site never holds them.
    {
      name: 'fixtures',
      testMatch: fixtures,
      use: { browserName: 'chromium', baseURL: 'http://localhost:4330' },
    },
  ],
  webServer: [
    {
      // Astro detaches the preview server when it detects a coding agent; --ignore-lock keeps it in the foreground.
      command: 'astro preview --port 4329 --ignore-lock',
      url: 'http://localhost:4329',
      reuseExistingServer: false,
    },
    {
      command: 'astro dev --port 4330 --ignore-lock',
      url: 'http://localhost:4330/test/guide',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
