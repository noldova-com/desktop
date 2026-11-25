/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class ChildRunNotStartedException extends installedElectron.ElectronException {
  public readonly runName: string;

  public constructor(runName: string) {
    super(`The child run ${runName} has no process id, so it did not start.`);

    this.runName = runName;
  }
}
