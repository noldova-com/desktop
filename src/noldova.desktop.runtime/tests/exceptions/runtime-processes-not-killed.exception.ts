/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class RuntimeProcessesNotKilledException extends RuntimeException {
  public readonly processIds: readonly number[];
  public readonly milliseconds: number;
  public readonly keptFolder: string;

  public constructor(processIds: readonly number[], milliseconds: number, keptFolder: string) {
    super(`The runtime processes ${processIds.join(", ")} were still running ${milliseconds} ms after they were killed, so ${keptFolder} was kept.`);

    this.processIds = processIds;
    this.milliseconds = milliseconds;
    this.keptFolder = keptFolder;
  }
}
