/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { TemporaryFolderFixture } from "./temporary-folder.fixture.js";

export class AddonModuleFixture implements AsyncDisposable {
  public static readonly TARGET: string = "fixture-x64";

  private readonly folder: TemporaryFolderFixture;

  public readonly file: string;

  private constructor(folder: TemporaryFolderFixture, file: string) {
    this.folder = folder;
    this.file = file;
  }

  public static async createAsync(exports: string): Promise<AddonModuleFixture> {
    const folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, AddonModuleFixture.TARGET, "fake-addon.cjs");
    await mkdir(path.dirname(file));
    await writeFile(file, `module.exports = ${exports};`);
    return new AddonModuleFixture(folder, file);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.folder[Symbol.asyncDispose]();
  }
}
