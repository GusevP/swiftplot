import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

const index = fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url));
const axes = ['Axis', 'BandAxis', 'LogAxis', 'TimeAxis', 'Nested'];
const helpers = [
  'plot',
  'band',
  'bare',
  'sequential',
  'log',
  'time',
  'gradient',
  'bin',
  'bands',
  'stack',
  'fiveNumbers',
  'fromTree',
  'fromLinks',
];

const documented = (node: ts.Node) =>
  ts.getJSDocCommentsAndTags(node).some(d => ts.isJSDoc(d) && !!ts.getTextOfJSDocComment(d.comment)?.trim());

/** `Type.field` or `function(parameter)` for each part of the public API the reference shows without a doc comment. */
function undocumented(edit?: { file: string; change: (text: string) => string }): string[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
    types: [],
    noEmit: true,
  };
  const base = ts.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...base,
    getSourceFile: (name, version, ...rest) =>
      edit && name.endsWith(edit.file)
        ? ts.createSourceFile(name, edit.change(ts.sys.readFile(name)!), version, true)
        : base.getSourceFile(name, version, ...rest),
  };
  const program = ts.createProgram([index], options, host);
  const checker = program.getTypeChecker();
  const exported = checker
    .getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(index)!)!)
    .map(s => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s));
  const missing: string[] = [];
  const checked = new Set<string>();

  const fields = (name: string, type: ts.Type) => {
    if (checked.has(name)) return;
    checked.add(name);
    const parts = type.isUnion() ? type.types : [type];
    const decls = new Map<string, ts.Declaration[]>();
    for (const part of parts)
      for (const p of checker.getPropertiesOfType(part))
        decls.set(p.name, [...(decls.get(p.name) ?? []), ...(p.declarations ?? [])]);
    for (const [field, list] of decls) {
      const real = list.filter(
        d =>
          !(
            ts.isPropertySignature(d) &&
            (d.type?.kind === ts.SyntaxKind.NeverKeyword || d.type?.kind === ts.SyntaxKind.UndefinedKeyword)
          ),
      );
      const overloads = Map.groupBy(real, d => d.parent);
      if (![...overloads.values()].every(group => group.some(documented))) missing.push(`${name}.${field}`);
    }
  };

  for (const s of exported) {
    const alias = s.declarations?.find(ts.isTypeAliasDeclaration);
    if (!alias || !(s.name.endsWith('Options') || axes.includes(s.name))) continue;
    fields(s.name, checker.getDeclaredTypeOfSymbol(s));
    const modes = ts.isUnionTypeNode(alias.type) ? alias.type.types : [];
    modes.forEach((mode, i) => {
      const literal = ts.isTypeLiteralNode(mode) && mode.members.some(m => m.name?.getText() === 'mode');
      const before = alias
        .getSourceFile()
        .text.slice(i ? modes[i - 1]!.end : alias.type.pos, mode.getStart());
      if (literal && !before.includes('/**')) missing.push(`${s.name} mode ${i + 1}`);
    });
  }

  for (const name of helpers) {
    const s = exported.find(e => e.name === name);
    const decl = s?.valueDeclaration;
    const fn =
      decl && ts.isVariableDeclaration(decl) && decl.initializer && ts.isArrowFunction(decl.initializer)
        ? decl.initializer
        : decl && ts.isFunctionDeclaration(decl)
          ? decl
          : undefined;
    if (!fn) {
      missing.push(`${name} is not an exported function`);
      continue;
    }
    for (const p of fn.parameters) {
      const label = `${name}(${p.name.getText()})`;
      if (p.type && ts.isTypeLiteralNode(p.type)) fields(label, checker.getTypeFromTypeNode(p.type));
      else if (p.type && ts.isTypeReferenceNode(p.type) && checked.has(p.type.typeName.getText())) continue;
      else if (!ts.getJSDocParameterTags(p).some(t => ts.getTextOfJSDocComment(t.comment)?.trim()))
        missing.push(label);
    }
  }
  return missing;
}

describe('doc comments on the explicit API', () => {
  test('every field of Options, the axes and each *Options, and each helper parameter, has one', () => {
    expect(undocumented()).toEqual([]);
  });

  test('a field without one is named with its type', () => {
    const change = (text: string) => text.replace(/\n\s*\/\*\*[^\n]*\*\/(\n\s*width\?:)/, '$1');
    expect(undocumented({ file: 'marks/line.ts', change })).toEqual(['LineOptions.width']);
  });

  test('a field is named when only one mode of its union lacks one', () => {
    const change = (text: string) => text.replace(/\n\s*\/\*\* Each bar's value\. \*\//, '');
    expect(undocumented({ file: 'marks/bar.ts', change })).toEqual(['BarOptions.y']);
  });
});
