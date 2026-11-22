/** The chart's own colours: text, tick marks and muted text, grid lines, and the tooltip's box. */
export type Theme = { text: string; muted: string; grid: string; surface: string; border: string };

export const light: Theme = { text: '#444', muted: '#888', grid: '#e5e5e5', surface: '#fff', border: '#ccc' };

export const dark: Theme = {
  text: '#d4d4d4',
  muted: '#8f8f8f',
  grid: '#333333',
  surface: '#1a1a1a',
  border: '#444444',
};
