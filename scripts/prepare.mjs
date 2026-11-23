import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promote } from './changelog.mjs';
import { higher, isVersion, next, setShared, shared } from './version.mjs';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function remoteTags(dir, run) {
  const { code, stdout, stderr } = run('git', ['ls-remote', '--tags', '--refs', 'origin', 'refs/tags/v*'], {
    cwd: dir,
  });
  if (code !== 0) throw new Error(`git ls-remote origin failed: ${stderr.trim()}`);
  return stdout
    .split('\n')
    .map(line => line.split('\trefs/tags/v')[1])
    .filter(version => version !== undefined && isVersion(version));
}

export function prepare({ dir, arg, run, today = localDate() }) {
  const git = (...args) => {
    const out = run('git', args, { cwd: dir });
    if (out.code !== 0) throw new Error(`git ${args[0]} failed: ${out.stderr.trim()}`);
    return out.stdout;
  };
  if (git('status', '--porcelain').trim()) throw new Error('the working tree is not clean');
  const current = shared(dir);
  const version = next(current, arg);
  if (!higher(version, current))
    throw new Error(`${version} is not higher than the current version ${current}`);
  const top = remoteTags(dir, run).reduce((a, b) => (higher(b, a) ? b : a), '0.0.0');
  if (!higher(version, top)) throw new Error(`${version} is not higher than the tag v${top} on origin`);
  const changelog = join(dir, 'CHANGELOG.md');
  const promoted = promote(readFileSync(changelog, 'utf8'), version, today);

  const touched = ['CHANGELOG.md', 'packages'];
  try {
    writeFileSync(changelog, promoted);
    const files = [changelog, ...setShared(dir, version)].map(path => relative(dir, path));
    const format = run('pnpm', ['exec', 'oxfmt', ...files], { cwd: dir });
    if (format.code !== 0) throw new Error(`oxfmt failed: ${format.stderr.trim()}`);
    git('add', '--', ...files);
    git('commit', '-m', `release: v${version}`);
    return { version, files };
  } catch (error) {
    const restore = [
      ['reset', '-q', '--', ...touched],
      ['checkout', 'HEAD', '--', ...touched],
    ];
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
