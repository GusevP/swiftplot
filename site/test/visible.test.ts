import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { whileNear, whileVisible } from '../src/charts/visible';

let queued: Map<number, FrameRequestCallback>;
let seen: (shown: boolean) => void;
let observed: number;
let reduced: boolean;
let page: EventTarget & { hidden: boolean };
let motion: EventTarget;

const run = (frames: number) => {
  for (let i = 0; i < frames; i++) {
    const now = [...queued];
    queued.clear();
    for (const [, callback] of now) callback(i * 16);
  }
};

beforeEach(() => {
  queued = new Map();
  reduced = false;
  page = Object.assign(new EventTarget(), { hidden: false });
  motion = Object.defineProperty(new EventTarget(), 'matches', { get: () => reduced });
  let id = 0;
  observed = 0;
  vi.stubGlobal('document', page);
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('innerHeight', 600);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id));
  vi.stubGlobal('matchMedia', () => motion);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        seen = shown => callback([{ isIntersecting: shown }]);
      }
      observe() {
        observed++;
      }
      unobserve() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

const el = {} as Element;

test('an animation runs only while its element is on screen', () => {
  const step = vi.fn();
  whileVisible(el, step);
  run(3);
  expect(step).not.toHaveBeenCalled();

  seen(true);
  run(3);
  expect(step).toHaveBeenCalledTimes(3);

  seen(false);
  run(3);
  expect(step).toHaveBeenCalledTimes(3);
  expect(queued.size).toBe(0);

  seen(true);
  run(2);
  expect(step).toHaveBeenCalledTimes(5);
});

test('an animation stops while the tab is hidden and resumes when it is shown', () => {
  const step = vi.fn();
  whileVisible(el, step);
  seen(true);
  run(2);

  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  run(3);
  expect(step).toHaveBeenCalledTimes(2);
  expect(queued.size).toBe(0);

  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  run(2);
  expect(step).toHaveBeenCalledTimes(4);
});

test('an animation never runs under reduced motion', () => {
  reduced = true;
  const step = vi.fn();
  whileVisible(el, step);
  seen(true);
  page.dispatchEvent(new Event('visibilitychange'));
  run(3);
  expect(step).not.toHaveBeenCalled();
});

test('an animation stops when reduced motion is turned on and resumes when it is turned off', () => {
  const step = vi.fn();
  whileVisible(el, step);
  seen(true);
  run(2);

  reduced = true;
  motion.dispatchEvent(new Event('change'));
  run(3);
  expect(step).toHaveBeenCalledTimes(2);
  expect(queued.size).toBe(0);

  reduced = false;
  motion.dispatchEvent(new Event('change'));
  run(2);
  expect(step).toHaveBeenCalledTimes(4);
});

test('one element seen twice still runs one loop', () => {
  const step = vi.fn();
  whileVisible(el, step);
  seen(true);
  seen(true);
  run(1);
  expect(step).toHaveBeenCalledTimes(1);
});

function card() {
  const loads: (() => void)[] = [];
  const destroy = vi.fn();
  const mount = vi.fn(() => ({ destroy }));
  const at = { top: 100, rendered: true };
  const box = {
    getBoundingClientRect: () => ({ top: at.top, bottom: at.top + 200, left: 0, right: 300 }),
    getClientRects: () => (at.rendered ? [{}] : []),
  } as unknown as Element;
  whileNear(box, () => new Promise<void>(done => loads.push(done)), mount);
  const land = async () => {
    for (const done of loads.splice(0)) done();
    await Promise.resolve();
  };
  return { mount, destroy, land, at };
}

test('a card mounts near the viewport, is destroyed away from it, and mounts again on return', async () => {
  const { mount, destroy, land } = card();
  seen(true);
  await land();
  expect(mount).toHaveBeenCalledTimes(1);

  seen(false);
  expect(destroy).toHaveBeenCalledTimes(1);

  seen(true);
  await land();
  expect(mount).toHaveBeenCalledTimes(2);
  expect(destroy).toHaveBeenCalledTimes(1);
});

test('a card whose destroy throws still mounts again on return', async () => {
  const { mount, destroy, land } = card();
  destroy.mockImplementationOnce(() => {
    throw new Error('release failed');
  });
  seen(true);
  await land();
  expect(() => seen(false)).toThrow('release failed');

  seen(true);
  await land();
  expect(mount).toHaveBeenCalledTimes(2);
  expect(destroy).toHaveBeenCalledTimes(1);
});

test('a load that lands after the card has left is dropped', async () => {
  const { mount, land } = card();
  seen(true);
  seen(false);
  await land();
  expect(mount).not.toHaveBeenCalled();
});

test('a card that comes back before its first load lands mounts one chart', async () => {
  const { mount, land } = card();
  seen(true);
  seen(false);
  seen(true);
  await land();
  expect(mount).toHaveBeenCalledTimes(1);
});

test('a load that lands once the card is far away, before the observer says so, is dropped', async () => {
  const { mount, land, at } = card();
  seen(true);
  at.top = 5000;
  await land();
  seen(false);
  expect(mount).not.toHaveBeenCalled();
});

test('a load that lands once the card is hidden, before the observer says so, is dropped', async () => {
  const { mount, land, at } = card();
  seen(true);
  at.rendered = false;
  await land();
  seen(false);
  expect(mount).not.toHaveBeenCalled();
});

test('a dropped load asks the observer again, so a card that is back by then still mounts', async () => {
  const { mount, land, at } = card();
  seen(true);
  at.top = 5000;
  await land();
  expect(observed).toBe(2);

  at.top = 100;
  seen(true);
  await land();
  expect(mount).toHaveBeenCalledTimes(1);
});
