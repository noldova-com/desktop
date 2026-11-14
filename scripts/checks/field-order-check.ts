/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { RepositoryFiles } from "../structure/repository-files.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class FieldOrderCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.fieldOrderCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const sources = (await this.files.listAsync()).filter(t => FieldOrderCheck.isSource(t));
    const findings: string[] = [];
    for (const file of sources)
      findings.push(...FieldOrderCheck.findMisplaced(file, await readFile(path.join(this.root, file), Resources.encoding)));

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatFieldOrderChecked(sources.length));
    return findings.length === 0;
  }

  private static isSource(file: string): boolean {
    return Resources.sourceScriptExtensions.has(path.posix.extname(file))
      && !file.endsWith(Resources.declarationsExtension)
      && Resources.fieldOrderFolders.some(t => file.startsWith(t));
  }

  private static findMisplaced(file: string, text: string): readonly string[] {
    const lines = text.split(Resources.lineEnd);
    const findings: string[] = [];
    let className: string | null = null;
    let hasEarlierField = false;
    lines.forEach((line, index) => {
      const declared = Resources.fieldOrderClassPattern.exec(line)?.[1];
      if (!Object.isUndefined(declared)) {
        className = declared;
        hasEarlierField = false;
        return;
      }
      if (line === Resources.fieldOrderClassEnd)
        className = null;
      const field = Object.isNull(className) ? null : Resources.fieldOrderFieldPattern.exec(line);
      if (Object.isNull(field) || Object.isNull(className))
        return;
      const isPublicStatic = (field[1] ?? Resources.fieldOrderPublicModifier) === Resources.fieldOrderPublicModifier && field[2] === Resources.fieldOrderStaticModifier;
      if (!isPublicStatic)
        hasEarlierField = true;
      else if (hasEarlierField && !FieldOrderCheck.usesClass(lines, index, className))
        findings.push(Resources.formatFieldOrderMisplaced(file, index + 1, field[3], className));
    });
    return findings;
  }

  private static usesClass(lines: readonly string[], start: number, className: string): boolean {
    let end = start + 1;
    while (end < lines.length && !Resources.fieldOrderMemberStartPattern.test(lines[end] ?? String.empty))
      end++;
    const declaration = lines.slice(start, end).join(Resources.lineEnd);
    return declaration.includes(Resources.formatFieldOrderMemberAccess(className)) || declaration.includes(Resources.formatFieldOrderConstruction(className));
  }
}
