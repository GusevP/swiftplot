import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';
import { bar, bin, fromTree, gradient, line, log, time, treemap, zoom } from 'swiftplot';
import { example, resolve, type PlotExample } from '../src/examples/define';
import {
  axis,
  call,
  col,
  dataset,
  evaluate,
  feature,
  fn,
  mark,
  omit,
  param,
  ref,
  scaled,
  spread,
  type Tree,
} from '../src/examples/tree';
import { closing, step, tickFormat } from './plot-definitions';

const rows = [
  { day: '2026-11-01', v: 1, w: 4, name: 'a' },
  { day: '2026-11-02', v: 3, w: 2, name: 'b' },
  { day: '2026-11-03', v: 2, w: 8, name: 'c' },
];

const tree = {
  frame: {
    x: axis('x', 'time', { label: 'Day' }),
    y: axis('y', 'linear', { label: 'Value', domain: 'nice' }),
  },
  marks: [
    mark('v', 'line', { x: col('day', 'time'), y: col('v'), color: '#111111', fill: true }),
    mark('w', 'line', { x: col('day', 'time'), y: col('w'), color: '#222222', curve: 'linear' }),
  ],
  use: [
    feature('zoom', 'zoom'),
    feature('tip', 'tooltip', { mode: 'nearest', text: fn('l => l', (l: string) => l) }, false),
  ],
} satisfies Tree;

const base = {
  kind: 'plot',
  id: 'plot-test',
  title: 'Plot test',
  summary: 'A test.',
  group: 'Line',
  tags: [],
  tree,
  data: { kind: 'rows', file: 'test.json', rows },
  switches: [],
  notes: [],
} satisfies PlotExample;

// Marks and features hold closures made anew on each call, so they compare with their functions left out.
const shape = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_, x: unknown) => (ArrayBuffer.isView(x) ? [...(x as Float64Array)] : x)));

describe('builders', () => {
  test('give nodes with their ids, arguments and on flags', () => {
    expect(mark('m', 'line', { x: col('v'), y: col('w'), color: 'red' })).toEqual({
      node: 'mark',
      id: 'm',
      mark: 'line',
      args: {
        x: { node: 'col', name: 'v', as: 'number' },
        y: { node: 'col', name: 'w', as: 'number' },
        color: 'red',
      },
    });
    expect(feature('z', 'zoom')).toEqual({
      node: 'feature',
      id: 'z',
      feature: 'zoom',
      args: undefined,
      on: true,
    });
    expect(feature('z', 'zoom', { axes: 'xy' }, false)).toMatchObject({ args: { axes: 'xy' }, on: false });
    expect(axis('x', 'log', { label: 'L' })).toEqual({
      node: 'axis',
      id: 'x',
      scale: 'log',
      args: { label: 'L' },
    });
    expect(spread(call('bin', [col('v'), param('bins', 20)]))).toEqual({
      node: 'spread',
      call: {
        node: 'call',
        name: 'bin',
        args: [
          { node: 'col', name: 'v', as: 'number' },
          { node: 'param', name: 'bins', value: 20 },
        ],
      },
    });
  });

  test('take the core option types, so a wrong argument fails typechecking', () => {
    // @ts-expect-error a curve core does not have
    mark('m', 'line', { x: col('v'), y: col('w'), color: 'red', curve: 'wavy' });
    // @ts-expect-error a text column where a number column goes
    mark('m', 'line', { x: col('name', 'text'), y: col('w'), color: 'red' });
    // @ts-expect-error a mark core does not have
    mark('m', 'pie', {});
    // @ts-expect-error the tooltip needs a mode
    feature('t', 'tooltip', { text: fn('l => l', (l: string) => l) });
    // @ts-expect-error gradient's direction is one of four
    call('gradient', [0.4, 0, 'sideways']);
    // @ts-expect-error a palette is not a colour
    mark('m', 'line', { x: col('v'), y: col('w'), color: ref('palette') });
    // @ts-expect-error a function node of the wrong shape
    feature('t', 'tooltip', { mode: 'nearest', text: fn('n => n', (n: number) => n) });
    // @ts-expect-error bin() gives no colour, so the bar needs one
    mark('b', 'bar', spread(call('bin', [col('v'), param('bins', 20)])), {});
    // @ts-expect-error a misspelled feature option
    feature('t', 'tooltip', { mode: 'nearest', text: fn('l => l', (l: string) => l), txet: 1 });
    // @ts-expect-error a misspelled axis option
    axis('y', 'linear', { label: 'V', domain: 'nice', fitt: 'all' });
    // @ts-expect-error a misspelled key inside a helper's object argument
    call('fromLinks', [[{ source: 'a', target: 'b', value: 1, vlaue: 2 }]]);
    // @ts-expect-error bin() needs its values
    call('bin', []);
    // @ts-expect-error gradient() needs both stops
    call('gradient', [0.4]);
    // @ts-expect-error fromLinks() needs its links
    call('fromLinks', []);
    call('bin', [col('v')]);
    expect(true).toBe(true);
  });
});

describe('example() for a plot definition', () => {
  test('accepts a valid definition', () => {
    expect(example(base)).toBe(base);
  });

  test('fails on a node id used twice', () => {
    expect(() => example({ ...base, tree: { ...tree, marks: [tree.marks[0]!, tree.marks[0]!] } })).toThrow(
      /plot-test.*duplicate node id "v"/,
    );
  });

  test.each(['params', 'frame', 'a.b'])('fails on the node id %j, which a switch target cannot name', id => {
    expect(() => example({ ...base, tree: { ...tree, marks: [{ ...tree.marks[0]!, id }] } })).toThrow(
      new RegExp(`plot-test.*node id "${id}"`),
    );
  });

  test.each([
    ['nope.color', /there is no id "nope"/],
    ['params.bins', /"params.bins" names no param/],
    ['v', /names a mark, not one of its arguments/],
    ['v.x.name', /goes into a value that is not an object/],
    ['frame', /names no frame option/],
  ])('fails on the target %j, which does not resolve', (target, message) => {
    expect(() =>
      // @ts-expect-error a target the tree does not have
      example({ ...base, switches: [{ id: 's', label: 'S', target, kind: 'boolean', value: true }] }),
    ).toThrow(message);
  });

  test('fails on an axis given something other than an axis, and an on flag given something other than a boolean', () => {
    const boolean = { id: 's', label: 'S', kind: 'boolean', value: true } as const;
    expect(() =>
      // @ts-expect-error an axis target given a string
      example({ ...base, switches: [{ ...boolean, target: 'y', puts: { on: omit, off: 'log' } }] }),
    ).toThrow(/"y" is an axis, and can only be given an axis or omit/);
    expect(() =>
      // @ts-expect-error an on flag given a string
      example({ ...base, switches: [{ ...boolean, target: 'zoom.on', puts: { on: 'yes', off: false } }] }),
    ).toThrow(/"zoom.on" can only be given true or false/);
  });

  test('fails on a choice whose value is not among its values, or whose puts and values differ', () => {
    const choice = {
      id: 'c',
      label: 'C',
      kind: 'choice',
      values: ['linear', 'step'],
    } as const;
    expect(() => example({ ...base, switches: [{ ...choice, target: 'w.curve', value: 'smooth' }] })).toThrow(
      /switch "c" starts at "smooth"/,
    );
    expect(() =>
      example({
        ...base,
        switches: [{ ...choice, target: 'w.curve', value: 'linear', puts: { smooth: 'smooth' } }],
      }),
    ).toThrow(/switch "c" puts a value for "smooth"/);
    expect(() =>
      example({
        ...base,
        switches: [{ ...choice, target: 'w.curve', value: 'linear', puts: { linear: 'linear' } }],
      }),
    ).toThrow(/switch "c" puts nothing for its value "step"/);
  });

  test('a switch target or value the core options do not take fails typechecking', () => {
    const valid = {
      ...base,
      tree: { marks: [mark('line1', 'line', { x: col('v'), y: col('w'), color: 'red' })] },
    };
    const choice = {
      id: 'c',
      label: 'C',
      kind: 'choice',
      values: ['linear', 'step'],
      value: 'linear',
    } as const;
    example({ ...valid, switches: [{ ...choice, target: 'line1.curve' }] });
    example({
      ...valid,
      switches: [{ ...choice, target: 'line1.curve', puts: { linear: 'linear', step: omit } }],
    });
    // @ts-expect-error a misspelled option of a real mark
    example({ ...valid, switches: [{ ...choice, target: 'line1.curvve' }] });
    // @ts-expect-error a curve core does not have
    example({
      ...valid,
      switches: [{ ...choice, target: 'line1.curve', puts: { linear: 'linear', step: 'wavy' } }],
    });
    const annotated: Tree = valid.tree;
    example({ ...valid, tree: annotated });
    // @ts-expect-error a Tree annotation erases the ids the switches are checked against
    example({ ...valid, tree: annotated, switches: [{ ...choice, target: 'line1.curve' }] });
    expect(true).toBe(true);
  });

  test('a switch with several puts: each value has its list, every target resolves, and each value fits its target', () => {
    const choice = { id: 'c', label: 'C', kind: 'choice', values: ['a', 'b'], value: 'a' } as const;
    expect(() => example({ ...base, switches: [{ ...choice, sets: { a: [] } }] })).toThrow(
      /switch "c" puts nothing for its value "b"/,
    );
    expect(() => example({ ...base, switches: [{ ...choice, sets: { a: [], b: [], z: [] } }] })).toThrow(
      /switch "c" puts a value for "z"/,
    );
    expect(() =>
      example({
        ...base,
        // @ts-expect-error a target the tree does not have
        switches: [{ ...choice, sets: { a: [], b: [{ target: 'nope.color', value: 'red' }] } }],
      }),
    ).toThrow(/in \{"c":"b"\}, "nope.color" names no node/);
    expect(() =>
      // @ts-expect-error a switch has either a target or sets
      example({
        ...base,
        switches: [
          { ...choice, target: 'w.curve', puts: { a: 'linear', b: 'step' }, sets: { a: [], b: [] } },
        ],
      }),
    ).toThrow(/switch "c" has both a target and sets/);
    example({
      ...base,
      switches: [
        {
          ...choice,
          sets: {
            a: [],
            b: [
              { target: 'w.width', value: 2 },
              // @ts-expect-error a curve core does not have, in one of the puts
              { target: 'w.curve', value: 'wavy' },
            ],
          },
        },
      ],
    });
  });

  test('fails on two switches that evaluate alone but not together', () => {
    expect(() =>
      example({
        ...base,
        switches: [
          { id: 'tooltip', label: 'Tooltip', target: 'tip.on', kind: 'boolean', value: false },
          // @ts-expect-error a column where the tooltip takes a function
          {
            id: 'text',
            label: 'Text',
            target: 'tip.text',
            kind: 'boolean',
            value: true,
            puts: { on: fn('l => l', (l: string) => l), off: col('nope') },
          },
        ],
      }),
    ).toThrow('the rows have no column "nope"');
  });

  test('fails on an axis replaced by one with another id, or a new axis whose id is taken', () => {
    const boolean = { id: 's', label: 'S', kind: 'boolean', value: true } as const;
    expect(() =>
      // @ts-expect-error an axis with another id
      example({
        ...base,
        switches: [
          { ...boolean, target: 'x', puts: { on: tree.frame!.x, off: axis('v', 'time', { label: 'V' }) } },
        ],
      }),
    ).toThrow(/replaces the axis "x" with one whose id is "v"/);
    expect(() =>
      example({
        ...base,
        switches: [
          {
            ...boolean,
            target: 'frame.y2',
            puts: { on: omit, off: axis('v', 'linear', { label: 'V', domain: 'nice' }) },
          },
        ],
      }),
    ).toThrow(/\{"s":false\}.*duplicate node id "v"/);
  });

  test.each([
    ['a function', { f: () => 1 }],
    ['a bigint', [1n]],
    ['undefined', { a: undefined }],
    ['NaN', [Number.NaN]],
  ])('fails on JSON data holding %s', (_, value) => {
    expect(() =>
      example({ ...base, data: { kind: 'json', file: 'bad.json', value: value as never } }),
    ).toThrow('example "plot-test": the data in bad.json holds a value JSON cannot carry');
  });

  test('fails on a switch state that does not evaluate, naming the example and the column', () => {
    expect(() =>
      example({
        ...base,
        switches: [
          {
            id: 'y',
            label: 'Y',
            target: 'v.y',
            kind: 'boolean',
            value: true,
            puts: { on: col('v'), off: col('nope') },
          },
        ],
      }),
    ).toThrow('example "plot-test": the rows have no column "nope"');
  });
});

describe('resolve() for a plot definition', () => {
  const definition = (switches: PlotExample['switches'], over: Tree = tree) =>
    example({ ...base, tree: over, switches: switches as never });

  test('a boolean switch turns a feature on and off, leaving the definition as it was', () => {
    const d = definition([
      { id: 'tooltip', label: 'Tooltip', target: 'tip.on', kind: 'boolean', value: false },
    ]);
    expect(resolve(d, {}).use![1]!.on).toBe(false);
    expect(resolve(d, { tooltip: true }).use![1]!.on).toBe(true);
    expect(d.tree.use![1]!.on).toBe(false);
  });

  test('a switch with several puts makes them all at its value, and none at a value with an empty list', () => {
    const d = definition([
      {
        id: 'both',
        label: 'Both',
        kind: 'boolean',
        value: false,
        sets: {
          on: [
            { target: 'v.width', value: 3 },
            { target: 'w.curve', value: omit },
            { target: 'tip.on', value: true },
          ],
          off: [],
        },
      },
    ]);
    expect(resolve(d, {})).toBe(d.tree);
    const on = resolve(d, { both: true });
    expect(on.marks[0]!.args).toMatchObject({ width: 3 });
    expect(on.marks[1]!.args).not.toHaveProperty('curve');
    expect(on.use![1]!.on).toBe(true);
  });

  test('a choice puts a number, a helper value, or leaves the argument out', () => {
    const d = definition([
      {
        id: 'width',
        label: 'Width',
        target: 'v.width',
        kind: 'choice',
        values: ['thin', 'thick'],
        value: 'thin',
        puts: { thin: 1, thick: 3 },
      },
      {
        id: 'fill',
        label: 'Fill',
        target: 'v.fill',
        kind: 'choice',
        values: ['fade', 'none'],
        value: 'fade',
        puts: { fade: call('gradient', [0.4, 0]), none: omit },
      },
    ]);
    expect(resolve(d, {}).marks[0]!.args).toMatchObject({ width: 1, fill: call('gradient', [0.4, 0]) });
    expect(resolve(d, { width: 'thick' }).marks[0]!.args).toMatchObject({ width: 3 });
    expect(resolve(d, { fill: 'none' }).marks[0]!.args).not.toHaveProperty('fill');
    expect(shape(evaluate(resolve(d, {}), d.data, d.id).marks[0])).toEqual(
      shape(
        line({
          x: Float64Array.from(rows, r => Date.parse(r.day)),
          y: Float64Array.of(1, 3, 2),
          color: '#111111',
          width: 1,
          fill: gradient(0.4, 0),
        }),
      ),
    );
  });

  test('a choice swaps an axis between log and linear', () => {
    const d = definition([
      {
        id: 'scale',
        label: 'Scale',
        target: 'y',
        kind: 'choice',
        values: ['linear', 'log'],
        value: 'linear',
        puts: {
          linear: axis('y', 'linear', { label: 'Value', domain: 'nice' }),
          log: axis('y', 'log', { label: 'Value' }),
        },
      },
    ]);
    expect(resolve(d, { scale: 'log' }).frame!.y).toEqual(axis('y', 'log', { label: 'Value' }));
    expect(shape(evaluate(resolve(d, { scale: 'log' }), d.data, d.id).y)).toEqual(
      shape(log({ label: 'Value' })),
    );
    expect(evaluate(resolve(d, {}), d.data, d.id).y).toEqual({ label: 'Value', domain: 'nice' });
  });

  test('a switch on a parameter puts values of the type where the parameter stands', () => {
    const binned = {
      marks: [
        mark('bars', 'bar', spread(call('bin', [col('w'), param('bins', 2)])), {
          color: '#333333',
          fill: param('paint', '#333333'),
        }),
      ],
    } satisfies Tree;
    const d = example({
      ...base,
      tree: binned,
      switches: [
        {
          id: 'bins',
          label: 'Bins',
          target: 'params.bins',
          kind: 'choice',
          values: ['2', '4'],
          value: '2',
          puts: { 2: 2, 4: 4 },
        },
        {
          id: 'paint',
          label: 'Paint',
          target: 'params.paint',
          kind: 'choice',
          values: ['solid', 'fade'],
          value: 'solid',
          puts: { solid: '#333333', fade: call('gradient', [0.4, 0]) },
        },
      ],
    });
    const evaluated = evaluate(resolve(d, { bins: '4', paint: 'fade' }), d.data, d.id);
    expect(shape(evaluated.marks)).toEqual(
      shape([bar({ ...bin(Float64Array.of(4, 2, 8), 4), color: '#333333', fill: gradient(0.4, 0) })]),
    );
    const unmapped = { id: 'bins', label: 'Bins', kind: 'choice' } as const;
    // @ts-expect-error a bin count takes a number, not the UI's string
    example({
      ...base,
      tree: binned,
      switches: [{ ...unmapped, target: 'params.bins', values: ['2', '4'], value: '2' }],
    });
    const misspelled = {
      ...unmapped,
      target: 'params.bns',
      values: ['2'],
      value: '2',
      puts: { 2: 2 },
    } as const;
    // @ts-expect-error a switch on a param the tree does not have
    expect(() => example({ ...base, tree: binned, switches: [misspelled] })).toThrow(
      /"params.bns" names no param/,
    );
    const twice = {
      marks: [
        mark('bars', 'bar', {
          x: col('v'),
          y: col('w'),
          color: param('paint', '#333'),
          fill: param('paint', '#333'),
        }),
      ],
    } satisfies Tree;
    const paint = {
      id: 'paint',
      label: 'Paint',
      target: 'params.paint',
      kind: 'choice',
      values: ['solid', 'fade'],
      value: 'solid',
    } as const;
    example({ ...base, tree: twice, switches: [{ ...paint, puts: { solid: '#333333', fade: '#999999' } }] });
    example({
      ...base,
      tree: twice,
      // @ts-expect-error a gradient fits the fill but not the colour, where the param also stands
      switches: [{ ...paint, puts: { solid: '#333333', fade: call('gradient', [0.4, 0]) } }],
    });
    const zoomed = {
      marks: [mark('bars', 'bar', { x: col('v'), y: col('w'), color: '#333' })],
      use: [feature('z', 'zoom', { axes: param('axes', 'x') })],
    } satisfies Tree;
    const axes = { id: 'axes', label: 'Axes', kind: 'choice' } as const;
    example({
      ...base,
      tree: zoomed,
      switches: [{ ...axes, target: 'params.axes', values: ['x', 'xy'], value: 'x' }],
    });
    // @ts-expect-error zoom's axes are x, y or xy
    example({
      ...base,
      tree: zoomed,
      switches: [{ ...axes, target: 'params.axes', values: ['x', 'z'], value: 'x' }],
    });
  });
});

describe('evaluate()', () => {
  test('gives the Options a hand would write', () => {
    const options = evaluate(tree, base.data, base.id);
    const x = Float64Array.from(rows, r => Date.parse(r.day));
    const expected = {
      x: time({ label: 'Day' }),
      y: { label: 'Value', domain: 'nice' },
      marks: [
        line({ x, y: Float64Array.of(1, 3, 2), color: '#111111', fill: true }),
        line({ x, y: Float64Array.of(4, 2, 8), color: '#222222', curve: 'linear' }),
      ],
      use: [zoom()],
    };
    expect(shape(options)).toEqual(shape(expected));
    expect(options.x).toEqual(expected.x);
    expect(options.use).toHaveLength(1);
  });

  test('reads the whole dataset into a helper, and fails on a column of JSON data', () => {
    const value = {
      name: 'root',
      children: [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 },
      ],
    };
    const json = { kind: 'json', file: 'tree.json', value } as const;
    const nested: Tree = {
      frame: { frame: 'blank' },
      marks: [mark('t', 'treemap', spread(call('fromTree', [dataset()])), { colors: ['#111111'] })],
    };
    expect(shape(evaluate(nested, json, 'nested'))).toEqual(
      shape({ frame: 'blank', marks: [treemap({ ...fromTree(value), colors: ['#111111'] })] }),
    );
    const flat: Tree = { marks: [mark('v', 'line', { x: col('v'), y: col('v'), color: 'red' })] };
    expect(() => evaluate(flat, json, 'nested')).toThrow(
      'example "nested": col("v") needs rows, and the data is JSON',
    );
  });

  test('gives a scaled column through its axis, and fails on an axis without col() or an id not in the frame', () => {
    const logged: Tree = {
      frame: { y: axis('y', 'log', { label: 'Value' }) },
      marks: [mark('w', 'line', { x: col('v'), y: scaled('y', col('w')), color: 'red' })],
    };
    const y = log({ label: 'Value' });
    const w = Float64Array.of(Math.log10(4), Math.log10(2), Math.log10(8));
    expect(shape(evaluate(logged, base.data, 'logged'))).toEqual(
      shape({ y, marks: [line({ x: Float64Array.of(1, 3, 2), y: w, color: 'red' })] }),
    );
    const linear: Tree = { ...logged, frame: { y: axis('y', 'linear', { label: 'Value', domain: 'nice' }) } };
    expect(() => evaluate(linear, base.data, 'linear')).toThrow(
      'example "linear": scaled("y") needs an axis with col(), such as log()',
    );
    expect(() => evaluate({ ...logged, frame: {} }, base.data, 'none')).toThrow(
      'example "none": scaled("y") names no axis of the frame',
    );
  });
});

test("a function node's source agrees with its function", () => {
  const node = fn('(v) => `${v.toFixed(1)} ms`', (v: number) => `${v.toFixed(1)} ms`);
  const compiled = runInNewContext(node.source) as (v: number) => string;
  for (const v of [0, 1.25, -3, 1e6]) expect(compiled(v)).toBe(node.impl(v));
});

test("the candlesticks tooltip's source agrees with its function", () => {
  const compiled = runInNewContext(closing.source) as typeof closing.impl;
  for (const [x, y] of [
    [Date.UTC(2026, 9, 1), 100],
    [Date.UTC(2026, 9, 30, 12), 97.456],
  ] as const)
    expect(compiled('Price', x, y)).toBe(closing.impl('Price', x, y));
});

test("the log scale's tick format and the live updates' step agree with their sources", () => {
  const formatted = runInNewContext(tickFormat.source) as typeof tickFormat.impl;
  for (const v of [1, 20, 1000, 1_000_000]) expect(formatted(v)).toBe(tickFormat.impl(v));

  const stepped = runInNewContext(step.source) as typeof step.impl;
  const feed = [
    { s: 0, v: 5 },
    { s: 1, v: 7 },
    { s: 2, v: 6 },
  ];
  expect(stepped(feed)).toEqual(step.impl(feed));
  expect(step.impl(feed)).toEqual([
    { s: 1, v: 7 },
    { s: 2, v: 6 },
    { s: 3, v: 5 },
  ]);
});
