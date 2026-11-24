import {
  animate,
  arcs,
  area,
  band,
  bands,
  bar,
  bare,
  bin,
  box,
  brand,
  brush,
  candlestick,
  dark,
  dots,
  errorBars,
  fiveNumbers,
  fromLinks,
  fromTree,
  funnel,
  gradient,
  heatmap,
  legend,
  light,
  line,
  log,
  palette,
  paletteDark,
  radar,
  radialBars,
  rule,
  sankey,
  sequential,
  stack,
  sunburst,
  ticks,
  time,
  tooltip,
  treemap,
  zone,
  zoom,
  type Axis,
  type LogAxis,
  type Options,
} from 'swiftplot';
import { plain } from 'swiftplot/charts';

const marks = {
  arcs,
  area,
  bar,
  box,
  candlestick,
  dots,
  errorBars,
  funnel,
  heatmap,
  line,
  radar,
  radialBars,
  rule,
  sankey,
  sunburst,
  ticks,
  treemap,
  zone,
};
const features = { animate, brush, legend, tooltip, zoom };
const scales = { linear: (o: Axis): Axis => o, time, log, band, bare };
const helpers = { bands, bin, fiveNumbers, fromLinks, fromTree, gradient, sequential, stack };
const refs = { brand, dark, light, palette, paletteDark };

export type MarkName = keyof typeof marks;
export const markNames = Object.keys(marks) as MarkName[];
export type FeatureName = keyof typeof features;
export const featureNames = Object.keys(features) as FeatureName[];
export type ScaleName = keyof typeof scales;
export type HelperName = keyof typeof helpers;
export type RefName = keyof typeof refs;

export type Rows = readonly Record<string, unknown>[];
export type RowsData = { kind?: 'rows'; file: string; rows: Rows };
export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };
export type Data = RowsData | { kind: 'json'; file: string; value: Json };

declare const out: unique symbol;
type Shape =
  | { node: 'col'; name: string; as: 'number' | 'text' | 'time' }
  | { node: 'dataset' }
  | { node: 'ref'; name: RefName }
  | { node: 'call'; name: HelperName; args: readonly unknown[] }
  | { node: 'param'; name: string; value: unknown }
  | { node: 'fn'; source: string; impl: (...args: never[]) => unknown }
  | { node: 'scaled'; axis: string; of: unknown };
/** A value the tree computes; `T` is what it evaluates to, so a node in the wrong place fails typechecking. */
export type Node<T = unknown> = Shape & { readonly [out]?: T };
export type Spread<T = unknown> = { node: 'spread'; call: Node<T> };
export const omit = { node: 'omit' } as const;
export type Omitted = typeof omit;

export type Arg<T> =
  | Node<T>
  | (T extends (...args: never[]) => unknown ? never : T extends object ? Args<T> : T);
export type Args<T> = { [K in keyof T]: Arg<T[K]> };
type ArgList<P extends readonly unknown[]> = { [I in keyof P]: Arg<P[I]> };

export type MarkNode<Id extends string = string, K extends MarkName = MarkName, A = unknown> = {
  node: 'mark';
  id: Id;
  mark: K;
  args: A;
  spread?: Spread;
};
export type FeatureNode<Id extends string = string, K extends FeatureName = FeatureName, A = unknown> = {
  node: 'feature';
  id: Id;
  feature: K;
  args: A;
  on: boolean;
};
export type AxisNode<Id extends string = string, K extends ScaleName = ScaleName, A = unknown> = {
  node: 'axis';
  id: Id;
  scale: K;
  args: A;
};

type FrameOptions = Omit<Options, 'x' | 'y' | 'y2' | 'marks' | 'use'>;
type Frame = Args<FrameOptions> & {
  x?: AxisNode;
  y?: AxisNode;
  y2?: AxisNode;
};
export type Tree = {
  frame?: Frame;
  marks: readonly MarkNode[];
  use?: readonly FeatureNode[];
  /** A timer per mount: every `every` ms the rows become `step(rows)`. */
  live?: { every: number; step: Extract<Node<(rows: Rows) => Rows>, { node: 'fn' }> };
};

type MarkOptions<K extends MarkName> = Parameters<(typeof marks)[K]>[0];
type FeatureOptions<K extends FeatureName> = NonNullable<Parameters<(typeof features)[K]>[0]>;
type ScaleOptions<K extends ScaleName> = NonNullable<Parameters<(typeof scales)[K]>[0]>;

type Leaf =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | ((...args: never[]) => unknown)
  | readonly unknown[]
  | ArrayBufferView;
type Paths<T, D extends 0[] = []> = T extends Leaf
  ? never
  : D['length'] extends 3
    ? never
    : { [K in keyof T & string]-?: K | `${K}.${Paths<NonNullable<T[K]>, [...D, 0]>}` }[keyof T & string];
type At<T, P extends string> = T extends Leaf
  ? never
  : P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? At<NonNullable<T[K]>, R>
      : undefined
    : P extends keyof T
      ? T[P]
      : undefined;
type Put<V> = Arg<NonNullable<V>> | (undefined extends V ? Omitted : never);
type Slot<P extends string, V> = { target: P; value: V };
type ElementAt<E, I> = E extends readonly unknown[] ? (I extends keyof E ? E[I] : E[number]) : never;
type PropAt<E, Q> = E extends unknown ? (Q extends keyof E ? E[Q] : never) : never;
/** A `params.<name>` target for each param in `X`, taking what `E`, the core type at the param's place, takes. */
type ParamSlots<X, E, D extends 0[] = []> = D['length'] extends 8
  ? never
  : X extends { node: 'param'; name: infer N extends string }
    ? string extends N
      ? never
      : Slot<`params.${N}`, Arg<E>>
    : X extends { node: 'call'; name: infer K extends HelperName; args: infer A }
      ? ParamSlots<A, Parameters<(typeof helpers)[K]>, [...D, 0]>
      : X extends { node: 'spread'; call: infer C }
        ? ParamSlots<C, unknown, [...D, 0]>
        : X extends readonly unknown[]
          ? number extends X['length']
            ? ParamSlots<X[number], ElementAt<E, number>, [...D, 0]>
            : { [I in keyof X & `${number}`]: ParamSlots<X[I], ElementAt<E, I>, [...D, 0]> }[keyof X &
                `${number}`]
          : X extends { node: string } | Leaf
            ? never
            : { [Q in keyof X & string]-?: ParamSlots<X[Q], PropAt<NonNullable<E>, Q>, [...D, 0]> }[keyof X &
                string];
type ArgSlots<Id extends string, O> = { [P in Paths<O>]: Slot<`${Id}.${P}`, Put<At<O, P>>> }[Paths<O>];
type NodeSlots<N> =
  N extends MarkNode<infer Id, infer K, infer A>
    ? ArgSlots<Id, MarkOptions<K>> | ParamSlots<A, MarkOptions<K>> | ParamSlots<N['spread'], unknown>
    : N extends FeatureNode<infer Id, infer K, infer A>
      ? Slot<`${Id}.on`, boolean> | ArgSlots<Id, FeatureOptions<K>> | ParamSlots<A, FeatureOptions<K>>
      : N extends AxisNode<infer Id, infer K, infer A>
        ? Slot<Id, AxisNode<Id> | Omitted> | ArgSlots<Id, ScaleOptions<K>> | ParamSlots<A, ScaleOptions<K>>
        : never;
type Both<S> = (S extends { value: infer V } ? (v: V) => void : never) extends (v: infer I) => void
  ? I
  : never;
/** One slot per `params.<name>` target, taking only what fits every place the param stands. */
type Merged<S, All = S> = S extends { target: infer P extends `params.${string}` }
  ? Slot<P, Both<Extract<All, { target: P }>>>
  : S;
/** Every switch target the tree has, with the type of value it takes. */
export type Slots<T extends Tree> = Merged<
  | NodeSlots<
      | T['marks'][number]
      | NonNullable<T['use']>[number]
      | (T extends { frame: infer F } ? F[keyof F & ('x' | 'y' | 'y2')] : never)
    >
  | Slot<`frame.${'x' | 'y' | 'y2'}`, AxisNode | Omitted>
  | ArgSlots<'frame', FrameOptions>
  | (T extends { frame: infer F } ? ParamSlots<Omit<F, 'x' | 'y' | 'y2'>, FrameOptions> : never)
>;

/** Types `never` every key of `A`, at any depth, that the options `O` do not have, so a misspelled one fails. */
type Known<A, O> = A extends { node: string }
  ? unknown
  : A extends readonly unknown[]
    ? { [I in keyof A]: Known<A[I], ElementAt<NonNullable<O>, I>> }
    : A extends Leaf
      ? unknown
      : {
          [Q in keyof A]: Q extends (O extends unknown ? keyof O : never)
            ? Known<A[Q], PropAt<NonNullable<O>, Q>>
            : never;
        };
export function mark<Id extends string, K extends MarkName, A extends Args<MarkOptions<K>>>(
  id: Id,
  name: K,
  args: A & Known<A, MarkOptions<K>>,
): MarkNode<Id, K, A>;
export function mark<
  Id extends string,
  K extends MarkName,
  Sp extends Spread<Partial<MarkOptions<K>>>,
  A extends Args<Omit<MarkOptions<K>, keyof Spreads<Sp>> & Partial<MarkOptions<K>>>,
>(id: Id, name: K, spread: Sp, args: A & Known<A, MarkOptions<K>>): MarkNode<Id, K, A> & { spread: Sp };
export function mark(id: string, name: MarkName, a: unknown, b?: unknown): MarkNode {
  return b === undefined
    ? { node: 'mark', id, mark: name, args: a }
    : { node: 'mark', id, mark: name, args: b, spread: a as Spread };
}

type Spreads<Sp> = Sp extends Spread<infer S> ? S : never;
type Optional<P extends readonly unknown[], A, Rest extends unknown[] = []> = P extends [unknown]
  ? [args: A & Known<A, P[0]>, ...Rest]
  : [args?: A & Known<A, P[0]>, ...Rest];

export const feature = <
  Id extends string,
  K extends FeatureName,
  A extends Arg<Parameters<(typeof features)[K]>[0]>,
>(
  id: Id,
  name: K,
  ...rest: Optional<Parameters<(typeof features)[K]>, A, [on?: boolean]>
): FeatureNode<Id, K, A> => {
  const [args, on = true] = rest as unknown as [A, boolean?];
  return { node: 'feature', id, feature: name, args, on };
};

export const axis = <
  Id extends string,
  K extends ScaleName,
  A extends Arg<Parameters<(typeof scales)[K]>[0]>,
>(
  id: Id,
  scale: K,
  ...[args]: Optional<Parameters<(typeof scales)[K]>, A>
): AxisNode<Id, K, A> => ({ node: 'axis', id, scale, args: args as A });

export function col(name: string, as?: 'number' | 'time'): Node<Float64Array>;
export function col(name: string, as: 'text'): Node<string[]>;
export function col(name: string, as: 'number' | 'text' | 'time' = 'number'): Node {
  return { node: 'col', name, as };
}
export const dataset = <T>(): Node<T> => ({ node: 'dataset' });
export const ref = <K extends RefName>(name: K): Node<(typeof refs)[K]> => ({ node: 'ref', name });
type Fit<A, P extends readonly unknown[]> = {
  [I in keyof A]: I extends keyof P ? (A[I] extends Arg<P[I]> ? A[I] & Known<A[I], P[I]> : Arg<P[I]>) : never;
} & { length: P['length'] };
// Typed `ArgList<…> & A`, the tuple would hand a nested dataset() the union of every helper's arguments.
export const call = <K extends HelperName, A extends readonly unknown[]>(
  name: K,
  args: ArgList<Parameters<(typeof helpers)[K]>> | Fit<A, Parameters<(typeof helpers)[K]>>,
): Node<ReturnType<(typeof helpers)[K]>> & { node: 'call'; name: K; args: A } => ({
  node: 'call',
  name,
  args: args as A,
});
export const spread = <C extends Node>(of: C): { node: 'spread'; call: C } => ({ node: 'spread', call: of });
export const param = <const N extends string, const T>(
  name: N,
  value: T,
): Node<T> & { node: 'param'; name: N } => ({
  node: 'param',
  name,
  value,
});
/** A pure function: the code shows `source` and the live chart runs `impl`. */
export const fn = <F extends (...args: never[]) => unknown>(
  source: string,
  impl: F,
): Node<F> & { node: 'fn'; impl: F } => ({
  node: 'fn',
  source,
  impl,
});

/** `values` in the space of the frame's axis `axis`, through its `col()`: what a mark on a log axis is given. */
export const scaled = (axis: string, values: Node<Float64Array>): Node<Float64Array> => ({
  node: 'scaled',
  axis,
  of: values,
});

type AnyNode = Shape | Spread | Omitted | MarkNode | FeatureNode | AxisNode;
const KINDS = new Set([
  'col',
  'dataset',
  'ref',
  'call',
  'param',
  'fn',
  'scaled',
  'spread',
  'omit',
  'mark',
  'feature',
  'axis',
]);
export const isNode = (v: unknown): v is AnyNode =>
  plain(v) && !Array.isArray(v) && typeof v.node === 'string' && KINDS.has(v.node);

export const contents = (data: Data): unknown => (data.kind === 'json' ? data.value : data.rows);

/** The features as resolved, before evaluation: a chart installs the ones on at mount, so a change to this means a remount. */
export const useOf = (tree: Tree): string => JSON.stringify((tree.use ?? []).filter(f => f.on));

export function evaluator(tree: Tree, data: Data, id: string) {
  const fail = (problem: string): never => {
    throw new Error(`example "${id}": ${problem}`);
  };
  const column = (name: string, as: string) => {
    if (data.kind === 'json') return fail(`col("${name}") needs rows, and the data is JSON`);
    if (data.rows.some(r => !Object.hasOwn(r, name))) fail(`the rows have no column "${name}"`);
    if (as === 'text') return data.rows.map(r => String(r[name]));
    return Float64Array.from(data.rows, r =>
      as === 'time' && typeof r[name] === 'string' ? Date.parse(r[name]) : Number(r[name]),
    );
  };
  const { x, y, y2, ...rest } = tree.frame ?? {};
  const frame = Object.entries({ x, y, y2 }).flatMap(([k, a]) =>
    a === undefined
      ? []
      : [[k, isNode(a) && a.node === 'axis' ? a : fail(`frame.${k} is not an axis`)] as const],
  );
  const axes = new Map<string, Axis>();
  const value = (v: unknown): unknown => {
    if (!isNode(v)) {
      if (Array.isArray(v)) return v.map(value);
      return plain(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) : v;
    }
    switch (v.node) {
      case 'col':
        return column(v.name, v.as);
      case 'dataset':
        return contents(data);
      case 'ref':
        return refs[v.name];
      case 'call':
        return (helpers[v.name] as (...args: unknown[]) => unknown)(...v.args.map(value));
      case 'param':
        return value(v.value);
      case 'fn':
        return v.impl;
      case 'scaled': {
        const axis = axes.get(v.axis) ?? fail(`scaled("${v.axis}") names no axis of the frame`);
        if (!('col' in axis)) return fail(`scaled("${v.axis}") needs an axis with col(), such as log()`);
        return (axis as LogAxis).col(value(v.of) as Float64Array);
      }
      default:
        return fail(`a ${v.node} node cannot stand as a value`);
    }
  };
  for (const [, a] of frame) axes.set(a.id, (scales[a.scale] as (arg: unknown) => Axis)(value(a.args)));
  return { value, frame, rest, axes };
}

export function evaluate(tree: Tree, data: Data, id: string): Options {
  const { value, frame, rest, axes } = evaluator(tree, data, id);
  return {
    ...(value(rest) as object),
    ...Object.fromEntries(frame.map(([k, a]) => [k, axes.get(a.id)])),
    marks: tree.marks.flatMap(m =>
      (marks[m.mark] as (o: unknown) => Options['marks'][number] | Options['marks'])({
        ...(m.spread ? (value(m.spread.call) as object) : {}),
        ...(value(m.args) as object),
      }),
    ),
    ...(tree.use && {
      use: tree.use
        .filter(f => f.on)
        .map(f =>
          (features[f.feature] as (o: unknown) => NonNullable<Options['use']>[number])(value(f.args)),
        ),
    }),
  };
}

const ids = (tree: Tree) => [
  ...[tree.frame?.x, tree.frame?.y, tree.frame?.y2].filter(a => a !== undefined),
  ...tree.marks,
  ...(tree.use ?? []),
];

/** The problem with the node ids, if one is used twice or cannot head a target: switches address nodes by id. */
export function checkIds(tree: Tree): string | undefined {
  const seen = new Set<string>();
  for (const { id } of ids(tree)) {
    if (id === 'params' || id === 'frame') return `node id "${id}" is reserved for switch targets`;
    if (id.includes('.')) return `node id "${id}" contains ".", which splits a switch target`;
    if (seen.has(id)) return `duplicate node id "${id}"`;
    seen.add(id);
  }
  return undefined;
}

function setIn(at: unknown, path: readonly string[], put: unknown, target: string): unknown {
  if (at !== undefined && (!plain(at) || Array.isArray(at) || isNode(at)))
    throw new Error(`"${target}" goes into a value that is not an object`);
  const [key, ...more] = path as [string, ...string[]];
  const copy: Record<string, unknown> = { ...at };
  const next = more.length ? setIn(copy[key], more, put, target) : put;
  if (next === omit) delete copy[key];
  else copy[key] = next;
  return copy;
}

function withParam(v: unknown, name: string, put: unknown, hit: { found: boolean }): unknown {
  if (Array.isArray(v)) return v.map(x => withParam(x, name, put, hit));
  if (!plain(v)) return v;
  if (v.node === 'param' && v.name === name) {
    hit.found = true;
    return { ...v, value: put };
  }
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withParam(x, name, put, hit)]));
}

/** Puts a value at a switch target: `params.<name>`, `frame.<option>`, `<axis id>`, `<feature id>.on` or `<id>.<arg path>`. */
export function put(tree: Tree, target: string, value: unknown): Tree {
  const [head, ...path] = target.split('.') as [string, ...string[]];
  if (head === 'params') {
    const hit = { found: false };
    const next = withParam(tree, path.join('.'), value, hit) as Tree;
    if (!hit.found) throw new Error(`"${target}" names no param in the tree`);
    return next;
  }
  if (head === 'frame') {
    if (!path.length) throw new Error(`"${target}" names no frame option`);
    const was = tree.frame?.[path[0] as 'x' | 'y' | 'y2'];
    if (path.length === 1 && isNode(was) && was.node === 'axis' && isNode(value) && value.node === 'axis')
      if (value.id !== was.id)
        throw new Error(`"${target}" replaces the axis "${was.id}" with one whose id is "${value.id}"`);
    return { ...tree, frame: setIn(tree.frame, path, value, target) as Frame };
  }
  const node = ids(tree).find(n => n.id === head);
  if (!node) throw new Error(`"${target}" names no node: there is no id "${head}"`);
  if (node.node === 'axis' && !path.length) {
    if (value !== omit && !(isNode(value) && value.node === 'axis'))
      throw new Error(`"${target}" is an axis, and can only be given an axis or omit`);
    const slot = (['x', 'y', 'y2'] as const).find(k => tree.frame?.[k] === node)!;
    return put(tree, `frame.${slot}`, value);
  }
  if (!path.length) throw new Error(`"${target}" names a ${node.node}, not one of its arguments`);
  const swap = <N extends MarkNode | FeatureNode | AxisNode>(list: readonly N[], to: N) =>
    list.map(n => (n === node ? to : n));
  if (node.node === 'feature' && path.length === 1 && path[0] === 'on') {
    if (typeof value !== 'boolean') throw new Error(`"${target}" can only be given true or false`);
    return { ...tree, use: swap(tree.use!, { ...node, on: value }) };
  }
  const changed = { ...node, args: setIn(node.args, path, value, target) };
  if (changed.node === 'mark') return { ...tree, marks: swap(tree.marks, changed) };
  if (changed.node === 'feature') return { ...tree, use: swap(tree.use!, changed) };
  const slot = (['x', 'y', 'y2'] as const).find(k => tree.frame?.[k] === node)!;
  return { ...tree, frame: { ...tree.frame, [slot]: changed } };
}
