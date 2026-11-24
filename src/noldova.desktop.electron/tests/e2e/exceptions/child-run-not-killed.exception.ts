/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class ChildRunNotKilledException extends ElectronException {
  public readonly seconds: number;

  public constructor(seconds: number) {
    super(`The child run still ran ${seconds} s after it was killed.`);

    this.seconds = seconds;
  }
}
