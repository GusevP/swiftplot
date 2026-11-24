import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';

const source = (path: string) => fileURLToPath(new URL(`../packages/${path}`, import.meta.url));

const colour = (name: string) => ({ foreground: `var(--code-${name})` });

const fixtures: AstroIntegration = {
  name: 'test-fixtures',
  hooks: {
    'astro:config:setup': ({ command, injectRoute, updateConfig }) => {
      if (command !== 'dev') return;
      const host = (page: string) => fileURLToPath(new URL(`test/host/${page}.astro`, import.meta.url));
      injectRoute({ pattern: '/test/guide', entrypoint: host('guide') });
      injectRoute({ pattern: '/test/live', entrypoint: host('live') });
      injectRoute({ pattern: '/test/cards', entrypoint: host('cards') });
      updateConfig({
        vite: { optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom/client', 'vue'] } },
      });
    },
  },
};

export default defineConfig({
  site: 'https://swiftplot.dev',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [mdx(), sitemap(), fixtures],
  markdown: {
    shikiConfig: {
      theme: {
        name: 'site',
        type: 'dark',
        colors: { 'editor.foreground': 'var(--code-ink)', 'editor.background': 'var(--code-bg)' },
        tokenColors: [
          { scope: ['comment', 'punctuation.definition.comment'], settings: colour('dim') },
          { scope: ['string', 'punctuation.definition.string'], settings: colour('str') },
          { scope: ['keyword', 'storage', 'constant.language'], settings: colour('key') },
          { scope: ['keyword.operator', 'storage.type.function.arrow'], settings: colour('ink') },
        ],
      },
    },
  },
  vite: {
    resolve: {
      alias: [
        { find: /^swiftplot$/, replacement: source('core/src/index.ts') },
        { find: /^swiftplot\/charts$/, replacement: source('core/src/charts/index.ts') },
        { find: /^@swiftplot\/react$/, replacement: source('react/src/index.ts') },
        { find: /^@swiftplot\/vue$/, replacement: source('vue/src/index.ts') },
      ],
    },
  },
});
