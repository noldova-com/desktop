/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AgentControlException, AgentControlFailure } from "@noldova/desktop.runtime";

@TestClass
export class AgentControlExceptionTests {
  @TestMethod
  public namesTheModuleRefusedASessionStop(): void {
    const exception = new AgentControlException(AgentControlFailure.SessionStopRefused, "notes");

    Assert.areEqual(
      "The module notes can't stop an agent session's turn while agent control or a session stops; only a command the person runs stops it.",
      exception.message);
    Assert.areEqual(AgentControlFailure.SessionStopRefused, exception.reason);
    Assert.areEqual("notes", exception.moduleId);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("AgentControlException", exception.name);
  }

  @TestMethod
  public namesTheModuleRefusedAResume(): void {
    const exception = new AgentControlException(AgentControlFailure.ResumeRefused, "notes");

    Assert.areEqual(
      "The module notes can't resume agent control while it stops or while one of its tool calls runs, even past its abort; only a command the person runs resumes it.",
      exception.message);
    Assert.areEqual(AgentControlFailure.ResumeRefused, exception.reason);
    Assert.areEqual("notes", exception.moduleId);
    Assert.isUndefined(exception.cause);
  }

  @TestMethod
  public keepsTheCause(): void {
    const cause = new Error("The registry is stopping.");

    const exception = new AgentControlException(AgentControlFailure.ResumeRefused, "notes", new ExceptionOptions(cause));

    Assert.areEqual<unknown>(cause, exception.cause);
  }
}
