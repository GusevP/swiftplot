import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { integrity, npmPublish, REGISTRY, shasum } from './npm-publish.mjs';
import { fakeNpm, tar } from './testing.mjs';

const STEMS = {
  swiftplot: 'swiftplot',
  '@swiftplot/react': 'swiftplot-react',
  '@swiftplot/vue': 'swiftplot-vue',
};
const NAMES = Object.keys(STEMS);

function setup(t, version = '0.1.0') {
  const dir = mkdtempSync(join(tmpdir(), 'swiftplot-npm-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = join(dir, 'files');
  mkdirSync(files);
  const sri = {};
  const sha = {};
  for (const [name, stem] of Object.entries(STEMS)) {
    const peers = name === 'swiftplot' ? {} : { peerDependencies: { swiftplot: `^${version}` } };
    const bytes = tar({
      'package/package.json': JSON.stringify({ name, version, ...peers }),
      'package/README.md': 'readme\n',
      'package/LICENSE': 'MIT\n',
      'package/dist/index.js': `export const name = '${name}';\n`,
      'package/dist/index.d.ts': 'export declare const name: string;\n',
    });
    sri[name] = integrity(bytes);
    sha[name] = shasum(bytes);
    writeFileSync(join(files, `${stem}-${version}.tgz`), bytes);
  }
  const receipts = join(dir, '.release', version, 'npm.json');
  const state = {};
  const npm = fakeNpm(state);
  const printed = [];
  const publish = () =>
    npmPublish({
      dir,
      version,
      prerelease: version.includes('-'),
      files,
      print: line => printed.push(line),
      npmCommand: ['npm'],
      run: (command, args, options) => {
        assert.equal(command, 'npm');
        return npm(args, options);
      },
    });
  const publishes = () => state.npmCalls.filter(call => call.args[0] === 'publish').map(call => call.args[1]);
  const receipt = () => JSON.parse(readFileSync(receipts, 'utf8'));
  const writeReceipt = packages => {
    mkdirSync(join(receipts, '..'), { recursive: true });
    writeFileSync(receipts, JSON.stringify({ version, packages }));
  };
  return {
    dir,
    files,
    sri,
    sha,
    receipts,
    state,
    printed,
    publish,
    publishes,
    receipt,
    writeReceipt,
    version,
  };
}

const FLAGS = `--registry ${REGISTRY} --@swiftplot:registry=${REGISTRY}`;
const key = (name, version = '0.1.0') => `${name}@${version}`;

test('publishes the three tarballs in order, by path, public, to the named registry', async t => {
  for (const version of ['0.1.0', '0.1.0-rc.0']) {
    await t.test(version, t => {
      const s = setup(t, version);
      assert.deepEqual(s.publish(), Object.fromEntries(NAMES.map(name => [name, 'public'])));
      const calls = s.state.npmCalls.filter(call => call.args[0] === 'publish');
      assert.deepEqual(
        calls.map(call => call.args),
        NAMES.map(name => [
          'publish',
          `./${STEMS[name]}-${version}.tgz`,
          '--access',
          'public',
          '--dry-run=false',
          '--logs-max=50',
          '--registry',
          REGISTRY,
          `--@swiftplot:registry=${REGISTRY}`,
          ...(version.includes('-') ? ['--tag', 'next'] : []),
        ]),
      );
      for (const call of calls) {
        assert.equal(call.cwd, s.files);
        assert.equal(call.stdio, 'inherit');
      }
      for (const name of NAMES) assert.equal(s.state.npm[key(name, version)].integrity, s.sri[name]);
      assert.deepEqual(s.receipt(), {
        version,
        packages: Object.fromEntries(
          NAMES.map(name => [name, { state: 'finished', integrity: s.sri[name] }]),
        ),
      });
    });
  }
});

test('a version npm shows with the same integrity is skipped', t => {
  const s = setup(t);
  s.state.npm = { [key('swiftplot')]: { integrity: s.sri.swiftplot, public: true } };
  s.publish();
  assert.deepEqual(s.publishes(), ['./swiftplot-react-0.1.0.tgz', './swiftplot-vue-0.1.0.tgz']);
});

test('a version npm shows with another integrity stops, even with a matching receipt', t => {
  const s = setup(t);
  s.writeReceipt({ swiftplot: { state: 'finished', integrity: s.sri.swiftplot } });
  s.state.npm = { [key('swiftplot')]: { integrity: s.sri['@swiftplot/vue'], public: true } };
  assert.throws(s.publish, /npm has swiftplot@0\.1\.0 with another integrity/);
  assert.deepEqual(s.publishes(), []);
});

test('a receipt for a version npm does not show is not published again, and npm stage list says why', async t => {
  const unknown = {
    code: 1,
    stdout: '{"error":{"code":"EUNKNOWNCOMMAND","summary":"","detail":""}}',
    stderr: 'Unknown command: "stage"',
  };
  const blocking = ['missing', 'unknown', 'staged, unchecked', 'staged, other bytes'];
  for (const [what, state, given, status, said] of [
    [
      'staged',
      'started',
      { staged: true },
      'staged',
      'is staged on npm (id id-swiftplot@0.1.0, pending) and waits for approval: run npm stage approve id-swiftplot@0.1.0 FLAGS',
    ],
    [
      'staged with other bytes',
      'finished',
      { staged: true, shasum: 'f'.repeat(40) },
      'staged, other bytes',
      `is staged on npm with other bytes (id id-swiftplot@0.1.0, shasum ${'f'.repeat(40)}, not SHA): reject it (npm stage reject id-swiftplot@0.1.0 FLAGS), then remove "swiftplot" from RECEIPTS and run again`,
    ],
    [
      'staged without a shasum',
      'started',
      { staged: true, shasum: null },
      'staged, unchecked',
      'is staged on npm (id id-swiftplot@0.1.0), and npm stage list gave no shasum to check its bytes against: approve it (npm stage approve id-swiftplot@0.1.0 FLAGS) only if npm stage view id-swiftplot@0.1.0 FLAGS shows shasum SHA, otherwise reject it (npm stage reject id-swiftplot@0.1.0 FLAGS), then remove "swiftplot" from RECEIPTS and run again',
    ],
    [
      'none staged, started',
      'started',
      {},
      'missing',
      'is neither public nor staged on npm, so its upload most likely failed; it may still be processing if it was sent in the last few minutes, otherwise remove "swiftplot" from RECEIPTS and run again',
    ],
    [
      'none staged, finished',
      'finished',
      {},
      'not visible',
      'was accepted by npm and is not visible yet: run again in a few minutes; if it has been more than a few minutes, or you rejected its staged copy, remove "swiftplot" from RECEIPTS and run again',
    ],
    [
      'only another version staged',
      'finished',
      {
        npmStage: {
          code: 0,
          stdout: JSON.stringify([
            {
              id: 'id-rc',
              packageName: 'swiftplot',
              version: '0.1.0-rc.0',
              status: 'pending',
              shasum: 'f'.repeat(40),
            },
          ]),
          stderr: '',
        },
      },
      'not visible',
      'was accepted by npm and is not visible yet: run again in a few minutes; if it has been more than a few minutes, or you rejected its staged copy, remove "swiftplot" from RECEIPTS and run again',
    ],
    [
      'npm stage unknown',
      'finished',
      { npmStage: unknown },
      'unknown',
      'is not public, and the script could not ask npm whether it is staged (npm stage needs npm 11.15 or later and a current login; npm printed: {"error":{"code":"EUNKNOWNCOMMAND","summary":"","detail":""}}\nUnknown command: "stage"). Keep RECEIPTS, update npm or run npm login, then run again',
    ],
  ]) {
    await t.test(what, t => {
      const s = setup(t);
      s.writeReceipt({ swiftplot: { state, integrity: s.sri.swiftplot } });
      if (given.staged)
        s.state.npm = {
          [key('swiftplot')]: {
            integrity: s.sri.swiftplot,
            shasum: given.shasum === undefined ? s.sha.swiftplot : given.shasum,
            public: false,
          },
        };
      s.state.npmStage = given.npmStage;
      const result = s.publish();
      assert.equal(result.swiftplot, status);
      const held = blocking.includes(status);
      assert.deepEqual(
        s.publishes(),
        held ? [] : ['./swiftplot-react-0.1.0.tgz', './swiftplot-vue-0.1.0.tgz'],
      );
      const line = `npm: swiftplot@0.1.0 ${said.replaceAll('RECEIPTS', s.receipts).replaceAll('SHA', s.sha.swiftplot).replaceAll('FLAGS', FLAGS)}`;
      assert.equal(s.printed[0], line);
      assert.equal(s.printed.at(-3), line);
      if (held) {
        assert.equal(result['@swiftplot/react'], 'held');
        assert.equal(
          s.printed.at(-1),
          'npm: @swiftplot/vue@0.1.0 was not published, as swiftplot@0.1.0 is not on npm',
        );
      }
    });
  }
});

test('npm stage list failing, as with an expired login, is reported as could not ask', t => {
  const s = setup(t);
  s.writeReceipt({ swiftplot: { state: 'started', integrity: s.sri.swiftplot } });
  s.state.npmStage = { code: 1, stdout: '{"error":{"code":"E401"}}', stderr: '' };
  assert.equal(s.publish().swiftplot, 'unknown');
  assert.match(s.printed[0], /could not ask npm whether it is staged .*E401/);
});

test('a receipt that is not valid stops before any publish', async t => {
  for (const [what, text] of [
    ['not JSON', '{'],
    ['another version', JSON.stringify({ version: '0.2.0', packages: {} })],
    [
      'an unknown package',
      JSON.stringify({ version: '0.1.0', packages: { other: { state: 'started', integrity: 'sha512-x' } } }),
    ],
    ['a bad state', JSON.stringify({ version: '0.1.0', packages: { swiftplot: { state: 'done' } } })],
  ]) {
    await t.test(what, t => {
      const s = setup(t);
      mkdirSync(join(s.receipts, '..'), { recursive: true });
      writeFileSync(s.receipts, text);
      assert.throws(s.publish, new RegExp(`npm\\.json`));
      assert.deepEqual(s.publishes(), []);
    });
  }
  await t.test('a receipt for other bytes', t => {
    const s = setup(t);
    s.writeReceipt({ swiftplot: { state: 'started', integrity: s.sri['@swiftplot/vue'] } });
    assert.throws(s.publish, /records a publish of other bytes for swiftplot/);
    assert.deepEqual(s.publishes(), []);
  });
});

test('a publish whose response was lost after npm accepted it is not sent again', t => {
  const s = setup(t);
  s.state.staged = true;
  s.state.npmFail = args => (args[1] === './swiftplot-0.1.0.tgz' ? 'after' : undefined);
  const staged = `npm: swiftplot@0.1.0 is staged on npm (id id-swiftplot@0.1.0, pending) and waits for approval: run npm stage approve id-swiftplot@0.1.0 ${FLAGS}`;
  assert.throws(s.publish, {
    message: `npm publish of swiftplot-0.1.0.tgz failed; its receipt stays "started", so running again will not publish it twice. ${staged}`,
  });
  assert.ok(s.state.npm[key('swiftplot')]);
  assert.deepEqual(s.printed.slice(-3), [
    staged,
    'npm: @swiftplot/react@0.1.0 was not checked',
    'npm: @swiftplot/vue@0.1.0 was not checked',
  ]);
  assert.deepEqual(s.receipt().packages, { swiftplot: { state: 'started', integrity: s.sri.swiftplot } });

  s.state.npmFail = undefined;
  s.state.npmCalls = [];
  assert.deepEqual(s.publish(), Object.fromEntries(NAMES.map(name => [name, 'staged'])));
  assert.deepEqual(s.publishes(), ['./swiftplot-react-0.1.0.tgz', './swiftplot-vue-0.1.0.tgz']);
});

test('a publish that exits non-zero but shows on npm as ours counts as public', t => {
  const s = setup(t);
  s.state.npmFail = args => (args[1] === './swiftplot-0.1.0.tgz' ? 'after' : undefined);
  assert.deepEqual(s.publish(), Object.fromEntries(NAMES.map(name => [name, 'public'])));
  assert.deepEqual(s.receipt().packages.swiftplot, { state: 'started', integrity: s.sri.swiftplot });
});

test('a rejected publish leaves a started receipt and says how to clear it', t => {
  const s = setup(t);
  s.state.npmFail = () => 'before';
  assert.throws(s.publish, e => e.message.includes(`remove "swiftplot" from ${s.receipts} and run again`));
  assert.deepEqual(s.receipt().packages, { swiftplot: { state: 'started', integrity: s.sri.swiftplot } });
  assert.deepEqual(s.publishes(), ['./swiftplot-0.1.0.tgz']);
});

test('after core succeeds and React fails, the next runs skip core and go on with React', t => {
  const s = setup(t);
  s.state.npmFail = args => (args[1] === './swiftplot-react-0.1.0.tgz' ? 'before' : undefined);
  assert.throws(s.publish, /npm publish of swiftplot-react-0\.1\.0\.tgz failed/);
  assert.deepEqual(s.publishes(), ['./swiftplot-0.1.0.tgz', './swiftplot-react-0.1.0.tgz']);
  assert.deepEqual(s.printed.slice(-3), [
    'npm: swiftplot@0.1.0 is public',
    `npm: @swiftplot/react@0.1.0 is neither public nor staged on npm, so its upload most likely failed; it may still be processing if it was sent in the last few minutes, otherwise remove "@swiftplot/react" from ${s.receipts} and run again`,
    'npm: @swiftplot/vue@0.1.0 was not checked',
  ]);

  s.state.npmFail = undefined;
  s.state.npmCalls = [];
  s.publish();
  assert.deepEqual(s.publishes(), ['./swiftplot-vue-0.1.0.tgz']);

  const { packages } = s.receipt();
  delete packages['@swiftplot/react'];
  s.writeReceipt(packages);
  s.state.npmCalls = [];
  s.printed.length = 0;
  assert.deepEqual(s.publish(), Object.fromEntries(NAMES.map(name => [name, 'public'])));
  assert.deepEqual(s.publishes(), ['./swiftplot-react-0.1.0.tgz']);
  assert.deepEqual(
    s.printed.slice(-3),
    NAMES.map(name => `npm: ${name}@0.1.0 is public`),
  );
});

test('npm showing other bytes right after our publish stops before the next package', t => {
  const s = setup(t);
  const npm = fakeNpm(s.state);
  assert.throws(
    () =>
      npmPublish({
        dir: s.dir,
        version: '0.1.0',
        prerelease: false,
        files: s.files,
        print: () => {},
        npmCommand: ['npm'],
        run: (command, args, options) =>
          args[0] === 'view' && s.state.npm[key('swiftplot')]
            ? { code: 0, stdout: JSON.stringify(s.sri['@swiftplot/vue']), stderr: '' }
            : npm(args, options),
      }),
    /npm has swiftplot@0\.1\.0 with another integrity/,
  );
  assert.deepEqual(s.publishes(), ['./swiftplot-0.1.0.tgz']);
});

test('a second run of the same version while one is publishing stops before reading receipts', t => {
  const s = setup(t);
  const npm = fakeNpm(s.state);
  let overlap;
  const run = (command, args, options) => {
    if (args[0] === 'publish' && !overlap) {
      try {
        s.publish();
        overlap = 'it ran';
      } catch (error) {
        overlap = error.message;
      }
    }
    return npm(args, options);
  };
  npmPublish({
    dir: s.dir,
    version: '0.1.0',
    prerelease: false,
    files: s.files,
    print: () => {},
    npmCommand: ['npm'],
    run,
  });
  const lock = join(s.dir, '.release', '0.1.0', 'npm.lock');
  assert.match(overlap, /another publish of 0\.1\.0 to npm is running/);
  assert.ok(overlap.includes(`remove ${lock} (not ${s.receipts})`));
  assert.deepEqual(
    s.publishes(),
    NAMES.map(name => `./${STEMS[name]}-0.1.0.tgz`),
  );
  assert.equal(existsSync(lock), false);

  writeFileSync(lock, '1\n');
  const before = readFileSync(s.receipts, 'utf8');
  s.state.npmCalls = [];
  assert.throws(s.publish, /npm\.lock exists/);
  assert.deepEqual(s.state.npmCalls, []);
  assert.equal(readFileSync(s.receipts, 'utf8'), before);
  assert.ok(existsSync(lock));
});

test('a staged publish is reported as staged, with its id', t => {
  const s = setup(t);
  s.state.staged = true;
  assert.deepEqual(s.publish(), Object.fromEntries(NAMES.map(name => [name, 'staged'])));
  assert.match(
    s.printed.at(-1),
    /npm: @swiftplot\/vue@0\.1\.0 is staged on npm \(id id-@swiftplot\/vue@0\.1\.0, pending\)/,
  );
});

test('a publish npm accepted that is neither public nor staged yet is reported as not visible', t => {
  const s = setup(t);
  s.state.staged = true;
  s.state.npmStage = { code: 0, stdout: '[]', stderr: '' };
  assert.deepEqual(s.publish(), Object.fromEntries(NAMES.map(name => [name, 'not visible'])));
  assert.equal(
    s.printed.at(-1),
    `npm: @swiftplot/vue@0.1.0 was accepted by npm and is not visible yet: run again in a few minutes; if it has been more than a few minutes, or you rejected its staged copy, remove "@swiftplot/vue" from ${s.receipts} and run again`,
  );
});

test('an answer from npm view that is neither an integrity nor E404 stops', t => {
  const s = setup(t);
  const npm = fakeNpm(s.state);
  assert.throws(
    () =>
      npmPublish({
        dir: s.dir,
        version: '0.1.0',
        prerelease: false,
        files: s.files,
        print: () => {},
        npmCommand: ['npm'],
        run: (command, args, options) =>
          args[0] === 'view'
            ? { code: 1, stdout: '{"error":{"code":"E401"}}', stderr: '' }
            : npm(args, options),
      }),
    /npm view swiftplot@0\.1\.0 gave no integrity and no E404 \(exit 1\); npm printed:\n\{"error":\{"code":"E401"\}\}$/,
  );
  assert.equal(existsSync(s.receipts), false);
});

test('a package npm view fails on, or the run never reached, is reported as not checked, not as not published', t => {
  const s = setup(t);
  s.state.npm = { [key('swiftplot')]: { integrity: s.sri.swiftplot, public: true } };
  const npm = fakeNpm(s.state);
  let views = 0;
  const run = failAt => (command, args, options) =>
    args[0] === 'view' && ++views === failAt
      ? { code: 1, stdout: '{"error":{"code":"E401"}}', stderr: '' }
      : npm(args, options);
  const publishWith = failAt => {
    views = 0;
    s.printed.length = 0;
    return npmPublish({
      dir: s.dir,
      version: '0.1.0',
      prerelease: false,
      files: s.files,
      print: line => s.printed.push(line),
      npmCommand: ['npm'],
      run: run(failAt),
    });
  };

  assert.throws(() => publishWith(3), /npm view @swiftplot\/react@0\.1\.0 gave no integrity/);
  assert.deepEqual(s.printed.slice(-3), [
    'npm: swiftplot@0.1.0 is public',
    'npm: @swiftplot/react@0.1.0 was sent, and the script stopped before npm showed it: run again to find out where it is',
    'npm: @swiftplot/vue@0.1.0 was not checked',
  ]);

  assert.throws(() => publishWith(1), /npm view swiftplot@0\.1\.0 gave no integrity/);
  assert.deepEqual(
    s.printed.slice(-3),
    NAMES.map(name => `npm: ${name}@0.1.0 was not checked`),
  );
});

test('an integrity npm view wraps in a list counts as that integrity', t => {
  const s = setup(t);
  const npm = fakeNpm(s.state);
  const run = (command, args, options) => {
    const out = npm(args, options);
    return args[0] === 'view' && out.code === 0 ? { ...out, stdout: `[${out.stdout.trim()}]` } : out;
  };
  const status = npmPublish({
    dir: s.dir,
    version: '0.1.0',
    prerelease: false,
    files: s.files,
    print: () => {},
    npmCommand: ['npm'],
    run,
  });
  assert.deepEqual(status, Object.fromEntries(NAMES.map(name => [name, 'public'])));
});
