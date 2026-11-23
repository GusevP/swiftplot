const isHeading = (line, name) => line === `## ${name}` || line.startsWith(`## ${name} - `);

function find(lines, name) {
  const start = lines.findIndex(line => isHeading(line.trimEnd(), name));
  if (start < 0) return null;
  const next = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return { start, end: next < 0 ? lines.length : next };
}

export function section(text, name) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const found = find(lines, name);
  return (
    found &&
    lines
      .slice(found.start + 1, found.end)
      .join('\n')
      .trim()
  );
}

export function promote(text, version, date) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const unreleased = find(lines, 'Unreleased');
  if (!unreleased) throw new Error('CHANGELOG.md has no "## Unreleased" section');
  if (find(lines, version)) throw new Error(`CHANGELOG.md already has a section for ${version}`);
  const entries = lines
    .slice(unreleased.start + 1, unreleased.end)
    .join('\n')
    .trim();
  if (!entries) throw new Error('"## Unreleased" in CHANGELOG.md is empty');
  const out = [
    ...lines.slice(0, unreleased.start),
    '## Unreleased',
    '',
    `## ${version} - ${date}`,
    '',
    entries,
    '',
    ...lines.slice(unreleased.end),
  ];
  return out.join('\n').trimEnd().replaceAll('\n', eol) + eol;
}
