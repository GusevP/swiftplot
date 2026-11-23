import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { sha256 } from './check-tarballs.mjs';
import { githubRelease } from './github-release.mjs';
import { run as realRun } from './prepare.mjs';
import { fakeGh, gitRepo, sh } from './testing.mjs';

const NAMES = ['SHA256SUMS', 'swiftplot-0.1.0.tgz', 'swiftplot-react-0.1.0.tgz', 'swiftplot-vue-0.1.0.tgz'];

function setup(t) {
  const { dir, origin } = gitRepo(t, 'swiftplot-github-release-test-', dir =>
    writeFileSync(join(dir, 'README.md'), 'readme\n'),
  );
  const commit = sh(dir, 'rev-parse', 'HEAD');
  const files = join(dir, '..', 'files');
  mkdirSync(files);
  for (const name of NAMES) writeFileSync(join(files, name), `the bytes of ${name}\n`);
  const bytes = name => readFileSync(join(files, name));
  const listing = NAMES.map(name => ({ name, size: bytes(name).length, sha256: sha256(bytes(name)) }));
  const state = { remote: origin, releases: [] };
  const tagAt = () => sh(origin, 'for-each-ref', '--format=%(objectname)', 'refs/tags/v0.1.0');
  const asset = name => ({ name, bytes: bytes(name) });

  const go = ({ lostPush = false, prerelease = false, checked = true } = {}) => {
    const temp = mkdtempSync(join(tmpdir(), 'swiftplot-github-release-temp-'));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    const gh = fakeGh(state);
    const writes = [];
    const run = (command, args, options) => {
      if (command === 'gh' && args[0] === 'release')
        writes.push(
          [args[1], { upload: basename(args[3]), 'delete-asset': args[3] }[args[1]]]
            .filter(Boolean)
            .join(' '),
        );
      if (command === 'gh') return gh(args);
      assert.equal(command, 'git');
      if (args[0] !== 'push') return realRun(command, args, options);
      writes.push('push');
      assert.deepEqual(args, ['push', 'origin', `${commit}:refs/tags/v0.1.0`]);
      const out = realRun(command, args, options);
      return lostPush ? { ...out, code: 1, stderr: 'fatal: the remote end hung up unexpectedly' } : out;
    };
    try {
      const url = githubRelease({
        dir,
        run,
        repo: 'GusevP/swiftplot',
        version: '0.1.0',
        commit,
        prerelease,
        notes: '- an entry\n',
        files,
        listing,
        checked,
        temp,
        print: () => {},
      });
      return { url, writes };
    } catch (error) {
      return { error, writes };
    }
  };
  const complete = () => {
    const [release] = state.releases;
    assert.equal(state.releases.length, 1);
    assert.equal(release.draft, false);
    assert.deepEqual(
      release.assets.map(a => [a.name, sha256(a.bytes)]).sort(),
      listing.map(f => [f.name, f.sha256]),
    );
  };
  const tagHere = () => sh(dir, 'push', 'origin', 'HEAD:refs/tags/v0.1.0');
  return { dir, commit, state, tagAt, asset, go, complete, tagHere };
}

const FULL = ['create', ...NAMES.map(name => `upload ${name}`), 'edit'];

test('a missing tag is created on origin on the release commit, and no local tag is made', async t => {
  const s = setup(t);
  const { url, writes, error } = s.go();
  assert.ifError(error);
  assert.equal(url, 'https://github.com/GusevP/swiftplot/releases/tag/v0.1.0');
  assert.deepEqual(writes, ['push', ...FULL]);
  assert.equal(s.tagAt(), s.commit);
  assert.equal(sh(s.dir, 'tag', '--list'), '');
  s.complete();
  assert.equal(s.state.releases[0].prerelease, false);
  assert.equal(s.state.releases[0].notes, '- an entry\n');
});

test('a tag already on the release commit is left alone', async t => {
  const s = setup(t);
  s.tagHere();
  const { writes, error } = s.go();
  assert.ifError(error);
  assert.deepEqual(writes, FULL);
  s.complete();
});

test('a tag on another commit stops with no write', async t => {
  const s = setup(t);
  sh(s.dir, 'commit', '--allow-empty', '-m', 'other');
  const other = sh(s.dir, 'rev-parse', 'HEAD');
  s.tagHere();
  const { writes, error } = s.go();
  assert.match(error.message, new RegExp(`the tag v0\\.1\\.0 on origin is on ${other}, not ${s.commit}`));
  assert.deepEqual(writes, []);
  assert.deepEqual(s.state.releases, []);
});

test('a tag push whose response was lost is seen as present on the next run', async t => {
  const s = setup(t);
  const first = s.go({ lostPush: true });
  assert.match(first.error.message, /pushing the tag v0\.1\.0 on [0-9a-f]+ to origin failed/);
  assert.ok(!first.error.message.includes('hung up'));
  assert.deepEqual(first.writes, ['push']);
  assert.equal(s.tagAt(), s.commit);
  const second = s.go();
  assert.ifError(second.error);
  assert.deepEqual(second.writes, FULL);
  s.complete();
});

for (const [when, uploaded] of [
  ['before', 1],
  ['after', 2],
]) {
  test(`an upload interrupted ${when} it reached GitHub is finished by the next run`, async t => {
    const s = setup(t);
    let uploads = 0;
    s.state.fail = args => (args[1] === 'upload' && ++uploads === 2 ? when : undefined);
    const first = s.go();
    assert.match(first.error.message, /gh release upload .* failed: connection reset/);
    assert.deepEqual(first.writes, ['push', 'create', `upload ${NAMES[0]}`, `upload ${NAMES[1]}`]);
    assert.equal(s.state.releases[0].draft, true);
    assert.equal(s.state.releases[0].assets.length, uploaded);

    s.state.fail = undefined;
    const second = s.go();
    assert.ifError(second.error);
    assert.deepEqual(second.writes, [...NAMES.slice(uploaded).map(name => `upload ${name}`), 'edit']);
    s.complete();
  });
}

test('a stub or an asset with the wrong digest in the draft is deleted and uploaded again', async t => {
  const s = setup(t);
  s.tagHere();
  s.state.releases.push({
    tag: 'v0.1.0',
    draft: true,
    assets: [
      { ...s.asset(NAMES[0]), state: 'starter' },
      { ...s.asset(NAMES[1]), digest: `sha256:${'0'.repeat(64)}` },
      s.asset(NAMES[2]),
      s.asset(NAMES[3]),
    ],
  });
  const { writes, error } = s.go();
  assert.ifError(error);
  assert.deepEqual(writes, [
    `delete-asset ${NAMES[0]}`,
    `upload ${NAMES[0]}`,
    `delete-asset ${NAMES[1]}`,
    `upload ${NAMES[1]}`,
    'edit',
  ]);
  s.complete();
});

test('an unexpected asset in the draft stops the command, names it and publishes nothing', async t => {
  const s = setup(t);
  s.tagHere();
  s.state.releases.push({
    tag: 'v0.1.0',
    draft: true,
    assets: [...NAMES.map(s.asset), { name: 'notes.txt', bytes: Buffer.from('x') }],
  });
  const { writes, error } = s.go();
  assert.match(error.message, /not expected: "notes\.txt".*Nothing was published/);
  assert.deepEqual(writes, []);
  assert.equal(s.state.releases[0].draft, true);
});

test('a complete published release is left as it is', async t => {
  const s = setup(t);
  s.tagHere();
  s.state.releases.push({ tag: 'v0.1.0', draft: false, assets: NAMES.map(s.asset) });
  const { writes, error, url } = s.go({ checked: false });
  assert.ifError(error);
  assert.equal(url, 'https://github.com/GusevP/swiftplot/releases/tag/v0.1.0');
  assert.deepEqual(writes, []);
});

test('a published release that differs stops, says what differs and writes nothing', async t => {
  const cases = [
    {
      name: 'two of the three tarballs',
      assets: s => NAMES.filter(n => n !== 'swiftplot-vue-0.1.0.tgz').map(s.asset),
      error: /swiftplot-vue-0\.1\.0\.tgz is missing/,
    },
    {
      name: 'a differing asset',
      assets: s => NAMES.map(n => (n === NAMES[1] ? { name: n, bytes: Buffer.from('other') } : s.asset(n))),
      error: new RegExp(
        `${NAMES[1].replaceAll('.', '\\.')} is not the expected \\d+ bytes with sha256 [0-9a-f]{64}`,
      ),
    },
    {
      name: 'an extra asset',
      assets: s => [...NAMES.map(s.asset), { name: 'notes.txt', bytes: Buffer.from('x') }],
      error: /"notes\.txt" is not expected/,
    },
    {
      name: 'a wrong pre-release flag',
      prerelease: true,
      error: /it is marked as a pre-release/,
    },
    {
      name: 'a tag on another commit',
      setup: s => {
        sh(s.dir, 'commit', '--allow-empty', '-m', 'other');
        s.tagHere();
      },
      error: /the tag v0\.1\.0 on origin is on [0-9a-f]+, not /,
    },
  ];
  for (const c of cases)
    await t.test(c.name, t => {
      const s = setup(t);
      (c.setup ?? s.tagHere)(s);
      s.state.releases.push({
        tag: 'v0.1.0',
        draft: false,
        prerelease: c.prerelease ?? false,
        assets: (c.assets ?? (s => NAMES.map(s.asset)))(s),
      });
      const { writes, error } = s.go({ checked: false });
      assert.match(error.message, c.error);
      assert.deepEqual(writes, []);
    });
});

test('a release found published without checks is not written to once it is a draft again', async t => {
  const s = setup(t);
  s.tagHere();
  s.state.releases.push({ tag: 'v0.1.0', draft: true, assets: [] });
  const { writes, error } = s.go({ checked: false });
  assert.match(error.message, /no longer published/);
  assert.deepEqual(writes, []);
});
