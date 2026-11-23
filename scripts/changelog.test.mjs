import assert from 'node:assert/strict';
import test from 'node:test';
import { promote, section } from './changelog.mjs';

const text = `# Changelog

## Unreleased

- new thing

## 0.1.0 - 2026-12-01

- first

### Fixed

- a fix

## 0.1.0-rc.0 - 2026-11-30

- candidate

## 0.0.1 - 2026-11-01
`;

const crlf = s => s.replaceAll('\n', '\r\n');

test('section returns the trimmed body up to the next ## heading', () => {
  assert.equal(section(text, '0.1.0'), '- first\n\n### Fixed\n\n- a fix');
  assert.equal(section(text, '0.1.0-rc.0'), '- candidate');
  assert.equal(section(text, 'Unreleased'), '- new thing');
});

test('section returns null for an absent version and an empty string for an empty one', () => {
  assert.equal(section(text, '0.2.0'), null);
  assert.equal(section(text, '0.1'), null);
  assert.equal(section(text, '0.0.1'), '');
  assert.equal(section('## Unreleased\n   \n## 0.1.0 - 2026-12-01\n- x', 'Unreleased'), '');
});

test('section tolerates Windows line endings and a missing final newline', () => {
  assert.equal(section(crlf(text), '0.1.0'), '- first\n\n### Fixed\n\n- a fix');
  assert.equal(section(crlf(text).trimEnd(), '0.0.1'), '');
  assert.equal(section('## Unreleased\r\n\r\n- a\r\n- b', 'Unreleased'), '- a\n- b');
});

test('promote moves Unreleased under the version, above the older versions', () => {
  const out = promote(text, '0.2.0', '2026-12-10');
  assert.equal(section(out, 'Unreleased'), '');
  assert.equal(section(out, '0.2.0'), '- new thing');
  assert.ok(
    out.startsWith('# Changelog\n\n## Unreleased\n\n## 0.2.0 - 2026-12-10\n\n- new thing\n\n## 0.1.0 - '),
  );
  assert.equal(section(out, '0.1.0'), section(text, '0.1.0'));
  assert.ok(out.endsWith('## 0.0.1 - 2026-11-01\n'));
});

test('promote of a release after its candidate keeps the candidate section', () => {
  const rc = promote('# Changelog\n\n## Unreleased\n\n- a\n', '0.1.0-rc.0', '2026-11-30');
  const out = promote(rc.replace('## Unreleased\n', '## Unreleased\n\n- b\n'), '0.1.0', '2026-12-01');
  assert.equal(
    out,
    '# Changelog\n\n## Unreleased\n\n## 0.1.0 - 2026-12-01\n\n- b\n\n## 0.1.0-rc.0 - 2026-11-30\n\n- a\n',
  );
});

test('promote throws when Unreleased is missing or empty, or the version has a section', () => {
  assert.throws(
    () => promote('# Changelog\n\n## 0.1.0 - 2026-12-01\n', '0.2.0', '2026-12-10'),
    /no "## Unreleased"/,
  );
  assert.throws(() => promote('# Changelog\n\n## Unreleased\n  \n', '0.2.0', '2026-12-10'), /is empty/);
  assert.throws(() => promote(text, '0.1.0', '2026-12-10'), /already has a section for 0\.1\.0/);
  assert.throws(() => promote(text, '0.1.0-rc.0', '2026-12-10'), /already has a section/);
});

test('promote tolerates Windows line endings and a missing final newline, and keeps the line endings', () => {
  const out = promote(crlf(text).trimEnd(), '0.2.0', '2026-12-10');
  assert.equal(out, crlf(promote(text, '0.2.0', '2026-12-10')));
  assert.doesNotMatch(out, /[^\r]\n/);
  assert.equal(
    promote('## Unreleased\n- a', '0.2.0', '2026-12-10'),
    '## Unreleased\n\n## 0.2.0 - 2026-12-10\n\n- a\n',
  );
});
