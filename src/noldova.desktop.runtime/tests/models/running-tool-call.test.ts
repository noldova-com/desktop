/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PermissionDecision } from "../../src/enums/permission-decision.js";
import { PermissionOption } from "../../src/enums/permission-option.js";
import { ToolAbortReason } from "../../src/enums/tool-abort-reason.js";
import { ToolRisk } from "../../src/enums/tool-risk.js";
import type { IPermissionRequest } from "../../src/interfaces/i-permission-request.js";
import type { IToolDescriptor } from "../../src/interfaces/i-tool-descriptor.js";
import { PermissionOutcome } from "../../src/models/permission-outcome.js";
import { RegisteredTool } from "../../src/models/registered-tool.js";
import { RunningToolCall } from "../../src/models/running-tool-call.js";
import { ToolCall } from "../../src/models/tool-call.js";
import { ToolDescriptor } from "../../src/models/tool-descriptor.js";
import { ToolResult } from "../../src/models/tool-result.js";
import { ToolSession } from "../../src/models/tool-session.js";

@TestClass
export class RunningToolCallTests {
  private static readonly TOOLS: readonly string[] = ["notes_search", "notes_send", "notes_append"];
  private static readonly SEARCH: IToolDescriptor = {
    name: "notes_search",
    description: "Searches the notes.",
    inputSchema: { type: "object" },
    hints: { isReadOnly: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 5_000, maximum: 30_000 }
  };
  private static readonly SEND: IToolDescriptor = {
    name: "notes_send",
    description: "Sends a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
    marksSending: true,
    deadline: { default: 5_000, maximum: 30_000 },
    nextTool: "notes_search"
  };
  private static readonly APPEND: IToolDescriptor = {
    name: "notes_append",
    description: "Appends text to a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Medium },
    deadline: { default: 5_000, maximum: 30_000 },
    nextTool: "notes_search"
  };
  private static readonly REQUEST: IPermissionRequest = {
    action: "notes.sendItem",
    title: "Send the note Plans",
    details: [],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce]
  };

  @TestMethod
  public isNotStartedUntilItHasACall(): void {
    const run = RunningToolCallTests.create(RunningToolCallTests.APPEND, [], () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce)));

    Assert.isFalse(run.isStarted);
    Assert.isFalse(run.isPastPointOfNoReturn);
    run.start(RunningToolCallTests.toolCall());

    Assert.isTrue(run.isStarted);
    Assert.isTrue(run.isPastPointOfNoReturn);
  }

  @TestMethod
  public neverPassesThePointOfNoReturnForAToolThatCannotBeUncertain(): void {
    const run = RunningToolCallTests.create(RunningToolCallTests.SEARCH, [], () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce)));

    run.start(RunningToolCallTests.toolCall());

    Assert.isFalse(run.isPastPointOfNoReturn);
  }

  @TestMethod
  public passesThePointOfNoReturnOfAMarkingToolOnlyWhileItHasMarkedSending(): void {
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, [], () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce)));
    const call = RunningToolCallTests.toolCall();
    run.start(call);
    const before = run.isPastPointOfNoReturn;

    call.markSending();
    const sending = run.isPastPointOfNoReturn;
    call.markNothingSent();

    Assert.areEqual("false|true|false", `${String(before)}|${String(sending)}|${String(run.isPastPointOfNoReturn)}`);
  }

  @TestMethod
  public async asksWithAnIdAndRecordsTheAnswer(): Promise<void> {
    const asked: string[] = [];
    let waiting = false;
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, [], (request, _signal, id) => {
      asked.push(`${request.action} ${id}`);
      waiting = run.isWaiting;
      return Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedAlways, true, id));
    });

    const outcome = await run.requestAsync(RunningToolCallTests.REQUEST, new AbortController().signal);
    run.end();

    Assert.isTrue(waiting);
    Assert.isFalse(run.isWaiting);
    Assert.areEqual(`notes.sendItem ${String(outcome.id)}`, asked.join("|"));
    Assert.areEqual(1, run.requests.length);
    Assert.areEqual(JSON.stringify({ id: outcome.id, risk: "Medium", decision: "AllowedAlways", isRemembered: true }), JSON.stringify(run.requests[0]?.toJson()));
  }

  @TestMethod
  public async deniesASecondRequestWhileOneIsWaitingAndLogsWhy(): Promise<void> {
    const log: string[] = [];
    let answer: (outcome: PermissionOutcome) => void = () => undefined;
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, log, () => new Promise(resolve => answer = resolve));
    const signal = new AbortController().signal;

    const first = run.requestAsync(RunningToolCallTests.REQUEST, signal);
    const second = await run.requestAsync(RunningToolCallTests.REQUEST, signal);
    answer(new PermissionOutcome(PermissionDecision.AllowedOnce));
    await first;
    run.end();

    Assert.areEqual(PermissionDecision.Denied, second.decision);
    Assert.areEqual("The permission request for notes.sendItem was denied: The call already has a permission request waiting.", log.join("|"));
    Assert.areEqual("AllowedOnce|Denied", run.requests.map(t => t.decision).join("|"));
  }

  @TestMethod
  public async deniesARequestAfterTheCallEndedWithoutAsking(): Promise<void> {
    const log: string[] = [];
    let asked = 0;
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, log, () => {
      asked++;
      return Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce));
    });
    run.end();

    const outcome = await run.requestAsync(RunningToolCallTests.REQUEST, new AbortController().signal);

    Assert.areEqual(PermissionDecision.Denied, outcome.decision);
    Assert.areEqual(0, asked);
    Assert.areEqual("The permission request for notes.sendItem was denied: The call has already ended.", log.join("|"));
  }

  @TestMethod
  public async withdrawsARequestWhoseSignalIsAlreadyAborted(): Promise<void> {
    let asked = 0;
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, [], () => {
      asked++;
      return Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce));
    });
    const controller = new AbortController();
    controller.abort();

    const outcome = await run.requestAsync(RunningToolCallTests.REQUEST, controller.signal);

    Assert.areEqual(PermissionDecision.Withdrawn, outcome.decision);
    Assert.isNotNull(outcome.id);
    Assert.areEqual(0, asked);
  }

  @TestMethod
  public abortsWithTheReasonItIsGiven(): void {
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, [], () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce)));

    run.abort(ToolAbortReason.Stopped);

    Assert.isTrue(run.controller.signal.aborted);
    Assert.areEqual(ToolAbortReason.Stopped, run.controller.signal.reason);
  }

  @TestMethod
  public async abortsWhenItsDeadlineIsReached(): Promise<void> {
    const run = RunningToolCallTests.create(RunningToolCallTests.SEND, [], () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce)));
    const aborted = new Promise<void>(resolve => run.controller.signal.addEventListener("abort", () => resolve(), { once: true }));

    run.startDeadline(0);
    await aborted;

    Assert.areEqual(ToolAbortReason.DeadlineReached, run.controller.signal.reason);
  }

  private static create(
    descriptor: IToolDescriptor,
    log: string[],
    ask: (request: IPermissionRequest, signal: AbortSignal, id: string) => Promise<PermissionOutcome>
  ): RunningToolCall {
    const tool = new RegisteredTool(
      "notes", new ToolDescriptor(descriptor, RunningToolCallTests.TOOLS), { handleAsync: () => Promise.resolve(new ToolResult([])) }, RunningToolCallTests.TOOLS, { write: message => log.push(message) });
    const session = new ToolSession("session-1", "conversation-1", {}, { listTools: () => [], callAsync: () => Promise.resolve(new ToolResult([])), end: () => undefined });
    return new RunningToolCall(tool, session, ask);
  }

  private static toolCall(): ToolCall {
    return new ToolCall("session-1", "conversation-1", {}, {}, 5_000, new AbortController().signal);
  }
}
