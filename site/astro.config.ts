import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { createReadStream, existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
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

/** In dev there is no search index, as Pagefind makes it from a build: the one of the last build is served instead. */
const devSearch: AstroIntegration = {
  name: 'dev-search',
  hooks: {
    'astro:server:setup': ({ server }) => {
      const index = fileURLToPath(new URL('dist/pagefind', import.meta.url));
      server.middlewares.use('/pagefind', (request, response, next) => {
        const file = normalize(join(index, (request.url ?? '').split('?')[0]!));
        if (!file.startsWith(index) || !existsSync(file) || file === index) return next();
        if (file.endsWith('.js')) response.setHeader('Content-Type', 'text/javascript');
        if (file.endsWith('.json')) response.setHeader('Content-Type', 'application/json');
        createReadStream(file).pipe(response);
      });
    },
  },
};

export default defineConfig({
  site: 'https://swiftplot.dev',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [mdx(), sitemap(), fixtures, devSearch],
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
