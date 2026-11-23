import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, PACKAGES } from './check-tarballs.mjs';
import { command } from './prepare.mjs';

export const REGISTRY = 'https://registry.npmjs.org/';
// A scope registry in the owner's npm config beats --registry for scoped names, so name both.
const REGISTRY_ARGS = ['--registry', REGISTRY, `--@swiftplot:registry=${REGISTRY}`];
const SRI = /^sha512-[A-Za-z0-9+/]{86}==$/;
const STATES = ['started', 'finished'];

export const npm = (env = process.env, platform = process.platform) =>
  command('npm', ['node_modules/npm/bin/npm-cli.js'], { env, platform });
export const integrity = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

function readReceipts(path, version) {
  if (!existsSync(path)) return {};
  const fix = `remove ${path} only if no publish of ${version} is waiting on npmjs.com`;
  let held;
  try {
    held = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${path} is not JSON; ${fix}`);
  }
  const packages = held?.packages;
  if (held?.version !== version || !packages || typeof packages !== 'object' || Array.isArray(packages))
    throw new Error(`${path} is not a receipt file for ${version}; ${fix}`);
  for (const [name, receipt] of Object.entries(packages))
    if (!PACKAGES.includes(name) || !STATES.includes(receipt?.state) || !SRI.test(receipt?.integrity ?? ''))
      throw new Error(`${path} holds an invalid receipt for ${JSON.stringify(name)}; ${fix}`);
  return packages;
}

function writeReceipts(path, version, packages) {
  mkdirSync(join(path, '..'), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ version, packages }, null, 2)}\n`);
  renameSync(temp, path);
}

function published({ run, npmCommand, cwd, name, version }) {
  const [bin, ...prefix] = npmCommand;
  const out = run(
    bin,
    [...prefix, 'view', `${name}@${version}`, 'dist.integrity', '--json', ...REGISTRY_ARGS],
    {
      cwd,
    },
  );
  let body;
  try {
    body = out.stdout.trim() ? JSON.parse(out.stdout) : undefined;
  } catch {
    body = undefined;
  }
  if (out.code === 0 && typeof body === 'string' && SRI.test(body)) return body;
  if (out.code !== 0 && body?.error?.code === 'E404') return null;
  throw new Error(`npm view ${name}@${version} gave no integrity and no E404 (exit ${out.code})`);
}

export function npmPublish({ dir, run, version, prerelease, files, print, npmCommand = npm() }) {
  const held = check(files);
  if (held.version !== version) throw new Error(`the files to publish are ${held.version}, not ${version}`);
  const path = join(dir, '.release', version, 'npm.json');
  const lock = join(dir, '.release', version, 'npm.lock');
  mkdirSync(join(lock, '..'), { recursive: true });
  try {
    writeFileSync(lock, `${process.pid}\n`, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(
      `${lock} exists: another publish of ${version} to npm is running, or one stopped before removing it; if none is running, remove ${lock} (not ${path}) and run again`,
    );
  }
  try {
    return publishLocked({ run, version, prerelease, files, print, npmCommand, held, path });
  } finally {
    rmSync(lock, { force: true });
  }
}

function publishLocked({ run, version, prerelease, files, print, npmCommand, held, path }) {
  const receipts = readReceipts(path, version);
  const clear = name =>
    `it is probably waiting for approval on npmjs.com (staged publishing); if it was rejected, remove "${name}" from ${path} and run again`;
  const view = name => published({ run, npmCommand, cwd: files, name, version });
  const status = Object.fromEntries(PACKAGES.map(name => [name, 'not checked']));
  const differs = (name, file, shown, ours) =>
    new Error(`npm has ${name}@${version} with another integrity (${shown}), not that of ${file} (${ours})`);

  try {
    for (const name of PACKAGES) {
      const file = held.files[name];
      const ours = integrity(readFileSync(join(files, file)));
      const shown = view(name);
      if (shown === ours) {
        status[name] = 'public';
        continue;
      }
      if (shown) throw differs(name, file, shown, ours);
      const receipt = receipts[name];
      if (receipt && receipt.integrity !== ours)
        throw new Error(`${path} records a publish of other bytes for ${name}; ${clear(name)}`);
      if (receipt) {
        status[name] = 'waiting';
        print(`npm: ${name}@${version} was published before and is not public: ${clear(name)}.`);
        continue;
      }
      status[name] = 'not published';
      receipts[name] = { state: 'started', integrity: ours };
      writeReceipts(path, version, receipts);
      print(`Publishing ${file} to npm.`);
      status[name] = 'unconfirmed';
      const [bin, ...prefix] = npmCommand;
      const out = run(
        bin,
        [
          ...prefix,
          'publish',
          `./${file}`,
          '--access',
          'public',
          ...REGISTRY_ARGS,
          ...(prerelease ? ['--tag', 'next'] : []),
        ],
        { cwd: files, stdio: 'inherit' },
      );
      if (out.code !== 0)
        throw new Error(
          `npm publish of ${file} failed, but npm may have taken it anyway; its receipt stays "started", so running again will not publish it twice. Check npmjs.com: if it is waiting for approval, approve it; if npm has no publish of it, remove "${name}" from ${path} and run again`,
        );
      receipts[name] = { state: 'finished', integrity: ours };
      writeReceipts(path, version, receipts);
      status[name] = 'waiting';
      const after = view(name);
      if (after === ours) status[name] = 'public';
      else if (after) throw differs(name, file, after, ours);
    }
  } finally {
    const words = {
      public: 'is public',
      waiting: 'is waiting (for approval on npmjs.com, or not visible yet)',
      unconfirmed: 'was sent, but npm did not confirm it: check npmjs.com before removing its receipt',
      'not published': 'is not published',
      'not checked': 'was not checked',
    };
    for (const name of PACKAGES) print(`npm: ${name}@${version} ${words[status[name]]}`);
  }
  return status;
}
