/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IPermissionRequest, PermissionDecision, PermissionOption, PermissionOutcome, PermissionQuestion, ToolRisk } from "@noldova/desktop.runtime";

@TestClass
export class PermissionQuestionTests {
  private static readonly REQUEST: IPermissionRequest = {
    action: "notes.deleteItem",
    title: "Delete the note Plans",
    details: [],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce, PermissionOption.Deny]
  };

  @TestMethod
  public keepsTheIdItIsGivenOrMakesItsOwn(): void {
    const given = new PermissionQuestion("notes", "session-1", "conversation-1", PermissionQuestionTests.REQUEST, "request-1");
    const made = [1, 2].map(() => new PermissionQuestion("notes", "session-1", "conversation-1", PermissionQuestionTests.REQUEST));

    Assert.areEqual("request-1", given.id);
    Assert.isTrue(made.every(t => t.id.length > 0), made.map(t => t.id).join());
    Assert.areNotEqual(made[0]?.id, made[1]?.id);
  }

  @TestMethod
  public givesAnOutcomeNoIdUnlessItIsGivenOne(): void {
    Assert.areEqual("null|request-1", `${new PermissionOutcome(PermissionDecision.Denied).id}|${new PermissionOutcome(PermissionDecision.AllowedOnce, false, "request-1").id}`);
  }
}
