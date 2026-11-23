import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { check, entries, lockedVersion, verify, writeSums } from './check-tarballs.mjs';
import { pack, pnpm } from './pack.mjs';
import { command } from './prepare.mjs';
import { tar } from './testing.mjs';

const tempDir = (t, prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

function tarball(name, version = '0.1.0', { manifest = {}, files = {}, drop = [] } = {}) {
  const peer = name === 'swiftplot' ? {} : { peerDependencies: { swiftplot: `^${version}` } };
  const all = {
    'package/package.json': JSON.stringify({ name, version, ...peer, ...manifest }),
    'package/README.md': 'readme',
    'package/LICENSE': 'MIT',
    'package/dist/index.js': 'export {};',
    'package/dist/index.d.ts': 'export {};',
    ...files,
  };
  for (const file of drop) delete all[file];
  return tar(all);
}

const fileName = name => `${name.replace('@', '').replace('/', '-')}.tgz`;

function tarballs(t, overrides = {}) {
  const dir = tempDir(t, 'swiftplot-tarballs-');
  for (const name of ['swiftplot', '@swiftplot/react', '@swiftplot/vue']) {
    if (overrides[name] === null) continue;
    writeFileSync(join(dir, fileName(name)), overrides[name] ?? tarball(name));
  }
  return dir;
}

test('check passes for the three packages at one version', t => {
  assert.deepEqual(check(tarballs(t)), {
    version: '0.1.0',
    files: {
      swiftplot: 'swiftplot.tgz',
      '@swiftplot/react': 'swiftplot-react.tgz',
      '@swiftplot/vue': 'swiftplot-vue.tgz',
    },
  });
});

for (const [what, make, problem] of [
  ['a missing package', t => tarballs(t, { '@swiftplot/vue': null }), /no tarball of @swiftplot\/vue/],
  [
    'an extra tarball',
    t => {
      const dir = tarballs(t);
      writeFileSync(join(dir, 'other.tgz'), tarball('other'));
      return dir;
    },
    /other\.tgz: other is not one of/,
  ],
  [
    'two tarballs of one package',
    t => {
      const dir = tarballs(t);
      writeFileSync(join(dir, 'again.tgz'), tarball('swiftplot'));
      return dir;
    },
    /swiftplot is packed twice: again\.tgz and swiftplot\.tgz/,
  ],
  [
    'differing versions',
    t => tarballs(t, { '@swiftplot/vue': tarball('@swiftplot/vue', '0.2.0') }),
    /disagree on the version: .*@swiftplot\/vue 0\.2\.0/,
  ],
  [
    'a file outside package.json, README.md, LICENSE and dist',
    t => tarballs(t, { swiftplot: tarball('swiftplot', '0.1.0', { files: { 'package/src/index.ts': '' } }) }),
    /swiftplot\.tgz: it holds package\/src\/index\.ts/,
  ],
  [
    'a file outside package/',
    t => tarballs(t, { swiftplot: tarball('swiftplot', '0.1.0', { files: { 'other/dist/x.js': '' } }) }),
    /it holds other\/dist\/x\.js/,
  ],
  [
    'a path climbing out of dist',
    t => tarballs(t, { swiftplot: tarball('swiftplot', '0.1.0', { files: { 'package/dist/../x.js': '' } }) }),
    /it holds package\/dist\/\.\.\/x\.js/,
  ],
  ...['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'].map(file => [
    `a missing ${file}`,
    t =>
      tarballs(t, {
        '@swiftplot/react': tarball('@swiftplot/react', '0.1.0', { drop: [`package/${file}`] }),
      }),
    new RegExp(`swiftplot-react\\.tgz: it has no ${file.replace('.', '\\.')}`),
  ]),
  ...['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].map(field => [
    `a workspace: range in ${field}`,
    t =>
      tarballs(t, {
        '@swiftplot/vue': tarball('@swiftplot/vue', '0.1.0', {
          manifest: { [field]: { swiftplot: 'workspace:^' } },
        }),
      }),
    new RegExp(`swiftplot-vue\\.tgz: ${field}\\.swiftplot is workspace:\\^`),
  ]),
  [
    'a workspace: range outside the dependency fields',
    t =>
      tarballs(t, {
        '@swiftplot/vue': tarball('@swiftplot/vue', '0.1.0', {
          manifest: { pnpm: { overrides: { swiftplot: 'workspace:*' } } },
        }),
      }),
    /swiftplot-vue\.tgz: pnpm\.overrides\.swiftplot is workspace:\*/,
  ],
  [
    'a wrapper whose swiftplot peer is not the caret of the version',
    t =>
      tarballs(t, {
        '@swiftplot/react': tarball('@swiftplot/react', '0.1.0', {
          manifest: { peerDependencies: { swiftplot: '0.1.0' } },
        }),
      }),
    /@swiftplot\/react: peer swiftplot is 0\.1\.0, not \^0\.1\.0/,
  ],
]) {
  test(`check fails for ${String(what)}`, t => {
    assert.throws(() => check(make(t)), problem);
  });
}

test('SHA256SUMS lists every tarball, and verify catches a changed byte, a missing file and an unlisted tarball', t => {
  const dir = tarballs(t);
  const text = writeSums(dir);
  assert.equal(readFileSync(join(dir, 'SHA256SUMS'), 'utf8'), text);
  const lines = text.trim().split('\n');
  assert.deepEqual(
    lines.map(line => line.split('  ')[1]),
    ['swiftplot-react.tgz', 'swiftplot-vue.tgz', 'swiftplot.tgz'],
  );
  for (const line of lines) {
    const [digest, file] = line.split('  ');
    assert.equal(
      digest,
      createHash('sha256')
        .update(readFileSync(join(dir, file)))
        .digest('hex'),
      file,
    );
  }
  verify(dir);

  const path = join(dir, 'swiftplot.tgz');
  const original = readFileSync(path);
  const changed = Buffer.from(original);
  changed[changed.length - 1] ^= 1;
  writeFileSync(path, changed);
  assert.throws(() => verify(dir), /swiftplot\.tgz does not match its SHA-256/);

  rmSync(path);
  assert.throws(() => verify(dir), /swiftplot\.tgz is listed but missing/);

  writeFileSync(path, original);
  verify(dir);
  writeFileSync(join(dir, 'extra.tgz'), original);
  assert.throws(() => verify(dir), /extra\.tgz is not listed/);
});

test('lockedVersion reads the one locked version of a package', () => {
  const lockfile = [
    'packages:',
    '  react-dom@19.3.1:',
    '  react@19.3.1:',
    '  vue@3.5.46:',
    'snapshots:',
    '  react-dom@19.3.1(react@19.3.1):',
    '  react@19.3.1: {}',
    '  vue@3.5.46(typescript@5.9.3):',
  ].join('\n');
  assert.equal(lockedVersion(lockfile, 'react'), '19.3.1');
  assert.equal(lockedVersion(lockfile, 'react-dom'), '19.3.1');
  assert.equal(lockedVersion(lockfile, 'vue'), '3.5.46');
  assert.throws(
    () => lockedVersion(`${lockfile}\n  vue@3.4.0:`, 'vue'),
    /one version of vue.*3\.5\.46, 3\.4\.0/,
  );
  assert.throws(() => lockedVersion(lockfile, 'svelte'), /found none/);
});

for (const [what, size, problem] of [
  ['a negative size', '-0002000', /bad size "-0002000"/],
  ['a size with trailing garbage', '0000001x', /bad size "0000001x"/],
  ['an empty size', '', /bad size ""/],
  ['an entry running past the end', '77777777', /package\/a runs past the end of the tar/],
]) {
  test(`entries rejects ${what}`, () => {
    const raw = gunzipSync(tar({ 'package/a': 'x' }));
    raw.fill(0, 124, 136);
    raw.write(size, 124);
    assert.throws(() => entries(gzipSync(raw)), problem);
  });
}

test('pnpm runs its JS entry through node when pnpm set npm_execpath, and pnpm from PATH otherwise', () => {
  assert.deepEqual(pnpm({ npm_execpath: '/x/pnpm/bin/pnpm.cjs' }, 'linux'), [
    process.execPath,
    '/x/pnpm/bin/pnpm.cjs',
  ]);
  assert.deepEqual(pnpm({ npm_execpath: '/x/npm/bin/npm-cli.js' }, 'linux'), ['pnpm']);
  assert.deepEqual(pnpm({}, 'linux'), ['pnpm']);
});

test('command on Windows runs a native exe or the JS entry beside a .cmd shim from PATH', t => {
  const root = tempDir(t, 'swiftplot-path-');
  const put = path => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), '');
  };
  const PATH = ['empty', 'global', 'native'].map(dir => join(root, dir)).join(delimiter);
  const win = env => pnpm(env, 'win32');
  assert.throws(() => win({ PATH }), /cannot find a runnable pnpm on PATH/);
  put('native/pnpm.exe');
  assert.deepEqual(win({ Path: PATH }), [join(root, 'native/pnpm.exe')]);
  put('global/node_modules/pnpm/bin/pnpm.cjs');
  assert.deepEqual(win({ PATH }), [join(root, 'native/pnpm.exe')]);
  put('global/pnpm.cmd');
  assert.deepEqual(win({ PATH }), [process.execPath, join(root, 'global/node_modules/pnpm/bin/pnpm.cjs')]);
  put('empty/npm.cmd');
  put('empty/node_modules/npm/bin/npm-cli.js');
  assert.deepEqual(
    command('npm', ['node_modules/npm/bin/npm-cli.js'], { env: { PATH }, platform: 'win32' }),
    [process.execPath, join(root, 'empty/node_modules/npm/bin/npm-cli.js')],
  );
  assert.deepEqual(command('npm', [], { env: {}, platform: 'linux' }), ['npm']);
});

const PACKAGES = ['core', 'react', 'vue'];

function workspace(t, { built = true } = {}) {
  const source = tempDir(t, 'swiftplot-pack-');
  writeFileSync(join(source, 'README.md'), 'root readme');
  writeFileSync(join(source, 'LICENSE'), 'root licence');
  for (const name of PACKAGES) {
    mkdirSync(join(source, 'packages', name, built ? 'dist' : ''), { recursive: true });
    writeFileSync(join(source, 'packages', name, 'package.json'), `{ "name": "${name}" }`);
  }
  return { source, out: join(source, 'out') };
}

function runner({ failIn } = {}) {
  const calls = [];
  const run = (command, args, options) => {
    const copies = ['README.md', 'LICENSE'].map(name => readFileSync(join(options.cwd, name), 'utf8'));
    calls.push({ command, args, cwd: options.cwd, copies });
    if (options.cwd.endsWith(failIn)) return { code: 1, stdout: '', stderr: 'boom' };
    writeFileSync(join(args.at(-1), `${options.cwd.split(/[\\/]/).at(-1)}.tgz`), options.cwd);
    return { code: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}

const leftovers = source =>
  PACKAGES.flatMap(name => ['README.md', 'LICENSE'].map(file => join(source, 'packages', name, file))).filter(
    existsSync,
  );

test('pack copies the root README and LICENSE in, packs each package into the output directory, writes SHA256SUMS and removes the copies', t => {
  const { source, out } = workspace(t);
  const { run, calls } = runner();
  const sums = pack({ source, out, run, pnpmCommand: ['node', 'pnpm.cjs'] });
  assert.deepEqual(
    calls,
    PACKAGES.map(name => ({
      command: 'node',
      args: ['pnpm.cjs', 'pack', '--pack-destination', out],
      cwd: join(source, 'packages', name),
      copies: ['root readme', 'root licence'],
    })),
  );
  assert.deepEqual(readdirSync(out).sort(), ['SHA256SUMS', 'core.tgz', 'react.tgz', 'vue.tgz']);
  assert.equal(readFileSync(join(out, 'SHA256SUMS'), 'utf8'), sums);
  verify(out);
  assert.deepEqual(leftovers(source), []);
});

test('pack refuses an output directory that is not empty', t => {
  const { source, out } = workspace(t);
  mkdirSync(out);
  writeFileSync(join(out, 'old.tgz'), 'old');
  const { run, calls } = runner();
  assert.throws(() => pack({ source, out, run }), /is not empty/);
  assert.deepEqual(calls, []);
  assert.deepEqual(leftovers(source), []);
});

test('pack requires a build', t => {
  const { source, out } = workspace(t, { built: false });
  const { run, calls } = runner();
  assert.throws(() => pack({ source, out, run }), /has no dist: run pnpm build first/);
  assert.deepEqual(calls, []);
});

for (const file of ['README.md', 'LICENSE']) {
  test(`pack fails without touching a ${file} already in a package`, t => {
    const { source, out } = workspace(t);
    const existing = join(source, 'packages', 'vue', file);
    writeFileSync(existing, 'mine');
    const { run, calls } = runner();
    assert.throws(() => pack({ source, out, run }), new RegExp(`${file.replace('.', '\\.')} already exists`));
    assert.deepEqual(calls, []);
    assert.equal(readFileSync(existing, 'utf8'), 'mine');
    assert.deepEqual(leftovers(source), [existing]);
  });
}

test('pack removes the copies when packing fails', t => {
  const { source, out } = workspace(t);
  const { run, calls } = runner({ failIn: 'react' });
  assert.throws(() => pack({ source, out, run }), /pnpm pack failed in .*react:\nboom/);
  assert.equal(calls.length, 2);
  assert.deepEqual(leftovers(source), []);
  assert.equal(existsSync(join(out, 'SHA256SUMS')), false);
});
