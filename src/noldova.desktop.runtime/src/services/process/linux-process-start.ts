/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessTableRowUnreadableException } from "../../exceptions/process-table-row-unreadable.exception.js";
import { Resources } from "../../resources.js";

export class LinuxProcessStart {
  public static async readAsync(processFolder: string, processId: number): Promise<string> {
    const text = (await readFile(path.posix.join(processFolder, String(processId), Resources.processStatFile), Resources.utf8Encoding)).trim();
    const end = text.lastIndexOf(Resources.processNameEnd);
    const start = text.slice(end + 1).trim().split(Resources.processStatFieldSeparator)[Resources.processStartField];
    if (end < 0 || Object.isUndefined(start) || !Resources.processStartPattern.test(start))
      throw new ProcessTableRowUnreadableException(text);
    return start;
  }
}
