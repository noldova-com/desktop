/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class StartTimeInvalidException extends ElectronException {
  public readonly processId: string;
  public readonly startTime: string;

  public constructor(processId: string, startTime: string) {
    super(`ps gave process ${processId} the start time "${startTime}", which is not a date.`);

    this.processId = processId;
    this.startTime = startTime;
  }
}
