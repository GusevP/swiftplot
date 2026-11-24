import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { headScript, setFramework, setTheme } from '../src/scripts/preferences';

let root: { dataset: Record<string, string> };
let saved: Map<string, string>;

function stubPage({ search = '', systemDark = false } = {}) {
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('location', { search });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: systemDark && query === '(prefers-color-scheme: dark)',
  }));
}

// oxlint-disable-next-line no-eval -- runs the exact string the page inlines in <head>
const runHead = () => globalThis.eval(headScript);

beforeEach(() => {
  root = { dataset: {} };
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the head script', () => {
  test('the theme is the saved one over the system one', () => {
    saved.set('theme', 'light');
    stubPage({ systemDark: true });
    runHead();
    expect(root.dataset.theme).toBe('light');
  });

  test("with nothing saved, the theme is the system's", () => {
    stubPage({ systemDark: true });
    runHead();
    expect(root.dataset.theme).toBe('dark');
  });

  test('an unknown saved theme falls back to the system one', () => {
    saved.set('theme', 'sepia');
    stubPage({ systemDark: false });
    runHead();
    expect(root.dataset.theme).toBe('light');
  });

  test('?fw= wins over the saved framework and is not saved', () => {
    saved.set('fw', 'vue');
    stubPage({ search: '?fw=react' });
    runHead();
    expect(root.dataset.fw).toBe('react');
    expect(saved.get('fw')).toBe('vue');
  });

  test('without ?fw=, the framework is the saved one', () => {
    saved.set('fw', 'vue');
    stubPage();
    runHead();
    expect(root.dataset.fw).toBe('vue');
  });

  test('with nothing saved, the framework is js', () => {
    stubPage();
    runHead();
    expect(root.dataset.fw).toBe('js');
  });

  test('an unknown ?fw= falls back to the saved framework, and an unknown saved one to js', () => {
    saved.set('fw', 'vue');
    stubPage({ search: '?fw=svelte' });
    runHead();
    expect(root.dataset.fw).toBe('vue');

    saved.set('fw', 'angular');
    runHead();
    expect(root.dataset.fw).toBe('js');
  });

  test('blocked storage still sets both attributes', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    stubPage({ search: '?fw=vue', systemDark: true });
    runHead();
    expect(root.dataset).toEqual({ theme: 'dark', fw: 'vue' });
  });
});

describe('an explicit switch', () => {
  test('sets the attribute and saves the theme', () => {
    stubPage();
    setTheme('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(saved.get('theme')).toBe('dark');
  });

  test('sets the attribute and saves the framework, even when ?fw= is set', () => {
    stubPage({ search: '?fw=react' });
    setFramework('vue');
    expect(root.dataset.fw).toBe('vue');
    expect(saved.get('fw')).toBe('vue');
  });
});
