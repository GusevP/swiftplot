import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sha256 } from './check-tarballs.mjs';
import { run } from './prepare.mjs';

export function sh(cwd, ...args) {
  const out = run('git', args, { cwd });
  if (out.code !== 0) throw new Error(`git ${args.join(' ')}: ${out.stderr}`);
  return out.stdout.trim();
}

export function gitRepo(t, prefix, fill) {
  const root = mkdtempSync(join(tmpdir(), prefix));
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
  fill(dir);
  sh(dir, 'add', '.');
  sh(dir, 'commit', '-m', 'initial');
  sh(dir, 'push', 'origin', 'main');
  return { dir, origin };
}

export function tar(files) {
  const blocks = [];
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0);
    header.write('0000644\0', 100);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('0', 156);
    header.write('ustar\0', 257);
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

export function github(state, now) {
  return path => {
    const url = new URL(path, 'https://api.github.com/');
    const rest = url.pathname.slice(1);
    if (rest === 'releases')
      return (state.releases ?? []).map(r => ({
        tag_name: r.tag,
        draft: r.draft,
        prerelease: r.prerelease ?? false,
        assets: r.assets.map(a => ({
          name: a.name,
          state: a.state ?? 'uploaded',
          size: a.size ?? a.bytes.length,
          digest: a.digest ?? `sha256:${sha256(a.bytes)}`,
        })),
      }));
    const runs = typeof state.runs === 'function' ? state.runs(now()) : (state.runs ?? []);
    if (rest === 'actions/workflows/ci.yml/runs') {
      const q = url.searchParams;
      return {
        workflow_runs: runs
          .filter(
            run =>
              (!q.has('head_sha') || run.sha === q.get('head_sha')) &&
              (!q.has('branch') || run.branch === q.get('branch')) &&
              (!q.has('event') || run.event === q.get('event')),
          )
          .map(run => {
            const last = run.attempts.at(-1);
            return {
              id: run.id,
              event: run.event,
              head_branch: run.branch,
              head_sha: run.sha,
              html_url: `https://github.com/GusevP/swiftplot/actions/runs/${run.id}`,
              run_attempt: run.attempts.length,
              status: last.status,
              conclusion: last.conclusion ?? null,
            };
          }),
      };
    }
    const m = /^actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs$/.exec(rest);
    const attempt = m && runs.find(run => run.id === Number(m[1]))?.attempts[Number(m[2]) - 1];
    if (attempt)
      return {
        jobs: Object.entries(attempt.jobs).map(([name, conclusion]) => ({
          name,
          status: conclusion ? 'completed' : 'in_progress',
          conclusion,
        })),
      };
    return null;
  };
}

const REPO = 'GusevP/swiftplot';

// state.remote is the bare repository standing in for GitHub's git side; state.fail(args) may return
// 'before' (the call never reached GitHub) or 'after' (GitHub applied it, the response was lost).
export function fakeGh(state, now = () => 0) {
  const api = github(state, now);
  const ok = stdout => ({ code: 0, stdout, stderr: '' });
  const refuse = stderr => ({ code: 1, stdout: '', stderr });
  const apply = (args, cwd) => {
    if (args[0] === 'api') {
      assert.deepEqual(args.slice(1, 3), ['--hostname', 'github.com']);
      const path = args.at(-1);
      assert.ok(path.startsWith(`repos/${REPO}/`), path);
      const body = api(path.slice(`repos/${REPO}/`.length));
      if (!body) return refuse('HTTP 404');
      const jq = args.indexOf('--jq');
      if (jq === -1) return ok(JSON.stringify(body));
      const tag = JSON.parse(/^\.\[\] \| select\(\.tag_name == (".*")\)$/.exec(args[jq + 1])[1]);
      return ok(
        body
          .filter(r => r.tag_name === tag)
          .map(r => `${JSON.stringify(r)}\n`)
          .join(''),
      );
    }
    assert.equal(args[0], 'release');
    assert.equal(args[args.indexOf('--repo') + 1], REPO);
    const [, verb, tag] = args;
    state.releases ??= [];
    const release = state.releases.find(r => r.tag === tag);
    if (verb === 'create') {
      if (args.includes('--verify-tag') && !sh(state.remote, 'tag', '--list', tag))
        return refuse(`tag ${tag} doesn't exist in the repo`);
      state.releases.push({
        tag,
        draft: args.includes('--draft'),
        prerelease: args.includes('--prerelease'),
        notes: readFileSync(args[args.indexOf('--notes-file') + 1], 'utf8'),
        assets: [],
      });
      return ok('');
    }
    if (!release) return refuse('release not found');
    if (verb === 'download') {
      for (const asset of release.assets) writeFileSync(join(args[6], asset.name), asset.bytes);
      return ok('');
    }
    if (verb === 'upload') {
      const [path] = args[3].split('#');
      const name = basename(path);
      if (release.assets.some(a => a.name === name)) return refuse(`asset ${name} already exists`);
      release.assets.push({ name, bytes: readFileSync(resolve(cwd ?? '.', path)) });
      return ok('');
    }
    if (verb === 'delete-asset') {
      const at = release.assets.findIndex(a => a.name === args[3]);
      if (at === -1) return refuse(`asset ${args[3]} not found`);
      release.assets.splice(at, 1);
      return ok('');
    }
    assert.equal(verb, 'edit');
    const rest = args.slice(5);
    const notes = rest.indexOf('--notes-file');
    if (notes !== -1) release.notes = readFileSync(rest.splice(notes, 2)[1], 'utf8');
    for (const arg of rest) {
      const m = /^--(draft|prerelease)=(true|false)$/.exec(arg);
      assert.ok(m, arg);
      release[m[1]] = m[2] === 'true';
    }
    return ok('');
  };
  return (args, { cwd } = {}) => {
    const fail = state.fail?.(args);
    if (fail === 'before') return refuse('connection reset');
    const out = apply(args, cwd);
    return fail === 'after' ? refuse('connection reset') : out;
  };
}
