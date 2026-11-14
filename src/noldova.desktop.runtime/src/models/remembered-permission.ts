/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionDecision } from "../enums/permission-decision.js";

export class RememberedPermission {
  public readonly id: string;
  public readonly module: string;
  public readonly action: string;
  public readonly subject: string | null;
  public readonly scope: string;
  public readonly decision: PermissionDecision;
  public readonly remembered: Date;

  public constructor(id: string, module: string, action: string, subject: string | null, scope: string, decision: PermissionDecision, remembered: Date) {
    this.id = id;
    this.module = module;
    this.action = action;
    this.subject = subject;
    this.scope = scope;
    this.decision = decision;
    this.remembered = remembered;
  }
}
