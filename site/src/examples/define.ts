import { plain } from 'swiftplot/charts';
import {
  checkIds,
  contents,
  evaluate,
  evaluateProps,
  put,
  setIn,
  type Data,
  type Slots,
  type Tree,
} from './tree';

export const chartNames = [
  'lineChart',
  'areaChart',
  'barChart',
  'scatterChart',
  'pieChart',
  'funnelChart',
  'radialBarChart',
  'radarChart',
  'heatmapChart',
  'histogramChart',
  'boxPlotChart',
  'candlestickChart',
  'sankeyChart',
  'treemapChart',
  'sunburstChart',
  'comboChart',
] as const;
export type ChartName = (typeof chartNames)[number];

export const referencePath = (name: string) =>
  `/reference/${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;

export const tagLabels: Readonly<Record<string, string>> = {
  time: 'Change over time',
  compare: 'Compare categories',
  stack: 'Stacked',
  rows: 'From rows',
  zoom: 'Zoom',
  large: 'Large data',
  share: 'Part of a whole',
  gradient: 'Gradients',
};

type OneTarget =
  | { kind: 'boolean'; value: boolean; puts?: { on: unknown; off: unknown } }
  | { kind: 'choice'; values: readonly string[]; value: string; puts?: Readonly<Record<string, unknown>> };

/** What an easy switch gives its prop for each UI value: a literal, a node or `omit`; the UI value itself when left out. Or, with `sets` in place of a prop, the puts each UI value makes. */
export type Switch =
  | ({ prop: string; label: string; sets?: never } & OneTarget)
  | ({ id: string; label: string; prop?: never } & Several<{ prop: string; value: unknown }>);

export type Put = { target: string; value: unknown };

/** What a plot switch puts at its target for each UI value: a literal, a node or `omit`; the UI value itself when left out. Or, with `sets` in place of a target, the puts each UI value makes. */
export type PlotSwitch = { id: string; label: string } & (
  | ({ target: string; sets?: never } & OneTarget)
  | ({ target?: never } & Several<Put>)
);

type Several<P> =
  | { kind: 'boolean'; value: boolean; sets: { on: readonly P[]; off: readonly P[] } }
  | {
      kind: 'choice';
      values: readonly string[];
      value: string;
      sets: Readonly<Record<string, readonly P[]>>;
    };

type Kinds<V> =
  | ({ kind: 'boolean'; value: boolean } & (boolean extends V
      ? { puts?: { on: V; off: V } }
      : { puts: { on: V; off: V } }))
  | { kind: 'choice'; values: readonly string[]; value: string; puts: Readonly<Record<string, V>> }
  | {
      kind: 'choice';
      values: readonly (unknown extends V ? string : Extract<V, string>)[];
      value: unknown extends V ? string : Extract<V, string>;
      puts?: undefined;
    };
type Typed<S> = S extends { target: infer P; value: infer V }
  ? { id: string; label: string; target: P; sets?: never } & Kinds<V>
  : never;
/** A plot switch checked against the tree: its target exists in the core options and it puts values they take. */
export type SwitchFor<T extends Tree> = string extends T['marks'][number]['id']
  ? PlotSwitch & {
      tree: 'declare the tree with `satisfies Tree`, not a `Tree` annotation, so its switches are checked';
    }
  : Typed<Slots<T>> | ({ id: string; label: string; target?: never } & Several<Slots<T>>);

type Page = {
  id: string;
  title: string;
  summary: string;
  group: string;
  tags: readonly string[];
  notes: readonly string[];
};

export type EasyExample = Page & {
  kind?: 'easy';
  chart: ChartName;
  data: Data;
  props: Record<string, unknown>;
  live?: Tree['live'];
  /** Leaves `colors` to the chart, for one with more categories than the site has colours. */
  palette?: true;
  switches: readonly Switch[];
};

export type PlotExample = Page & {
  kind: 'plot';
  tree: Tree;
  data: Data;
  switches: readonly PlotSwitch[];
};

export type Example = EasyExample | PlotExample;

export type State = Record<string, unknown>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const switchKey = (s: Switch | PlotSwitch) =>
  'prop' in s && s.prop !== undefined ? s.prop : (s as { id: string }).id;

/** The puts a switch makes at the UI value `value`: an easy switch's target is its prop. */
export function putsOf(s: Switch | PlotSwitch, value: unknown): readonly Put[] {
  const key = typeof value === 'boolean' ? (value ? 'on' : 'off') : String(value);
  if (s.sets) {
    const sets: Readonly<Record<string, readonly (Put | { prop: string; value: unknown })[]>> = s.sets;
    if (!Object.hasOwn(sets, key)) return [];
    return sets[key]!.map(p => ('prop' in p ? { target: p.prop, value: p.value } : p));
  }
  const puts: Readonly<Record<string, unknown>> | undefined = s.puts;
  const target = 'prop' in s ? s.prop : s.target;
  return [{ target, value: puts && Object.hasOwn(puts, key) ? puts[key] : value }];
}

export const targetsOf = (s: Switch | PlotSwitch): string[] =>
  s.sets
    ? Object.values(s.sets)
        .flat()
        .map(p => ('prop' in p ? p.prop : p.target))
    : ['prop' in s ? s.prop : s.target];

const settings = (s: Switch | PlotSwitch): unknown[] =>
  s.kind === 'boolean' ? [s.value, !s.value] : [s.value, ...s.values.filter(v => v !== s.value)];

/** The switch states the site checks: every combination of up to four switches, else each flipped alone and all flipped. */
export function checkedStates(switches: readonly (Switch | PlotSwitch)[]): State[] {
  if (switches.length <= 4)
    return switches.reduce<State[]>(
      (states, s) => states.flatMap(state => settings(s).map(v => ({ ...state, [switchKey(s)]: v }))),
      [{}],
    );
  const flipped = switches.flatMap(s =>
    settings(s)
      .slice(1, 2)
      .map(v => [switchKey(s), v] as const),
  );
  return [{}, ...flipped.map(([k, v]) => ({ [k]: v })), Object.fromEntries(flipped)];
}

const isJson = (v: unknown): boolean =>
  v === null ||
  typeof v === 'string' ||
  typeof v === 'boolean' ||
  (typeof v === 'number' && Number.isFinite(v)) ||
  (plain(v) && (!Array.isArray(v) || Object.keys(v).length === v.length) && Object.values(v).every(isJson));

export function example(input: EasyExample): EasyExample;
export function example<T extends Tree>(
  input: Omit<PlotExample, 'tree' | 'switches'> & { tree: T; switches: readonly NoInfer<SwitchFor<T>>[] },
): PlotExample;
export function example(input: Example): Example {
  const fail = (problem: string): never => {
    throw new Error(`example "${input.id}": ${problem}`);
  };
  if (!SLUG.test(input.id)) fail('the id is not a URL slug');
  for (const tag of input.tags) {
    if (!SLUG.test(tag)) fail(`the tag "${tag}" is not a URL slug`);
    if (!Object.hasOwn(tagLabels, tag)) fail(`the tag "${tag}" has no label in tagLabels`);
  }
  if (input.kind !== 'plot' && !(chartNames as readonly string[]).includes(input.chart))
    fail(`"${input.chart}" is not one of ${chartNames.join(', ')}`);
  const seen = new Set<string>();
  for (const s of input.switches) {
    const key = switchKey(s);
    if (seen.has(key)) fail(`duplicate switch "${key}"`);
    seen.add(key);
    for (const one of ['target', 'prop'])
      if (one in s && 'sets' in s) fail(`switch "${key}" has both a ${one} and sets`);
    if (s.kind === 'choice' && !s.values.includes(s.value))
      fail(`switch "${key}" starts at "${s.value}", which is not among ${JSON.stringify(s.values)}`);
    const byValue = s.kind !== 'choice' ? undefined : 'sets' in s ? s.sets : 'puts' in s ? s.puts : undefined;
    if (s.kind === 'choice' && byValue) {
      for (const v of Object.keys(byValue))
        if (!s.values.includes(v))
          fail(`switch "${key}" puts a value for "${v}", which is not among its values`);
      for (const v of s.values)
        if (!Object.hasOwn(byValue, v)) fail(`switch "${key}" puts nothing for its value "${v}"`);
    }
  }
  if (input.data.kind === 'json') {
    if (!isJson(input.data.value)) fail(`the data in ${input.data.file} holds a value JSON cannot carry`);
    if (input.kind === 'plot' ? input.tree.live : input.live) fail('a live block steps rows, not JSON data');
  }
  const duplicate = input.kind === 'plot' && checkIds(input.tree);
  if (duplicate) fail(duplicate);
  for (const state of checkedStates(input.switches)) {
    const resolved = <T>(make: () => T): T => {
      try {
        return make();
      } catch (error) {
        return fail(`in ${JSON.stringify(state)}, ${(error as Error).message}`);
      }
    };
    if (input.kind === 'plot') {
      const tree = resolved(() => resolve(input, state));
      const problem = checkIds(tree);
      if (problem) fail(`in ${JSON.stringify(state)}, ${problem}`);
      evaluate(tree, input.data, input.id);
    } else {
      const { data: _, ...props } = resolved(() => resolve(input, state));
      evaluateProps(props, input.data, input.id);
    }
  }
  return input;
}

export function registry(examples: readonly Example[]): ReadonlyMap<string, Example> {
  const byId = new Map<string, Example>();
  for (const e of examples) {
    if (byId.has(e.id)) throw new Error(`duplicate example id "${e.id}"`);
    byId.set(e.id, e);
  }
  return byId;
}

export function resolve(definition: EasyExample, state: State): Record<string, unknown>;
export function resolve(definition: PlotExample, state: State): Tree;
export function resolve(definition: Example, state: State): Record<string, unknown> | Tree {
  const puts = definition.switches.flatMap((s: Switch | PlotSwitch) => {
    const key = switchKey(s);
    return putsOf(s, Object.hasOwn(state, key) ? state[key] : s.value);
  });
  if (definition.kind === 'plot')
    return puts.reduce((tree, p) => put(tree, p.target, p.value), definition.tree);
  return puts.reduce<Record<string, unknown>>(
    (props, p) => setIn(props, p.target.split('.'), p.value, p.target),
    { data: contents(definition.data), ...definition.props },
  );
}

export function fromQuery(definition: Example, query: URLSearchParams): State {
  return Object.fromEntries(
    definition.switches.flatMap((s): [string, unknown][] => {
      const key = switchKey(s);
      const raw = query.get(key);
      if (s.kind === 'boolean') return raw === 'true' || raw === 'false' ? [[key, raw === 'true']] : [];
      return raw !== null && s.values.includes(raw) ? [[key, raw]] : [];
    }),
  );
}

export function exampleHref(id: string, state: State = {}): string {
  const query = new URLSearchParams(Object.entries(state).map(([k, v]) => [k, String(v)])).toString();
  return `/examples/${id}${query && `?${query}`}`;
}
