import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { higher, next, setShared, shared } from './version.mjs';

function workspace(versions) {
  const dir = mkdtempSync(join(tmpdir(), 'swiftplot-version-'));
  for (const [name, version] of Object.entries(versions)) {
    mkdirSync(join(dir, 'packages', name), { recursive: true });
    writeFileSync(
      join(dir, 'packages', name, 'package.json'),
      `{\n  "name": "${name}",\n  "version": "${version}",\n  "files": ["dist"],\n  "peerDependencies": { "x": "1.0.0" }\n}\n`,
    );
  }
  return dir;
}

test('shared returns the one version, and throws naming the packages when they differ', t => {
  const same = workspace({ core: '0.1.0', react: '0.1.0', vue: '0.1.0' });
  const differ = workspace({ core: '0.1.0', react: '0.2.0', vue: '0.1.0' });
  t.after(() => [same, differ].forEach(dir => rmSync(dir, { recursive: true })));
  assert.equal(shared(same), '0.1.0');
  assert.throws(() => shared(differ), /core 0\.1\.0, react 0\.2\.0, vue 0\.1\.0/);
});

test('setShared changes only the top-level version line', t => {
  const dir = workspace({ core: '0.0.0', react: '0.0.0' });
  t.after(() => rmSync(dir, { recursive: true }));
  const before = readFileSync(join(dir, 'packages/core/package.json'), 'utf8');
  setShared(dir, '0.1.0-rc.0');
  assert.equal(shared(dir), '0.1.0-rc.0');
  assert.equal(
    readFileSync(join(dir, 'packages/core/package.json'), 'utf8'),
    before.replace('"0.0.0"', '"0.1.0-rc.0"'),
  );
  assert.throws(() => setShared(dir, '1.0'), /not a version/);
});

test('next bumps patch, minor and major, takes an exact version and rejects anything else', () => {
  assert.equal(next('0.1.0', 'patch'), '0.1.1');
  assert.equal(next('0.1.0', 'minor'), '0.2.0');
  assert.equal(next('0.1.0', 'major'), '1.0.0');
  assert.equal(next('0.1.0', '0.1.1-rc.0'), '0.1.1-rc.0');
  assert.equal(next('0.1.0-rc.0', 'patch'), '0.1.0');
  assert.equal(next('0.1.0-rc.0', 'minor'), '0.1.0');
  assert.equal(next('0.1.1-rc.0', 'minor'), '0.2.0');
  assert.equal(next('1.0.0-rc.0', 'major'), '1.0.0');
  for (const bad of ['v0.2.0', '0.2', '01.0.0', '0.2.0-', '0.2.0-rc..1', 'premajor', '']) {
    assert.throws(() => next('0.1.0', bad), /not a version/);
  }
  assert.throws(() => next('0.1', 'patch'), /not a version/);
  assert.equal(next('9007199254740992.0.0', 'major'), '9007199254740993.0.0');
});

test('higher orders versions, pre-releases below their release and numerically', () => {
  const ordered = [
    '0.0.0',
    '0.1.0-rc.0',
    '0.1.0-rc.1',
    '0.1.0-rc.9',
    '0.1.0-rc.10',
    '0.1.0',
    '0.1.1-rc.9007199254740992',
    '0.1.1-rc.9007199254740993',
    '0.1.1',
    '0.2.0',
    '1.0.0',
    '9007199254740992.0.0',
    '9007199254740993.0.0',
  ];
  for (let i = 1; i < ordered.length; i++) {
    assert.equal(higher(ordered[i], ordered[i - 1]), true, `${ordered[i]} > ${ordered[i - 1]}`);
    assert.equal(higher(ordered[i - 1], ordered[i]), false, `${ordered[i - 1]} < ${ordered[i]}`);
  }
  assert.equal(higher('0.1.0', '0.1.0'), false);
  assert.equal(higher('0.1.0-rc.1', '0.1.0-rc'), true);
  assert.equal(higher('0.1.0-rc', '0.1.0-1'), true);
  assert.throws(() => higher('0.1.0', 'x'), /not a version/);
});
