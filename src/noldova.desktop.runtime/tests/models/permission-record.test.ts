/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDecision, PermissionRecord, ToolRisk } from "@noldova/desktop.runtime";

@TestClass
export class PermissionRecordTests {
  @TestMethod
  public keepsWhatWasAskedAndAnswered(): void {
    const record = new PermissionRecord("request-1", ToolRisk.Medium, PermissionDecision.AllowedAlways, true);

    Assert.areEqual("request-1", record.id);
    Assert.areEqual(ToolRisk.Medium, record.risk);
    Assert.areEqual(PermissionDecision.AllowedAlways, record.decision);
    Assert.isTrue(record.isRemembered);
  }

  @TestMethod
  public writesItsJson(): void {
    const record = new PermissionRecord("request-2", ToolRisk.High, PermissionDecision.Denied, false);

    Assert.areEqual(JSON.stringify({ id: "request-2", risk: "High", decision: "Denied", isRemembered: false }), JSON.stringify(record.toJson()));
  }
}
