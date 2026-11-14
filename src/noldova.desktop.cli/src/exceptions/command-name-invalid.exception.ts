/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class CommandNameInvalidException extends UsageException {
  public readonly commandName: string;

  public constructor(commandName: string, cause: unknown) {
    super(Resources.formatReason(cause), new ExceptionOptions(cause));

    this.commandName = commandName;
  }
}
