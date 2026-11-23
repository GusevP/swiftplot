import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { section } from './changelog.mjs';
import { check, PACKAGES, sha256, smoke, SUMS, verify } from './check-tarballs.mjs';
import { caller, findRelease, githubRelease } from './github-release.mjs';
import { pack, pnpm } from './pack.mjs';
import { remoteTags, run as realRun } from './prepare.mjs';
import { npm as npmBin, npmPublish, REGISTRY } from './npm-publish.mjs';
import { higher, highest, manifests, shared } from './version.mjs';

const POLL = 20_000;
const NO_RUN = 5 * 60_000;
const LIMIT = 30 * 60_000;
const JOBS = ['check', 'pack'];
const GITHUB =
  /^(?:git\+)?(?:https:\/\/(?:[^@/]+@)?github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i;

export const tarballName = (name, version) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
const expectedFiles = version => [...PACKAGES.map(name => tarballName(name, version)), SUMS].sort();
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const describe = dir =>
  readdirSync(dir)
    .sort()
    .map(name => {
      const bytes = readFileSync(join(dir, name));
      return { name, size: bytes.length, sha256: sha256(bytes) };
    });
const shown = url => {
  const repo = GITHUB.exec(url)?.[1];
  return repo ? `github.com/${repo}` : 'a URL that names no GitHub repository';
};

export async function checks({ api, commit, sleep, now, print = () => {}, wait = true }) {
  const start = now();
  for (;;) {
    const { workflow_runs: runs } = api(
      `actions/workflows/ci.yml/runs?head_sha=${commit}&branch=main&event=push`,
    );
    const [latest] = runs
      .filter(run => run.head_sha === commit && run.event === 'push' && run.head_branch === 'main')
      .sort((a, b) => b.id - a.id);
    if (latest?.status === 'completed') {
      if (!Number.isSafeInteger(latest.id) || !Number.isSafeInteger(latest.run_attempt))
        throw new Error(`GitHub returned the run ${latest.id}, attempt ${latest.run_attempt}, for ${commit}`);
      const { jobs } = api(`actions/runs/${latest.id}/attempts/${latest.run_attempt}/jobs`);
      const problems = latest.conclusion === 'success' ? [] : [`it concluded ${latest.conclusion}`];
      for (const name of JOBS) {
        const job = jobs.find(j => j.name === name);
        if (job?.conclusion !== 'success')
          problems.push(`its ${name} job is ${job ? (job.conclusion ?? job.status) : 'missing'}`);
      }
      if (problems.length)
        throw new Error(
          `the ci.yml push run on main for ${commit} (${latest.html_url}, attempt ${latest.run_attempt}) did not pass: ${problems.join('; ')}`,
        );
      return latest;
    }
    const what = latest
      ? `the ci.yml push run on main for ${commit} (${latest.html_url}) is ${latest.status}`
      : `there is no ci.yml push run on main for ${commit}`;
    const waited = now() - start;
    if (!wait || waited >= (latest ? LIMIT : NO_RUN))
      throw new Error(wait ? `${what} after ${Math.round(waited / 60_000)} minutes` : what);
    print(`Waiting: ${what}.`);
    await sleep(POLL);
  }
}

function fromRelease({ release, version, tag, repo, out, call }) {
  const expected = expectedFiles(version);
  const names = release.assets.map(asset => asset.name).sort();
  if (!sameList(names, expected))
    throw new Error(
      `the published release ${tag} has the assets ${names.join(', ') || 'none'}, not ${expected.join(', ')}`,
    );
  mkdirSync(out);
  call('gh', ['release', 'download', tag, '--repo', repo, '--dir', out]);
  const problems = [];
  for (const asset of release.assets) {
    const bytes = readFileSync(join(out, asset.name));
    if (asset.state !== 'uploaded') problems.push(`${asset.name} is ${asset.state} on GitHub`);
    if (bytes.length !== asset.size)
      problems.push(`${asset.name} has ${bytes.length} bytes, GitHub says ${asset.size}`);
    if (asset.digest !== `sha256:${sha256(bytes)}`)
      problems.push(`${asset.name} does not match the digest GitHub reports (${asset.digest})`);
  }
  if (!sameList(readdirSync(out).sort(), expected))
    problems.push(`the download holds ${readdirSync(out).join(', ')}`);
  if (problems.length)
    throw new Error(`the published release ${tag} does not hold:\n  ${problems.join('\n  ')}`);
  verify(out);
  const held = check(out);
  if (held.version !== version) throw new Error(`the published release ${tag} holds another version`);
  for (const [name, file] of Object.entries(held.files))
    if (file !== tarballName(name, version))
      throw new Error(
        `the published release ${tag} has ${name} in ${file}, not ${tarballName(name, version)}`,
      );
  return out;
}

function fromCache({ cache, version, commit }) {
  const record = join(cache, 'record.json');
  if (!existsSync(record)) throw new Error(`${cache} has no record.json; remove it to build again`);
  const held = JSON.parse(readFileSync(record, 'utf8'));
  if (held.version !== version || held.commit !== commit)
    throw new Error(
      `${cache} holds ${held.version} of ${held.commit}, not ${version} of ${commit}; remove it to build again`,
    );
  const files = join(cache, 'files');
  if (!sameList(readdirSync(files).sort(), expectedFiles(version)))
    throw new Error(
      `${files} holds ${readdirSync(files).join(', ')}, not ${expectedFiles(version).join(', ')}`,
    );
  try {
    verify(files);
  } catch (error) {
    throw new Error(`${error.message}\nremove ${cache} to build again`);
  }
  return files;
}

function build({ source, out, version, run, pnpmCommand }) {
  const [bin, ...prefix] = pnpmCommand;
  for (const args of [['install', '--frozen-lockfile'], ['build']]) {
    const result = run(bin, [...prefix, ...args], { cwd: source });
    if (result.code !== 0)
      throw new Error(`pnpm ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
  }
  pack({ source, out, run, pnpmCommand });
  const built = smoke({ dir: out, source, run }).version;
  if (built !== version) throw new Error(`the tarballs are ${built}, not ${version}`);
  return out;
}

function store({ files, cache, version, commit, time }) {
  mkdirSync(join(cache, '..'), { recursive: true });
  const staging = mkdtempSync(join(cache, '..', `.${version}-`));
  try {
    cpSync(files, join(staging, 'files'), { recursive: true });
    writeFileSync(join(staging, 'record.json'), `${JSON.stringify({ version, commit, time }, null, 2)}\n`);
    renameSync(staging, cache);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return join(cache, 'files');
}

export async function release({
  dir,
  run,
  dryRun = false,
  npm = false,
  npmCommand,
  ask,
  print = console.log,
  sleep,
  now = Date.now,
  pnpmCommand = pnpm(),
}) {
  const call = caller(run, dir);
  const git = (...args) => call('git', args);

  const repo = GITHUB.exec(
    JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).repository?.url ?? '',
  )?.[1];
  if (!repo) throw new Error('the root package.json names no GitHub repository');
  const isRepo = url => GITHUB.exec(url)?.[1].toLowerCase() === repo.toLowerCase();
  const origin = git('remote', 'get-url', 'origin').trim();
  if (!isRepo(origin)) throw new Error(`origin is ${shown(origin)}, not github.com/${repo}`);
  for (const push of git('remote', 'get-url', '--push', '--all', 'origin').split('\n').filter(Boolean))
    if (!isRepo(push.trim()))
      throw new Error(`origin pushes to ${shown(push.trim())}, not github.com/${repo}`);
  const api = path => JSON.parse(call('gh', ['api', '--hostname', 'github.com', `repos/${repo}/${path}`]));

  const reasons = [];
  const stop = reason => {
    if (!dryRun) throw new Error(reason);
    reasons.push(reason);
  };

  const temp = mkdtempSync(join(tmpdir(), 'swiftplot-release-'));
  try {
    const exportAt = commit => {
      const source = join(temp, commit);
      mkdirSync(source);
      git('archive', '--format=tar', '-o', join(temp, 'export.tar'), commit);
      call('tar', ['-xf', 'export.tar', '-C', commit], temp);
      rmSync(join(temp, 'export.tar'));
      return source;
    };

    const head = git('rev-parse', 'HEAD').trim();
    let commit = head;
    let source = exportAt(head);
    const version = shared(source);
    const tag = `v${version}`;
    if (version === '0.0.0') stop('0.0.0 is never released');
    const tags = remoteTags(dir, run);
    if (tags.has(version)) {
      commit = tags.get(version);
      if (commit !== head) {
        if (run('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: dir }).code !== 0)
          throw new Error(
            `the tag ${tag} is on ${commit}, which this clone does not have: git fetch origin tag ${tag}`,
          );
        source = exportAt(commit);
        const there = shared(source);
        if (there !== version)
          throw new Error(`the tag ${tag} is on ${commit}, whose packages say ${there}, not ${version}`);
      }
    }
    if (npm) {
      const held = manifests(source)
        .map(path => JSON.parse(readFileSync(path, 'utf8')))
        .filter(pkg => pkg.private)
        .map(pkg => pkg.name);
      if (held.length)
        stop(
          `npm refuses private packages: ${held.join(', ')} ${held.length > 1 ? 'are' : 'is'} "private" at ${commit}, so npm is blocked`,
        );
    }
    const changelog = join(source, 'CHANGELOG.md');
    const notes = existsSync(changelog) ? (section(readFileSync(changelog, 'utf8'), version) ?? '') : '';
    if (!tags.has(version)) {
      if (git('status', '--porcelain', '--untracked-files=normal').trim())
        stop('the working tree is not clean');
      const main = git('ls-remote', 'origin', 'refs/heads/main').split('\t')[0].trim();
      if (main !== head)
        stop(`HEAD ${head} is not origin/main (${main || 'missing'}): the commit is not on main`);
      const top = highest([...tags.keys()]);
      if (top !== undefined && !higher(version, top))
        stop(`${version} is not higher than the tag v${top} on origin`);
      if (!notes) stop(`CHANGELOG.md has no entries for ${version}`);
    }
    const existing = findRelease({ call, repo, tag });
    const state = !existing ? 'none' : existing.draft ? 'draft' : 'published';
    if (state === 'published' && !tags.has(version))
      throw new Error(`the release ${tag} is published but origin has no tag ${tag}`);

    if (state !== 'published') {
      try {
        await checks({ api, commit, sleep, now, print, wait: !dryRun });
      } catch (error) {
        stop(`${error.message}: no successful workflow run`);
      }
    }

    const cache = join(dir, '.release', version);
    const fresh = () => build({ source, out: join(temp, 'tarballs'), version, run, pnpmCommand });
    let files;
    if (state === 'published')
      files = fromRelease({ release: existing, version, tag, repo, out: join(temp, 'release'), call });
    else if (!existsSync(cache)) files = fresh();
    else
      try {
        files = fromCache({ cache, version, commit });
      } catch (error) {
        stop(error.message);
        files = fresh();
      }
    const listing = describe(files);
    if (!dryRun && state !== 'published' && !existsSync(cache))
      store({ files, cache, version, commit, time: new Date(now()).toISOString() });

    const prerelease = version.includes('-');
    print(`Release ${tag} of ${repo}`);
    print(`  commit:      ${commit}${commit === head ? '' : ` (the tag's commit; HEAD is ${head})`}`);
    print(`  pre-release: ${prerelease ? 'yes' : 'no'}`);
    print('  files:');
    for (const f of listing) print(`    ${f.name}  ${f.size} bytes  sha256 ${f.sha256}`);
    print('  notes:');
    print((notes || '(none)').replace(/^/gm, '    '));
    print('Next:');
    print(
      tags.has(version)
        ? `  the tag ${tag} is on that commit`
        : `  create the tag ${tag} on ${commit} on origin`,
    );
    print(
      {
        none: `  create a draft GitHub Release ${tag}, upload the four files, publish it`,
        draft: `  finish the draft GitHub Release ${tag}: upload what is missing, publish it`,
        published: `  the GitHub Release ${tag} is published and stays as it is`,
      }[state],
    );
    if (npm)
      print(
        `  publish the release's files to npm (${REGISTRY}) in the order ${PACKAGES.join(', ')}${prerelease ? ' with the tag next' : ''}`,
      );
    const result = { version, tag, commit, state, files: listing, notes, prerelease };
    if (dryRun) {
      print('Dry run: nothing was written.');
      if (reasons.length) {
        print('A real run would stop here, so this is a preview of the tarballs only:');
        for (const reason of reasons) print(`  - ${reason}`);
      }
      return { ...result, reasons };
    }
    const answer = await ask(`Type ${version} to release it, anything else stops: `);
    if (answer !== version) throw new Error('not confirmed; nothing was written to GitHub or npm');
    const url = githubRelease({
      dir,
      run,
      repo,
      version,
      commit,
      prerelease,
      notes,
      files,
      listing,
      checked: state !== 'published',
      temp,
      print,
    });
    print(`Released ${tag}: the tag is on ${commit}, the GitHub Release is ${url}`);
    if (!npm) {
      print('npm publishing skipped. To publish these files to npm later, run: pnpm release --npm');
      return { ...result, url };
    }
    let assets = files;
    if (state !== 'published') {
      const published = findRelease({ call, repo, tag });
      if (published?.draft !== false)
        throw new Error(`the release ${tag} is not published; nothing was sent to npm`);
      assets = fromRelease({ release: published, version, tag, repo, out: join(temp, 'published'), call });
      if (JSON.stringify(describe(assets)) !== JSON.stringify(listing))
        throw new Error(
          `the published release ${tag} does not hold the confirmed files; nothing was sent to npm`,
        );
    }
    const npmStatus = npmPublish({
      dir,
      run,
      version,
      prerelease,
      files: assets,
      print,
      npmCommand: npmCommand ?? npmBin(),
    });
    return { ...result, url, npm: npmStatus };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.on('close', () => resolve(null));
    rl.question(question, answer => {
      resolve(answer);
      rl.close();
    });
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--dry-run' && arg !== '--npm'))
      throw new Error('usage: pnpm release [--npm] [--dry-run]');
    await release({
      dir: fileURLToPath(new URL('..', import.meta.url)),
      run: realRun,
      dryRun: args.includes('--dry-run'),
      npm: args.includes('--npm'),
      ask,
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    });
  } catch (error) {
    console.error(`release: ${error.message}`);
    process.exitCode = 1;
  }
}
