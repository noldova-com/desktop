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

export class SettingScopeNotOwnedException extends RegistrationException {
  public readonly moduleId: string;
  public readonly scope: string;

  public constructor(moduleId: string, scope: string, options?: ExceptionOptions) {
    super(Resources.formatSettingScopeNotOwned(moduleId, scope), options);

    this.moduleId = moduleId;
    this.scope = scope;
  }
}
