/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { ProcessStartException } from "./process-start.exception.js";

export class ModuleStoppingException extends ProcessStartException {
  public readonly moduleId: string;
  public readonly program: string;

  public constructor(moduleId: string, program: string) {
    super(Resources.formatModuleStopping(moduleId, program));

    this.moduleId = moduleId;
    this.program = program;
  }
}
