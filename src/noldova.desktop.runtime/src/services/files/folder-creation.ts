/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, stat } from "node:fs/promises";

import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";

export class FolderCreation {
  public static async createAsync(folder: string, mode: number = Resources.folderMode, create: typeof mkdir = mkdir): Promise<string | undefined> {
    try {
      return await create(folder, { recursive: true, mode });
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.deniedFolderCode) || !await FolderCreation.isFolderAsync(folder))
        throw error;
      return undefined;
    }
  }

  private static async isFolderAsync(folder: string): Promise<boolean> {
    try {
      return (await stat(folder)).isDirectory();
    }
    catch {
      return false;
    }
  }
}
