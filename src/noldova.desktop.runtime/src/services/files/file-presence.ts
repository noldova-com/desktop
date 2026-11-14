/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stat } from "node:fs/promises";

import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";

export class FilePresence {
  public static async existsAsync(file: string): Promise<boolean> {
    return await FilePresence.unlessMissingAsync(stat(file)) !== null;
  }

  public static async unlessMissingAsync<T>(operation: Promise<T>): Promise<T | null> {
    try {
      return await operation;
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.missingFileErrorCode))
        throw error;
      return null;
    }
  }
}
