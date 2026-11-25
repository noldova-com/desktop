/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class ProcessRowMissingException extends installedElectron.ElectronException {
  public readonly processId: number;

  public constructor(processId: number) {
    super(`The process list has no row for process ${processId}, so it failed or the process has ended, and the processes it started are unknown.`);

    this.processId = processId;
  }
}
