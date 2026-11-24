import ts from 'typescript';
import type { ChartName } from '../examples/define';

export const shapes = {
  rows: 'RowProps',
  columns: 'ColumnProps',
  numbers: 'NumberProps',
  pairs: 'PairProps',
} as const;
export type Shape = keyof typeof shapes;

const charts: Record<ChartName, string> = {
  lineChart: 'LineProps',
  areaChart: 'AreaProps',
  barChart: 'BarProps',
  scatterChart: 'ScatterProps',
};

export type Line = { shape?: Shape; mode?: string; type: string; description: string };
export type Entry = { name: string; default?: string; lines: Line[] };

type Params = ReadonlyMap<string, string[]>;

export function extract(source: string): Record<ChartName, Entry[]> {
  const file = ts.createSourceFile('types.ts', source, ts.ScriptTarget.Latest, true);
  const aliases = new Map<string, ts.TypeAliasDeclaration>();
  for (const s of file.statements) if (ts.isTypeAliasDeclaration(s)) aliases.set(s.name.text, s);
  const alias = (name: string) => aliases.get(name) ?? fail(`no type ${name} in types.ts`);

  const local = (node: ts.TypeNode) =>
    ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
      ? aliases.get(node.typeName.text)
      : undefined;

  const member = (node: ts.TypeNode, name: string): ts.PropertySignature | undefined => {
    if (ts.isIntersectionTypeNode(node))
      return node.types.map(t => member(t, name)).findLast(m => m !== undefined);
    if (ts.isTypeLiteralNode(node))
      return node.members.find(
        (m): m is ts.PropertySignature => ts.isPropertySignature(m) && text(m.name) === name,
      );
    const decl = local(node);
    return decl && member(decl.type, name);
  };

  const byShape = (node: ts.Node): node is ts.IndexedAccessTypeNode =>
    ts.isIndexedAccessTypeNode(node) && local(node.objectType)?.name.text === 'Props';
  const mentionsShape = (node: ts.Node): boolean => byShape(node) || !!ts.forEachChild(node, mentionsShape);

  const wrap = (u: string[]) =>
    u.length > 1 || u[0]?.startsWith('readonly ') ? `(${u.join(' | ')})` : u.join('');

  /** A union as its members; `never` is the empty union. */
  const render = (node: ts.TypeNode, shape: Shape | undefined, params: Params): string[] => {
    if (ts.isUnionTypeNode(node)) return [...new Set(node.types.flatMap(t => render(t, shape, params)))];
    if (node.kind === ts.SyntaxKind.NeverKeyword) return [];
    if (ts.isParenthesizedTypeNode(node)) return render(node.type, shape, params);
    if (ts.isArrayTypeNode(node)) return [`${wrap(render(node.elementType, shape, params))}[]`];
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword)
      return render(node.type, shape, params).map(t => `readonly ${t}`);
    if (byShape(node)) {
      const key = node.indexType;
      if (!shape || !ts.isLiteralTypeNode(key) || !ts.isStringLiteral(key.literal))
        fail(`cannot read ${node.getText()}`);
      const m = member(alias(shapes[shape!]).type, key.literal.text);
      return m?.type ? render(m.type, shape, params) : [];
    }
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const name = node.typeName.text;
      const args = (node.typeArguments ?? []).map(a => render(a, shape, params));
      if (params.has(name)) return params.get(name)!;
      if (name === 'Exclude' && args[1]?.join() === 'readonly unknown[]')
        return args[0]!.filter(t => !t.endsWith('[]'));
      if (name === 'NonNullable') return args[0]!.filter(t => t !== 'null' && t !== 'undefined');
      const decl = aliases.get(name);
      if (decl && ts.isUnionTypeNode(decl.type))
        return render(decl.type, shape, new Map(decl.typeParameters?.map((p, i) => [p.name.text, args[i]!])));
      return [args.length ? `${name}<${args.map(a => a.join(' | ')).join(', ')}>` : name];
    }
    return [node.getText()];
  };

  const extractChart = (chart: string): Entry[] => {
    const entries = new Map<string, Entry & { decl: ts.PropertySignature }>();

    const add = (m: ts.PropertySignature, shape: Shape | undefined, prefix: string) => {
      const name = prefix + text(m.name);
      if (entries.get(name)?.decl === m) return;
      const where = `${ts.findAncestor(m, ts.isTypeAliasDeclaration)?.name.text}.${text(m.name)}`;
      if (!m.type) fail(`${where} has no type`);
      const each = shape ? [shape] : mentionsShape(m.type!) ? (Object.keys(shapes) as Shape[]) : [undefined];
      const present = each
        .map(s => ({ shape: s, type: render(m.type!, s, new Map()) }))
        .filter(t => t.type.length);
      if (!present.length) return;
      const doc = ts.getJSDocCommentsAndTags(m).filter(ts.isJSDoc).at(-1);
      const description = ts.getTextOfJSDocComment(doc?.comment)?.trim();
      if (!description) fail(`${where} has no doc comment`);
      const fallback = doc?.tags?.find(t => t.tagName.text === 'default');
      const lines = present.map(t => ({
        ...(t.shape && { shape: t.shape }),
        type: t.type.join(' | '),
        description: description!,
      }));
      const existing = entries.get(name);
      if (shape && existing?.lines[0]?.shape) existing.lines.push(...lines);
      else
        entries.set(name, {
          name,
          ...(fallback && { default: ts.getTextOfJSDocComment(fallback.comment)!.trim() }),
          lines,
          decl: m,
        });
      const nested = local(m.type!);
      if (nested && !nested.typeParameters) walk(nested.type, undefined, `${name}.`);
    };

    const walk = (node: ts.TypeNode, shape: Shape | undefined, prefix = ''): void => {
      if (ts.isIntersectionTypeNode(node)) return node.types.forEach(t => walk(t, shape, prefix));
      if (ts.isTypeLiteralNode(node))
        return node.members.forEach(m => ts.isPropertySignature(m) && add(m, shape, prefix));
      const decl = local(node) ?? fail(`cannot walk ${node.getText()}`);
      if (decl.name.text === 'Props')
        return Object.entries(shapes).forEach(([s, a]) => walk(alias(a).type, s as Shape, prefix));
      walk(decl.type, undefined, prefix);
    };

    walk(alias(chart).type, undefined);
    const list: Entry[] = [...entries.values()].map(({ name, default: d, lines }) => ({
      name,
      ...(d !== undefined && { default: d }),
      lines,
    }));
    return [...list.filter(e => e.lines[0]!.shape), ...list.filter(e => !e.lines[0]!.shape)];
  };

  return Object.fromEntries(
    Object.entries(charts).map(([chart, name]) => [chart, extractChart(name)]),
  ) as Record<ChartName, Entry[]>;
}

const text = (name: ts.PropertyName) =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText();

function fail(message: string): never {
  throw new Error(`reference: ${message}`);
}

/** A public function of the explicit API, or a type that stands in for one, as its reference page shows it. */
export type Fn = {
  name: string;
  call: string;
  intro: string;
  entries: Entry[];
  /** Whether a path of fields from an entry down (`stroke.toward`) is one some member of its type has. */
  accepts(path: readonly string[]): boolean;
  /** Whether `line` describes a member of its union that options with these fields can be. */
  fits(line: Line, given: ReadonlySet<string>): boolean;
};

/**
 * Reads each name exported from core's index.ts: a function's parameters, with a parameter of an
 * object type as that type's fields, or a type alias's fields. `files` maps paths under core's
 * src/ (`marks/line.ts`) to their text.
 */
export function extractApi(
  files: Readonly<Record<string, string>>,
  names: readonly string[],
): Record<string, Fn> {
  const root = '/core/';
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es5.d.ts'],
    types: [],
    noEmit: true,
  };
  const base = ts.createCompilerHost(options);
  const own = (name: string) => (name.startsWith(root) ? files[name.slice(root.length)] : undefined);
  const host: ts.CompilerHost = {
    ...base,
    fileExists: name => own(name) !== undefined || (!name.startsWith(root) && base.fileExists(name)),
    readFile: name => own(name) ?? base.readFile(name),
    directoryExists: name => name.startsWith(root.slice(0, -1)) || !!base.directoryExists?.(name),
    getSourceFile: (name, version, ...rest) => {
      const source = own(name);
      return source === undefined
        ? base.getSourceFile(name, version, ...rest)
        : ts.createSourceFile(name, source, version, true);
    },
  };
  const program = ts.createProgram([`${root}index.ts`], options, host);
  const checker = program.getTypeChecker();
  const index = program.getSourceFile(`${root}index.ts`) ?? fail('no index.ts among the core files');
  const exported = new Map(
    checker
      .getExportsOfModule(checker.getSymbolAtLocation(index)!)
      .map(s => [s.name, s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s]),
  );

  const flat = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const docOf = (node: ts.Node) => ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc).at(-1);
  const comment = (node: ts.Node) =>
    flat((ts.getTextOfJSDocComment(docOf(node)?.comment) ?? '').split('ponytail:')[0]!);

  const aliasOf = (node: ts.TypeReferenceNode) => {
    const s = checker.getSymbolAtLocation(node.typeName);
    return (s && s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)?.declarations?.find(
      ts.isTypeAliasDeclaration,
    );
  };
  const objectLike = (node: ts.TypeNode): boolean => {
    if (ts.isTypeLiteralNode(node)) return true;
    if (ts.isParenthesizedTypeNode(node)) return objectLike(node.type);
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) return node.types.every(objectLike);
    if (!ts.isTypeReferenceNode(node)) return false;
    if (node.typeName.getText() === 'Omit') return objectLike(node.typeArguments![0]!);
    const decl = aliasOf(node);
    return !!decl && !decl.typeParameters && objectLike(decl.type);
  };

  type Field = ts.PropertySignature | ts.MethodSignature;
  const field = (d: ts.Declaration): d is Field =>
    (ts.isPropertySignature(d) || ts.isMethodSignature(d)) &&
    d.type?.kind !== ts.SyntaxKind.NeverKeyword &&
    d.type?.kind !== ts.SyntaxKind.UndefinedKeyword;
  const members = new WeakMap<Line, ((given: ReadonlySet<string>) => boolean)[]>();
  const fields = (type: ts.Type, owner: string, given: ReadonlyMap<string, string> = new Map()): Entry[] => {
    const parts = type.isUnion() ? type.types : [type];
    const fit = parts.map(part => {
      const props = checker.getPropertiesOfType(part).filter(p => p.declarations?.some(field));
      const names = new Set(props.map(p => p.name));
      const required = props.filter(p => !(p.flags & ts.SymbolFlags.Optional)).map(p => p.name);
      return (given: ReadonlySet<string>) =>
        [...given].every(k => names.has(k)) && required.every(k => given.has(k));
    });
    const modeOf = (part: ts.Type) => {
      const m = part.getProperty('mode');
      const t = m && checker.getTypeOfSymbol(m);
      return t?.isStringLiteral() ? `mode '${t.value}'` : undefined;
    };
    const modes = parts.every(modeOf) ? parts.map(modeOf) : undefined;
    const found = new Map<string, Map<Field, string | undefined>>();
    const inParts = new Map<Field, number[]>();
    parts.forEach((part, i) => {
      for (const p of checker.getPropertiesOfType(part))
        for (const d of p.declarations ?? []) {
          if (!field(d)) continue;
          const at = found.get(p.name) ?? found.set(p.name, new Map()).get(p.name)!;
          if (!at.has(d)) at.set(d, p.name === 'mode' ? undefined : modes?.[i]);
          inParts.set(d, [...(inParts.get(d) ?? []), i]);
        }
    });
    return [...found].map(([name, decls]) => {
      const lines: Line[] = [];
      let fallback: string | undefined;
      for (const [d, mode] of decls) {
        const where = `${ts.findAncestor(d, ts.isTypeAliasDeclaration)?.name.text ?? owner}.${name}`;
        const description = comment(d) || fail(`${where} has no doc comment`);
        const tag = docOf(d)?.tags?.find(t => t.tagName.text === 'default');
        fallback ??= tag && flat(ts.getTextOfJSDocComment(tag.comment) ?? '');
        const type = ts.isMethodSignature(d)
          ? `(${d.parameters.map(p => p.getText()).join(', ')}) => ${d.type?.getText() ?? 'void'}`
          : (d.type?.getText() ?? fail(`${where} has no type`));
        const line = { type: flat(type), description, ...(mode && { mode }) };
        let kept = lines.find(
          l => l.type === line.type && l.description === line.description && l.mode === line.mode,
        );
        if (!kept) lines.push((kept = line));
        members.set(kept, [...(members.get(kept) ?? []), ...inParts.get(d)!.map(i => fit[i]!)]);
      }
      const value = given.get(name) ?? fallback;
      return { name, ...(value && { default: value }), lines };
    });
  };

  const accepts =
    (roots: readonly ts.Type[]) =>
    (path: readonly string[]): boolean =>
      path.reduce(
        (types, key) =>
          types
            .flatMap(t => (t.isUnion() ? t.types : [t]))
            .flatMap(t => {
              const p = checker.getPropertyOfType(t, key);
              return p ? [checker.getNonNullableType(checker.getTypeOfSymbol(p))] : [];
            }),
        roots,
      ).length > 0;

  const fits = (line: Line, given: ReadonlySet<string>) => members.get(line)?.some(f => f(given)) ?? true;

  const read = (name: string): Fn => {
    const s = exported.get(name) ?? fail(`core exports no ${name}`);
    const alias = s.declarations?.find(ts.isTypeAliasDeclaration);
    if (alias) {
      const type = checker.getDeclaredTypeOfSymbol(s);
      return {
        name,
        call: name,
        intro: comment(alias) || fail(`${name} has no doc comment`),
        entries: fields(type, name),
        accepts: accepts([type]),
        fits,
      };
    }
    const decl = s.valueDeclaration;
    const fn =
      decl && ts.isVariableDeclaration(decl) && decl.initializer && ts.isArrowFunction(decl.initializer)
        ? decl.initializer
        : decl && ts.isFunctionDeclaration(decl)
          ? decl
          : fail(`${name} is not an exported function`);
    const params = fn.parameters.map(p => {
      const object = !!p.type && objectLike(p.type);
      const label = object || !ts.isIdentifier(p.name) ? 'options' : p.name.text;
      return { p, label, object, optional: !!(p.questionToken || p.initializer) };
    });
    const typeDoc = params
      .map(({ p }) => p.type && ts.isTypeReferenceNode(p.type) && aliasOf(p.type))
      .find(a => a);
    const roots = params.flatMap(({ p, object }) => (object ? [checker.getTypeFromTypeNode(p.type!)] : []));
    return {
      name,
      accepts: accepts(roots),
      fits,
      call: `${name}(${params.map(({ label, optional }) => label + (optional ? '?' : '')).join(', ')})`,
      intro: comment(decl!) || (typeDoc && comment(typeDoc)) || fail(`${name}() has no doc comment`),
      entries: params.flatMap(({ p, label, object }) => {
        const owner = `${name}(${label})`;
        if (object) {
          const given = ts.isObjectBindingPattern(p.name)
            ? p.name.elements.flatMap(e =>
                e.initializer
                  ? [
                      [
                        text(e.propertyName ?? (e.name as ts.Identifier)),
                        flat(e.initializer.getText()),
                      ] as const,
                    ]
                  : [],
              )
            : [];
          return fields(checker.getTypeFromTypeNode(p.type!), owner, new Map(given));
        }
        const tag = ts.getJSDocParameterTags(p).find(t => ts.getTextOfJSDocComment(t.comment)?.trim());
        const description = tag
          ? flat(ts.getTextOfJSDocComment(tag.comment)!)
          : fail(`${owner} has no doc comment`);
        return [
          {
            name: label,
            ...(p.initializer && { default: flat(p.initializer.getText()) }),
            lines: [{ type: flat(p.type?.getText() ?? 'unknown'), description }],
          },
        ];
      }),
    };
  };

  return Object.fromEntries(names.map(n => [n, read(n)]));
}
