import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { remoteTags } from './prepare.mjs';

export const caller =
  (run, dir) =>
  (command, args, cwd = dir) => {
    const out = run(command, args, { cwd });
    if (out.code !== 0)
      throw new Error(`${command} ${args.join(' ')} failed: ${(out.stderr || out.stdout).trim()}`);
    return out.stdout;
  };

export function findRelease({ call, repo, tag }) {
  const found = call('gh', [
    'api',
    '--hostname',
    'github.com',
    '--paginate',
    '--jq',
    `.[] | select(.tag_name == ${JSON.stringify(tag)})`,
    `repos/${repo}/releases?per_page=100`,
  ])
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
  if (found.length > 1) throw new Error(`${found.length} releases on GitHub have the tag ${tag}`);
  return found[0];
}

const matches = (asset, file) =>
  asset.state === 'uploaded' &&
  Number.isSafeInteger(asset.size) &&
  asset.size === file.size &&
  asset.digest === `sha256:${file.sha256}`;

function differences(release, listing) {
  const problems = [];
  for (const asset of release.assets) {
    const file = listing.find(f => f.name === asset.name);
    if (!file) problems.push(`${JSON.stringify(asset.name)} is not expected`);
    else if (!matches(asset, file))
      problems.push(`${file.name} is not the expected ${file.size} bytes with sha256 ${file.sha256}`);
  }
  for (const file of listing)
    if (!release.assets.some(asset => asset.name === file.name)) problems.push(`${file.name} is missing`);
  return problems;
}

export function githubRelease({
  dir,
  run,
  repo,
  version,
  commit,
  prerelease,
  notes,
  files,
  listing,
  checked,
  temp,
  print,
}) {
  const call = caller(run, dir);
  const tag = `v${version}`;
  const tagAt = () => remoteTags(dir, run).get(version);
  const find = () => findRelease({ call, repo, tag });

  const tagged = tagAt();
  let release = find();
  if (tagged && tagged !== commit)
    throw new Error(`the tag ${tag} on origin is on ${tagged}, not ${commit}; nothing was written`);
  if (!checked && (!tagged || release?.draft !== false))
    throw new Error(
      `the release ${tag} is no longer published with its tag, and its checks were not looked at; run again`,
    );

  if (!tagged) {
    print(`Creating the tag ${tag} on ${commit} on origin.`);
    if (run('git', ['push', 'origin', `${commit}:refs/tags/${tag}`], { cwd: dir }).code !== 0)
      throw new Error(`pushing the tag ${tag} on ${commit} to origin failed; run again to continue`);
    if (tagAt() !== commit)
      throw new Error(`origin does not show the tag ${tag} on ${commit} after the push`);
  }

  if (!release) {
    print(`Creating the draft GitHub Release ${tag}.`);
    const notesFile = join(temp, 'notes.md');
    writeFileSync(notesFile, notes);
    call('gh', [
      'release',
      'create',
      tag,
      '--repo',
      repo,
      '--draft',
      '--verify-tag',
      '--title',
      tag,
      '--notes-file',
      notesFile,
      ...(prerelease ? ['--prerelease'] : []),
    ]);
    release = find();
    if (!release?.draft) throw new Error(`GitHub does not show the draft release ${tag} just created`);
  }

  if (release.draft) {
    const unexpected = release.assets.filter(asset => !listing.some(f => f.name === asset.name));
    if (unexpected.length)
      throw new Error(
        `the draft release ${tag} has assets that are not expected: ${unexpected.map(a => JSON.stringify(a.name)).join(', ')}; delete them on GitHub and run again. Nothing was published`,
      );
    for (const file of listing) {
      const asset = release.assets.find(a => a.name === file.name);
      if (asset && matches(asset, file)) continue;
      if (asset) {
        print(`Deleting ${file.name} from the draft: it is not the expected file.`);
        call('gh', ['release', 'delete-asset', tag, file.name, '--repo', repo, '--yes']);
      }
      const path = join(files, file.name);
      // gh release upload reads "#" in a file argument as the start of a label.
      if (path.includes('#')) throw new Error(`cannot upload ${path}: gh reads "#" in it as a label`);
      print(`Uploading ${file.name}.`);
      call('gh', ['release', 'upload', tag, path, '--repo', repo]);
    }
    release = find();
    const problems = release ? differences(release, listing) : ['it is gone'];
    if (problems.length)
      throw new Error(`the draft release ${tag} was not published:\n  ${problems.join('\n  ')}`);
    print(`Publishing the GitHub Release ${tag}.`);
    call('gh', ['release', 'edit', tag, '--repo', repo, '--draft=false', `--prerelease=${prerelease}`]);
    release = find();
    if (release?.draft !== false) throw new Error(`GitHub does not show the release ${tag} as published`);
  }

  const problems = differences(release, listing);
  if (release.prerelease !== prerelease)
    problems.push(prerelease ? 'it is not marked as a pre-release' : 'it is marked as a pre-release');
  const at = tagAt();
  if (at !== commit) problems.push(`the tag ${tag} is on ${at ?? 'no commit'}, not ${commit}`);
  if (problems.length)
    throw new Error(
      `the published release ${tag} is not the one confirmed, and this command never changes it:\n  ${problems.join('\n  ')}`,
    );
  return `https://github.com/${repo}/releases/tag/${tag}`;
}
