/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import ts from "typescript";

import { ApiException } from "../api/api.exception.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class InterfaceNameCheck implements ICheck {
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = Resources.interfaceNameCheckTitle;

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const scripts = (await this.files.listAsync()).filter(t => Resources.sourceScriptExtensions.has(path.posix.extname(t)));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(scripts, (t, u) => InterfaceNameCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatInterfaceNameChecked(scripts.length));
    return findings.length === 0;
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isModuleDeclaration(node) && (ts.isStringLiteral(node.name) || node.name.text === Resources.interfaceNameGlobalScope))
        return;
      if (ts.isInterfaceDeclaration(node) && !Resources.interfaceNamePrefixedPattern.test(node.name.text)) {
        const name = node.name.text;
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push(Resources.formatInterfaceNameFinding(file, line, name));
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }
}
