import { arcs, legend, type Options } from 'swiftplot';
import type {
  LineChartProps as CoreLineChartProps,
  PieChartProps as CorePieChartProps,
  TreemapChartProps as CoreTreemapChartProps,
} from 'swiftplot/charts';
import { expectTypeOf, test } from 'vitest';

import type { HostProps } from '../src/bind.js';
import {
  AreaChart,
  BarChart,
  LineChart,
  PieChart,
  Plot,
  ScatterChart,
  TreemapChart,
  type AreaChartProps,
  type BarChartProps,
  type LineChartProps,
  type PieChartProps,
  type PlotProps,
  type ScatterChartProps,
  type TreemapChartProps,
} from '../src/index.js';

type Row = { date: string; api: number; note: string };

test('types: JSX checks field names against the data as the stage 1 functions do', () => {
  const rows: Row[] = [];
  const columns = { t: new Float64Array(), v: [] as number[] };
  const declared: number[][] = [];
  const elements = [
    <LineChart data={rows} x="date" y="api" />,
    <LineChart data={rows} y={['api']} className="c" style={{ height: 200 }} id="i" onError={() => {}} />,
    <LineChart
      data={rows}
      x={d => {
        expectTypeOf(d).toEqualTypeOf<Row>();
        return d.date;
      }}
      series={d => d.note}
    />,
    // @ts-expect-error not a field of the rows
    <LineChart data={rows} x="nope" y="api" />,
    // @ts-expect-error a text field is not a y
    <LineChart data={rows} x="date" y="note" />,
    <LineChart data={null as Row[] | null} x="date" />,
    <LineChart x="date" y="api" />,
    <LineChart data={columns} x="t" y="v" />,
    // @ts-expect-error not a column
    <LineChart data={columns} x="w" y="v" />,
    // @ts-expect-error an accessor works on rows only
    <LineChart data={columns} x={() => 1} y="v" />,
    <LineChart data={[1, null, 3]} tooltip />,
    // @ts-expect-error a number array has no fields to name
    <LineChart data={new Float32Array()} y="value" />,
    <LineChart data={[] as [number, number][]} zoom />,
    // @ts-expect-error pairs have no fields to name
    <LineChart data={[] as [number, number][]} x="x" y="y" />,
    // @ts-expect-error pairs have no fields to name, even when not inferred as tuples
    <LineChart data={declared} y="length" />,
    // @ts-expect-error a line chart does not stack
    <LineChart data={rows} stack />,
    <AreaChart data={rows} x="date" y={['api']} stack />,
    // @ts-expect-error not a field of the rows
    <AreaChart data={rows} x="nope" />,
    <BarChart data={rows} x="date" y="api" stack />,
    // @ts-expect-error a text field is not a y
    <BarChart data={rows} y="note" />,
    <ScatterChart data={rows} x="date" y="api" r="api" />,
    <ScatterChart data={[] as number[]} r={3} />,
    // @ts-expect-error one y per scatter chart
    <ScatterChart data={rows} y={['api', 'api']} />,
    // @ts-expect-error a text field is not an r
    <ScatterChart data={rows} r="note" />,
    // @ts-expect-error a number array has no field for r
    <ScatterChart data={[] as number[]} r="value" />,
  ];
  expectTypeOf(elements).toBeArray();
});

test('types: PieChart checks its field names against the data; TreemapChart takes a nested tree', () => {
  const rows: Row[] = [];
  const elements = [
    <PieChart data={rows} label="note" value="api" inner={0.6} className="c" />,
    <PieChart data={rows} label={d => d.note} value={d => d.api} />,
    <PieChart data={[1, 2]} />,
    // @ts-expect-error not a field of the rows
    <PieChart data={rows} label="nope" value="api" />,
    // @ts-expect-error a text field is not a value
    <PieChart data={rows} label="note" value="date" />,
    // @ts-expect-error a pie has no x
    <PieChart data={rows} x="note" />,
    <TreemapChart data={{ name: 'all', children: [{ name: 'a', value: 1 }] }} shade={0.5} className="c" />,
    <TreemapChart data={[{ name: 'a', value: 1 }]} />,
    // @ts-expect-error rows are not a tree
    <TreemapChart data={rows} />,
    // @ts-expect-error a child needs a name
    <TreemapChart data={{ name: 'all', children: [{ value: 1 }] }} />,
  ];
  expectTypeOf(elements).toBeArray();
  expectTypeOf<PieChartProps<Row[]>>().toEqualTypeOf<CorePieChartProps<Row[]> & HostProps>();
  expectTypeOf<TreemapChartProps>().toEqualTypeOf<CoreTreemapChartProps & HostProps>();
});

test('types: Plot takes the core options plus the host props and needs marks; the props types are exported', () => {
  const elements = [
    <Plot
      frame="polar"
      marks={[arcs({ values: [1], colors: ['red'] })]}
      use={[legend()]}
      className="c"
      onError={() => {}}
    />,
    // @ts-expect-error marks is required
    <Plot frame="polar" />,
    // @ts-expect-error not an option
    <Plot marks={[]} nope />,
  ];
  expectTypeOf(elements).toBeArray();
  expectTypeOf<PlotProps>().toEqualTypeOf<Options & HostProps>();
  expectTypeOf<LineChartProps<Row[]>>().toEqualTypeOf<CoreLineChartProps<Row[]> & HostProps>();
  expectTypeOf<AreaChartProps<Row[]>['stack']>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<BarChartProps<Row[]>['stack']>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<NonNullable<ScatterChartProps<Row[]>['y']>>().not.toBeArray();
});
