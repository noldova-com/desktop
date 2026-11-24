/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class EarlierRunProcessesKilledException extends ElectronException {
  public readonly processes: readonly string[];

  public constructor(processes: readonly string[]) {
    super(`Processes that earlier UI runs started still ran after their runners had ended, so they were killed:\n${processes.join("\n")}`);

    this.processes = processes;
  }
}
