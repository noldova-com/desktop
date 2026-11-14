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

import type { RepositoryFiles } from "../structure/repository-files.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class NativeElementAssertionCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.nativeElementAssertionCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const testFiles = (await this.files.listAsync()).filter(t => NativeElementAssertionCheck.isTestFile(t));
    const findings: string[] = [];
    for (const file of testFiles) {
      const lines = (await readFile(path.join(this.root, file), Resources.encoding)).split(Resources.lineEnd);
      lines.forEach((line, index) => {
        if (Resources.nativeElementReads.some(t => t.test(line)))
          findings.push(Resources.formatNativeElementLocation(file, index + 1));
      });
    }

    for (const finding of findings)
      output.write(Resources.formatNativeElementFinding(finding));
    output.write(Resources.formatNativeElementChecked(testFiles.length));
    return findings.length === 0;
  }

  private static isTestFile(file: string): boolean {
    if (!Resources.sourceScriptExtensions.has(path.posix.extname(file)))
      return false;
    return file.startsWith(Resources.sourceFolderPrefix) && file.split(Resources.pathSeparator).some(t => Resources.sourceTestFolders.has(t));
  }
}
