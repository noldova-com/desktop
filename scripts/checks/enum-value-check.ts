/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";
import ts from "typescript";

import { ApiException } from "../api/api.exception.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class EnumValueCheck implements ICheck {
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = Resources.enumValueCheckTitle;

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => EnumValueCheck.isProductionScript(t));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(files, (t, u) => EnumValueCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatEnumValueChecked(files.length));
    return findings.length === 0;
  }

  private static isProductionScript(file: string): boolean {
    return file.endsWith(Resources.scriptExtension)
      && Resources.enumValueRoots.some(t => file.startsWith(t))
      && !file.split(Resources.pathSeparator).some(t => Resources.sourceTestFolders.has(t));
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isEnumDeclaration(node))
        for (const member of node.members) {
          const value = member.initializer;
          if ((ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) && !Object.isUndefined(value) && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && value.text !== member.name.text)
            findings.push(Resources.formatEnumValueFinding(file, source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1, node.name.text, member.name.text, value.text));
        }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }
}
