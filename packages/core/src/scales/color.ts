/** A colour for each value of a domain, as a table of 256 pixels to index into. */
export type ColorScale = {
  /** The values that get the first and the last colour; the extent of the data when left out. */
  domain?: [number, number];
  /** The first and the last stop, as given. */
  stops: string[];
  /** Pixels as ImageData holds them when read through a Uint32Array. */
  table: Uint32Array;
};

const channels = (hex: string) => {
  const h = hex.length === 4 ? hex.replace(/[^#]/g, c => c + c) : hex;
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
};

/**
 * Colours running through the stops, which are #rgb or #rrggbb, in equal steps.
 * ponytail: blended in sRGB, and the pixel layout assumes a little-endian machine, as every
 * browser's is; a perceptual blend or a byte-order check when one of them matters.
 */
export function sequential(
  o: {
    /** The colours to run through, as #rgb or #rrggbb. @default ['#f7fbff', '#6baed6', '#08306b'] */
    stops?: string[];
    /** The values that get the first and the last colour; the extent of the data when left out. */
    domain?: [number, number];
  } = {},
): ColorScale {
  const stops = o.stops?.length ? o.stops : ['#f7fbff', '#6baed6', '#08306b'];
  const rgb = stops.map(channels);
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const at = (i / 255) * (rgb.length - 1);
    const [a, b] = [rgb[Math.floor(at)]!, rgb[Math.ceil(at)]!];
    const [r, g, bl] = a.map((v, k) => Math.round(v + (b[k]! - v) * (at % 1)));
    table[i] = (255 << 24) | (bl! << 16) | (g! << 8) | r!;
  }
  return { domain: o.domain, stops, table };
}
