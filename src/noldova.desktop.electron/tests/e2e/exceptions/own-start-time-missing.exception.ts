/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class OwnStartTimeMissingException extends installedElectron.ElectronException {
  public readonly processId: number;

  public constructor(processId: number) {
    super(`The process list gave no start time for this process, ${processId}, so the list failed, and no run can be told to have ended.`);

    this.processId = processId;
  }
}
