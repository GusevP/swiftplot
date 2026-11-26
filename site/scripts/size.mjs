import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { build } from 'vite';

const root = resolve(import.meta.dirname, 'size');

async function gzipBytes(input) {
  const out = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    build: { write: false, rollupOptions: { input, external: /^(react|react-dom|vue)(\/|$)/ } },
  });
  return [out]
    .flat()
    .flatMap(o => o.output)
    .reduce(
      (bytes, file) => (file.type === 'chunk' ? bytes + gzipSync(file.code, { level: 9 }).length : bytes),
      0,
    );
}

const sizes = {};
for (const file of readdirSync(root)
  .filter(f => f.endsWith('.js'))
  .sort())
  sizes[file.replace(/\.js$/, '')] = +((await gzipBytes(resolve(root, file))) / 1024).toFixed(1);
writeFileSync(resolve(root, 'sizes.json'), JSON.stringify(sizes, null, 2) + '\n');
console.table(sizes);
