import { readdirSync } from 'node:fs';
import { pagePath } from '../../src/components/path';

export const site = 'https://swiftplot.dev';
export const dist = new URL('../../dist/', import.meta.url);

export const pages = new Map(
  readdirSync(dist, { recursive: true, encoding: 'utf8' })
    .filter(f => f.endsWith('.html'))
    .map(f => [pagePath(new URL(`/${f}`, site)), f]),
);
