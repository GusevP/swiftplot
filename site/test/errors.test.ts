import { describe, expect, test } from 'vitest';
import { assign, type Family, type FieldProps } from '../../packages/core/src/charts/fields';
import { source, type Data } from '../../packages/core/src/charts/source';
import { errorsFor, table, xyOnly } from '../src/reference/errors';

type Trigger = { data: Data<never>; props?: FieldProps<never>; family?: Family; name: string };

const triggers: Record<string, Trigger> = {
  'there is no field of numbers for y': { data: [{ a: 'p' }] as never, name: 'a' },
  '"<name>" is text, so the rows look like long data': {
    data: [{ d: 'p', s: 'q', v: 1 }] as never,
    name: 's',
  },
  'there is no field "<name>"': { data: [{ v: 1 }] as never, props: { y: 'w' }, name: 'w' },
  '"<name>" is text, not numbers': { data: [{ v: 1, t: 'a' }] as never, props: { y: 't' }, name: 't' },
  'a scatter chart needs two fields of numbers or dates': {
    data: [{ v: 1 }] as never,
    family: 'scatter',
    name: '',
  },
  'a scatter chart has one y': {
    data: [{ a: 1, b: 2, c: 3 }] as never,
    props: { y: ['b', 'c'] },
    family: 'scatter',
    name: '',
  },
  'with series there is one y': {
    data: [{ x: 1, s: 'a', b: 1, c: 2 }] as never,
    props: { x: 'x', series: 's', y: ['b', 'c'] },
    name: '',
  },
  'Row N is not an [x, y] pair': { data: [[1, 2], [3]] as never, name: '' },
  'Columns differ in length': { data: { a: [1, 2], b: [1] } as never, name: '' },
  'Accessors work on row objects only': { data: { a: [1] } as never, props: { y: () => 1 }, name: '' },
};

const thrown = ({ data, props = {}, family = 'xy' }: Trigger) => {
  try {
    assign(source(data), props, family, 'chart');
  } catch (e) {
    return (e as Error).message;
  }
  return 'nothing thrown';
};

describe('the errors table of llms-full.txt', () => {
  const messages = table.flatMap(row => row.messages);

  test('has every row it is read for', () => {
    expect(messages.sort()).toEqual(Object.keys(triggers).sort());
    for (const m of xyOnly) expect(messages).toContain(m);
  });

  test.each(Object.entries(triggers))('core throws %s', (message, trigger) => {
    expect(thrown(trigger)).toContain(message.replace('<name>', trigger.name).replace('Row N', 'Row 1'));
  });

  test('keeps the scatter rows off the other pages and the long-data rows off the scatter page', () => {
    const of = (chart: Parameters<typeof errorsFor>[0]) => errorsFor(chart).flatMap(r => r.messages);
    expect(of('lineChart').some(m => m.includes('scatter chart'))).toBe(false);
    expect(of('scatterChart')).not.toContain('with series there is one y');
    expect(of('scatterChart')).toContain('a scatter chart has one y');
  });
});
