import { plain } from 'swiftplot/charts';
import { targetsOf, type EasyExample, type Example, type PlotExample } from '../examples/define';
import { evaluator, isNode } from '../examples/tree';
import type { Entry, Fn, Line } from './extract';

/** An entry of a reference page: an easy chart's, plot's, a mark's or a feature's, with the lines that describe it as the example uses it. */
export type Used = { page: string; entry: Entry; lines: Line[] };
type Api = Readonly<Record<string, Pick<Fn, 'accepts' | 'fits'>>>;
type Path = [page: string, name: string, shows: (line: Line) => boolean];

const keys = (args: unknown) => (plain(args) && !isNode(args) ? Object.keys(args) : []);
export const rows = (line: Line) => !line.shape || line.shape === 'rows';

function easyPaths(e: EasyExample, entries: readonly Entry[]): Path[] {
  const nested = (key: string) => entries.some(r => r.name.startsWith(`${key}.`));
  const paths = Object.entries(e.props).flatMap(([key, value]) =>
    keys(value).length && nested(key) ? keys(value).map(k => `${key}.${k}`) : [key],
  );
  const switched = e.switches.flatMap(targetsOf).map(target => {
    const [key] = target.split('.') as [string];
    return nested(key) ? target : key;
  });
  return [...paths, ...switched].map(path => [e.chart, path, rows]);
}

/** `<mark>.<arg>` and `<feature>.<arg>`: the arguments the tree gives, then those its switches target. */
function plotPaths({ id, tree, data, switches }: PlotExample, api: Api): Path[] {
  const nodes = [...tree.marks, ...(tree.use ?? [])];
  type Node = (typeof nodes)[number];
  const page = (n: Node) => (n.node === 'mark' ? n.mark : n.feature);
  const targeted = switches.flatMap(targetsOf).flatMap(target => {
    const [node, ...path] = target.split('.');
    const n = nodes.find(n => n.id === node);
    if (!n || !path.length || (n.node === 'feature' && target === `${node}.on`)) return [];
    if (path.length > 1 && !api[page(n)]?.accepts(path))
      fail(`example "${id}": "${page(n)}.${path.join('.')}" is not an option of ${page(n)} in the reference`);
    return [[n, path[0]!] as const];
  });
  const spread = tree.marks.some(m => m.spread) ? evaluator(tree, data, id).value : undefined;
  const own = (n: Node) => [
    ...(n.node === 'mark' && n.spread ? Object.keys(spread!(n.spread.call) as object) : []),
    ...keys(n.args),
  ];
  const shows = (n: Node): Path[2] => {
    const given = new Set([...own(n), ...targeted.filter(([t]) => t === n).map(([, k]) => k)]);
    return line => api[page(n)]?.fits(line, given) ?? true;
  };
  return [
    ...nodes.flatMap(n => own(n).map((k): Path => [page(n), k, shows(n)])),
    ...targeted.map(([n, k]): Path => [page(n), k, shows(n)]),
  ];
}

export function join(
  examples: Iterable<Example>,
  reference: Readonly<Record<string, readonly Entry[]>>,
  api: Api = {},
): Map<string, Used[]> {
  const options = new Map<string, Used[]>();
  for (const e of examples) {
    const paths = e.kind === 'plot' ? plotPaths(e, api) : easyPaths(e, reference[e.chart] ?? []);
    const used = new Map<string, Used>();
    for (const [page, name, shows] of paths) {
      const entry =
        reference[page]?.find(r => r.name === name) ??
        fail(
          `example "${e.id}": "${e.kind === 'plot' ? `${page}.` : ''}${name}" is not an option of ${page} in the reference`,
        );
      const at = used.get(`${page}.${name}`) ?? { page, entry, lines: [] };
      used.set(`${page}.${name}`, {
        ...at,
        lines: [...new Set([...at.lines, ...entry.lines.filter(shows)])],
      });
    }
    options.set(
      e.id,
      [...used.values()].map(u => (u.lines.length ? u : { ...u, lines: u.entry.lines })),
    );
  }
  return options;
}

function fail(message: string): never {
  throw new Error(message);
}
