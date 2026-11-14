/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { AgentControlFailure } from "../enums/agent-control-failure.js";
import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class AgentControlException extends RuntimeException {
  public readonly reason: AgentControlFailure;
  public readonly moduleId: string;

  public constructor(reason: AgentControlFailure, moduleId: string, options?: ExceptionOptions) {
    super(AgentControlException.describe(reason, moduleId), options);

    this.reason = reason;
    this.moduleId = moduleId;
  }

  private static describe(reason: AgentControlFailure, moduleId: string): string {
    switch (reason) {
      case AgentControlFailure.SessionStopRefused:
        return Resources.formatSessionStopRefused(moduleId);
      default:
        return Resources.formatResumeRefused(moduleId);
    }
  }
}
