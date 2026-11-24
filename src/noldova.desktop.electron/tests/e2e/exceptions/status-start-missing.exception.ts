/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class StatusStartMissingException extends ElectronException {
  public readonly status: string;
  public readonly field: number;

  public constructor(status: string, field: number) {
    super(`The process status "${status}" has no start time in field ${field}.`);

    this.status = status;
    this.field = field;
  }
}
