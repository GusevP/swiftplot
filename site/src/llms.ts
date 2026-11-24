import root from '../../llms.txt?raw';
import { chartNames, referencePath } from './examples/define';
import { examples } from './examples/index';
import { featureNames, markNames } from './examples/tree';
import { api, intros, scalesIntro } from './reference/index';

export type Guide = { id: string; title: string; summary: string; llms?: string };

export function llms(site: URL, guides: readonly Guide[]): string {
  const link = (label: string, path: string, line: string) => `- [${label}](${new URL(path, site)}): ${line}`;
  const section = (title: string, lines: string[]) => `## ${title}\n\n${lines.join('\n')}\n`;
  return [
    root.slice(0, root.indexOf('\n## ')),
    section('Docs', [
      link(
        'Guide for AI coding assistants',
        '/llms-full.txt',
        'which API to pick, every prop of the easy charts, data shapes, errors and their fixes, React and Vue usage, the explicit API and every mark, mistakes to avoid',
      ),
      ...guides.map(g => link(g.title, `/guides/${g.id}`, g.llms ?? g.summary)),
    ]),
    section('Reference', [
      ...chartNames.map(c => link(c, referencePath(c), intros[c])),
      link('plot', referencePath('plot'), api.plot!.intro),
      link('Scales and helpers', referencePath('scales'), scalesIntro),
      ...[...markNames, ...featureNames].map(n => link(n, referencePath(n), api[n]!.intro)),
    ]),
    section(
      'Examples',
      [...examples.values()].map(e => link(e.title, `/examples/${e.id}`, e.summary)),
    ),
    section('Optional', [link('Changelog', '/changelog', 'what changed in each version')]),
  ].join('\n');
}
