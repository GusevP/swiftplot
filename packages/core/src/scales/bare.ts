import { scale } from '../scale.js';
import type { Axis, Resolved } from '../types.js';

function resolve(axis: Axis, extent: () => [number, number]): Resolved {
  const { lo, hi } = scale(axis.domain, typeof axis.domain === 'string' ? extent() : axis.domain);
  return { lo, hi, ticks: [] };
}

/** An axis that places the marks and shows nothing itself: no ticks, no grid lines and no label. */
export const bare = (domain: Axis['domain'] = 'data'): Axis => ({ domain, label: '', scale: resolve });
