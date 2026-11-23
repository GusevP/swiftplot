import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promote } from './changelog.mjs';
import { higher, highest, isVersion, manifests, next, setShared, shared } from './version.mjs';

const require = createRequire(import.meta.url);
const oxfmt = join(dirname(require.resolve('oxfmt/package.json')), require('oxfmt/package.json').bin.oxfmt);

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

// spawnSync cannot start a Windows .cmd shim without a shell, so on Windows run a native .exe or the JS
// entry the shim would run.
export function command(name, entries, { env = process.env, platform = process.platform } = {}) {
  if (platform !== 'win32') return [name];
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)) {
    if (existsSync(join(dir, `${name}.exe`))) return [join(dir, `${name}.exe`)];
    if (!existsSync(join(dir, `${name}.cmd`))) continue;
    const entry = entries.map(path => join(dir, path)).find(existsSync);
    if (entry) return [process.execPath, entry];
  }
  throw new Error(`cannot find a runnable ${name} on PATH`);
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function remoteTags(dir, run) {
  const { code, stdout, stderr } = run('git', ['ls-remote', '--tags', 'origin', 'refs/tags/v*'], {
    cwd: dir,
  });
  if (code !== 0) throw new Error(`git ls-remote origin failed: ${stderr.trim()}`);
  const tags = new Map();
  for (const line of stdout.split('\n')) {
    const m = /^([0-9a-f]+)\trefs\/tags\/v([^^]+)(\^\{\})?$/.exec(line);
    if (m && isVersion(m[2]) && (m[3] || !tags.has(m[2]))) tags.set(m[2], m[1]);
  }
  return tags;
}

export function prepare({ dir, arg, run, today = localDate() }) {
  const git = (...args) => {
    const out = run('git', args, { cwd: dir });
    if (out.code !== 0) throw new Error(`git ${args[0]} failed: ${out.stderr.trim()}`);
    return out.stdout;
  };
  if (git('status', '--porcelain', '--untracked-files=normal').trim())
    throw new Error('the working tree is not clean');
  const current = shared(dir);
  const version = next(current, arg);
  if (!higher(version, current))
    throw new Error(`${version} is not higher than the current version ${current}`);
  const top = highest([...remoteTags(dir, run).keys()]);
  if (top !== undefined && !higher(version, top))
    throw new Error(`${version} is not higher than the tag v${top} on origin`);
  const changelog = join(dir, 'CHANGELOG.md');
  const promoted = promote(readFileSync(changelog, 'utf8'), version, today);

  const files = [changelog, ...manifests(dir)].map(path => relative(dir, path));
  try {
    writeFileSync(changelog, promoted);
    setShared(dir, version);
    const format = run(process.execPath, [oxfmt, ...files], { cwd: dir });
    if (format.code !== 0) throw new Error(`oxfmt failed: ${format.stderr.trim()}`);
    git('add', '--', ...files);
    git('commit', '-m', `release: v${version}`, '--', ...files);
    return { version, files };
  } catch (error) {
    const restore = [['checkout', 'HEAD', '--', ...files]];
    if (!restore.every(args => run('git', args, { cwd: dir }).code === 0)) {
      error.message += `; the release files may be left changed, restore them with: ${restore
        .map(args => `git ${args.join(' ')}`)
        .join(' && ')}`;
    }
    throw error;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.length !== 3)
      throw new Error('usage: pnpm release:prepare <version | patch | minor | major>');
    const { version } = prepare({
      dir: fileURLToPath(new URL('..', import.meta.url)),
      arg: process.argv[2],
      run,
    });
    console.log(`Committed release: v${version} on the current branch. Nothing was pushed.`);
    console.log(
      'Next: get this commit onto main (push or merge it), wait for its checks, then run pnpm release.',
    );
  } catch (error) {
    console.error(`release:prepare: ${error.message}`);
    process.exitCode = 1;
  }
}
