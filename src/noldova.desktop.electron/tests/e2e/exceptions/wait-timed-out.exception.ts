/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class WaitTimedOutException extends ElectronException {
  public readonly description: string;
  public readonly milliseconds: number;

  public constructor(description: string, milliseconds: number) {
    super(`Waited ${milliseconds} ms for ${description}, but it did not happen.`);

    this.description = description;
    this.milliseconds = milliseconds;
  }
}
