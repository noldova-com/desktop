/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { ByteFile } from "./byte-file.ts";
import { FileErrors } from "./file-errors.ts";

export class TextFile {
  public static async readAsync(file: string, read: typeof readFile = readFile): Promise<string> {
    try {
      return await read(file, Resources.textEncoding);
    }
    catch (error) {
      if (!FileErrors.isUnsized(error))
        throw error;
      return (await ByteFile.readThroughHandleAsync(file)).toString(Resources.textEncoding);
    }
  }
}
