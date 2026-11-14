/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { TemporaryFolder } from "../../src/services/processes/temporary-folder.js";

export class RecordingTemporaryFolderFixture extends TemporaryFolder {
  private readonly parent: string;
  private readonly createFailure: Error | null;
  private readonly removeFailure: Error | null;

  public readonly created: string[] = [];
  public readonly removed: string[] = [];

  public constructor(parent: string, createFailure: Error | null = null, removeFailure: Error | null = null) {
    super();
    this.parent = parent;
    this.createFailure = createFailure;
    this.removeFailure = removeFailure;
  }

  public override async createAsync(_platform: string, prefix: string): Promise<string> {
    if (!Object.isNull(this.createFailure))
      throw this.createFailure;
    const folder = await mkdtemp(path.join(this.parent, prefix));
    this.created.push(folder);
    return folder;
  }

  public override async removeAsync(folder: string): Promise<void> {
    this.removed.push(folder);
    if (!Object.isNull(this.removeFailure))
      throw this.removeFailure;
    await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
