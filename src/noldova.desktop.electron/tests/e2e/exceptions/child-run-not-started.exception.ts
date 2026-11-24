/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class ChildRunNotStartedException extends ElectronException {
  public readonly runName: string;

  public constructor(runName: string) {
    super(`The child run ${runName} has no process id, so it did not start.`);

    this.runName = runName;
  }
}
