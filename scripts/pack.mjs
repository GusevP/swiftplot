import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSums } from './check-tarballs.mjs';
import { run } from './prepare.mjs';
import { manifests } from './version.mjs';

const COPIED = ['README.md', 'LICENSE'];

// pnpm sets npm_execpath to its JS entry for `pnpm run`; a bare `node scripts/pack.mjs` falls back to
// `pnpm` on PATH, which Windows cannot spawn without a shell.
export const pnpm = ({ npm_execpath: execpath } = process.env) =>
  execpath && /pnpm\.[cm]?js$/.test(execpath) ? [process.execPath, execpath] : ['pnpm'];

export function pack({ source, out, run, pnpmCommand = pnpm() }) {
  const packages = manifests(source).map(dirname);
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty`);
  for (const dir of packages) {
    if (!existsSync(join(dir, 'dist'))) throw new Error(`${dir} has no dist: run pnpm build first`);
    for (const name of COPIED) {
      if (existsSync(join(dir, name)))
        throw new Error(`${join(dir, name)} already exists; remove it and pack again`);
    }
  }
  mkdirSync(out, { recursive: true });
  const copies = [];
  try {
    for (const dir of packages) {
      for (const name of COPIED) {
        copyFileSync(join(source, name), join(dir, name), constants.COPYFILE_EXCL);
        copies.push(join(dir, name));
      }
    }
    const [command, ...prefix] = pnpmCommand;
    for (const dir of packages) {
      const result = run(command, [...prefix, 'pack', '--pack-destination', out], { cwd: dir });
      if (result.code !== 0) throw new Error(`pnpm pack failed in ${dir}:\n${result.stdout}${result.stderr}`);
    }
  } finally {
    for (const path of copies) rmSync(path, { force: true });
  }
  return writeSums(out);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.length !== 4)
      throw new Error('usage: node scripts/pack.mjs <source directory> <output directory>');
    process.stdout.write(pack({ source: resolve(process.argv[2]), out: resolve(process.argv[3]), run }));
  } catch (error) {
    console.error(`pack: ${error.message}`);
    process.exitCode = 1;
  }
}
