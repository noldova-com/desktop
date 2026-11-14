/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateProcess } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class ProcessesNotExitedException extends UpdateStopException {
  public readonly processes: readonly UpdateProcess[];
  public readonly milliseconds: number;

  public constructor(processes: readonly UpdateProcess[], milliseconds: number) {
    super(Resources.formatProcessesNotExited(processes.map(t => Resources.formatProcessEntry(t.role, t.processId)).join(Resources.workSeparator), milliseconds / Resources.millisecondsPerSecond));

    this.processes = processes;
    this.milliseconds = milliseconds;
  }
}
