import { describe, expect, test } from 'vitest';
import { chartNames, example, type EasyExample, type Example } from '../src/examples/define';
import { examples, unlisted } from '../src/examples/index';
import { call, col, feature, fn, mark, type Tree } from '../src/examples/tree';
import source from '../../packages/core/src/charts/types.ts?raw';
import { extract, extractApi, type Entry } from '../src/reference/extract';
import { api, coreFiles, intros, pages } from '../src/reference/index';
import { join } from '../src/reference/join';
import { definitions } from './plot-definitions';

const reference = extract(source);
const entry = (chart: keyof typeof reference, name: string) => reference[chart].find(e => e.name === name);
const types = (e: Entry | undefined) => Object.fromEntries(e!.lines.map(l => [l.shape ?? '', l.type]));

describe('extract()', () => {
  test('lists the props of lineChart, nested axis settings included', () => {
    const names = reference.lineChart.map(e => e.name);
    for (const name of [
      'data',
      'x',
      'y',
      'series',
      'xAxis',
      'xAxis.label',
      'xAxis.utc',
      'yAxis.label',
      'curve',
      'zoom',
    ])
      expect(names).toContain(name);
    expect(names).not.toContain('yAxis.utc');
    expect(names).not.toContain('stack');
  });

  test('reads the declared type, the description and the default', () => {
    expect(entry('lineChart', 'curve')).toEqual({
      name: 'curve',
      default: "'linear'",
      lines: [
        {
          type: "LineOptions['curve']",
          description: 'How the points are joined: straight, stepped or smooth.',
        },
      ],
    });
    expect(entry('lineChart', 'xAxis.label')!.lines[0]!.type).toBe('string');
    expect(entry('lineChart', 'xAxis.utc')!.default).toBe('true');
    expect(entry('lineChart', 'tooltip')!.lines[0]!.description).toMatch(/tooltip/);
    expect(entry('lineChart', 'width')!.default).toBeUndefined();
    expect(entry('lineChart', 'yAxis.domain')!.default).toBe("'nice'");
    expect(entry('lineChart', 'xAxis.domain')!.default).toBeUndefined();
  });

  test('x is a name or an accessor on rows, a name on columns, and absent on numbers and pairs', () => {
    expect(types(entry('lineChart', 'x'))).toEqual({ rows: 'Name<R> | Accessor<R>', columns: 'Name<C>' });
    expect(entry('lineChart', 'data')!.lines.map(l => l.shape)).toEqual([
      'rows',
      'columns',
      'numbers',
      'pairs',
    ]);
  });

  test("y takes one field or a list, and scatterChart's y one field", () => {
    expect(types(entry('lineChart', 'y'))).toEqual({
      rows: 'NumberKey<R> | Accessor<R> | readonly (NumberKey<R> | Accessor<R>)[]',
      columns: 'NumberColumn<C> | readonly NumberColumn<C>[]',
    });
    expect(types(entry('scatterChart', 'y'))).toEqual({
      rows: 'Name<R> | Accessor<R>',
      columns: 'Name<C>',
    });
    expect(entry('scatterChart', 'y')!.lines[0]!.description).toMatch(/one y field/);
    expect(types(entry('scatterChart', 'r'))).toEqual({
      rows: 'number | NumberKey<R> | Accessor<R>',
      columns: 'number | NumberColumn<C>',
      numbers: 'number',
      pairs: 'number',
    });
  });

  test('stack belongs to areas and bars only', () => {
    expect(entry('areaChart', 'stack')).toBeDefined();
    expect(entry('barChart', 'stack')).toBeDefined();
    expect(entry('scatterChart', 'stack')).toBeUndefined();
    expect(entry('barChart', 'curve')).toBeUndefined();
  });

  test('every chart takes data first, and has an intro', () => {
    expect(Object.keys(reference).sort()).toEqual([...chartNames].sort());
    for (const chart of chartNames) {
      expect(reference[chart][0]!.name, chart).toBe('data');
      expect(intros[chart], chart).toMatch(/^Draws|^Counts/);
    }
  });

  test.each([
    [
      'pieChart',
      ['rows', 'columns', 'numbers', 'pairs'],
      ['data', 'label', 'value'],
      ['inner', 'text', 'sweep'],
    ],
    ['funnelChart', ['rows', 'columns', 'numbers', 'pairs'], ['data', 'label', 'value'], ['text', 'fill']],
    [
      'radialBarChart',
      ['rows', 'columns', 'numbers', 'pairs'],
      ['data', 'label', 'value'],
      ['max', 'sweep', 'inner'],
    ],
    ['radarChart', ['rows', 'columns', 'numbers', 'pairs'], ['data', 'x', 'y'], ['max', 'fill']],
    [
      'heatmapChart',
      ['rows', 'columns'],
      ['data', 'x', 'y', 'value'],
      ['color', 'xAxis', 'xAxis.label', 'yAxis', 'yAxis.label'],
    ],
    [
      'histogramChart',
      ['rows', 'columns', 'numbers'],
      ['data', 'x'],
      ['bins', 'xAxis.format', 'yAxis.label'],
    ],
    [
      'boxPlotChart',
      ['rows', 'columns', 'numbers', 'pairs'],
      ['data', 'x', 'y'],
      ['fill', 'xAxis.label', 'yAxis.step'],
    ],
    [
      'candlestickChart',
      ['rows', 'columns'],
      ['data', 'x', 'open', 'high', 'low', 'close'],
      ['up', 'down', 'xAxis.utc', 'zoom'],
    ],
    ['sankeyChart', ['rows', 'columns'], ['data', 'source', 'target', 'value'], ['blend', 'text']],
    [
      'comboChart',
      ['rows', 'columns'],
      ['data', 'x', 'lines', 'bars', 'y2Lines', 'y2Bars'],
      ['stack', 'y2Axis.scale', 'rules'],
    ],
  ] as const)(
    '%s takes its field props by the shape of its data, and its own props',
    (chart, shapes, fields, own) => {
      expect(entry(chart, 'data')!.lines.map(l => l.shape)).toEqual(shapes);
      expect(reference[chart].filter(e => e.lines[0]!.shape).map(e => e.name)).toEqual(fields);
      const names = reference[chart].map(e => e.name);
      expect(names).toEqual(expect.arrayContaining([...own, 'tooltip']));
    },
  );

  test.each(['treemapChart', 'sunburstChart'] as const)('%s takes one tree as its data', chart => {
    expect(types(entry(chart, 'data'))).toEqual({ '': 'Nested | readonly Nested[] | null' });
    expect(entry(chart, 'shade')).toBeDefined();
  });

  test('a new chart has its types, descriptions and defaults, its own over the shared ones', () => {
    expect(types(entry('boxPlotChart', 'x'))).toEqual({
      rows: 'Name<R> | Accessor<R> | null',
      columns: 'Name<C> | null',
    });
    expect(entry('pieChart', 'inner')!.default).toBe('0');
    expect(entry('radarChart', 'fill')!.default).toBe('0.15');
    expect(entry('heatmapChart', 'colors')!.lines[0]!.description).toMatch(/^Not used/);
    expect(entry('sankeyChart', 'legend')!.default).toBeUndefined();
  });

  test('leaves out what Omit<> drops, at the top and in a nested axis', () => {
    const names = reference.histogramChart.map(e => e.name).filter(n => n.startsWith('xAxis'));
    expect(names).toEqual([
      'xAxis',
      'xAxis.label',
      'xAxis.step',
      'xAxis.format',
      'xAxis.fit',
      'xAxis.domain',
    ]);
  });

  test.each([
    ['PieProps.inner', /\n\s*\/\*\*[^\n]*\*\/(\n\s*inner\?: number;\n\s*\/\*\* Writes each slice)/],
    ['HistogramNumberProps.data', /\n\s*\/\*\* Numbers to count[^\n]*\*\/(\n\s*data\?:)/],
    ['TreeProps.data', /\n\s*\/\*\* A root[^\n]*\*\/(\n\s*data\?:)/],
  ])('%s without a doc comment fails and is named', (where, doc) => {
    const stripped = source.replace(doc, '$1');
    expect(stripped).not.toBe(source);
    expect(() => extract(stripped)).toThrow(`${where} has no doc comment`);
  });

  test('a prop without a doc comment fails and is named', () => {
    const stripped = source.replace(/\n\s*\/\*\*[^\n]*\*\/(\n\s*tooltip\?:)/, '$1');
    expect(stripped).not.toBe(source);
    expect(() => extract(stripped)).toThrow('Base.tooltip has no doc comment');
  });
});

const field = (fn: string, name: string) => api[fn]!.entries.find(e => e.name === name);

describe('extractApi()', () => {
  test("reads an intersection: line() takes Common's fields and its own", () => {
    const names = api.line!.entries.map(e => e.name);
    for (const name of ['key', 'label', 'color', 'alpha', 'yAxis', 'x', 'y', 'curve', 'width', 'fill'])
      expect(names).toContain(name);
    expect(field('line', 'color')!.lines).toEqual([{ type: 'string', description: 'A CSS colour.' }]);
    expect(api.line!.call).toBe('line(options)');
  });

  test("leaves out what Omit<> drops: heatmap's color is its own colour scale and it has no yAxis", () => {
    expect(field('heatmap', 'yAxis')).toBeUndefined();
    expect(field('heatmap', 'color')!.lines.map(l => l.type)).toEqual(['ColorScale']);
    expect(field('heatmap', 'key')).toBeDefined();
  });

  test('lists each mode of a union, and labels a field that only one mode has', () => {
    expect(field('tooltip', 'mode')!.lines.map(l => [l.type, l.mode])).toEqual([
      ["'x'", undefined],
      ["'nearest'", undefined],
    ]);
    expect(field('tooltip', 'title')!.lines.map(l => l.mode)).toEqual(["mode 'x'"]);
    expect(field('tooltip', 'text')!.lines.map(l => l.mode)).toEqual(["mode 'nearest'"]);
  });

  test('reads a default from @default, and the intro from the type when the function has none', () => {
    expect(field('arcs', 'inner')!.default).toBe('0');
    expect(field('arcs', 'labels')!.default).toBeUndefined();
    expect(api.arcs!.intro).toMatch(/^Slices of a pie, or of a ring/);
  });

  test('reads a default written only in a destructured parameter', () => {
    expect(field('legend', 'toggle')!.default).toBe('true');
    expect(field('animate', 'enter')!.default).toBe("'reveal'");
    expect(field('time', 'utc')!.default).toBe('true');
  });

  test("reads band()'s inline object parameter as fields", () => {
    expect(api.band!.call).toBe('band(options)');
    expect(api.band!.entries.map(e => [e.name, e.lines[0]!.type])).toEqual([
      ['label', 'string'],
      ['categories', 'readonly string[]'],
    ]);
  });

  test("reads bare()'s domain from @param, with its initializer as the default", () => {
    expect(api.bare!.call).toBe('bare(domain?)');
    expect(api.bare!.entries).toEqual([
      {
        name: 'domain',
        default: "'data'",
        lines: [
          { type: "Axis['domain']", description: expect.stringMatching(/^'data' \(the default\) fits/) },
        ],
      },
    ]);
  });

  test('a field without a doc comment fails and is named', () => {
    const files = {
      ...coreFiles,
      'marks/line.ts': coreFiles['marks/line.ts']!.replace(/\n\s*\/\*\*[^\n]*\*\/(\n\s*width\?:)/, '$1'),
    };
    expect(files['marks/line.ts']).not.toBe(coreFiles['marks/line.ts']);
    expect(() => extractApi(files, ['line'])).toThrow('LineOptions.width has no doc comment');
  });
});

const rows = [{ day: '2026-11-01', a: 1 }];
const sample = (over: Partial<EasyExample>): Example =>
  example({
    id: 'sample',
    title: 'Sample',
    summary: 'A sample.',
    group: 'Line',
    tags: [],
    chart: 'lineChart',
    data: { file: 'sample.json', rows },
    props: {},
    switches: [],
    notes: [],
    ...over,
  });

describe('join()', () => {
  const one = sample({
    id: 'one',
    props: { x: 'day', xAxis: { label: 'Day' } },
    switches: [{ prop: 'zoom', label: 'Zoom', kind: 'boolean', value: true }],
  });
  const two = sample({
    id: 'two',
    switches: [
      { prop: 'xAxis.label', label: 'Label', kind: 'choice', values: ['Day', 'Date'], value: 'Day' },
    ],
  });

  test("lists each example's entries, fixed props and switches", () => {
    const options = join([one, two], reference);
    expect(options.get('one')!.map(u => u.entry.name)).toEqual(['x', 'xAxis.label', 'zoom']);
    expect(options.get('two')!.map(u => u.entry.name)).toEqual(['xAxis.label']);
  });

  test('a sets switch lists each prop it changes, an option of a prop without its own entry lists the prop, and a node is a value', () => {
    const several = sample({
      id: 'several',
      chart: 'lineChart',
      props: { fill: call('gradient', [0.4, 0]) },
      switches: [
        {
          id: 'axes',
          label: 'Axes',
          kind: 'choice',
          values: ['x', 'y'],
          value: 'x',
          sets: {
            x: [{ prop: 'brush.axes', value: 'x' }],
            y: [
              { prop: 'brush.axes', value: 'y' },
              { prop: 'yAxis.label', value: 'Y' },
            ],
          },
        },
      ],
    });
    expect(
      join([several], reference)
        .get('several')!
        .map(u => u.entry.name),
    ).toEqual(['fill', 'brush', 'yAxis.label']);
  });

  test('an axis given as an empty object is listed by its own name', () => {
    const empty = sample({ id: 'empty', props: { xAxis: {} } });
    expect(
      join([empty], reference)
        .get('empty')!
        .map(u => u.entry.name),
    ).toEqual(['xAxis']);
  });

  test('a switch not in the reference fails, naming the example and the prop', () => {
    const bad = sample({
      id: 'bad',
      switches: [{ prop: 'xAxis.lable', label: 'Label', kind: 'boolean', value: true }],
    });
    expect(() => join([bad], reference)).toThrow(
      'example "bad": "xAxis.lable" is not an option of lineChart',
    );
  });

  test('a fixed prop not in the reference fails', () => {
    expect(() =>
      join([sample({ id: 'odd', chart: 'barChart', props: { curve: 'step' } })], reference),
    ).toThrow('example "odd": "curve" is not an option of barChart');
  });

  test("the site's examples, the unlisted definitions and the test plots all resolve, with the fields a spread supplies", () => {
    const options = join([...examples.values(), ...unlisted, ...definitions], pages, api);
    expect(options.get('line-zoom')!.map(u => u.entry.name)).toEqual(['zoom', 'legend', 'tooltip', 'curve']);
    for (const [id, page, names] of [
      ['pie-donut', 'pieChart', ['inner', 'text']],
      ['funnel', 'funnelChart', ['legend', 'fill']],
      ['radial-bars', 'radialBarChart', ['max', 'legend', 'sweep']],
      ['radar', 'radarChart', ['max', 'legend', 'fill']],
      ['heatmap', 'heatmapChart', ['x', 'y', 'xAxis.label', 'yAxis.label', 'legend']],
      ['histogram', 'histogramChart', ['xAxis.label', 'yAxis.label', 'colors', 'bins']],
      ['box-plot', 'boxPlotChart', ['xAxis.label', 'yAxis.label', 'colors', 'fill']],
      ['candlesticks', 'candlestickChart', ['xAxis.label', 'colors', 'down']],
      ['sankey', 'sankeyChart', ['blend']],
      ['treemap', 'treemapChart', ['shade', 'colors']],
      ['sunburst', 'sunburstChart', ['shade', 'colors']],
      ['error-bars', 'scatterChart', ['x', 'errorBars', 'xAxis.label', 'yAxis.label', 'colors']],
      ['bubbles', 'scatterChart', ['r', 'alpha', 'xAxis.label', 'yAxis.label', 'colors', 'ring']],
      [
        'two-y-axes',
        'comboChart',
        ['lines', 'y2Bars', 'xAxis.label', 'yAxis.label', 'y2Axis.label', 'colors', 'y2Axis', 'bars'],
      ],
      [
        'line-log',
        'lineChart',
        ['xAxis.label', 'xAxis.domain', 'yAxis.label', 'yAxis.scale', 'yAxis.format', 'colors'],
      ],
      [
        'line-annotated',
        'lineChart',
        ['rules', 'zones', 'xAxis.label', 'xAxis.domain', 'yAxis.label', 'yAxis.domain', 'colors', 'fill'],
      ],
      ['line-brush', 'lineChart', ['y', 'xAxis.label', 'yAxis.label', 'colors', 'brush', 'zoom']],
      [
        'line-live',
        'lineChart',
        ['xAxis.label', 'xAxis.domain', 'yAxis.label', 'yAxis.domain', 'colors', 'animate'],
      ],
      [
        'strip-plot',
        'scatterChart',
        ['x', 'y', 'shape', 'alpha', 'xAxis.label', 'yAxis.label', 'colors', 'r'],
      ],
    ] as const)
      expect(options.get(id)!.map(u => `${u.page}.${u.entry.name}`)).toEqual(names.map(n => `${page}.${n}`));
    for (const [id, page, names] of [
      ['test-histogram', 'bar', ['x1', 'x2', 'y1', 'y2']],
      ['test-box-plot', 'box', ['min', 'q1', 'median', 'q3', 'max']],
      ['test-sankey', 'sankey', ['nodes', 'source', 'target', 'value']],
      ['test-sunburst', 'sunburst', ['nodes', 'parent', 'value']],
      ['test-over-tree', 'treemap', ['nodes', 'parent', 'value']],
    ] as const)
      expect(options.get(id)!.map(u => `${u.page}.${u.entry.name}`)).toEqual(
        expect.arrayContaining(names.map(n => `${page}.${n}`)),
      );
  });

  test('an option of a union is described by the members the example can be, from the fields it gives', () => {
    const options = join(definitions, pages, api);
    const described = (id: string, path: string) =>
      options
        .get(id)!
        .find(u => `${u.page}.${u.entry.name}` === path)!
        .lines.map(l => l.description);
    expect(described('test-two-axes', 'bar.x')).toEqual(["The place of each bar's category on a band axis."]);
    expect(described('test-two-axes', 'bar.y')).toEqual(["Each bar's value."]);
    expect(described('test-histogram', 'bar.x1')).toEqual(['One end of each bar along x, in data units.']);
    expect(described('test-candlesticks', 'tooltip.mode')).toEqual([
      'Shows what is nearest the pointer, within 20 CSS pixels.',
    ]);
  });
});

const tree = {
  marks: [mark('v', 'line', { x: col('day', 'time'), y: col('a'), color: '#000' })],
  use: [
    feature('tip', 'tooltip', { mode: 'nearest', text: fn('l => l', (l: string) => l) }),
    feature('z', 'zoom'),
  ],
} satisfies Tree;
const plotted = example({
  id: 'plotted',
  title: 'Plotted',
  summary: 'A plot.',
  group: 'Line',
  tags: [],
  notes: [],
  kind: 'plot',
  tree,
  data: { file: 'sample.json', rows },
  switches: [
    {
      id: 'width',
      label: 'Width',
      target: 'v.width',
      kind: 'choice',
      values: ['1', '2'],
      value: '1',
      puts: { '1': 1, '2': 2 },
    },
    { id: 'zoom', label: 'Zoom', target: 'z.on', kind: 'boolean', value: true },
  ],
});

describe('join() of a plot definition', () => {
  test("lists <mark>.<arg> and <feature>.<arg> from the tree's arguments, then the switches' targets", () => {
    const options = join([plotted], pages);
    expect(options.get('plotted')!.map(u => `${u.page}.${u.entry.name}`)).toEqual([
      'line.x',
      'line.y',
      'line.color',
      'tooltip.mode',
      'tooltip.text',
      'line.width',
    ]);
  });

  test('an argument not in the reference fails, naming the example and the path', () => {
    const bad = {
      ...plotted,
      id: 'bad',
      tree: { marks: [{ ...tree.marks[0], args: { ...tree.marks[0].args, fil: 1 } }] },
    };
    expect(() => join([bad], pages)).toThrow(
      'example "bad": "line.fil" is not an option of line in the reference',
    );
  });

  const targeting = (target: string) => ({
    ...plotted,
    id: 'deep',
    switches: [{ id: 'width', label: 'Width', target, kind: 'boolean', value: true } as const],
  });

  test("a switch into a field of an argument's type links to the argument", () => {
    const options = join([targeting('v.stroke.toward')], pages, api);
    expect(options.get('deep')!.map(u => `${u.page}.${u.entry.name}`)).toContain('line.stroke');
  });

  test('a switch into a field no member of the type has fails, naming the example and the full path', () => {
    expect(() => join([targeting('v.stroke.typo')], pages, api)).toThrow(
      'example "deep": "line.stroke.typo" is not an option of line in the reference',
    );
  });
});
