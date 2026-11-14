/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  type IPermissionRequest, PermissionDecision, PermissionOption, PermissionOutcome, ToolAbortReason, ToolCall, ToolRisk
} from "@noldova/desktop.runtime";


@TestClass
export class ToolCallTests {
  private static readonly REQUEST: IPermissionRequest = {
    action: "notes.deleteItem",
    title: "Delete the note Plans",
    details: [],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce]
  };

  @TestMethod
  public async deniesARequestOutsideARegisteredCall(): Promise<void> {
    const call = new ToolCall("session-1", "conversation-1", {}, {}, 1_000, new AbortController().signal);

    const outcome = await call.requestPermissionAsync(ToolCallTests.REQUEST);

    Assert.areEqual(`${PermissionDecision.Denied}|false|false`, `${outcome.decision}|${String(outcome.isRemembered)}|${String(outcome.isAllowed)}`);
    Assert.areEqual(1_000, call.deadline);
  }

  @TestMethod
  public async asksThroughItsPermissionsWithItsSignalAndMovesItsDeadlineByTheWait(): Promise<void> {
    const controller = new AbortController();
    const signals: AbortSignal[] = [];
    const requests: IPermissionRequest[] = [];
    let answer: (outcome: PermissionOutcome) => void = () => undefined;
    let time = 1_000_000;
    const call = new ToolCall("session-1", "conversation-1", {}, {}, 1_000, controller.signal, {
      requestAsync: (request, signal) => {
        requests.push(request);
        signals.push(signal);
        return new Promise(resolve => answer = resolve);
      }
    }, () => time);

    const asking = call.requestPermissionAsync(ToolCallTests.REQUEST);
    time += 250;
    answer(new PermissionOutcome(PermissionDecision.AllowedAlways, true));
    const outcome = await asking;

    Assert.areEqual(`${PermissionDecision.AllowedAlways}|true|true`, `${outcome.decision}|${String(outcome.isRemembered)}|${String(outcome.isAllowed)}`);
    Assert.areEqual(ToolCallTests.REQUEST, requests[0]);
    Assert.areEqual(controller.signal, signals[0]);
    Assert.areEqual(1_250, call.deadline);
  }

  @TestMethod
  public recordsItsPointOfNoReturn(): void {
    const call = new ToolCall("session-1", "conversation-1", { folder: "/notes" }, { text: "plans" }, 1_000, new AbortController().signal);
    Assert.isFalse(call.hasMarkedSending);

    call.markSending();

    Assert.isTrue(call.hasMarkedSending);
    Assert.areEqual("session-1", call.session);
    Assert.areEqual("conversation-1", call.scope);
    Assert.areEqual("/notes", call.bindings["folder"]);
    Assert.areEqual("plans", call.arguments["text"]);
    Assert.areEqual(1_000, call.deadline);
  }

  @TestMethod
  public recordsThatNothingWasSentUntilItMarksSendingAgain(): void {
    const controller = new AbortController();
    const call = new ToolCall("session-1", "conversation-1", {}, {}, 1_000, controller.signal);
    const marks: boolean[][] = [];
    const record = (): void => void marks.push([call.hasMarkedSending, call.hasMarkedNothingSent]);

    record();
    call.markSending();
    call.markNothingSent();
    record();
    call.markSending();
    record();
    controller.abort(ToolAbortReason.Cancelled);
    call.markNothingSent();
    record();

    Assert.areEqual(JSON.stringify([[false, false], [true, true], [true, false], [true, true]]), JSON.stringify(marks));
  }

  @TestMethod
  public refusesToReachItsPointOfNoReturnOnceAborted(): void {
    const controller = new AbortController();
    const call = new ToolCall("session-1", "conversation-1", {}, {}, 1_000, controller.signal);
    controller.abort(ToolAbortReason.Cancelled);

    let reason: unknown = null;
    try {
      call.markSending();
    }
    catch (error) {
      reason = error;
    }

    Assert.areEqual(ToolAbortReason.Cancelled, reason);
    Assert.isFalse(call.hasMarkedSending);
  }
}
