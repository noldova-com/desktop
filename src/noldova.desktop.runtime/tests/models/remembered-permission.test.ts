/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDecision, RememberedPermission } from "@noldova/desktop.runtime";

@TestClass
export class RememberedPermissionTests {
  @TestMethod
  public keepsWhatWasRememberedAndWhen(): void {
    const remembered = new Date(Date.UTC(2026, 10, 12, 9, 30));

    const permission = new RememberedPermission("answer-1", "notes", "notes.deleteItem", "Plans", "conversation-1", PermissionDecision.AllowedAlways, remembered);

    Assert.areEqual("answer-1|notes|notes.deleteItem|Plans|conversation-1", [permission.id, permission.module, permission.action, permission.subject, permission.scope].join("|"));
    Assert.areEqual(PermissionDecision.AllowedAlways, permission.decision);
    Assert.areEqual(remembered, permission.remembered);
  }

  @TestMethod
  public keepsAPermissionWithoutASubject(): void {
    const permission = new RememberedPermission("answer-2", "notes", "notes.search", null, "conversation-1", PermissionDecision.DeniedAlways, new Date(0));

    Assert.isNull(permission.subject);
  }
}
