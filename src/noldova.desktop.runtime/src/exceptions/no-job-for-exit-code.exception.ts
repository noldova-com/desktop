/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class NoJobForExitCodeException extends SystemCommandException {
  public readonly processId: number;

  public constructor(processId: number) {
    super(Resources.formatNoJobForExitCode(processId));

    this.processId = processId;
  }
}
