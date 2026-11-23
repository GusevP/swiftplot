import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { command, run } from './prepare.mjs';
import { isVersion, manifests } from './version.mjs';

export const PACKAGES = ['swiftplot', '@swiftplot/react', '@swiftplot/vue'];
const WRAPPERS = PACKAGES.slice(1);
const REQUIRED = ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'];
export const SUMS = 'SHA256SUMS';

const workspaceRanges = (value, path = []) =>
  typeof value === 'string'
    ? value.startsWith('workspace:')
      ? [`${path.join('.')} is ${value}`]
      : []
    : value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, inner]) => workspaceRanges(inner, [...path, key]))
      : [];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const cString = (block, start, length) => {
  const end = block.indexOf(0, start);
  return block.toString('utf8', start, end === -1 || end > start + length ? start + length : end);
};

export function entries(gzipped) {
  const tar = gunzipSync(gzipped);
  const files = new Map();
  for (let at = 0; at + 512 <= tar.length;) {
    const header = tar.subarray(at, at + 512);
    if (header.every(byte => byte === 0)) break;
    const type = String.fromCharCode(header[156] || 48);
    const prefix = cString(header, 257, 6) === 'ustar' ? cString(header, 345, 155) : '';
    const name = prefix ? `${prefix}/${cString(header, 0, 100)}` : cString(header, 0, 100);
    const field = cString(header, 124, 12).trim();
    if (!/^[0-7]+$/.test(field))
      throw new Error(`bad size ${JSON.stringify(field)} in the tar header of ${name}`);
    const size = Number.parseInt(field, 8);
    const next = at + 512 + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(next) || next > tar.length)
      throw new Error(`${name} runs past the end of the tar`);
    const body = tar.subarray(at + 512, at + 512 + size);
    if (type === '0') files.set(name, body);
    else if (type !== '5') throw new Error(`unsupported tar entry type ${JSON.stringify(type)} for ${name}`);
    at = next;
  }
  return files;
}

function inspect(path) {
  const problems = [];
  const files = new Map();
  for (const [name, body] of entries(readFileSync(path))) {
    const inner = name.startsWith('package/') ? name.slice('package/'.length) : null;
    const allowed =
      inner !== null &&
      !inner.split('/').includes('..') &&
      (['package.json', 'README.md', 'LICENSE'].includes(inner) || inner.startsWith('dist/'));
    if (allowed) files.set(inner, body);
    else problems.push(`it holds ${name}, which is not package.json, README.md, LICENSE or dist/**`);
  }
  for (const name of REQUIRED) if (!files.has(name)) problems.push(`it has no ${name}`);
  const manifest = files.has('package.json') ? JSON.parse(files.get('package.json').toString('utf8')) : {};
  problems.push(...workspaceRanges(manifest));
  return { manifest, problems };
}

export function check(dir) {
  const problems = [];
  const found = new Map();
  for (const file of readdirSync(dir).sort()) {
    if (file === SUMS) continue;
    if (!file.endsWith('.tgz')) {
      problems.push(`${file} is not a tarball`);
      continue;
    }
    const { manifest, problems: own } = inspect(join(dir, file));
    problems.push(...own.map(problem => `${file}: ${problem}`));
    if (!PACKAGES.includes(manifest.name))
      problems.push(`${file}: ${manifest.name} is not one of ${PACKAGES.join(', ')}`);
    else if (found.has(manifest.name))
      problems.push(`${manifest.name} is packed twice: ${found.get(manifest.name).file} and ${file}`);
    else found.set(manifest.name, { file, manifest });
  }
  for (const name of PACKAGES) if (!found.has(name)) problems.push(`no tarball of ${name}`);
  const versions = new Set([...found.values()].map(({ manifest }) => manifest.version));
  if (versions.size > 1)
    problems.push(
      `the tarballs disagree on the version: ${[...found].map(([n, p]) => `${n} ${p.manifest.version}`).join(', ')}`,
    );
  const [version] = versions;
  if (versions.size === 1 && !isVersion(version)) problems.push(`${version} is not a version`);
  for (const name of WRAPPERS) {
    const peer = found.get(name)?.manifest.peerDependencies?.swiftplot;
    if (found.has(name) && versions.size === 1 && peer !== `^${version}`)
      problems.push(`${name}: peer swiftplot is ${peer}, not ^${version}`);
  }
  if (problems.length) throw new Error(`the tarballs in ${dir} are wrong:\n  ${problems.join('\n  ')}`);
  return { version, files: Object.fromEntries([...found].map(([name, { file }]) => [name, file])) };
}

export function writeSums(dir) {
  const tarballs = readdirSync(dir)
    .filter(file => file.endsWith('.tgz'))
    .sort();
  const text = tarballs.map(file => `${sha256(readFileSync(join(dir, file)))}  ${file}\n`).join('');
  writeFileSync(join(dir, SUMS), text);
  return text;
}

export function verify(dir) {
  const problems = [];
  const listed = new Set();
  for (const line of readFileSync(join(dir, SUMS), 'utf8').split('\n').filter(Boolean)) {
    const m = /^([0-9a-f]{64}) {2}([^/\\]+\.tgz)$/.exec(line);
    if (!m) {
      problems.push(`bad line in ${SUMS}: ${JSON.stringify(line)}`);
      continue;
    }
    const [, digest, file] = m;
    listed.add(file);
    if (!existsSync(join(dir, file))) problems.push(`${file} is listed but missing`);
    else if (sha256(readFileSync(join(dir, file))) !== digest)
      problems.push(`${file} does not match its SHA-256`);
  }
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.tgz') && !listed.has(file)) problems.push(`${file} is not listed in ${SUMS}`);
  }
  if (problems.length) throw new Error(`${SUMS} in ${dir} does not hold:\n  ${problems.join('\n  ')}`);
}

export function lockedVersion(lockfile, name) {
  const found = new Set(
    [...lockfile.matchAll(new RegExp(`^  ${name}@([^:(\\s]+)[:(]`, 'gm'))].map(m => m[1]),
  );
  if (found.size !== 1 || !isVersion([...found][0]))
    throw new Error(
      `expected one version of ${name} in pnpm-lock.yaml, found ${[...found].join(', ') || 'none'}`,
    );
  return [...found][0];
}

export function smoke({ dir, source, run }) {
  const { version, files } = check(dir);
  const lockfile = readFileSync(join(source, 'pnpm-lock.yaml'), 'utf8');
  const peers = ['react', 'react-dom', 'vue'].map(name => `${name}@${lockedVersion(lockfile, name)}`);
  const fixture = mkdtempSync(join(tmpdir(), 'swiftplot-tarballs-'));
  const call = (command, args) => {
    const out = run(command, args, { cwd: fixture });
    if (out.code !== 0) throw new Error(`${args.join(' ')} failed:\n${out.stdout}${out.stderr}`);
  };
  try {
    writeFileSync(join(fixture, 'package.json'), '{ "private": true, "type": "module" }\n');
    const [npm, ...prefix] = command('npm', ['node_modules/npm/bin/npm-cli.js']);
    call(npm, [
      ...prefix,
      'install',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      ...PACKAGES.map(name => resolve(dir, files[name])),
      ...peers,
    ]);
    const installed = name => join(fixture, 'node_modules', name);
    for (const name of PACKAGES) {
      const got = JSON.parse(readFileSync(join(installed(name), 'package.json'), 'utf8')).version;
      if (got !== version) throw new Error(`installed ${name} is ${got}, not the tarball's ${version}`);
    }
    for (const name of WRAPPERS) {
      if (existsSync(join(installed(name), 'node_modules/swiftplot')))
        throw new Error(`${name} installed its own swiftplot instead of the tarball's`);
    }
    const sources = new Map(
      manifests(source).map(path => [JSON.parse(readFileSync(path, 'utf8')).name, dirname(path)]),
    );
    for (const name of PACKAGES) {
      mkdirSync(join(installed(name), 'test'));
      cpSync(join(sources.get(name), 'test/import.mjs'), join(installed(name), 'test/import.mjs'));
      call(process.execPath, [join(installed(name), 'test/import.mjs')]);
    }
    writeFileSync(
      join(fixture, 'imports.mjs'),
      `import { strictEqual } from 'node:assert/strict';
for (const [name, file] of [
  ['swiftplot', 'swiftplot/dist/index.js'],
  ['swiftplot/charts', 'swiftplot/dist/charts/index.js'],
  ['@swiftplot/react', '@swiftplot/react/dist/index.js'],
  ['@swiftplot/vue', '@swiftplot/vue/dist/index.js'],
]) strictEqual(await import(name), await import(\`./node_modules/\${file}\`), name);
`,
    );
    call(process.execPath, [join(fixture, 'imports.mjs')]);
    return { version, files };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.length !== 3)
      throw new Error('usage: node scripts/check-tarballs.mjs <tarball directory>');
    const dir = resolve(process.argv[2]);
    verify(dir);
    const { version, files } = smoke({ dir, source: fileURLToPath(new URL('..', import.meta.url)), run });
    console.log(
      `The tarballs of ${version} hold what they should and install and import: ${Object.values(files).join(', ')}`,
    );
  } catch (error) {
    console.error(`check-tarballs: ${error.message}`);
    process.exitCode = 1;
  }
}
