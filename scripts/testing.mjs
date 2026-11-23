import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
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
