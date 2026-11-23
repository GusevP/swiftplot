import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import test from 'node:test';
import { entries, sha256, verify } from './check-tarballs.mjs';
import { run as realRun } from './prepare.mjs';
import { checks, release, tarballName } from './release.mjs';
import { fakeGh, fakeNpm, github, gitRepo, sh, tar } from './testing.mjs';

const URL_OF_REPO = 'https://github.com/GusevP/swiftplot.git';
const NAMES = { core: 'swiftplot', react: '@swiftplot/react', vue: '@swiftplot/vue' };
const READS = [
  /^git (remote get-url|rev-parse|ls-remote|status|archive|cat-file) /,
  /^tar -xf /,
  /^gh api --hostname github\.com (--paginate --jq .+ )?repos\/GusevP\/swiftplot\/\S+$/,
  /^gh release download /,
  /^pnpm (install --frozen-lockfile|build|pack --pack-destination \S+)$/,
  /^npm install /,
  /^npm view /,
  /^node /,
];

function setVersion(dir, version, { isPrivate = false } = {}) {
  for (const [folder, name] of Object.entries(NAMES)) {
    const peers = name === 'swiftplot' ? {} : { peerDependencies: { swiftplot: 'workspace:^' } };
    if (isPrivate) peers.private = true;
    mkdirSync(join(dir, 'packages', folder, 'test'), { recursive: true });
    writeFileSync(
      join(dir, 'packages', folder, 'package.json'),
      `${JSON.stringify({ name, version, type: 'module', files: ['dist'], ...peers }, null, 2)}\n`,
    );
  }
}

function repo(t, { version = '0.1.0', changelog, isPrivate } = {}) {
  const { dir, origin } = gitRepo(t, 'swiftplot-release-test-', dir => {
    setVersion(dir, version, { isPrivate });
    for (const folder of Object.keys(NAMES))
      writeFileSync(join(dir, 'packages', folder, 'test/import.mjs'), '\n');
    const files = {
      'package.json': `${JSON.stringify({ name: 'workspace', private: true, repository: { url: `git+${URL_OF_REPO}` } })}\n`,
      'pnpm-lock.yaml':
        "lockfileVersion: '9.0'\n\npackages:\n\n  react@19.0.0:\n    resolution: {}\n\n  react-dom@19.0.0:\n    resolution: {}\n\n  vue@3.5.0:\n    resolution: {}\n",
      '.gitignore': 'dist\n.release/\n',
      'README.md': 'readme\n',
      LICENSE: 'MIT\n',
      'CHANGELOG.md':
        changelog ?? `# Changelog\n\n## Unreleased\n\n## ${version} - 2026-12-01\n\n- an entry\n`,
    };
    for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
  });
  return { dir, origin, head: () => sh(dir, 'rev-parse', 'HEAD') };
}

function commit(r, message, { push = true } = {}) {
  writeFileSync(join(r.dir, 'README.md'), `${message}\n`);
  sh(r.dir, 'commit', '-am', message);
  if (push) sh(r.dir, 'push', 'origin', 'HEAD:main');
  return r.head();
}

const ciRun = (sha, over = {}) => ({
  id: 1,
  event: 'push',
  branch: 'main',
  sha,
  attempts: [{ status: 'completed', conclusion: 'success', jobs: { check: 'success', pack: 'success' } }],
  ...over,
});

const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async ms => void (t += ms) };
};

const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? walk(join(dir, entry.name), base)
      : [relative(base, join(dir, entry.name)).replaceAll('\\', '/')],
  );

function fakePnpm(args, cwd) {
  if (args[0] === 'install') return '';
  if (args[0] === 'build') {
    for (const folder of readdirSync(join(cwd, 'packages'))) {
      mkdirSync(join(cwd, 'packages', folder, 'dist'));
      writeFileSync(join(cwd, 'packages', folder, 'dist/index.js'), `export const name = '${folder}';\n`);
      writeFileSync(join(cwd, 'packages', folder, 'dist/index.d.ts'), 'export declare const name: string;\n');
    }
    return '';
  }
  assert.equal(args[0], 'pack');
  const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const core = JSON.parse(readFileSync(join(cwd, '..', 'core', 'package.json'), 'utf8')).version;
  if (manifest.peerDependencies) manifest.peerDependencies.swiftplot = `^${core}`;
  const files = { 'package/package.json': JSON.stringify(manifest) };
  for (const path of ['README.md', 'LICENSE', ...walk(join(cwd, 'dist')).map(p => `dist/${p}`)])
    files[`package/${path}`] = readFileSync(join(cwd, path));
  writeFileSync(join(args[2], tarballName(manifest.name, manifest.version)), tar(files));
  return '';
}

function fakeNpmInstall(args, cwd) {
  for (const path of args.filter(arg => arg.endsWith('.tgz'))) {
    const files = entries(readFileSync(path));
    const name = JSON.parse(files.get('package/package.json').toString('utf8')).name;
    for (const [inner, body] of files) {
      const target = join(cwd, 'node_modules', name, inner.slice('package/'.length));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }
  return '';
}

function harness(r, state = {}) {
  const { now, sleep } = clock();
  const calls = [];
  const writes = [];
  const printed = [];
  const asked = [];
  let atAsk;
  const ok = stdout => ({ code: 0, stdout, stderr: '' });
  state.remote = r.origin;
  const gh = fakeGh(state, now);
  const npm = fakeNpm(state);
  const run = (command, args, options = {}) => {
    const name = command === process.execPath ? 'node' : basename(command).replace(/\.exe$/i, '');
    const line = `${name} ${args.join(' ')}`;
    calls.push({ line, name, args, cwd: options.cwd });
    if (!READS.some(re => re.test(line))) writes.push(line);
    if (name === 'git' && args[0] === 'remote' && args[1] === 'get-url')
      return ok(`${(args[2] === '--push' && state.pushUrls) || state.origin || URL_OF_REPO}\n`);
    if (name === 'git' || name === 'tar') return realRun(command, args, options);
    if (name === 'gh') return gh(args, options);
    if (name === 'pnpm') {
      assert.ok(!state.noBuild, `built although it must not: ${line}`);
      return ok(fakePnpm(args, options.cwd));
    }
    if (name === 'npm' && (args[0] === 'view' || args[0] === 'publish')) return npm(args, options);
    if (name === 'npm' || (name === 'node' && args[1] === 'install'))
      return ok(fakeNpmInstall(args, options.cwd));
    if (name === 'node') return ok('');
    assert.fail(`unexpected call: ${line}`);
  };
  return {
    calls,
    writes,
    printed,
    asked,
    beforeAsk: () => writes.slice(0, atAsk),
    now,
    release: ({ dryRun = false, npm = false, answer } = {}) =>
      release({
        dir: r.dir,
        run,
        dryRun,
        npm,
        npmCommand: ['npm'],
        ask: async question => {
          asked.push(question);
          atAsk = writes.length;
          return answer === undefined ? question.split(' ')[1] : answer;
        },
        print: line => printed.push(line),
        sleep,
        now,
        pnpmCommand: ['pnpm'],
      }),
  };
}

const releaseDir = r => join(r.dir, '.release');
const snapshot = r => ({
  head: r.head(),
  branch: sh(r.dir, 'branch', '--show-current'),
  status: sh(r.dir, 'status', '--porcelain', '--untracked-files=normal', '--ignored'),
  refs: sh(r.dir, 'for-each-ref'),
  remote: sh(r.origin, 'for-each-ref'),
  release: existsSync(releaseDir(r))
    ? walk(releaseDir(r)).map(path => `${path} ${sha256(readFileSync(join(releaseDir(r), path)))}`)
    : null,
});

const EXPECTED = [
  'SHA256SUMS',
  'swiftplot-0.1.0.tgz',
  'swiftplot-react-0.1.0.tgz',
  'swiftplot-vue-0.1.0.tgz',
];

test('an existing tag needs a passing push run on main for its commit, even after main has moved on', async t => {
  const r = repo(t);
  const tagged = r.head();
  sh(r.dir, 'tag', '-a', 'v0.1.0', '-m', 'v0.1.0');
  sh(r.dir, 'push', 'origin', 'v0.1.0');
  sh(r.dir, 'tag', '-d', 'v0.1.0');
  const head = commit(r, 'later');

  const onlyOthers = harness(r, {
    runs: [
      ciRun(tagged, { id: 1, event: 'pull_request', branch: 'release-flow' }),
      ciRun(tagged, { id: 2, event: 'workflow_dispatch' }),
    ],
  });
  await assert.rejects(
    onlyOthers.release(),
    new RegExp(`there is no ci\\.yml push run on main for ${tagged} after 5 minutes`),
  );
  assert.deepEqual(onlyOthers.writes, []);
  assert.deepEqual(onlyOthers.asked, []);
  assert.equal(existsSync(releaseDir(r)), false);

  const passing = harness(r, { runs: [ciRun(tagged)] });
  const result = await passing.release();
  assert.notEqual(head, tagged);
  assert.equal(result.commit, tagged);
  assert.equal(result.state, 'none');
  assert.deepEqual(passing.beforeAsk(), []);
  assert.deepEqual(
    passing.writes.map(line => line.split(' ').slice(0, 3).join(' ')),
    ['gh release create', ...Array(4).fill('gh release upload'), 'gh release edit'],
  );
  assert.equal(passing.asked.length, 1);
});

test('with the tag present it continues on the tag commit from another branch', async t => {
  const r = repo(t);
  const tagged = r.head();
  sh(r.dir, 'push', 'origin', 'HEAD:refs/tags/v0.1.0');
  sh(r.dir, 'switch', '-c', 'feature');
  commit(r, 'elsewhere', { push: false });
  const h = harness(r, { runs: [ciRun(tagged)] });
  assert.equal((await h.release()).commit, tagged);
  assert.deepEqual(h.beforeAsk(), []);
  assert.ok(!h.writes.some(line => line.startsWith('git push')));
});

test('step 1 stops, naming the reason, before anything is written', async t => {
  const cases = [
    { name: 'at 0.0.0', version: '0.0.0', error: /0\.0\.0 is never released/ },
    {
      name: 'a dirty tree',
      setup: r => writeFileSync(join(r.dir, 'new.txt'), 'x\n'),
      error: /the working tree is not clean/,
    },
    {
      name: 'HEAD is not origin/main',
      setup: r => commit(r, 'local only', { push: false }),
      error: /is not origin\/main/,
    },
    {
      name: 'a version not higher than the highest tag',
      setup: r => sh(r.dir, 'push', 'origin', 'HEAD:refs/tags/v0.2.0'),
      error: /0\.1\.0 is not higher than the tag v0\.2\.0 on origin/,
    },
    {
      name: 'no changelog entries for the version',
      changelog: '# Changelog\n\n## Unreleased\n\n- not yet\n',
      error: /CHANGELOG\.md has no entries for 0\.1\.0/,
    },
    {
      name: 'the packages at the tag commit say another version',
      version: '0.2.0',
      setup: r => {
        sh(r.dir, 'push', 'origin', 'HEAD:refs/tags/v0.1.0');
        setVersion(r.dir, '0.1.0');
        commit(r, 'back to 0.1.0');
      },
      error: /whose packages say 0\.2\.0, not 0\.1\.0/,
    },
    {
      name: 'origin is another repository',
      origin: 'git@github.com:someone/swiftplot.git',
      error: /origin is github\.com\/someone\/swiftplot, not github\.com\/GusevP\/swiftplot/,
      only: ['git remote get-url origin'],
    },
    {
      name: 'origin is another repository, behind a token',
      origin: 'https://x-access-token:s3cret@github.com/someone/swiftplot.git',
      error: e =>
        !e.message.includes('s3cret') &&
        /origin is github\.com\/someone\/swiftplot, not github\.com\/GusevP\/swiftplot/.test(e.message),
      only: ['git remote get-url origin'],
    },
    {
      name: 'origin carries a token in its query',
      origin: 'https://github.com/GusevP/swiftplot.git?access_token=s3cret',
      error: e =>
        !e.message.includes('s3cret') &&
        /origin is a URL that names no GitHub repository, not github\.com\/GusevP\/swiftplot/.test(e.message),
      only: ['git remote get-url origin'],
    },
    {
      name: 'origin pushes to another repository',
      pushUrls: `${URL_OF_REPO}\nhttps://user:s3cret@github.com/someone/swiftplot.git\n`,
      error: e =>
        !e.message.includes('s3cret') &&
        /origin pushes to github\.com\/someone\/swiftplot, not github\.com\/GusevP\/swiftplot/.test(
          e.message,
        ),
      only: ['git remote get-url origin', 'git remote get-url --push --all origin'],
    },
    {
      name: 'origin pushes to a URL with a token in its query',
      pushUrls: `${URL_OF_REPO}\nhttps://github.com/GusevP/swiftplot.git?access_token=s3cret\n`,
      error: e =>
        !e.message.includes('s3cret') &&
        /origin pushes to a URL that names no GitHub repository, not github\.com\/GusevP\/swiftplot/.test(
          e.message,
        ),
      only: ['git remote get-url origin', 'git remote get-url --push --all origin'],
    },
  ];
  for (const c of cases) {
    await t.test(c.name, async t => {
      const r = repo(t, c);
      c.setup?.(r);
      const before = snapshot(r);
      const h = harness(r, { origin: c.origin, pushUrls: c.pushUrls, runs: [ciRun(r.head())] });
      await assert.rejects(h.release(), c.error);
      if (c.only)
        assert.deepEqual(
          h.calls.map(call => call.line),
          c.only,
        );
      assert.deepEqual(h.writes, []);
      assert.deepEqual(h.asked, []);
      assert.deepEqual(snapshot(r), before);
    });
  }
});

test('checks: only a passing push run on main counts', async t => {
  const SHA = 'a'.repeat(40);
  const attempt = (status, conclusion, jobs) => ({ status, conclusion, jobs });
  const cases = [
    { name: 'a successful push run whose check and pack jobs succeeded', runs: [ciRun(SHA)], waited: 0 },
    {
      name: 'check green while pack has not appeared waits',
      runs: t =>
        t < 60_000
          ? [ciRun(SHA, { attempts: [attempt('in_progress', null, { check: 'success' })] })]
          : [ciRun(SHA)],
      waited: 60_000,
    },
    {
      name: 'a successful pull-request or dispatch run on the same commit does not count',
      runs: [
        ciRun(SHA, { id: 1, event: 'pull_request', branch: 'feature' }),
        ciRun(SHA, { id: 2, event: 'workflow_dispatch' }),
      ],
      error: /there is no ci\.yml push run on main for a+ after 5 minutes/,
      waited: 300_000,
    },
    {
      name: 'a stale successful attempt followed by a failed re-run',
      runs: [
        ciRun(SHA, {
          attempts: [
            attempt('completed', 'success', { check: 'success', pack: 'success' }),
            attempt('completed', 'failure', { check: 'failure', pack: 'skipped' }),
          ],
        }),
      ],
      error:
        /attempt 2\) did not pass: it concluded failure; its check job is failure; its pack job is skipped/,
      waited: 0,
    },
    {
      name: 'a skipped job',
      runs: [
        ciRun(SHA, { attempts: [attempt('completed', 'success', { check: 'success', pack: 'skipped' })] }),
      ],
      error: /its pack job is skipped/,
      waited: 0,
    },
    {
      name: 'a cancelled job',
      runs: [ciRun(SHA, { attempts: [attempt('completed', 'cancelled', { check: 'cancelled' })] })],
      error: /it concluded cancelled; its check job is cancelled; its pack job is missing/,
      waited: 0,
    },
    {
      name: 'no run after the grace period',
      runs: [],
      error: /no ci\.yml push run .* after 5 minutes/,
      waited: 300_000,
    },
    {
      name: 'a run still going after 30 minutes',
      runs: [ciRun(SHA, { attempts: [attempt('in_progress', null, {})] })],
      error: /is in_progress after 30 minutes/,
      waited: 1_800_000,
    },
  ];
  for (const c of cases) {
    await t.test(c.name, async () => {
      const { now, sleep } = clock();
      const api = github({ runs: c.runs }, now);
      const done = checks({ api, commit: SHA, sleep, now });
      if (c.error) await assert.rejects(done, c.error);
      else assert.equal((await done).head_sha, SHA);
      assert.equal(now(), c.waited);
    });
  }
});

test('the files are built from an export of the commit and stored in .release', async t => {
  const r = repo(t);
  const head = r.head();
  mkdirSync(join(r.dir, 'packages/core/dist'), { recursive: true });
  writeFileSync(join(r.dir, 'packages/core/dist/stale.js'), 'stale\n');
  const before = snapshot(r);
  const h = harness(r, { runs: [ciRun(head)] });
  const result = await h.release();

  const after = snapshot(r);
  assert.deepEqual(
    after.status.split('\n').filter(line => line !== '!! .release/'),
    before.status.split('\n'),
  );
  assert.deepEqual(
    { ...after, status: null, release: null },
    { ...before, status: null, release: null, remote: `${before.remote}\n${head} commit\trefs/tags/v0.1.0` },
  );
  assert.equal(readFileSync(join(r.dir, 'packages/core/dist/stale.js'), 'utf8'), 'stale\n');
  const builds = h.calls.filter(call => call.line.startsWith('pnpm '));
  assert.deepEqual(
    builds.slice(0, 2).map(call => call.line),
    ['pnpm install --frozen-lockfile', 'pnpm build'],
  );
  for (const call of builds) assert.ok(relative(r.dir, call.cwd).startsWith('..'), call.cwd);

  const files = join(releaseDir(r), '0.1.0', 'files');
  assert.deepEqual(readdirSync(files).sort(), EXPECTED);
  verify(files);
  assert.deepEqual(
    new Set(entries(readFileSync(join(files, 'swiftplot-0.1.0.tgz'))).keys()),
    new Set([
      'package/LICENSE',
      'package/README.md',
      'package/dist/index.d.ts',
      'package/dist/index.js',
      'package/package.json',
    ]),
  );
  const record = JSON.parse(readFileSync(join(releaseDir(r), '0.1.0', 'record.json'), 'utf8'));
  assert.deepEqual({ version: record.version, commit: record.commit }, { version: '0.1.0', commit: head });
  assert.deepEqual(
    result.files,
    EXPECTED.map(name => {
      const bytes = readFileSync(join(files, name));
      return { name, size: bytes.length, sha256: sha256(bytes) };
    }),
  );
  assert.ok(h.printed.includes('  pre-release: no'));
  assert.deepEqual(h.beforeAsk(), []);
});

for (const kind of ['tag only', 'draft']) {
  test(`a second run reuses the stored files, and stops on a changed file or another commit (${kind})`, async t => {
    const r = repo(t);
    const head = r.head();
    if (kind === 'tag only') sh(r.dir, 'push', 'origin', 'HEAD:refs/tags/v0.1.0');
    const state = {
      runs: [ciRun(head)],
      releases: kind === 'draft' ? [{ tag: 'v0.1.0', draft: true, assets: [] }] : [],
    };
    const notConfirmed = /not confirmed/;
    await assert.rejects(harness(r, state).release({ answer: 'no' }), notConfirmed);
    const stored = snapshot(r).release;

    const again = harness(r, { ...state, noBuild: true });
    await assert.rejects(again.release({ answer: 'no' }), notConfirmed);
    assert.deepEqual(snapshot(r).release, stored);
    assert.deepEqual(again.writes, []);

    const tarball = join(releaseDir(r), '0.1.0', 'files', 'swiftplot-0.1.0.tgz');
    const good = readFileSync(tarball);
    const bad = Buffer.from(good);
    bad[bad.length - 1] ^= 1;
    writeFileSync(tarball, bad);
    const changed = harness(r, { ...state, noBuild: true });
    await assert.rejects(changed.release(), /swiftplot-0\.1\.0\.tgz does not match its SHA-256/);
    assert.deepEqual(changed.writes, []);
    assert.deepEqual(changed.asked, []);
    writeFileSync(tarball, good);

    const record = join(releaseDir(r), '0.1.0', 'record.json');
    writeFileSync(record, JSON.stringify({ version: '0.1.0', commit: 'f'.repeat(40) }));
    const other = harness(r, { ...state, noBuild: true });
    await assert.rejects(other.release(), /holds 0\.1\.0 of f{40}, not 0\.1\.0 of/);
    assert.deepEqual(other.writes, []);
    assert.deepEqual(other.asked, []);

    const kept = snapshot(r).release;
    const preview = harness(r, state);
    const result = await preview.release({ dryRun: true });
    assert.match(result.reasons.join('\n'), /holds 0\.1\.0 of f{40}, not 0\.1\.0 of/);
    assert.equal(result.files.length, 4);
    assert.ok(preview.calls.some(call => call.line === 'pnpm build'));
    assert.deepEqual(snapshot(r).release, kept);
    assert.deepEqual(preview.writes, []);
  });
}

test('a published release supplies its own files, whatever the local cache holds', async t => {
  const r = repo(t);
  const head = r.head();
  await assert.rejects(harness(r, { runs: [ciRun(head)] }).release({ answer: 'no' }), /not confirmed/);
  const files = join(releaseDir(r), '0.1.0', 'files');
  const assets = readdirSync(files).map(name => ({ name, bytes: readFileSync(join(files, name)) }));
  sh(r.dir, 'push', 'origin', 'HEAD:refs/tags/v0.1.0');
  const published = assets => ({ releases: [{ tag: 'v0.1.0', draft: false, assets }], noBuild: true });
  const expected = assets
    .map(({ name, bytes }) => ({ name, size: bytes.length, sha256: sha256(bytes) }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  const tarball = join(files, 'swiftplot-0.1.0.tgz');
  writeFileSync(tarball, 'corrupt');
  for (const cache of ['corrupt', 'none']) {
    if (cache === 'none') rmSync(releaseDir(r), { recursive: true });
    const h = harness(r, published(assets));
    const result = await h.release();
    assert.equal(result.state, 'published', cache);
    assert.deepEqual(result.files, expected, cache);
    assert.equal(h.asked.length, 1, cache);
    assert.deepEqual(h.writes, [], cache);
    assert.ok(!h.calls.some(call => call.line.includes('actions/')), cache);
  }

  const extra = { name: 'notes.txt', bytes: Buffer.from('x') };
  for (const [what, wrong, error] of [
    ['a missing asset', assets.filter(a => a.name !== 'swiftplot-vue-0.1.0.tgz'), /has the assets .* not /],
    ['an extra asset', [...assets, extra], /has the assets .*notes\.txt.* not /],
    [
      'a digest that does not match',
      assets.map(a => (a.name === 'SHA256SUMS' ? { ...a, digest: `sha256:${'0'.repeat(64)}` } : a)),
      /SHA256SUMS does not match the digest GitHub reports/,
    ],
    [
      "two tarballs under each other's names",
      (() => {
        const bytesOf = name => assets.find(a => a.name === name).bytes;
        const swap = {
          'swiftplot-react-0.1.0.tgz': 'swiftplot-vue-0.1.0.tgz',
          'swiftplot-vue-0.1.0.tgz': 'swiftplot-react-0.1.0.tgz',
        };
        const tarballs = assets
          .filter(a => a.name !== 'SHA256SUMS')
          .map(a => ({ name: a.name, bytes: bytesOf(swap[a.name] ?? a.name) }));
        const sums = tarballs.map(a => `${sha256(a.bytes)}  ${a.name}\n`).join('');
        return [...tarballs, { name: 'SHA256SUMS', bytes: Buffer.from(sums) }];
      })(),
      /has @swiftplot\/vue in swiftplot-react-0\.1\.0\.tgz, not swiftplot-vue-0\.1\.0\.tgz/,
    ],
  ]) {
    const h = harness(r, published(wrong));
    await assert.rejects(h.release(), error, what);
    assert.deepEqual(h.asked, [], what);
    assert.deepEqual(h.writes, [], what);
  }
});

test('the confirmation shows what will be released, and anything but the exact version stops', async t => {
  const r = repo(t, { version: '0.1.0-rc.0' });
  const head = r.head();
  for (const answer of ['no', '0.1.0', '0.1.0-rc.0 ', '', null]) {
    const h = harness(r, { runs: [ciRun(head)] });
    await assert.rejects(h.release({ answer }), /not confirmed; nothing was written to GitHub or npm/);
    assert.equal(h.asked.length, 1);
    assert.deepEqual(h.writes, []);
    const out = h.printed.join('\n');
    assert.match(out, /Release v0\.1\.0-rc\.0 of GusevP\/swiftplot/);
    assert.match(out, new RegExp(`commit: +${head}`));
    assert.match(out, /pre-release: yes/);
    assert.match(out, /- an entry/);
    const files = join(releaseDir(r), '0.1.0-rc.0', 'files');
    for (const name of readdirSync(files)) {
      const bytes = readFileSync(join(files, name));
      assert.ok(out.includes(`${name}  ${bytes.length} bytes  sha256 ${sha256(bytes)}`), name);
    }
  }
});

test('--dry-run on another branch at 0.0.0 previews the tarballs and writes nothing', async t => {
  const r = repo(t, { version: '0.0.0' });
  sh(r.dir, 'switch', '-c', 'feature');
  commit(r, 'on a branch', { push: false });
  const before = snapshot(r);
  const h = harness(r, { runs: [] });
  const result = await h.release({ dryRun: true });

  assert.deepEqual(snapshot(r), before);
  assert.equal(existsSync(releaseDir(r)), false);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.asked, []);
  assert.equal(h.now(), 0);
  const out = h.printed.join('\n');
  assert.match(out, /Dry run: nothing was written/);
  assert.match(out, /preview of the tarballs only/);
  assert.match(out, /- 0\.0\.0 is never released/);
  assert.match(out, /- HEAD [0-9a-f]+ is not origin\/main .*the commit is not on main/);
  assert.match(out, /- there is no ci\.yml push run on main for [0-9a-f]+: no successful workflow run/);
  assert.match(out, /swiftplot-0\.0\.0\.tgz {2}\d+ bytes {2}sha256 [0-9a-f]{64}/);
  assert.equal(result.files.length, 4);
});

test('a pre-release takes its notes from the tag commit, and every gh call names the repository', async t => {
  const r = repo(t, { version: '0.1.0-rc.0' });
  const tagged = r.head();
  sh(r.dir, 'push', 'origin', 'HEAD:refs/tags/v0.1.0-rc.0');
  writeFileSync(
    join(r.dir, 'CHANGELOG.md'),
    '# Changelog\n\n## Unreleased\n\n## 0.1.0-rc.0 - 2026-12-01\n\n- rewritten on main later\n',
  );
  commit(r, 'later');
  const state = { runs: [ciRun(tagged)] };
  const h = harness(r, state);
  const result = await h.release();

  assert.equal(result.url, 'https://github.com/GusevP/swiftplot/releases/tag/v0.1.0-rc.0');
  assert.ok(h.printed.some(line => line.includes(result.url)));
  const [published] = state.releases;
  assert.deepEqual(
    { draft: published.draft, prerelease: published.prerelease, notes: published.notes },
    { draft: false, prerelease: true, notes: '- an entry' },
  );
  const gh = h.calls.filter(call => call.name === 'gh').map(call => call.args);
  for (const args of gh.filter(args => args[0] === 'api')) {
    assert.deepEqual(args.slice(0, 3), ['api', '--hostname', 'github.com']);
    assert.match(args.at(-1), /^repos\/GusevP\/swiftplot\//);
  }
  const writes = gh.filter(args => args[0] === 'release');
  const notesFile = writes[0][writes[0].indexOf('--notes-file') + 1];
  const tag = 'v0.1.0-rc.0';
  const names = [
    'SHA256SUMS',
    'swiftplot-0.1.0-rc.0.tgz',
    'swiftplot-react-0.1.0-rc.0.tgz',
    'swiftplot-vue-0.1.0-rc.0.tgz',
  ];
  assert.deepEqual(
    writes.map(args =>
      args[1] === 'upload' ? [...args.slice(0, 3), basename(args[3]), ...args.slice(4)] : args,
    ),
    [
      [
        'release',
        'create',
        tag,
        '--repo',
        'GusevP/swiftplot',
        '--draft',
        '--verify-tag',
        '--title',
        tag,
        '--notes-file',
        notesFile,
        '--prerelease',
      ],
      ...names.map(name => ['release', 'upload', tag, name, '--repo', 'GusevP/swiftplot']),
      [
        'release',
        'edit',
        tag,
        '--repo',
        'GusevP/swiftplot',
        '--notes-file',
        notesFile,
        '--draft=false',
        '--prerelease=true',
      ],
    ],
  );
  assert.deepEqual(h.beforeAsk(), []);
  assert.ok(!h.writes.some(line => line.startsWith('git push')));
});

const published = (state, name, version = '0.1.0') => state.npm[`${name}@${version}`]?.bytes;

test('without --npm no npm registry call is made at all', async t => {
  const r = repo(t);
  const state = { runs: [ciRun(r.head())] };
  const h = harness(r, state);
  await h.release();
  assert.equal(state.releases[0].draft, false);
  assert.deepEqual(state.npmCalls, []);
  assert.ok(
    h.printed.includes('npm: not published. To publish these files to npm later, run: pnpm release --npm'),
  );
});

test('with --npm, private packages stop a new release in step 1 and a published one before any publish', async t => {
  const r = repo(t, { isPrivate: true });
  const head = r.head();
  const blocked =
    /npm refuses private packages: swiftplot, @swiftplot\/react, @swiftplot\/vue are "private" at [0-9a-f]{40}, so npm is blocked/;
  const fresh = { runs: [ciRun(head)] };
  const h = harness(r, fresh);
  await assert.rejects(h.release({ npm: true }), blocked);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.asked, []);
  assert.equal(sh(r.origin, 'tag', '--list'), '');

  const preview = harness(r, { runs: [ciRun(head)] });
  const result = await preview.release({ npm: true, dryRun: true });
  assert.ok(result.reasons.some(reason => blocked.test(reason)));
  assert.match(
    preview.printed.join('\n'),
    /publish the release's files to npm \(https:\/\/registry\.npmjs\.org\/\)/,
  );

  await harness(r, fresh).release();
  const done = harness(r, { ...fresh, noBuild: true });
  await assert.rejects(done.release({ npm: true }), blocked);
  assert.deepEqual(fresh.npmCalls, []);
  assert.deepEqual(done.writes, []);
});

test('npm publishes the published release assets, not the local cache', async t => {
  const r = repo(t, { version: '0.1.0-rc.0' });
  const state = { runs: [ciRun(r.head())] };
  const cached = join(releaseDir(r), '0.1.0-rc.0', 'files', 'swiftplot-0.1.0-rc.0.tgz');
  state.fail = args => {
    if (args[1] === 'edit') writeFileSync(cached, 'changed after the upload');
  };
  await assert.rejects(harness(r, { runs: state.runs }).release({ answer: 'no' }), /not confirmed/);
  state.noBuild = true;
  const h = harness(r, state);
  const result = await h.release({ npm: true });
  const asset = name => state.releases[0].assets.find(a => a.name === name).bytes;
  for (const name of Object.values(NAMES))
    assert.deepEqual(published(state, name, '0.1.0-rc.0'), asset(tarballName(name, '0.1.0-rc.0')), name);
  assert.deepEqual(result.npm, Object.fromEntries(Object.values(NAMES).map(name => [name, 'public'])));
  for (const call of state.npmCalls.filter(c => c.args[0] === 'publish')) {
    assert.ok(!call.cwd.startsWith(releaseDir(r)), call.cwd);
    assert.ok(call.args.includes('next'));
  }

  const assets = state.releases[0].assets;
  for (const cache of ['corrupt', 'none']) {
    if (cache === 'none') rmSync(releaseDir(r), { recursive: true });
    else {
      writeFileSync(cached, 'corrupt');
      rmSync(join(releaseDir(r), '0.1.0-rc.0', 'npm.json'));
    }
    const again = {
      releases: [{ tag: 'v0.1.0-rc.0', draft: false, prerelease: true, assets }],
      noBuild: true,
    };
    await harness(r, again).release({ npm: true });
    for (const name of Object.values(NAMES))
      assert.deepEqual(published(again, name, '0.1.0-rc.0'), asset(tarballName(name, '0.1.0-rc.0')), cache);
  }
});

test('an unpublished or incomplete release stops before any npm call', async t => {
  const r = repo(t);
  const head = r.head();
  const draft = { runs: [ciRun(head)], fail: args => (args[1] === 'edit' ? 'before' : undefined) };
  await assert.rejects(harness(r, draft).release({ npm: true }), /connection reset/);
  assert.equal(draft.releases[0].draft, true);
  assert.deepEqual(draft.npmCalls, []);

  const assets = draft.releases[0].assets.filter(a => a.name !== 'swiftplot-vue-0.1.0.tgz');
  const incomplete = { releases: [{ tag: 'v0.1.0', draft: false, assets }], noBuild: true };
  await assert.rejects(harness(r, incomplete).release({ npm: true }), /has the assets .* not /);
  assert.deepEqual(incomplete.npmCalls, []);
});
