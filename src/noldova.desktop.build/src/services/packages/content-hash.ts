/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Resources } from "../../resources.ts";

export class ContentHash {
  public static ofParts(parts: readonly string[]): string {
    const hash = createHash(Resources.hashAlgorithm);
    for (const part of parts)
      hash.update(part).update(Resources.hashPartSeparator);
    return hash.digest(Resources.hashEncoding);
  }

  public static async ofFileAsync(file: string): Promise<string> {
    return createHash(Resources.hashAlgorithm).update(await readFile(file)).digest(Resources.hashEncoding);
  }

  public static async ofTreeAsync(directory: string): Promise<string> {
    const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.relative(directory, path.join(t.parentPath, t.name)).split(path.sep).join(Resources.pathSegmentSeparator))
      .filter(t => !t.split(Resources.pathSegmentSeparator).includes(Resources.nodeModulesFolder))
      .sort();
    const parts: string[] = [];
    for (const file of files)
      parts.push(file, await ContentHash.ofFileAsync(path.join(directory, file)));
    return ContentHash.ofParts(parts);
  }
}
