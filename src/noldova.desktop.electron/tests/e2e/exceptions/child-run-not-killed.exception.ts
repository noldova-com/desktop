/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class ChildRunNotKilledException extends installedElectron.ElectronException {
  public readonly seconds: number;

  public constructor(seconds: number) {
    super(`The child run still ran ${seconds} s after it was killed.`);

    this.seconds = seconds;
  }
}
