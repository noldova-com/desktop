/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { PermissionAccessException } from "./permission-access.exception.js";

export class PermissionsModuleOnlyException extends PermissionAccessException {
  public readonly moduleId: string;

  public constructor(moduleId: string, options?: ExceptionOptions) {
    super(Resources.formatPermissionsModuleOnly(moduleId), options);

    this.moduleId = moduleId;
  }
}
