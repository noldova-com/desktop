/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class ForegroundGroupReadFailedException extends SystemCommandException {
  public readonly processId: number;

  public constructor(processId: number, cause: unknown) {
    super(Resources.formatForegroundGroupUnreadable(processId, String(cause)), new ExceptionOptions(cause));

    this.processId = processId;
  }
}
