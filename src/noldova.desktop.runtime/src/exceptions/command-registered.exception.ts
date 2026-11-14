/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { RegistrationException } from "./registration.exception.js";

export class CommandRegisteredException extends RegistrationException {
  public readonly command: string;

  public constructor(command: string, options?: ExceptionOptions) {
    super(Resources.formatCommandRegistered(command), options);

    this.command = command;
  }
}
