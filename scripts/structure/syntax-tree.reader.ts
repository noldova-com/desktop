/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { Resources } from "../resources.ts";
import { SyntaxTreeMissingException } from "./syntax-tree-missing.exception.ts";

export class SyntaxTreeReader {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async readAsync<T>(files: readonly string[], read: (file: string, source: ts.SourceFile) => readonly T[]): Promise<readonly T[]> {
    const results: T[] = [];
    for (const file of files)
      results.push(...read(file, await this.parseAsync(file)));
    return results;
  }

  private async parseAsync(file: string): Promise<ts.SourceFile> {
    const fileName = path.join(this.root, file);
    const text = await readFile(fileName, Resources.encoding).catch((error: unknown) => {
      throw new SyntaxTreeMissingException(file, error);
    });
    return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  }
}
