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

export class NotificationCommandNotAllowedException extends RegistrationException {
  public readonly moduleId: string;
  public readonly command: string;

  public constructor(moduleId: string, command: string, options?: ExceptionOptions) {
    super(Resources.formatNotificationCommandNotAllowed(moduleId, command), options);

    this.moduleId = moduleId;
    this.command = command;
  }
}
