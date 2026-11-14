/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { CliException } from "./cli.exception.js";

export class ModuleNotActiveException extends CliException {
  public readonly moduleId: string;
  public readonly reason: string;
  public readonly blockedBy: string | null;

  public constructor(moduleId: string, reason: string, blockedBy: string | null = null) {
    super(Resources.formatModuleNotActive(moduleId, reason));
    this.moduleId = moduleId;
    this.reason = reason;
    this.blockedBy = blockedBy;
  }

  public toJson(): JsonObject {
    return Object.isNull(this.blockedBy)
      ? { module: this.moduleId, cause: this.reason }
      : { module: this.moduleId, cause: this.reason, blockedBy: this.blockedBy };
  }
}
