/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { PermissionDecision } from "../enums/permission-decision.js";
import type { ToolRisk } from "../enums/tool-risk.js";

export class PermissionRecord {
  public readonly id: string;
  public readonly risk: ToolRisk;
  public readonly decision: PermissionDecision;
  public readonly isRemembered: boolean;

  public constructor(id: string, risk: ToolRisk, decision: PermissionDecision, isRemembered: boolean) {
    this.id = id;
    this.risk = risk;
    this.decision = decision;
    this.isRemembered = isRemembered;
  }

  public toJson(): JsonObject {
    return { id: this.id, risk: this.risk, decision: this.decision, isRemembered: this.isRemembered };
  }
}
