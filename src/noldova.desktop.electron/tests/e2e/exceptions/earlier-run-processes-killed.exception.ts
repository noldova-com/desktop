/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class EarlierRunProcessesKilledException extends installedElectron.ElectronException {
  public readonly processes: readonly string[];

  public constructor(processes: readonly string[]) {
    super(`Processes that earlier UI runs started still ran after their runners had ended, so they were killed:\n${processes.join("\n")}`);

    this.processes = processes;
  }
}
