/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionRevocation } from "@noldova/desktop.runtime";

@TestClass
export class PermissionRevocationTests {
  @TestMethod
  public keepsTheActionTheSubjectAndTheScope(): void {
    const revocation = new PermissionRevocation("notes.deleteItem", "Plans", "conversation-1");

    Assert.areEqual("notes.deleteItem", revocation.action);
    Assert.areEqual("Plans", revocation.subject);
    Assert.areEqual("conversation-1", revocation.scope);
  }

  @TestMethod
  public keepsARevocationWithoutASubject(): void {
    Assert.isNull(new PermissionRevocation("notes.deleteItem", null, "conversation-1").subject);
  }
}
