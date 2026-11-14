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

import { Resources } from "../resources.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class TestWaitCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.testWaitCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const listed = files.includes(Resources.testWaitContractFile) ? await this.readListAsync() : new Map<string, number>();
    const testFiles = files.filter(t => TestWaitCheck.isTestFile(t));
    const pausing = new Set<string>();
    const findings: string[] = [];
    for (const file of testFiles) {
      const lines = TestWaitCheck.findPauses(await readFile(path.join(this.root, file), Resources.encoding));
      if (lines.length > 0)
        pausing.add(file);
      if (!listed.has(file))
        findings.push(...lines.map(t => Resources.formatTestWaitPause(file, t)));
    }
    for (const [file, line] of listed)
      if (!pausing.has(file))
        findings.push(Resources.formatTestWaitStale(line, file));

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatTestWaitChecked(testFiles.length, listed.size));
    return findings.length === 0;
  }

  private static isTestFile(file: string): boolean {
    if (!Resources.sourceScriptExtensions.has(path.posix.extname(file)))
      return false;
    return file.startsWith(Resources.testWaitSourcePrefix) && file.split(Resources.pathSeparator).some(t => Resources.sourceTestFolders.has(t));
  }

  private static findPauses(text: string): readonly number[] {
    const lines = new Set<number>();
    for (const pattern of Resources.testWaitPauses)
      for (const match of text.matchAll(pattern))
        if (!TestWaitCheck.isInString(text, match.index))
          lines.add(text.slice(0, match.index).split(Resources.lineEnd).length);
    return [...lines].sort((a, b) => a - b);
  }

  private static isInString(text: string, index: number): boolean {
    const lineStart = text.lastIndexOf(Resources.lineEnd, index - 1) + 1;
    let quote: string | null = null;
    for (let position = lineStart; position < index; position++) {
      const character = text.charAt(position);
      if (Object.isNull(quote)) {
        if (Resources.testWaitQuotes.includes(character))
          quote = character;
      }
      else if (character === Resources.testWaitEscape)
        position++;
      else if (character === quote)
        quote = null;
    }
    return !Object.isNull(quote);
  }

  private async readListAsync(): Promise<ReadonlyMap<string, number>> {
    const lines = (await readFile(path.join(this.root, Resources.testWaitContractFile), Resources.encoding)).split(Resources.lineEnd);
    const start = lines.indexOf(Resources.testWaitListHeader);
    const files = new Map<string, number>();
    if (start === -1)
      return files;
    for (const [offset, line] of lines.slice(start + 2).entries()) {
      if (!line.startsWith(Resources.testWaitTableRowPrefix))
        break;
      const file = Resources.testWaitListRow.exec(line)?.[1];
      if (!Object.isUndefined(file))
        files.set(file, start + offset + 3);
    }
    return files;
  }
}
