# Contributing to swiftplot

## Reporting a bug

Open an issue with the bug form: the swiftplot version, the browser, a reproduction, what happened and what you
expected. A reproduction is the smallest page that shows the bug: a StackBlitz or CodePen link, or one HTML file, with
the data inline and nothing else from your app. Questions and ideas go to
[Discussions](https://github.com/GusevP/swiftplot/discussions).

swiftplot is before 1.0, so its API may still change between minor versions. Every change is listed in
[CHANGELOG.md](CHANGELOG.md).

## Develop

From the repository root. `build`, `test` and `typecheck` run in every package under `packages/` and in the site (`site/`), `test:import` in the packages only. GitHub runs these checks, re-measures the bundle sizes, then packs the packages and checks the tarballs, on every push to `main` and every pull request (`.github/workflows/ci.yml`, read-only):

```sh
pnpm install
pnpm --filter swiftplot exec playwright install chromium   # once, for the tests
pnpm build
pnpm test:import # imports each package's dist/ in Node, after pnpm build
pnpm test:smoke  # Playwright on the built site, after pnpm build
pnpm test        # Vitest (in a real browser for the packages), one package at a time, then node --test on scripts/
pnpm typecheck
pnpm --filter swiftplot run test   # one package
pnpm lint        # oxlint, type-aware
pnpm format      # oxfmt
pnpm format:check
pnpm size        # bundle sizes into site/scripts/size/sizes.json, after pnpm build
```

The site is the Astro project in `site/`. `pnpm --filter swiftplot-site dev` serves it while you edit; `pnpm --filter swiftplot-site build`, then `pnpm --filter swiftplot-site exec astro preview`, serves the build, with search. `pnpm test:smoke` needs that build in `site/dist` and the Chromium installed above, and starts the preview itself. The site's other commands are in [site/README.md](site/README.md).

## Releasing

Every package has the same version, and one release is one tag `vX.Y.Z` and one GitHub Release with the three tarballs and `SHA256SUMS`. The changelog is `CHANGELOG.md`: work adds its entries under `## Unreleased`, written by hand. Two commands, run on your machine with your own `git`, `gh` and `npm` logins:

```sh
pnpm release:prepare <version | patch | minor | major>   # one local commit: versions and changelog
pnpm release [--npm] [--dry-run]                         # releases the commit on main
```

`release:prepare` needs a clean tree, a version higher than the current one and than every `v` tag on `origin`, and entries under `## Unreleased`. It sets the version in every package, turns `## Unreleased` into `## X.Y.Z - date` and commits `release: vX.Y.Z`. It does not push or tag: get the commit onto `main` as usual and let its checks run. A version with a hyphen (`0.1.0-rc.0`) is a pre-release.

`pnpm release` takes the version from the packages and, when the tag does not exist yet, requires a clean tree, `HEAD` equal to `main` on `origin`, a version higher than every tag and changelog entries for it. It waits for the `ci.yml` push run on `main` for that commit and requires it and its `check` and `pack` jobs to have passed (a pull-request run does not count). It builds the tarballs from a clean export of the commit, checks them and keeps them in `.release/<version>/`. It then shows the commit, each file with its size and SHA-256, and the notes (the changelog section), and asks you to type the version. Only then does it push the tag to `origin` and create, upload to and publish the GitHub Release. A published release is never changed: one that differs from what was confirmed stops the command, naming what differs.

If it stops, fix the cause and run it again: each step checks what is already done. Once the tag exists, a run continues that release on the tag's commit, even when `main` has moved on, and asks again before writing. A `.release/<version>/` that no longer matches stops the command with a message to remove it. `--dry-run` builds and shows the same preview, lists every reason a real run would stop, and writes nothing. It looks at the `ci.yml` run once, so it also lists a run still queued or in progress, which a real run waits up to 30 minutes for.

`--npm` then publishes the published release's own files to npm in the order `swiftplot`, `@swiftplot/react`, `@swiftplot/vue`, a pre-release under the dist-tag `next`. npm refuses a `private` package, so `--npm` stops before anything is written when a package is `"private": true` at the release commit. A release made without `--npm` can go to npm later with `pnpm release --npm`.

The command uploads with plain `npm publish`, which makes a version public at once; npm can also hold a version staged for approval some other way (`npm stage publish`), and a staged version does not show in `npm view`. The command keeps a receipt per package in `.release/<version>/npm.json` on your machine and never publishes a package twice. When a package has a receipt and `npm view` does not show it, the command asks `npm stage list` and says which of these it is. The `npm stage` commands it prints name registry.npmjs.org, as the command does, so run them as printed:

- **staged**: it waits for approval; the line gives its id, and `npm stage approve <id>` publishes it.
- **staged with other bytes**: what npm holds is not this release's tarball: reject it (`npm stage reject <id>`), remove that package's entry from `npm.json` and run again.
- **staged, bytes not checked**: `npm stage list` gave no shasum. Approve it only if `npm stage view <id>` shows the shasum the line gives; otherwise reject it, remove its entry and run again.
- **neither public nor staged, receipt `started`**: the upload most likely failed. If it was sent in the last few minutes it may still be processing; otherwise remove that package's entry from `npm.json` and run again.
- **accepted and not visible yet**, receipt `finished`: run again in a few minutes. If it has been more than a few minutes, or you rejected its staged copy, remove that package's entry from `npm.json` and run again.
- **could not ask**: `npm stage` needs npm 11.15 or later, and a login that has expired fails too. The line gives what npm printed. Keep `npm.json`, update npm or run `npm login`, then run again, so the command can check what npm holds.

At the end it prints one line per package: public, one of the six above, sent but not yet seen on npm (run again), not published or not checked. `.release/<version>/npm.lock` stops a second publish of the same version; if a run was killed and none is running, remove `npm.lock`, not `npm.json`.
