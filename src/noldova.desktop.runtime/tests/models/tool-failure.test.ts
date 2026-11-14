/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionDecision, PermissionRecord, ToolContent, ToolFailure, ToolFailureCode, ToolRisk } from "@noldova/desktop.runtime";

@TestClass
export class ToolFailureTests {
  @TestMethod
  public carriesItsCodeMessageAndWhatTheModuleAdds(): void {
    const requests = [new PermissionRecord("request-1", ToolRisk.High, PermissionDecision.Expired, false)];
    const failure = new ToolFailure(
      ToolFailureCode.OutcomeUncertain, "The command may have run.", "terminal.exited", [ToolContent.fromText("partial", "terminal:output")], "terminal_read", requests);
    requests.length = 0;

    Assert.isTrue(failure.isFailure);
    Assert.areEqual(
      "{\"isFailure\":true,\"code\":\"OutcomeUncertain\",\"message\":\"The command may have run.\",\"moduleCode\":\"terminal.exited\",\"content\":[{\"kind\":\"Text\",\"text\":\"partial\",\"isUntrusted\":true,\"origin\":\"terminal:output\"}],\"nextTool\":\"terminal_read\"," +
        "\"requests\":[{\"id\":\"request-1\",\"risk\":\"High\",\"decision\":\"Expired\",\"isRemembered\":false}]}",
      JSON.stringify(failure.toJson()));
  }

  @TestMethod
  public addsNothingByDefault(): void {
    const failure = new ToolFailure(ToolFailureCode.Refused, "The query is empty.");

    Assert.isNull(failure.moduleCode);
    Assert.areEqual(0, failure.content.length);
    Assert.isNull(failure.nextTool);
    Assert.areEqual(0, failure.requests.length);
  }

  @TestMethod
  public refusesABlankMessage(): void {
    const exception = Assert.throws(() => new ToolFailure(ToolFailureCode.Refused, " "), ArgumentException);

    Assert.areEqual("message", exception.parameterName);
  }
}
