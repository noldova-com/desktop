/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";

import { NpmCommand } from "../../src/services/toolchain/npm-command.js";

export class StageFolderFixture implements AsyncDisposable {
  public readonly path: string;
  public readonly cache: string;
  public readonly archives: ReadonlyMap<string, string>;
  public readonly npm: NpmCommand;
  private readonly folder: string;

  public constructor(folder: string, stage: string, cache: string, archives: ReadonlyMap<string, string>, npm: NpmCommand) {
    this.folder = folder;
    this.path = stage;
    this.cache = cache;
    this.archives = archives;
    this.npm = npm;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
