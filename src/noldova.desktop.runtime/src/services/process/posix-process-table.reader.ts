/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPosixProcessTableApi } from "../../interfaces/i-posix-process-table-api.js";
import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import { ProcessTable } from "../../models/process-table.js";
import { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";

export class PosixProcessTableReader implements IProcessTableReader {
  private readonly api: IPosixProcessTableApi;

  public constructor(api: IPosixProcessTableApi) {
    this.api = api;
  }

  public async readAsync(): Promise<ProcessTable> {
    return new ProcessTable((await this.api.listProcessesAsync()).map(([processId, parentId, groupId, terminal, started, zombie]) => {
      const start = Math.round(started);
      return new ProcessTableEntry(processId, parentId, groupId, start, start - Resources.posixStartMargin, start + Resources.posixStartMargin, null, terminal, zombie === 1);
    }));
  }
}
