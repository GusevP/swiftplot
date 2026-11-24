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

## Cloudflare Pages

Pages builds the site on every push to `main` and gives each pull request from a branch of this repository a preview;
pull requests from forks get none. The settings to enter when connecting `GusevP/swiftplot`:

| Setting                | Value                                   |
| ---------------------- | --------------------------------------- |
| Production branch      | `main`                                  |
| Framework preset       | None                                    |
| Build command          | `pnpm --filter swiftplot-site... build` |
| Build output directory | `site/dist`                             |
| Root directory         | empty (the repository root)             |
| Environment variable   | `PNPM_VERSION` = `10.34.7`              |

- The build command builds the packages the site depends on, then the site.
- Node comes from `.node-version` at the repository root (`24`); without it the build image uses its default (22).
- Set `PNPM_VERSION` (the v3 image does not read the lockfile; the default is 10.11.1) and keep it equal to
  `packageManager` in the root `package.json`.

`public/_headers` sets caching: files with a content hash in their names (`/_astro/*`, Pagefind's `fragment/` and `index/`)
are cached for a year as immutable; everything else, the pages included, revalidates on every request.
