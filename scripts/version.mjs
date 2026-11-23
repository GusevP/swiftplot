import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
const VERSION_LINE = /^(  "version": )"[^"]*"/m;

export const isVersion = version => SEMVER.test(version);

export function parse(version) {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`not a version: ${JSON.stringify(version)}`);
  return { core: [BigInt(m[1]), BigInt(m[2]), BigInt(m[3])], pre: m[4] ? m[4].split('.') : [] };
}

export const manifests = dir => {
  const root = join(dir, 'packages');
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(root, entry.name, 'package.json'));
};

export function shared(dir) {
  const found = manifests(dir).map(path => JSON.parse(readFileSync(path, 'utf8')));
  const versions = new Set(found.map(pkg => pkg.version));
  if (versions.size !== 1) {
    throw new Error(
      `the packages disagree on the version: ${found.map(p => `${p.name} ${p.version}`).join(', ')}`,
    );
  }
  const [version] = versions;
  parse(version);
  return version;
}

export function setShared(dir, version) {
  parse(version);
  return manifests(dir).map(path => {
    const text = readFileSync(path, 'utf8');
    if (!VERSION_LINE.test(text)) throw new Error(`${path} has no top-level "version" line`);
    const out = text.replace(VERSION_LINE, (_, key) => `${key}"${version}"`);
    if (JSON.parse(out).version !== version) throw new Error(`could not set the version in ${path}`);
    writeFileSync(path, out);
    return path;
  });
}

export function next(current, arg) {
  const { core, pre } = parse(current);
  const [major, minor, patch] = core;
  if (arg === 'major') return pre.length && !minor && !patch ? `${major}.0.0` : `${major + 1n}.0.0`;
  if (arg === 'minor') return pre.length && !patch ? `${major}.${minor}.0` : `${major}.${minor + 1n}.0`;
  if (arg === 'patch') return pre.length ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1n}`;
  parse(arg);
  return arg;
}

const comparePre = (a, b) => {
  if (!a.length || !b.length) return b.length - a.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const an = /^\d+$/.test(a[i]);
    const bn = /^\d+$/.test(b[i]);
    if (an && bn) return BigInt(a[i]) < BigInt(b[i]) ? -1 : 1;
    if (an !== bn) return an ? -1 : 1;
    return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
};

export function higher(a, b) {
  const x = parse(a);
  const y = parse(b);
  const core = x.core.map((n, i) => (n < y.core[i] ? -1 : n > y.core[i] ? 1 : 0)).find(d => d !== 0);
  return (core ?? comparePre(x.pre, y.pre)) > 0;
}
