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
// A wrapper published while its core is in one of these states cannot be installed, so it waits.
const BLOCKING = ['missing', 'unknown', 'staged, unchecked', 'staged, other bytes'];

export const npm = (env = process.env, platform = process.platform) =>
  command('npm', ['node_modules/npm/bin/npm-cli.js'], { env, platform });
export const integrity = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
export const shasum = bytes => createHash('sha1').update(bytes).digest('hex');

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

const said = out =>
  [out.stdout, out.stderr]
    .map(text => text?.trim())
    .filter(Boolean)
    .join('\n') || 'nothing';

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
  // npm view sometimes wraps the one value it found in a list.
  if (Array.isArray(body) && body.length === 1) [body] = body;
  if (out.code === 0 && typeof body === 'string' && SRI.test(body)) return body;
  if (out.code !== 0 && body?.error?.code === 'E404') return null;
  throw new Error(
    `npm view ${name}@${version} gave no integrity and no E404 (exit ${out.code}); npm printed:\n${said(out)}`,
  );
}

function staged({ run, npmCommand, cwd, name, version }) {
  const [bin, ...prefix] = npmCommand;
  const out = run(bin, [...prefix, 'stage', 'list', name, '--json', ...REGISTRY_ARGS], { cwd });
  if (out.code !== 0) return { error: said(out) };
  try {
    const items = JSON.parse(out.stdout);
    if (Array.isArray(items))
      return { item: items.find(item => item?.packageName === name && item?.version === version) ?? null };
  } catch {}
  return { error: said(out) };
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
  const again = name => `remove "${name}" from ${path} and run again`;
  const stage = (...args) => ['npm stage', ...args, ...REGISTRY_ARGS].join(' ');
  const view = name => published({ run, npmCommand, cwd: files, name, version });
  const status = Object.fromEntries(PACKAGES.map(name => [name, 'not checked']));
  const notes = {};
  const settle = (name, state, sha) => {
    const { item, error } = staged({ run, npmCommand, cwd: files, name, version });
    if (item && !item.shasum)
      [status[name], notes[name]] = [
        'staged, unchecked',
        `is staged on npm (id ${item.id}), and npm stage list gave no shasum to check its bytes against: approve it (${stage('approve', item.id)}) only if ${stage('view', item.id)} shows shasum ${sha}, otherwise reject it (${stage('reject', item.id)}), then ${again(name)}`,
      ];
    else if (item && item.shasum !== sha)
      [status[name], notes[name]] = [
        'staged, other bytes',
        `is staged on npm with other bytes (id ${item.id}, shasum ${item.shasum}, not ${sha}): reject it (${stage('reject', item.id)}), then ${again(name)}`,
      ];
    else if (item)
      [status[name], notes[name]] = [
        'staged',
        `is staged on npm (id ${item.id}${item.status ? `, ${item.status}` : ''}) and waits for approval: run ${stage('approve', item.id)}`,
      ];
    else if (item === null && state === 'started')
      [status[name], notes[name]] = [
        'missing',
        `is neither public nor staged on npm, so its upload most likely failed; it may still be processing if it was sent in the last few minutes, otherwise ${again(name)}`,
      ];
    else if (item === null)
      [status[name], notes[name]] = [
        'not visible',
        `was accepted by npm and is not visible yet: run again in a few minutes; if it has been more than a few minutes, or you rejected its staged copy, ${again(name)}`,
      ];
    else
      [status[name], notes[name]] = [
        'unknown',
        `is not public, and the script could not ask npm whether it is staged (npm stage needs npm 11.15 or later and a current login; npm printed: ${error}). Keep ${path}, update npm or run npm login, then run again`,
      ];
    return `npm: ${name}@${version} ${notes[name]}`;
  };
  const differs = (name, file, shown, ours) =>
    new Error(`npm has ${name}@${version} with another integrity (${shown}), not that of ${file} (${ours})`);

  try {
    for (const name of PACKAGES) {
      const file = held.files[name];
      const bytes = readFileSync(join(files, file));
      const ours = integrity(bytes);
      const sha = shasum(bytes);
      const shown = view(name);
      if (shown === ours) {
        status[name] = 'public';
        continue;
      }
      if (shown) throw differs(name, file, shown, ours);
      const receipt = receipts[name];
      if (receipt && receipt.integrity !== ours)
        throw new Error(
          `${path} records a publish of other bytes for ${name}; reject any staged copy of it (${stage('list', name)}), then ${again(name)}`,
        );
      if (receipt) {
        print(settle(name, receipt.state, sha));
        if (name === 'swiftplot' && BLOCKING.includes(status[name])) {
          for (const later of PACKAGES.slice(PACKAGES.indexOf(name) + 1)) {
            status[later] = 'held';
            notes[later] = `was not published, as ${name}@${version} is not on npm`;
          }
          break;
        }
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
          // An inherited dry-run=true would exit 0 without publishing and leave a "finished" receipt.
          '--dry-run=false',
          // npm keeps 10 logs by default, and the checks around a failed publish push its log out.
          '--logs-max=50',
          ...REGISTRY_ARGS,
          ...(prerelease ? ['--tag', 'next'] : []),
        ],
        { cwd: files, stdio: 'inherit' },
      );
      if (out.code === 0) {
        receipts[name] = { state: 'finished', integrity: ours };
        writeReceipts(path, version, receipts);
      }
      const after = view(name);
      if (after === ours) {
        status[name] = 'public';
        continue;
      }
      if (after) throw differs(name, file, after, ours);
      const line = settle(name, receipts[name].state, sha);
      if (out.code !== 0)
        throw new Error(
          `npm publish of ${file} failed; its receipt stays "started", so running again will not publish it twice. ${line}`,
        );
    }
  } finally {
    const words = {
      public: 'is public',
      unconfirmed: 'was sent, and the script stopped before npm showed it: run again to find out where it is',
      'not published': 'is not published',
      'not checked': 'was not checked',
    };
    for (const name of PACKAGES) print(`npm: ${name}@${version} ${notes[name] ?? words[status[name]]}`);
  }
  return status;
}
