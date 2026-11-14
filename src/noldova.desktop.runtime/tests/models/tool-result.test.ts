/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDecision, PermissionRecord, ToolContent, ToolResult, ToolRisk } from "@noldova/desktop.runtime";

@TestClass
export class ToolResultTests {
  @TestMethod
  public keepsACopyOfItsItemsItsStructuredFieldsAndItsRequests(): void {
    const items = [ToolContent.fromText("Found 2 notes.", null)];
    const requests = [new PermissionRecord("request-1", ToolRisk.Medium, PermissionDecision.AllowedAlways, true)];

    const result = new ToolResult(items, { count: 2 }, requests);
    items.push(ToolContent.fromText("Later.", null));
    requests.push(new PermissionRecord("request-2", ToolRisk.Low, PermissionDecision.Denied, false));

    Assert.isFalse(result.isFailure);
    Assert.areEqual(1, result.content.length);
    Assert.areEqual(
      "{\"isFailure\":false,\"content\":[{\"kind\":\"Text\",\"text\":\"Found 2 notes.\",\"isUntrusted\":false}],\"structured\":{\"count\":2}," +
        "\"requests\":[{\"id\":\"request-1\",\"risk\":\"Medium\",\"decision\":\"AllowedAlways\",\"isRemembered\":true}]}",
      JSON.stringify(result.toJson()));
  }

  @TestMethod
  public hasNoStructuredFieldsAndNoRequestsByDefault(): void {
    const result = new ToolResult([]);

    Assert.isNull(result.structured);
    Assert.areEqual(0, result.requests.length);
  }
}
