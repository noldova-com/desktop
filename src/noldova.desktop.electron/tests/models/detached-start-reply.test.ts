/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetachedStartReply, RuntimeStarterFailedException } from "@noldova/desktop.electron";

@TestClass
export class DetachedStartReplyTests {
  @TestMethod
  public carriesTheStartedProcess(): void {
    const reply = DetachedStartReply.fromJson(DetachedStartReply.started(4120).toJson());

    Assert.areEqual(4120, reply.processId);
    Assert.isNull(reply.failure);
    Assert.areEqual(4120, reply.requireProcessId());
  }

  @TestMethod
  public turnsAFailureIntoALaunchException(): void {
    const reply = DetachedStartReply.fromJson(DetachedStartReply.failed("The program is missing.").toJson());

    const exception = Assert.throws(() => reply.requireProcessId(), RuntimeStarterFailedException);

    Assert.isNull(reply.processId);
    Assert.areEqual("The runtime starter could not start the runtime: The program is missing.", exception.message);
  }

  @TestMethod
  public refusesAReplyWithoutExactlyOneOutcome(): void {
    for (const value of [{ processId: null, failure: null }, { processId: 1, failure: "both" }]) {
      const exception = Assert.throws(() => DetachedStartReply.fromJson(value), JsonException);
      Assert.areEqual("$: A start reply carries either a process id or a failure.", exception.message);
    }
  }
}
