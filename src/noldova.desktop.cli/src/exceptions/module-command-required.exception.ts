/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class ModuleCommandRequiredException extends UsageException {
  public readonly moduleId: string;

  public constructor(moduleId: string) {
    super(Resources.formatModuleCommandRequired(moduleId));

    this.moduleId = moduleId;
  }
}
