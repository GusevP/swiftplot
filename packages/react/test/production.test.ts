import { createElement as h } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { dots, type Feature, type Hover, type Layout } from 'swiftplot';
import { expect, onTestFinished, test, vi } from 'vitest';

import { host, hover } from '../../core/test/helpers.js';
import { Plot } from '../src/index.js';

test('in a production build a Plot is made once, follows its marks and overlay, and is destroyed once', async () => {
  const errors = vi.spyOn(console, 'error');
  onTestFinished(() => errors.mockRestore());
  let [made, destroyed] = [0, 0];
  const counted: Feature = () => (made++, { destroy: () => void destroyed++ });
  const many = Array.from({ length: 11 }, (_, x) => ({ x }));
  const marksOf = (d: { x: number }[]) => [
    dots({ x: d.map(v => v.x), y: d.map(() => 0.5), r: d.map(() => 4), color: '#ff0000' }),
  ];
  const use = [counted];
  const props = {
    width: 200,
    height: 100,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    x: { label: '', domain: [0, 10] as [number, number] },
    y: { label: '', domain: [0, 1] as [number, number] },
    use,
  };
  // Keyless on purpose: React's development build logs an error for it, the production build does not.
  const overlay = (data: { x: number }[]) => (layout: Layout, at: Hover | null) => [
    h('i', null, `${layout.width} ${at?.hit ? data[at.hit.row!]!.x : 'none'}`),
    h('s'),
  ];
  const node = (data: { x: number }[], on: boolean) =>
    h(Plot, { ...props, marks: marksOf(data), ...(on && { children: overlay(data) }) });
  const container = host();
  const root = createRoot(container);
  flushSync(() => root.render(node(many, false)));
  const el = container.firstElementChild as HTMLElement;
  const text = () => el.querySelector('i')?.textContent;
  hover(el, 198, 50);
  expect(text()).toBeUndefined();
  for (let n = 0; n < 2; n++) {
    flushSync(() => root.render(node(many, true)));
    await expect.poll(text).toBe('200 10');
    flushSync(() => root.render(node(many, false)));
    await expect.poll(text).toBeUndefined();
  }
  flushSync(() => root.render(node(many, true)));
  await expect.poll(text).toBe('200 10');
  flushSync(() => root.render(node(many.slice(0, 1), true)));
  await expect.poll(text).toBe('200 none');
  flushSync(() => root.unmount());
  expect([made, destroyed, el.isConnected, errors.mock.calls]).toEqual([1, 1, false, []]);
});
