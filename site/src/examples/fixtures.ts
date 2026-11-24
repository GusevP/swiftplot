import type { Example } from './define';

/** The test definitions, served by `astro dev` only: a production build leaves them out. */
export const fixtures: readonly Example[] = import.meta.env.DEV
  ? (await import('../../test/plot-definitions')).definitions
  : [];
