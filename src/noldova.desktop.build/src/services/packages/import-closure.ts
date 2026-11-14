/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { SourceScanner } from "../structure/source-scanner.ts";
import { ContentHash } from "./content-hash.ts";
import { Resources } from "../../resources.ts";

export class ImportClosure {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async listAsync(entry: string): Promise<readonly string[]> {
    const found = new Set<string>([path.resolve(entry)]);
    const pending = [...found];
    for (let file = pending.pop(); !Object.isUndefined(file); file = pending.pop())
      for (const literal of new SourceScanner(await readFile(file, Resources.textEncoding)).scan().imports) {
        if (!literal.value.startsWith(Resources.relativeSpecifierPrefix))
          continue;
        const imported = path.resolve(path.dirname(file), literal.value);
        if (found.has(imported) || !existsSync(imported) || path.relative(this.root, imported).startsWith(Resources.parentFolderSegment))
          continue;
        found.add(imported);
        pending.push(imported);
      }
    return [...found].sort();
  }

  public async hashAsync(entry: string): Promise<string> {
    const parts: string[] = [];
    for (const file of await this.listAsync(entry))
      parts.push(Resources.formatHashEntry(path.relative(this.root, file).split(path.sep).join(path.posix.sep), await ContentHash.ofFileAsync(file)));
    return ContentHash.ofParts(parts);
  }
}
