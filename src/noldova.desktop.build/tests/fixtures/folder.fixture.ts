/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

export class FolderFixture {
  public static async ensureAsync(folder: string, make: (folder: string) => Promise<unknown> = t => mkdir(t, { recursive: true })): Promise<void> {
    if (!existsSync(folder))
      await make(folder);
  }
}
