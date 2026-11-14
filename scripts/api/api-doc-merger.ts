/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import ts from "typescript";

import { Resources } from "../resources.ts";
import type { ApiProgram } from "./api-program.ts";
import { ApiReach } from "./api-reach.ts";
import { ApiSymbolWalker } from "./api-symbol-walker.ts";
import { ApiValue } from "./api-value.ts";
import type { ApiVisibility } from "./api-visibility.ts";

export class ApiDocMerger {
  private readonly api: ApiProgram;
  private readonly visibility: ApiVisibility;
  private readonly root: string;
  private readonly insertions: Map<string, Map<number, string>> = new Map();
  private readonly found: string[] = [];

  public constructor(api: ApiProgram, visibility: ApiVisibility, root: string) {
    this.api = api;
    this.visibility = visibility;
    this.root = root;
  }

  public get problems(): readonly string[] {
    return [...this.found].sort();
  }

  public add(documented: string, compiled: string): void {
    const folder = path.dirname(path.dirname(compiled));
    this.pair(documented, compiled, (owner, declarations, texts) => {
      if (texts.every(t => Object.isNull(t)))
        this.found.push(Resources.formatApiDocMissing(owner, this.describe(documented)));
      else
        declarations.forEach((declaration, index) => this.insert(owner, declaration, texts[index] ?? null, folder));
    });
  }

  public compare(documented: string, compiled: string): void {
    this.pair(documented, compiled, (owner, declarations, texts) => {
      for (const [index, declaration] of declarations.entries())
        if (ApiDocMerger.normalize(ApiDocMerger.readDoc(declaration)) !== ApiDocMerger.normalize(texts[index] ?? null))
          this.found.push(Resources.formatApiDocNotCarried(owner, this.locate(declaration), this.describe(documented)));
    });
  }

  public async writeAsync(): Promise<void> {
    for (const [file, docs] of this.insertions) {
      const text = await readFile(file, Resources.encoding);
      const lines = text.split(Resources.apiDocLineBreakPattern);
      for (const [line, doc] of [...docs].sort(([a], [b]) => b - a))
        lines.splice(line, 0, ...ApiDocMerger.indentDoc(doc, Resources.apiDocIndentPattern.exec(lines[line] ?? String.empty)?.[0] ?? String.empty));
      const lineBreak = text.includes(Resources.apiDocWindowsLineBreak) ? Resources.apiDocWindowsLineBreak : Resources.lineEnd;
      await writeFile(file, lines.join(lineBreak), Resources.encoding);
    }
  }

  private static holder(node: ts.Node): ts.Node {
    return ts.isVariableDeclaration(node) ? node.parent.parent : node;
  }

  private static readDoc(node: ts.Node): string | null {
    const docs = ApiValue.readOwnDocs(node).filter(t => !(t.tags ?? []).some(u => u.tagName.text === Resources.apiDocLicenseTag));
    return docs.at(-1)?.getText() ?? null;
  }

  private static normalize(doc: string | null): string | null {
    return doc?.split(Resources.apiDocLineBreakPattern).map(t => t.trim()).join(Resources.lineEnd) ?? null;
  }

  private static indentDoc(doc: string, indent: string): readonly string[] {
    return doc.split(Resources.apiDocLineBreakPattern).map((t, index) => Resources.formatApiDocLine(indent, index > 0, t.trimStart()));
  }

  private pair(documented: string, compiled: string, pair: (owner: string, declarations: readonly ts.Declaration[], texts: readonly (string | null)[]) => void): void {
    const docs = new Map<string, readonly (string | null)[]>();
    new ApiSymbolWalker(this.api, this.visibility).walk(documented, (owner, _symbol, declarations) => {
      docs.set(owner, declarations.map(t => ApiDocMerger.readDoc(t)));
    });
    const targets = new Map<string, readonly ts.Declaration[]>();
    new ApiSymbolWalker(this.api, this.visibility, ApiReach.RE_EXPORTED).walk(compiled, (owner, _symbol, declarations) => {
      targets.set(owner, declarations);
    });

    const shown = this.describe(documented);
    for (const [owner, texts] of docs) {
      const declarations = targets.get(owner);
      if (Object.isUndefined(declarations))
        this.found.push(Resources.formatApiDocNotCompiled(owner, shown));
      else if (declarations.length !== texts.length)
        this.found.push(Resources.formatApiDocCountDiffers(owner, texts.length, shown, declarations.length));
      else
        pair(owner, declarations, texts);
    }
    for (const owner of targets.keys())
      if (!docs.has(owner))
        this.found.push(Resources.formatApiDocUndocumented(owner, shown));
  }

  private insert(owner: string, declaration: ts.Declaration, text: string | null, folder: string): void {
    if (Object.isNull(text))
      return;
    const holder = ApiDocMerger.holder(declaration);
    const file = holder.getSourceFile();
    if (path.relative(folder, file.fileName).startsWith(Resources.parentFolder)) {
      this.found.push(Resources.formatApiDocOutsidePackage(owner, this.describe(file.fileName), this.describe(folder)));
      return;
    }
    const line = file.getLineAndCharacterOfPosition(holder.getStart(file)).line;
    const docs = this.insertions.get(file.fileName) ?? new Map<number, string>();
    const earlier = docs.get(line);
    if (!Object.isUndefined(earlier) && earlier !== text)
      this.found.push(Resources.formatApiDocTwoDocs(owner, this.locate(holder)));
    docs.set(line, text);
    this.insertions.set(file.fileName, docs);
  }

  private locate(node: ts.Node): string {
    const file = node.getSourceFile();
    return Resources.formatSourceLineLocation(this.describe(file.fileName), file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }
}
