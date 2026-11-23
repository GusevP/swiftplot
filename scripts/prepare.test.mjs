import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepare, run as realRun } from './prepare.mjs';

const CHANGELOG = '# Changelog\n\n## Unreleased\n\n- first entry\n';
const PACKAGES = ['core', 'react', 'vue'];
const FILES = ['CHANGELOG.md', ...PACKAGES.map(name => `packages/${name}/package.json`)];

function sh(cwd, ...args) {
  const out = realRun('git', args, { cwd });
  if (out.code !== 0) throw new Error(`git ${args.join(' ')}: ${out.stderr}`);
  return out.stdout.trim();
}

function repo(t, { versions = {}, changelog = CHANGELOG } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'swiftplot-prepare-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const origin = join(root, 'origin.git');
  const dir = join(root, 'work');
  sh(root, 'init', '--bare', '-b', 'main', origin);
  sh(root, 'init', '-b', 'main', dir);
  for (const [key, value] of [
    ['user.name', 'Test'],
    ['user.email', 'test@example.com'],
    ['commit.gpgsign', 'false'],
    ['tag.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
  ]) {
    sh(dir, 'config', key, value);
  }
  sh(dir, 'remote', 'add', 'origin', origin);
  for (const name of PACKAGES) {
    mkdirSync(join(dir, 'packages', name), { recursive: true });
    writeFileSync(
      join(dir, 'packages', name, 'package.json'),
      `{\n  "name": "${name}",\n  "version": "${versions[name] ?? '0.0.0'}",\n  "files": ["dist"]\n}\n`,
    );
  }
  writeFileSync(join(dir, 'CHANGELOG.md'), changelog);
  writeFileSync(join(dir, 'README.md'), 'readme\n');
  sh(dir, 'add', '.');
  sh(dir, 'commit', '-m', 'initial');
  sh(dir, 'push', 'origin', 'main');
  return { dir, origin };
}

function runner() {
  const formatted = [];
  const run = (command, args, options) => {
    if (command === 'git') return realRun(command, args, options);
    assert.deepEqual([command, ...args.slice(0, 2)], ['pnpm', 'exec', 'oxfmt']);
    formatted.push(args.slice(2));
    return { code: 0, stdout: '', stderr: '' };
  };
  return { run, formatted };
}

const snapshot = ({ dir, origin }) => ({
  head: sh(dir, 'rev-parse', 'HEAD'),
  status: sh(dir, 'status', '--porcelain'),
  tags: sh(dir, 'tag', '-l'),
  remote: sh(origin, 'for-each-ref'),
  files: FILES.map(path => readFileSync(join(dir, path), 'utf8')),
});

test('release:prepare minor from 0.0.0 makes one commit with the versions and the changelog, and pushes nothing', t => {
  const r = repo(t);
  const before = snapshot(r);
  const { run, formatted } = runner();
  const result = prepare({ dir: r.dir, arg: 'minor', run, today: '2026-12-01' });

  assert.equal(result.version, '0.1.0');
  for (const name of PACKAGES) {
    assert.equal(
      JSON.parse(readFileSync(join(r.dir, 'packages', name, 'package.json'), 'utf8')).version,
      '0.1.0',
    );
  }
  assert.equal(
    readFileSync(join(r.dir, 'CHANGELOG.md'), 'utf8'),
    '# Changelog\n\n## Unreleased\n\n## 0.1.0 - 2026-12-01\n\n- first entry\n',
  );
  assert.deepEqual(
    formatted.map(files => files.map(f => f.replaceAll('\\', '/')).sort()),
    [[...FILES].sort()],
  );
  assert.equal(sh(r.dir, 'rev-list', '--count', `${before.head}..HEAD`), '1');
  assert.equal(sh(r.dir, 'log', '-1', '--format=%s'), 'release: v0.1.0');
  assert.deepEqual(
    sh(r.dir, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort(),
    [...FILES].sort(),
  );
  assert.equal(sh(r.dir, 'status', '--porcelain'), '');
  assert.equal(sh(r.dir, 'tag', '-l'), '');
  assert.equal(sh(r.origin, 'for-each-ref'), before.remote);
});

test('release:prepare stops and changes nothing', async t => {
  const cases = [
    {
      name: 'the tree is dirty',
      setup: ({ dir }) => writeFileSync(join(dir, 'README.md'), 'changed\n'),
      arg: 'minor',
      error: /not clean/,
    },
    {
      name: 'an untracked file',
      setup: ({ dir }) => writeFileSync(join(dir, 'new.txt'), 'x\n'),
      arg: 'minor',
      error: /not clean/,
    },
    { name: 'the versions differ', versions: { react: '0.1.0' }, arg: 'minor', error: /react 0\.1\.0/ },
    {
      name: 'Unreleased is empty',
      changelog: '# Changelog\n\n## Unreleased\n\n## 0.0.1 - 2026-01-01\n\n- old\n',
      arg: 'minor',
      error: /is empty/,
    },
    {
      name: 'the target is not higher',
      versions: { core: '0.2.0', react: '0.2.0', vue: '0.2.0' },
      arg: '0.1.0',
      error: /not higher than the current version 0\.2\.0/,
    },
    {
      name: 'the target equals the current version',
      arg: '0.0.0',
      error: /not higher than the current version/,
    },
    { name: 'the argument is not a version', arg: 'v0.1.0', error: /not a version/ },
    {
      name: 'the target is not higher than the highest tag on origin',
      setup: ({ dir }) => {
        sh(dir, 'tag', 'v0.2.0');
        sh(dir, 'tag', 'v0.0.9');
        sh(dir, 'tag', 'vnot-a-version');
        sh(dir, 'push', 'origin', '--tags');
        sh(dir, 'tag', '-d', 'v0.2.0', 'v0.0.9', 'vnot-a-version');
      },
      arg: 'minor',
      error: /0\.1\.0 is not higher than the tag v0\.2\.0 on origin/,
    },
  ];
  for (const c of cases) {
    await t.test(c.name, t => {
      const r = repo(t, c);
      c.setup?.(r);
      const before = snapshot(r);
      const { run, formatted } = runner();
      assert.throws(() => prepare({ dir: r.dir, arg: c.arg, run, today: '2026-12-01' }), c.error);
      assert.deepEqual(snapshot(r), before);
      assert.deepEqual(formatted, []);
    });
  }
});

test('release:prepare 0.1.0-rc.0, new entries, then 0.1.0 keeps the rc section', t => {
  const r = repo(t);
  const { run } = runner();
  assert.equal(prepare({ dir: r.dir, arg: '0.1.0-rc.0', run, today: '2026-11-30' }).version, '0.1.0-rc.0');

  const path = join(r.dir, 'CHANGELOG.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace('## Unreleased\n', '## Unreleased\n\n- second entry\n'),
  );
  sh(r.dir, 'commit', '-am', 'more');
  assert.equal(prepare({ dir: r.dir, arg: '0.1.0', run, today: '2026-12-01' }).version, '0.1.0');

  assert.equal(
    readFileSync(path, 'utf8'),
    '# Changelog\n\n## Unreleased\n\n## 0.1.0 - 2026-12-01\n\n- second entry\n\n## 0.1.0-rc.0 - 2026-11-30\n\n- first entry\n',
  );
  assert.equal(sh(r.dir, 'log', '-3', '--format=%s'), 'release: v0.1.0\nmore\nrelease: v0.1.0-rc.0');
});
