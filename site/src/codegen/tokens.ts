export const kinds = ['keyword', 'string', 'number', 'comment', 'plain'] as const;
export type Kind = (typeof kinds)[number];
export type Token = { text: string; kind: Kind };

const token =
  (kind: Kind) =>
  (text: string): Token => ({ text, kind });

export const keyword = token('keyword');
export const string = token('string');
export const number = token('number');
export const plain = token('plain');

export const text = (tokens: readonly Token[]): string => tokens.map(t => t.text).join('');
