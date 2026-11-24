import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

export default getViteConfig({
  test: {
    include: ['test/**/*.test.ts'],
    css: { include: [/tokens\.css/] },
    exclude: [...configDefaults.exclude, 'test/smoke/**'],
  },
});
