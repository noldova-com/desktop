/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class ExitWaitTimedOutException extends SystemCommandException {
  public readonly processId: number;
  public readonly milliseconds: number;

  public constructor(processId: number, milliseconds: number) {
    super(Resources.formatExitWaitTimedOut(processId, milliseconds));

    this.processId = processId;
    this.milliseconds = milliseconds;
  }
}
