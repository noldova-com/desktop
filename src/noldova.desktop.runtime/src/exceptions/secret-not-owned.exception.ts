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

export class SecretNotOwnedException extends RegistrationException {
  public readonly moduleId: string;
  public readonly secret: string;

  public constructor(moduleId: string, secret: string, options?: ExceptionOptions) {
    super(Resources.formatSecretNotOwn(moduleId, secret), options);

    this.moduleId = moduleId;
    this.secret = secret;
  }
}
