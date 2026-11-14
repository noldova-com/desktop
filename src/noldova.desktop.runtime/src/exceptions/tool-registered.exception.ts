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

export class ToolRegisteredException extends RegistrationException {
  public readonly tool: string;

  public constructor(tool: string, options?: ExceptionOptions) {
    super(Resources.formatToolRegistered(tool), options);

    this.tool = tool;
  }
}
