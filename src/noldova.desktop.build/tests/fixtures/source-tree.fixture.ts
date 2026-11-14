/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class SourceTreeFixture implements AsyncDisposable {
  public readonly path: string;

  private constructor(folder: string) {
    this.path = folder;
  }

  public static async createAsync(files: Readonly<Record<string, string>> = {}): Promise<SourceTreeFixture> {
    const tree = new SourceTreeFixture(await mkdtemp(path.join(tmpdir(), "desktop-build-tree-")));
    await tree.writeAsync(files);
    return tree;
  }

  public async writeAsync(files: Readonly<Record<string, string>>): Promise<void> {
    for (const [name, text] of Object.entries(files)) {
      const file = path.join(this.path, ...name.split("/"));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    }
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }
}
