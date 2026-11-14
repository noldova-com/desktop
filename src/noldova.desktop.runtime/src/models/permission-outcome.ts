/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionDecision } from "../enums/permission-decision.js";

export class PermissionOutcome {
  public readonly decision: PermissionDecision;
  public readonly isRemembered: boolean;
  public readonly id: string | null;

  public constructor(decision: PermissionDecision, isRemembered: boolean = false, id: string | null = null) {
    this.decision = decision;
    this.isRemembered = isRemembered;
    this.id = id;
  }

  public get isAllowed(): boolean {
    return this.decision === PermissionDecision.AllowedOnce || this.decision === PermissionDecision.AllowedAlways;
  }
}
