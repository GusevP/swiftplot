import { fromLinks, sankey } from '../marks/sankey.js';
import { sunburst } from '../marks/sunburst.js';
import { fromTree, type Nested, type TreeColumns } from '../marks/tree.js';
import { treemap, type TreemapOptions } from '../marks/treemap.js';
import type { Mark, Options } from '../types.js';
import { defined, easyChart, featuresOf, given, install, noAxes, sizeOf } from './build.js';
import type { Build } from './controller.js';
import { colorsFor, formatNumber, namesOf } from './defaults.js';
import { reader, type Field } from './fields.js';
import type { Column, Source } from './source.js';
import type { Base, SankeyProps, TreemapProps } from './types.js';

type LinkFields<R> = { source?: Field<R>; target?: Field<R>; value?: Field<R> };
type SankeyInput = Base &
  LinkFields<never> &
  Pick<SankeyProps<undefined>, 'blend' | 'text'> & { data?: unknown };
type Links = ReturnType<typeof fromLinks> & { label: string; totals: Float64Array };
type TreeInput = Base & Pick<TreemapProps, 'data' | 'shade' | 'text'>;
type Tree = TreeColumns & { branches: number; totals: Float64Array };

const SANKEY = 'sankeyChart';

const worth = (v: number) => (v > 0 && Number.isFinite(v) ? v : 0);
// Only finite sizes are added up, so a total that is not finite is a sum past the largest number.
const formatTotal = (v: number) => (Number.isFinite(v) ? formatNumber(v) : 'over 1.79e+308');
const hidden = (text: boolean | undefined) => (text === false ? false : undefined);

/** Runs a step of the core, whose errors start with its own name, under the chart's. */
function under<T>(name: string, step: () => T): T {
  try {
    return step();
  } catch (e) {
    throw new Error(`${name}: ${(e as Error).message.replace(/^\w+: /, '')}`, { cause: e });
  }
}

function links<R>(s: Source<R>, p: LinkFields<R>): Links | undefined {
  const { kinds, fail, check, sole, read, numeric } = reader(s, SANKEY);
  if (!s.length) return undefined;
  if (s.shape)
    fail(
      'a list of numbers or pairs has no links',
      'rows or columns with fields for source, target and value',
    );
  const pool = check(
    [
      ['source', p.source],
      ['target', p.target],
      ['value', p.value],
    ],
    ['value'],
  );
  const named = pool.filter(f => kinds.get(f) === 'text');
  const end = (role: 'source' | 'target') =>
    p[role] ??
    named.shift() ??
    fail(`there is no field of text left for ${role}`, `${role} as a field of the nodes' names`);
  const from = end('source');
  const to = end('target');
  const value = sole('value', p.value, pool);

  const { values } = numeric(value, 'value');
  const ends = [
    read(from, 'the accessor source', 'source'),
    read(to, 'the accessor target', 'target'),
  ] as const;
  const namer = ({ kind, categories }: Column) =>
    namesOf(
      kind,
      categories,
      ends.filter(c => c.kind === kind).map(c => c.values),
      true,
    );
  const [source, target] = ends;
  const [sourceName, targetName] = [namer(source), namer(target)];
  const list: Parameters<typeof fromLinks>[0] = [];
  for (let i = 0; i < s.length; i++) {
    const [a, b] = [source.values[i]!, target.values[i]!];
    if (Number.isFinite(a) && Number.isFinite(b))
      list.push({ source: sourceName(a), target: targetName(b), value: values[i]! });
  }
  const flow = fromLinks(list);
  const [out, into] = [new Float64Array(flow.nodes.length), new Float64Array(flow.nodes.length)];
  flow.value.forEach((v, i) => {
    out[flow.source[i]!]! += worth(v);
    into[flow.target[i]!]! += worth(v);
  });
  return {
    ...flow,
    label: typeof value === 'string' ? value : 'value',
    totals: out.map((v, i) => Math.max(v, into[i]!)),
  };
}

const sankeyBuild: Build<SankeyInput> = (p, { source: s, theme, memo }) => {
  if (s.length) {
    for (const k of ['x', 'y', 'label', 'series'])
      if (given(p, k)) throw new Error(`${SANKEY}: use source, target and value, not ${k}`);
    noAxes(p, SANKEY);
  }
  const picked = memo('fields', [s, p.source, p.target, p.value], () => links(s, p));
  const colors = colorsFor(theme, p.colors, picked?.nodes.length ?? 0);
  const marks = memo('marks', [picked, p.blend, hidden(p.text), ...colors], (): Mark[] => {
    if (!picked) return [];
    const { nodes, source, target, value, label } = picked;
    return under(SANKEY, () => [
      sankey(
        defined({
          key: 'sankey',
          label,
          nodes,
          source,
          target,
          value,
          colors,
          blend: p.blend,
          text: hidden(p.text),
        }),
      ),
    ]);
  });
  const features = featuresOf({ ...p, zoom: false }, 0);
  const ref = memo<{ current?: Links }>('tooltip', [], () => ({}));
  ref.current = picked;
  return {
    options: { ...sizeOf(p), theme, frame: 'blank', marks },
    features,
    use: () => {
      ref.current = picked;
      return install(features, {
        mode: 'nearest',
        text: (_label, _x, _y, row) => {
          const { nodes, source, target, value, totals } = ref.current!;
          const link = row! - nodes.length;
          return link < 0
            ? `${nodes[row!]}: ${formatTotal(totals[row!]!)}`
            : `${nodes[source[link]!]} → ${nodes[target[link]!]}: ${formatNumber(worth(value[link]!))}`;
        },
      });
    },
  };
};

function grown(data: TreeInput['data'], name: string): Tree | undefined {
  if (!data || !Object.keys(data).length) return undefined;
  const tree = under(name, () => {
    const bad = (cause?: unknown) =>
      new Error('data must be a root { name, value, children } or a list of roots', { cause });
    try {
      const made = fromTree(data as Nested | Nested[]);
      if (made.nodes.some(n => typeof n !== 'string')) throw bad();
      return made;
    } catch (e) {
      throw e instanceof TypeError ? bad(e) : e;
    }
  });
  const { nodes, parent, value } = tree;
  const totals = new Float64Array(nodes.length);
  const leaf = new Uint8Array(nodes.length).fill(1);
  for (const at of parent) if (at >= 0) leaf[at] = 0;
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (leaf[i]) totals[i] = worth(value[i]!);
    if (parent[i]! >= 0) totals[parent[i]!]! += totals[i]!;
  }
  const below = (at: number) => parent.filter(up => up === at).length;
  const roots = below(-1);
  return { ...tree, totals, branches: roots > 1 ? roots : below(0) || 1 };
}

function trees(
  kind: 'treemap' | 'sunburst',
  frame: Options['frame'],
  draw: (o: TreemapOptions) => Mark,
): Build<TreeInput> {
  const name = `${kind}Chart`;
  return (p, { source: s, theme, memo }) => {
    // The source stands for the data: a new one is made when the data or its version changes.
    const tree = memo('tree', [s], () => grown(p.data, name));
    if (tree) {
      for (const k of ['x', 'y', 'series', 'label', 'value', 'source', 'target'])
        if (given(p, k))
          throw new Error(`${name}: ${k} does not apply, as data is a tree of { name, value, children }`);
      noAxes(p, name);
    }
    const colors = colorsFor(theme, p.colors, tree?.branches ?? 0);
    const marks = memo('marks', [tree, p.shade, hidden(p.text), ...colors], () => {
      if (!tree) return [];
      const { nodes, parent, value } = tree;
      return [
        draw(defined({ key: kind, nodes, parent, value, colors, shade: p.shade, text: hidden(p.text) })),
      ];
    });
    const features = featuresOf({ ...p, zoom: false }, 0);
    const ref = memo<{ current?: Tree }>('tooltip', [], () => ({}));
    ref.current = tree;
    return {
      options: { ...sizeOf(p), theme, frame, marks },
      features,
      use: () => {
        ref.current = tree;
        return install(features, {
          mode: 'nearest',
          text: (_label, _x, _y, row) => {
            const { nodes, parent, totals } = ref.current!;
            const path: string[] = [];
            for (let i = row!; i >= 0; i = parent[i]!) path.push(nodes[i]!);
            return `${path.reverse().join(' · ')}: ${formatTotal(totals[row!]!)}`;
          },
        });
      },
    };
  };
}

export const sankeyChart = easyChart<'sankey'>(sankeyBuild);
export const treemapChart = easyChart<'treemap'>(trees('treemap', 'blank', treemap));
export const sunburstChart = easyChart<'sunburst'>(trees('sunburst', 'polar', sunburst));
