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

export const BREAK = plain('\n');
export const indented = (tokens: readonly Token[], by: string) =>
  tokens.flatMap(t => (t === BREAK ? [t, plain(by)] : [t]));

export const text = (tokens: readonly Token[]): string => tokens.map(t => t.text).join('');

const WORDS = new Set(
  'import from export const let function return if else new typeof null undefined true false default for of'.split(
    ' ',
  ),
);
const PIECE =
  /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[\s\S]/g;

/** Hand-written source as tokens: its strings, numbers and keywords are told apart, the rest is plain. */
export const tokenize = (source: string): Token[] =>
  [...source.matchAll(PIECE)].map(([piece]) =>
    /^['"`]/.test(piece)
      ? string(piece)
      : /^\d/.test(piece)
        ? number(piece)
        : WORDS.has(piece)
          ? keyword(piece)
          : plain(piece),
  );
