/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDecision, PermissionOutcome } from "@noldova/desktop.runtime";

@TestClass
export class PermissionOutcomeTests {
  @TestMethod
  public isNotRememberedAndHasNoIdByDefault(): void {
    const outcome = new PermissionOutcome(PermissionDecision.AllowedOnce);

    Assert.areEqual(PermissionDecision.AllowedOnce, outcome.decision);
    Assert.isFalse(outcome.isRemembered);
    Assert.isNull(outcome.id);
  }

  @TestMethod
  public keepsWhetherItWasRememberedAndItsId(): void {
    const outcome = new PermissionOutcome(PermissionDecision.DeniedAlways, true, "request-1");

    Assert.isTrue(outcome.isRemembered);
    Assert.areEqual("request-1", outcome.id);
  }

  @TestMethod
  public allowsOnlyTheAllowingDecisions(): void {
    const allowed = Object.values(PermissionDecision).filter(t => new PermissionOutcome(t).isAllowed);

    Assert.areEqual(`${PermissionDecision.AllowedOnce}|${PermissionDecision.AllowedAlways}`, allowed.join("|"));
  }
}
