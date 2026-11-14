/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Resources } from "../../resources.ts";

export class TemporaryFolder {
  public static locateRoot(platform: string): string {
    return platform === Resources.windowsPlatform ? tmpdir() : Resources.shortTemporaryRoot;
  }

  public async createAsync(platform: string, prefix: string): Promise<string> {
    return realpath(await mkdtemp(path.join(TemporaryFolder.locateRoot(platform), prefix)));
  }

  public async removeAsync(folder: string): Promise<void> {
    await rm(folder, { recursive: true, force: true });
  }
}
