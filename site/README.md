# swiftplot-site

The swiftplot.dev site: Astro, built to static files in `site/dist`. Commands run from the repository root after
`pnpm install`.

| What                        | Command                                           |
| --------------------------- | ------------------------------------------------- |
| Develop                     | `pnpm --filter swiftplot-site dev`                |
| Build (pages, then search)  | `pnpm --filter swiftplot-site build`              |
| Preview the build           | `pnpm --filter swiftplot-site exec astro preview` |
| Typecheck                   | `pnpm --filter swiftplot-site typecheck`          |
| Unit tests                  | `pnpm --filter swiftplot-site test`               |
| Browser tests (after build) | `pnpm --filter swiftplot-site test:smoke`         |

The site reads the packages' sources, so it needs no package build of its own. The search index (Pagefind) is written by
`build` only, so search works in the preview, not in `dev`.

`public/_headers` sets caching: files with a content hash in their names (`/_astro/*`, Pagefind's `fragment/` and `index/`)
are cached for a year as immutable; everything else, the pages included, revalidates on every request.
