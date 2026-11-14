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

export class CommandFailedException extends SystemCommandException {
  public readonly command: string;

  public constructor(command: string, cause: Error) {
    super(Resources.formatCommandFailed(command, cause.message), new ExceptionOptions(cause));

    this.command = command;
  }
}
