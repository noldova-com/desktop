/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class JobAssignmentFailedException extends SystemCommandException {
  public readonly processId: number;
  public readonly errorCode: number;

  public constructor(processId: number, errorCode: number) {
    super(Resources.formatJobAssignmentFailed(processId, errorCode));

    this.processId = processId;
    this.errorCode = errorCode;
  }
}
