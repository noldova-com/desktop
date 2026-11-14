/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import ts from "typescript";

import { ApiException } from "../api/api.exception.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class BucketNameCheck implements ICheck {
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = Resources.bucketNameCheckTitle;

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const scripts = files.filter(t => Resources.sourceScriptExtensions.has(path.posix.extname(t)));
    const findings = files.flatMap(t => BucketNameCheck.findPathBuckets(t));
    try {
      findings.push(...await this.syntax.readAsync(scripts, (t, u) => BucketNameCheck.findTypeBuckets(t, u)));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings.push(error.message);
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatBucketNameChecked(files.length, scripts.length));
    return findings.length === 0;
  }

  private static findPathBuckets(file: string): readonly string[] {
    return file.split(Resources.pathSeparator)
      .filter(t => t.split(Resources.dot).some(u => Resources.bucketNameWords.has(u.slice(u.lastIndexOf(Resources.dash) + 1).toLowerCase())))
      .map(t => Resources.formatBucketNamePath(file, t));
  }

  private static findTypeBuckets(file: string, source: ts.SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: ts.Node): void => {
      const name = BucketNameCheck.readName(node);
      if (!Object.isNull(name) && Resources.bucketNameWords.has(name.replace(Resources.bucketNameBeforeLastWord, String.empty).toLowerCase()))
        findings.push(Resources.formatBucketNameType(file, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, name));
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }

  private static readName(node: ts.Node): string | null {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node))
      return node.name?.text ?? null;
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isExportSpecifier(node))
      return node.name.text;
    return null;
  }
}
