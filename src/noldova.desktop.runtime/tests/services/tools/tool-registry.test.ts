/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  AgentControlException, type IPermissionRequest, type IToolDescriptor, type IToolHandler, type IToolSchemaValidator, PermissionCenter, PermissionDecision, PermissionOption, type PermissionOutcome,
  type Registration, RememberedPermissionStore, ToolAbortReason, type ToolCall, ToolContent, ToolDescriptor, ToolFailure, ToolFailureCode, ToolFailureException, ToolRegisteredException, ToolRegistry,
  ToolResult, ToolRisk, ToolSchemaValidator, type ToolSession
} from "@noldova/desktop.runtime";

import { ModuleLogFixture } from "../../fixtures/module-log.fixture.js";
import { PermissionAnswererFixture } from "../../fixtures/permission-answerer.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { ToolHandlerFixture } from "../../fixtures/tool-handler.fixture.js";
import { ToolImageFixture } from "../../fixtures/tool-image.fixture.js";
import { ToolRegistryFixture } from "../../fixtures/tool-registry.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class ToolRegistryTests {
  private static readonly UNWRITABLE: object = {
    [inspect.custom]: (): never => {
      throw new Error("The value cannot be shown.");
    }
  };
  private static readonly TOOLS: readonly string[] = ["notes_search", "notes_append", "notes_status"];
  private static readonly SEARCH: IToolDescriptor = {
    name: "notes_search",
    description: "Searches the notes.",
    inputSchema: { type: "object" },
    hints: { isReadOnly: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 2_000, maximum: 5_000 }
  };
  private static readonly APPEND: IToolDescriptor = {
    name: "notes_append",
    description: "Appends text to a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    deadline: { default: 2_000, maximum: 5_000 },
    nextTool: "notes_status"
  };

  @TestMethod
  public listsToolsInRegistrationOrderAndRefusesASecondToolWithOneName(): void {
    const registry = ToolRegistryFixture.create();
    ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH);
    ToolRegistryTests.register(registry, ToolRegistryTests.APPEND);

    const exception = Assert.throws(() => ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH), ToolRegisteredException);

    Assert.areEqual("The tool notes_search is already registered.", exception.message);
    Assert.areEqual("notes_search,notes_append", registry.listTools().map(t => t.name).join(","));
    Assert.areEqual("notes_search,notes_append", registry.openSession("conversation-1", {}).listTools().map(t => t.name).join(","));
  }

  @TestMethod
  public withdrawsAToolOnlyThroughItsOwnRegistration(): void {
    const registry = ToolRegistryFixture.create();
    const first = ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH);
    first[Symbol.dispose]();
    const second = new ToolHandlerFixture();
    ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, second);

    first[Symbol.dispose]();

    Assert.areEqual(1, registry.listTools().length);
  }

  @TestMethod
  public opensSessionsWithTheirIdsAndRefusesALongScope(): void {
    let count = 0;
    const registry = ToolRegistryFixture.create(undefined, undefined, () => `session-${++count}`);

    const session = registry.openSession("x".repeat(256), { folder: "/notes" });
    const exception = Assert.throws(() => registry.openSession("x".repeat(257), {}), ArgumentOutOfRangeException);

    Assert.areEqual("session-1", session.id);
    Assert.areEqual(256, session.scope.length);
    Assert.areEqual("/notes", session.bindings["folder"]);
    Assert.areEqual("scope", exception.parameterName);
    Assert.isTrue(ToolRegistryFixture.create().openSession("conversation-1", {}).id.length > 0);
  }

  @TestMethod
  public answersWithTheHandlersResultForACallThatCarriesItsSession(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const result = new ToolResult([ToolContent.fromText("Found 2 notes.", null)]);
      const handler = new ToolHandlerFixture(() => Promise.resolve(result));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);
      const before = Date.now();

      const outcome = await session.callAsync("notes_search", { query: "plans" });

      Assert.areEqual(JSON.stringify(result.toJson()), JSON.stringify(outcome.toJson()));
      const call = ToolRegistryTests.only(handler.calls);
      Assert.areEqual(session.id, call.session);
      Assert.areEqual("conversation-1", call.scope);
      Assert.areEqual("/notes", call.bindings["folder"]);
      Assert.areEqual("plans", call.arguments["query"]);
      Assert.isTrue(call.deadline >= before + 2_000 && call.deadline <= Date.now() + 2_000);
      Assert.isFalse(call.signal.aborted);
    });
  }

  @TestMethod
  public failsACallOfAnEndedSessionOrAnUnregisteredToolAsUnavailable(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture();
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);

      const unknown = await session.callAsync("notes_delete", {});
      session.end();
      const ended = await session.callAsync("notes_search", {});

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, unknown, "The tool notes_delete is not registered.");
      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, ended, "The agent session has ended.");
      Assert.areEqual(0, handler.calls.length);
    });
  }

  @TestMethod
  public refusesArgumentsOverTheirLimitAndADeadlineOutsideTheTools(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture();
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);

      const large = await session.callAsync("notes_search", { query: "x".repeat(64 * 1024) });
      const deadlines = await Promise.all([0, 1.5, 5_001].map(t => session.callAsync("notes_search", {}, { deadlineMilliseconds: t })));
      const longest = await session.callAsync("notes_search", { query: "x".repeat(64 * 1024 - 12) }, { deadlineMilliseconds: 5_000 });

      ToolRegistryTests.assertFailure(ToolFailureCode.Refused, large, "The call's arguments are over 64 KiB as JSON.");
      for (const outcome of deadlines)
        ToolRegistryTests.assertFailure(ToolFailureCode.Refused, outcome, "The call's deadline must be a whole number of milliseconds from 1 to 5000.");
      Assert.isFalse(longest.isFailure);
      Assert.areEqual(1, handler.calls.length);
    });
  }

  @TestMethod
  public keepsACancelledCallsFailureWhenItsHandlerAnswersAfterwards(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(t => new Promise(resolve => t.signal.addEventListener("abort", () => resolve(new ToolResult([])), { once: true })));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);
      const controller = new AbortController();
      const running = session.callAsync("notes_search", {}, { signal: controller.signal });
      const isSettled = ToolRegistryTests.track(running);
      await handler.waitForCallAsync(1);

      controller.abort();
      await setImmediate();

      Assert.isTrue(isSettled());
      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, await running, "The call was cancelled.");
    });
  }

  @TestMethod
  public freesTheSlotAndTheTurnOfACallWhoseHandlerNeverAnswersWhenItsDeadlinePasses(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(() => undefined));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "binding:folder" }, handler);
      const other = registry.openSession("conversation-2", { folder: "/notes" });

      const hanging = await Promise.all(Array.from({ length: 16 }, () => session.callAsync("notes_search", {}, { deadlineMilliseconds: 1 })));
      const after = await session.callAsync("notes_search", {}, { deadlineMilliseconds: 1 });
      const elsewhere = await other.callAsync("notes_search", {}, { deadlineMilliseconds: 1 });

      for (const outcome of [...hanging, after, elsewhere])
        ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, outcome, "The call's deadline passed.");
      other.end();
    });
  }

  @TestMethod
  public refusesACallBeyondTheSessionsSixteenInFlight(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);
      const other = registry.openSession("conversation-2", {});
      const controller = new AbortController();
      const calls = Array.from({ length: 16 }, () => session.callAsync("notes_search", {}, { signal: controller.signal }));
      await handler.waitForCallAsync(16);

      const refused = await session.callAsync("notes_search", {});
      const allowed = other.callAsync("notes_search", {});
      await handler.waitForCallAsync(17);
      other.end();
      controller.abort();

      ToolRegistryTests.assertFailure(ToolFailureCode.Refused, refused, "The agent session already has 16 calls in flight.");
      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, await allowed, "The call was cancelled.");
      for (const outcome of await Promise.all(calls))
        ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, outcome, "The call was cancelled.");
    });
  }

  @TestMethod
  public endsACallAtItsDeadlineEvenIfTheHandlerHasNotReturned(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const reasons: unknown[] = [];
      const handler = new ToolHandlerFixture(t => {
        t.signal.addEventListener("abort", () => reasons.push(t.signal.reason), { once: true });
        return new Promise<ToolResult>(() => undefined);
      });
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);

      const outcome = await session.callAsync("notes_search", {}, { deadlineMilliseconds: 20 });

      ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, outcome, "The call's deadline passed.");
      Assert.areEqual(ToolAbortReason.DeadlineReached, reasons.join(","));
    });
  }

  @TestMethod
  public cancelsACallWhoseSignalAbortsBeforeOrWhileItRuns(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(t => new Promise((_resolve, reject) => t.signal.addEventListener("abort", () => reject(t.signal.reason), { once: true })));
      const log = new ModuleLogFixture();
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler, log);
      const early = new AbortController();
      early.abort();
      const late = new AbortController();

      const before = await session.callAsync("notes_search", {}, { signal: early.signal });
      const running = session.callAsync("notes_search", {}, { signal: late.signal });
      const isSettled = ToolRegistryTests.track(running);
      await handler.waitForCallAsync(1);
      late.abort("anything");
      await setImmediate();

      Assert.isTrue(isSettled());
      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, before, "The call was cancelled.");
      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, await running, "The call was cancelled.");
      Assert.areEqual(ToolAbortReason.Cancelled, ToolRegistryTests.only(handler.calls).signal.reason);
      Assert.areEqual(0, log.lines.length);
    });
  }

  @TestMethod
  public endsASessionsCallsAndTellsEachListenerOnce(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);
      const ended: string[] = [];
      const log = new ModuleLogFixture();
      registry.onSessionEnded(t => ended.push(t), log);
      const stopped = registry.onSessionEnded(t => ended.push(`stopped ${t}`), log);
      stopped[Symbol.dispose]();
      const running = session.callAsync("notes_search", {});
      await handler.waitForCallAsync(1);

      session.end();
      session.end();

      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, await running, "The call was cancelled.");
      Assert.areEqual(ToolAbortReason.SessionEnded, ToolRegistryTests.only(handler.calls).signal.reason);
      Assert.areEqual(session.id, ended.join(","));
    });
  }

  @TestMethod
  public writesAListenerThatThrowsToItsModulesLogAndStillTellsTheNext(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync((registry, session) => {
      const failing = new ModuleLogFixture();
      const ended: string[] = [];
      registry.onSessionEnded(() => {
        throw new Error("The index is closed.");
      }, failing);
      registry.onSessionEnded(t => ended.push(t), new ModuleLogFixture());

      session.end();

      Assert.areEqual(session.id, ended.join(","));
      Assert.isTrue(ToolRegistryTests.only(failing.lines).startsWith("A listener for ended agent sessions failed: Error: The index is closed."), failing.lines.join(","));
      return Promise.resolve();
    });
  }

  @TestMethod
  public endsAWithdrawnToolsCallsAsUnavailable(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
      const registration = ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);
      const running = session.callAsync("notes_search", {});
      await handler.waitForCallAsync(1);

      registration[Symbol.dispose]();

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, await running, "The tool was switched off.");
      Assert.areEqual(0, registry.listTools().length);
    });
  }

  @TestMethod
  public failsACallPastItsPointOfNoReturnOnlyAsOutcomeUncertainNamingItsNextTool(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const hanging = (call: ToolCall): Promise<ToolResult> => {
        if (call.arguments["mark"] === true)
          call.markSending();
        return new Promise<ToolResult>(() => undefined);
      };
      ToolRegistryTests.register(registry, ToolRegistryTests.APPEND, new ToolHandlerFixture(hanging));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, name: "notes_status", marksSending: true }, new ToolHandlerFixture(hanging));

      const started = await session.callAsync("notes_append", {}, { deadlineMilliseconds: 20 });
      const unmarked = await session.callAsync("notes_status", {}, { deadlineMilliseconds: 20 });
      const marked = await session.callAsync("notes_status", { mark: true }, { deadlineMilliseconds: 20 });

      ToolRegistryTests.assertFailure(ToolFailureCode.OutcomeUncertain, started, "The call's deadline passed.");
      Assert.areEqual("notes_status", ToolRegistryTests.failure(started).nextTool);
      ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, unmarked, "The call's deadline passed.");
      ToolRegistryTests.assertFailure(ToolFailureCode.OutcomeUncertain, marked, "The call's deadline passed.");
    });
  }

  @TestMethod
  public endsACallAbortedBeforeItsHandlerStartsWithoutAnUncertainOutcome(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture();
      ToolRegistryTests.register(registry, ToolRegistryTests.APPEND, handler);
      const controller = new AbortController();
      controller.abort();

      const outcome = await session.callAsync("notes_append", {}, { signal: controller.signal });

      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, outcome, "The call was cancelled.");
      Assert.areEqual(0, handler.calls.length);
    });
  }

  @TestMethod
  public endsAnAbortedCallWithItsHandlersOwnFailureWithinTheGraceUnderTheCodeTheAbortGives(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const ownEnd = (message: string) => (call: ToolCall): Promise<ToolResult> => {
        if (call.arguments["mark"] === true)
          call.markSending();
        const failure = new ToolFailure(ToolFailureCode.Refused, message, "notes.ended", [ToolContent.fromText("Step 2 of 3.", null)], "notes_search");
        return new Promise((_resolve, reject) => call.signal.addEventListener("abort", () => reject(new ToolFailureException(failure)), { once: true }));
      };
      const search = new ToolHandlerFixture(ownEnd("The search was cancelled before it read a note."));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, search, log);
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, name: "notes_status", marksSending: true }, new ToolHandlerFixture(ownEnd("The note was half written.")), log);
      const find = new ToolHandlerFixture(ownEnd("The find was stopped before it read a note."));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name: "notes_find" }, find, log);
      const controller = new AbortController();
      const cancelled = session.callAsync("notes_search", {}, { signal: controller.signal });
      await search.waitForCallAsync(1);

      controller.abort();
      const marked = await session.callAsync("notes_status", { mark: true }, { deadlineMilliseconds: 1 });
      const timedOut = await session.callAsync("notes_search", {}, { deadlineMilliseconds: 1 });
      const stopped = session.callAsync("notes_find", {});
      await find.waitForCallAsync(1);
      registry.stopAll("The person took over.");

      const own = [ToolRegistryTests.failure(await cancelled), ToolRegistryTests.failure(timedOut), ToolRegistryTests.failure(marked), ToolRegistryTests.failure(await stopped)]
        .map(t => [t.code, t.message, t.moduleCode, t.content.map(u => u.value).join(), t.nextTool]);
      Assert.areEqual(JSON.stringify([
        [ToolFailureCode.Cancelled, "The search was cancelled before it read a note.", "notes.ended", "Step 2 of 3.", null],
        [ToolFailureCode.TimedOut, "The search was cancelled before it read a note.", "notes.ended", "Step 2 of 3.", null],
        [ToolFailureCode.OutcomeUncertain, "The note was half written.", "notes.ended", "Step 2 of 3.", "notes_status"],
        [ToolFailureCode.Stopped, "The find was stopped before it read a note.", "notes.ended", "Step 2 of 3.", null]
      ]), JSON.stringify(own));
      Assert.areEqual(0, log.lines.length, log.lines.join("\n"));
    });
  }

  @TestMethod
  public async waitsTheGraceItIsGivenAndOneSecondByDefault(): Promise<void> {
    const shortened = new ToolRegistry(randomUUID, new ToolSchemaValidator(), new PermissionCenter(), 20);
    const kept = [new ToolRegistry(randomUUID, new ToolSchemaValidator(), new PermissionCenter())];
    const release = Promise.withResolvers<void>();
    const answer = (): Promise<ToolResult> => release.promise.then(() => new ToolResult([]));
    const call = (registry: ToolRegistry, index: number): Promise<ToolResult | ToolFailure> => {
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(answer));
      return registry.openSession(`conversation-${index}`, {}).callAsync("notes_search", {}, { deadlineMilliseconds: 1 });
    };
    const running = kept.map(call);
    const settled = running.map(t => ToolRegistryTests.track(t));

    const first = await call(shortened, running.length);
    const pending = settled.map(t => t());
    release.resolve();
    const outcomes = [first, ...await Promise.all(running)];

    Assert.areEqual("false", pending.join());
    for (const outcome of outcomes)
      ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, outcome, "The call's deadline passed.");
  }

  @TestMethod
  public refusesAGraceThatIsNotAPositiveWholeNumber(): void {
    for (const grace of [0, -5, 1.5, Number.NaN])
      Assert.areEqual("endGraceMilliseconds", Assert.throws(() => new ToolRegistry(randomUUID, new ToolSchemaValidator(), new PermissionCenter(), grace), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public endsAStoppedCallWhoseHandlerNeverAnswersAfterTheGraceAndFreesItsTurnAndSlotAtTheStop(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const handler = new ToolHandlerFixture(t => t.arguments["hang"] === true ? new Promise<ToolResult>(() => undefined) : Promise.resolve(new ToolResult([])));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "binding:folder" }, handler);
      const hanging = Array.from({ length: 16 }, () => session.callAsync("notes_search", { hang: true }));
      const settled = hanging.map(t => ToolRegistryTests.track(t));
      await handler.waitForCallAsync(1);

      registry.stopAll("The person took over.");
      registry.resumeAll(null);
      const next = await session.callAsync("notes_search", {});
      const pending = settled.filter(t => !t()).length;
      const outcomes = await Promise.all(hanging);

      Assert.isFalse(next.isFailure);
      Assert.areEqual(1, pending);
      Assert.areEqual(2, handler.calls.length);
      for (const outcome of outcomes)
        ToolRegistryTests.assertFailure(ToolFailureCode.Stopped, outcome, "Agent control was stopped.");
    });
  }

  @TestMethod
  public endsAnAbortedCallWithItsOwnMessageAndLogsItsHandlersFailureWhenItComesAfterTheGraceOrDoesNotFit(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const late = Promise.withResolvers<void>();
      const failure = new ToolFailure(ToolFailureCode.Cancelled, "The search was cancelled late.");
      const lateEnd = (call: ToolCall): Promise<ToolResult> =>
        new Promise((_resolve, reject) => call.signal.addEventListener("abort", () => void late.promise.then(() => reject(new ToolFailureException(failure))), { once: true }));
      const foreignEnd = (call: ToolCall): Promise<ToolResult> => {
        const foreign = call.arguments["nextTool"] === true
          ? new ToolFailure(ToolFailureCode.Cancelled, "Ended.", "notes.ended", [], "files_open")
          : new ToolFailure(ToolFailureCode.Cancelled, "Ended.", "files.ended");
        return new Promise((_resolve, reject) => call.signal.addEventListener("abort", () => reject(new ToolFailureException(foreign)), { once: true }));
      };
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(lateEnd), log);
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name: "notes_status" }, new ToolHandlerFixture(foreignEnd), log);

      const afterGrace = await session.callAsync("notes_search", {}, { deadlineMilliseconds: 1 });
      const unfit = await session.callAsync("notes_status", {}, { deadlineMilliseconds: 1 });
      const strayNext = await session.callAsync("notes_status", { nextTool: true }, { deadlineMilliseconds: 1 });
      late.resolve();
      await setImmediate();

      ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, afterGrace, "The call's deadline passed.");
      for (const outcome of [unfit, strayNext]) {
        ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, outcome, "The call's deadline passed.");
        Assert.isNull(ToolRegistryTests.failure(outcome).moduleCode);
      }
      Assert.areEqual(
        "The tool notes_status failed after its call had ended|The tool notes_status failed after its call had ended|The tool notes_search failed after its call had ended",
        log.lines.map(t => t.split(":")[0]).join("|"),
        log.lines.join("\n"));
    });
  }

  @TestMethod
  public passesOnAModulesFailureAndMakesItUncertainPastThePointOfNoReturn(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const refuse = (): Promise<ToolResult> => Promise.reject(new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, "The note is locked.", "notes.locked")));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(refuse));
      ToolRegistryTests.register(registry, ToolRegistryTests.APPEND, new ToolHandlerFixture(refuse));

      const read = await session.callAsync("notes_search", {});
      const appended = await session.callAsync("notes_append", {});

      ToolRegistryTests.assertFailure(ToolFailureCode.Refused, read, "The note is locked.");
      Assert.areEqual("notes.locked", ToolRegistryTests.failure(read).moduleCode);
      Assert.isNull(ToolRegistryTests.failure(read).nextTool);
      ToolRegistryTests.assertFailure(ToolFailureCode.OutcomeUncertain, appended, "The note is locked.");
      Assert.areEqual("notes.locked", ToolRegistryTests.failure(appended).moduleCode);
      Assert.areEqual("notes_status", ToolRegistryTests.failure(appended).nextTool);
    });
  }

  @TestMethod
  public keepsAFailuresCodePastMarkSendingWhenTheHandlerKnowsNothingWasSentBeforeOrAfterTheAbort(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const send = (call: ToolCall): Promise<ToolResult> => {
        call.markSending();
        if (call.arguments["refused"] === true)
          call.markNothingSent();
        if (call.arguments["again"] === true)
          call.markSending();
        return Promise.reject(new ToolFailureException(new ToolFailure(ToolFailureCode.Stale, "The window moved before the click.", "notes.windowMoved")));
      };
      const wait = (call: ToolCall): Promise<ToolResult> => {
        call.markSending();
        if (call.arguments["early"] === true)
          call.markNothingSent();
        return new Promise<ToolResult>((_resolve, reject) => call.signal.addEventListener("abort", () => {
          call.markNothingSent();
          if (call.arguments["answer"] === true)
            reject(new ToolFailureException(new ToolFailure(ToolFailureCode.Stale, "The window moved before the click.", "notes.windowMoved")));
        }, { once: true }));
      };
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, marksSending: true }, new ToolHandlerFixture(send));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, name: "notes_status", marksSending: true }, new ToolHandlerFixture(wait));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, name: "notes_replace" }, new ToolHandlerFixture(send));

      const outcomes = [
        await session.callAsync("notes_append", { refused: true }),
        await session.callAsync("notes_replace", { refused: true }),
        await session.callAsync("notes_append", {}),
        await session.callAsync("notes_append", { refused: true, again: true }),
        await session.callAsync("notes_status", { early: true }, { deadlineMilliseconds: 1 }),
        await session.callAsync("notes_status", {}, { deadlineMilliseconds: 1 }),
        await session.callAsync("notes_status", { answer: true }, { deadlineMilliseconds: 1 })
      ].map(t => [ToolRegistryTests.failure(t).code, ToolRegistryTests.failure(t).message, ToolRegistryTests.failure(t).moduleCode, ToolRegistryTests.failure(t).nextTool]);

      Assert.areEqual(JSON.stringify([
        [ToolFailureCode.Stale, "The window moved before the click.", "notes.windowMoved", null],
        [ToolFailureCode.OutcomeUncertain, "The window moved before the click.", "notes.windowMoved", "notes_status"],
        [ToolFailureCode.OutcomeUncertain, "The window moved before the click.", "notes.windowMoved", "notes_status"],
        [ToolFailureCode.OutcomeUncertain, "The window moved before the click.", "notes.windowMoved", "notes_status"],
        [ToolFailureCode.TimedOut, "The call's deadline passed.", null, null],
        [ToolFailureCode.TimedOut, "The call's deadline passed.", null, null],
        [ToolFailureCode.TimedOut, "The window moved before the click.", "notes.windowMoved", null]
      ]), JSON.stringify(outcomes));
    });
  }

  @TestMethod
  public writesAFailuresCauseToTheModulesLogAndNeverToTheAgent(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const fail = (message: string, call: ToolCall): ToolFailureException => {
        const failure = new ToolFailure(ToolFailureCode.Refused, message, "notes.locked");
        return call.arguments["cause"] === true ? new ToolFailureException(failure, { cause: new Error("EBUSY: the notes file is held.") }) : new ToolFailureException(failure);
      };
      const refuse = (call: ToolCall): Promise<ToolResult> => Promise.reject(fail("The note is locked.", call));
      const refuseAtAbort = (call: ToolCall): Promise<ToolResult> =>
        new Promise((_resolve, reject) => call.signal.addEventListener("abort", () => reject(fail("The note was locked when the call ended.", call)), { once: true }));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(refuse), log);
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name: "notes_status" }, new ToolHandlerFixture(refuseAtAbort), log);

      const outcomes = [
        await session.callAsync("notes_search", { cause: true }),
        await session.callAsync("notes_search", {}),
        await session.callAsync("notes_status", { cause: true }, { deadlineMilliseconds: 1 }),
        await session.callAsync("notes_status", {}, { deadlineMilliseconds: 1 })
      ].map(t => ToolRegistryTests.failure(t));
      const answers = outcomes.map(t => JSON.stringify(t.toJson()));

      Assert.areEqual(
        [ToolFailureCode.Refused, ToolFailureCode.Refused, ToolFailureCode.TimedOut, ToolFailureCode.TimedOut].join(),
        outcomes.map(t => t.code).join());
      Assert.isFalse(answers.some(t => t.includes("EBUSY")), answers.join("|"));
      Assert.areEqual(JSON.stringify([
        "The tool notes_search failed with \"The note is locked.\", caused by: Error: EBUSY: the notes file is held.",
        "The tool notes_status failed with \"The note was locked when the call ended.\", caused by: Error: EBUSY: the notes file is held."
      ]), JSON.stringify(log.lines.map(t => t.split("\n")[0])), log.lines.join("\n"));
    });
  }

  @TestMethod
  public answersAtOnceAndWritesOneLineForEachFailureWhateverItsCauseIs(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const cyclic: { self?: unknown } = {};
      cyclic.self = cyclic;
      const causes: Record<string, unknown> = { cyclic, text: "EBUSY", unwritable: ToolRegistryTests.UNWRITABLE };
      const refuse = (call: ToolCall): Promise<ToolResult> =>
        Promise.reject(new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, "The note is locked.", "notes.locked"), { cause: causes[String(call.arguments["cause"])] }));
      const refusals = new ToolHandlerFixture(refuse);
      const broken = new ToolHandlerFixture(() => Promise.reject(ToolRegistryTests.UNWRITABLE));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, refusals, log);
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name: "notes_status" }, broken, log);

      const running = [
        session.callAsync("notes_search", { cause: "cyclic" }),
        session.callAsync("notes_search", { cause: "text" }),
        session.callAsync("notes_search", { cause: "unwritable" }),
        session.callAsync("notes_status", {})
      ];
      const settled = running.map(t => ToolRegistryTests.track(t));
      await Promise.all([refusals.waitForCallAsync(3), broken.waitForCallAsync(1)]);
      await setImmediate();
      const isSettled = settled.map(t => t());
      const outcomes = (await Promise.all(running)).map(t => ToolRegistryTests.failure(t));

      Assert.areEqual("true,true,true,true", isSettled.join());
      Assert.areEqual(
        [ToolFailureCode.Refused, ToolFailureCode.Refused, ToolFailureCode.Refused, ToolFailureCode.Unavailable].join(),
        outcomes.map(t => t.code).join());
      Assert.areEqual(JSON.stringify([
        "The tool notes_search failed with \"The note is locked.\", caused by: <ref *1> { self: [Circular *1] }",
        "The tool notes_search failed with \"The note is locked.\", caused by: 'EBUSY'",
        "The tool notes_search failed, and what it failed with could not be written to the log.",
        "The tool notes_status failed, and what it failed with could not be written to the log."
      ]), JSON.stringify(log.lines), log.lines.join("\n"));
    });
  }

  @TestMethod
  public writesOneLineForAFailureAfterItsCallEndedThatCannotBeWritten(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const rejections: Promise<void>[] = [];
      const rejectAtAbort = (call: ToolCall, error: unknown): Promise<ToolResult> => {
        const rejected = Promise.withResolvers<ToolResult>();
        call.signal.addEventListener("abort", () => rejected.reject(error), { once: true });
        rejections.push(rejected.promise.then(() => undefined, () => undefined));
        return rejected.promise;
      };
      const unwritable = { cause: ToolRegistryTests.UNWRITABLE };
      const fit = new ToolFailureException(new ToolFailure(ToolFailureCode.Cancelled, "Ended."), unwritable);
      const unfit = new ToolFailureException(new ToolFailure(ToolFailureCode.Cancelled, "Ended.", "files.ended"), unwritable);
      const handlers = [
        new ToolHandlerFixture(t => rejectAtAbort(t, ToolRegistryTests.UNWRITABLE)),
        new ToolHandlerFixture(t => rejectAtAbort(t, fit)),
        new ToolHandlerFixture(t => rejectAtAbort(t, unfit))
      ];
      const names = ["notes_search", "notes_status", "notes_append"];
      names.forEach((name, i) => ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name }, handlers[i], log));

      const running = names.map(t => session.callAsync(t, {}, { deadlineMilliseconds: 1 }));
      await Promise.all(handlers.map(t => t.waitForCallAsync(1)));
      await Promise.all(rejections);
      await setImmediate();
      const outcomes = await Promise.all(running);

      Assert.areEqual(
        JSON.stringify([[ToolFailureCode.TimedOut, "The call's deadline passed."], [ToolFailureCode.TimedOut, "Ended."], [ToolFailureCode.TimedOut, "The call's deadline passed."]]),
        JSON.stringify(outcomes.map(t => ToolRegistryTests.failure(t)).map(t => [t.code, t.message])));
      Assert.areEqual(
        names.map(t => `The tool ${t} failed, and what it failed with could not be written to the log.`).sort().join("|"),
        [...log.lines].sort().join("|"),
        log.lines.join("\n"));
    });
  }

  @TestMethod
  public answersAnInternalFailureAsUnavailableAndLogsIt(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const broken: IToolHandler = {
        handleAsync: (): Promise<ToolResult> => {
          throw new Error("The index is corrupt.");
        }
      };
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, broken, log);

      const outcome = await session.callAsync("notes_search", {});

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, outcome, "The tool failed inside its module.");
      Assert.areEqual("notes.internal", ToolRegistryTests.failure(outcome).moduleCode);
      Assert.isTrue(ToolRegistryTests.only(log.lines).startsWith("The tool notes_search failed: Error: The index is corrupt."), log.lines.join("\n"));
    });
  }

  @TestMethod
  public logsARejectionAfterItsCallEndedOnceUnlessItIsTheCallsOwnAbort(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const log = new ModuleLogFixture();
      const rejections: Promise<void>[] = [];
      const rejectAfterAbort = (call: ToolCall, error: (signal: AbortSignal) => unknown): Promise<ToolResult> => {
        const rejected = Promise.withResolvers<ToolResult>();
        call.signal.addEventListener("abort", () => rejected.reject(error(call.signal)), { once: true });
        rejections.push(rejected.promise.then(() => undefined, () => undefined));
        return rejected.promise;
      };
      const search = new ToolHandlerFixture(t => rejectAfterAbort(t, () => new Error("The index closed.")));
      const status = new ToolHandlerFixture(t => rejectAfterAbort(t, signal => signal.reason));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, search, log);
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name: "notes_status" }, status, log);

      const running = [session.callAsync("notes_search", {}, { deadlineMilliseconds: 1 }), session.callAsync("notes_status", {}, { deadlineMilliseconds: 1 })];
      const settled = running.map(t => ToolRegistryTests.track(t));
      await Promise.all([search.waitForCallAsync(1), status.waitForCallAsync(1)]);
      await Promise.all(rejections);
      await setImmediate();
      const isSettled = settled.map(t => t());
      const outcomes = await Promise.all(running);

      Assert.areEqual("true,true", isSettled.join());
      for (const outcome of outcomes)
        ToolRegistryTests.assertFailure(ToolFailureCode.TimedOut, outcome, "The call's deadline passed.");
      Assert.isTrue(ToolRegistryTests.only(log.lines).startsWith("The tool notes_search failed after its call had ended: Error: The index closed."), log.lines.join("\n"));
    });
  }

  @TestMethod
  public reachesIntoArraysAsJsonPointerDoes(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers: (() => void)[] = [];
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(resolve => answers.push(() => resolve(new ToolResult([])))));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "/items/1" }, handler);
      const other = registry.openSession("conversation-2", {});

      const first = session.callAsync("notes_search", { items: ["plans", "ideas"] });
      await handler.waitForCallAsync(1);
      const held = await other.callAsync("notes_search", { items: ["notes", "ideas", "lists"] });
      const keyed = await other.callAsync("notes_search", { items: { 1: "ideas" } });
      const missing = await Promise.all([[], ["plans"], { items: ["plans"] }].map(t => other.callAsync("notes_search", { items: t })));
      for (const answer of answers.splice(0))
        answer();
      other.end();

      Assert.isFalse((await first).isFailure);
      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, held, "What the call acts on is held by another agent session.");
      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, keyed, "What the call acts on is held by another agent session.");
      for (const outcome of missing)
        ToolRegistryTests.assertFailure(ToolFailureCode.Refused, outcome, "The call has nothing at /items/1, which the tool takes turns on.");
    });
  }

  @TestMethod
  @TestData("01")
  @TestData("-")
  @TestData("1e0")
  @TestData(" 1")
  public refusesAnArrayTokenThatIsNotAPlainIndex(token: string): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: `/items/${token}` }, new ToolHandlerFixture());

      const outcome = await session.callAsync("notes_search", { items: ["plans", "ideas"] });

      ToolRegistryTests.assertFailure(ToolFailureCode.Refused, outcome, `The call has nothing at /items/${token}, which the tool takes turns on.`);
    });
  }

  @TestMethod
  public takesOneTurnOnAnObjectTargetWhateverTheOrderOfItsKeys(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers: (() => void)[] = [];
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(resolve => answers.push(() => resolve(new ToolResult([])))));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "/note" }, handler);
      const other = registry.openSession("conversation-2", {});

      const first = session.callAsync("notes_search", { note: { folder: "work", name: "plans", tags: [{ b: 1, a: 2 }] } });
      await handler.waitForCallAsync(1);
      const held = await other.callAsync("notes_search", { note: { tags: [{ a: 2, b: 1 }], name: "plans", folder: "work" } });
      const elsewhere = other.callAsync("notes_search", { note: { name: "plans", folder: "home", tags: [{ a: 2, b: 1 }] } });
      await handler.waitForCallAsync(2);
      for (const answer of answers.splice(0))
        answer();

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, held, "What the call acts on is held by another agent session.");
      Assert.isFalse((await first).isFailure);
      Assert.isFalse((await elsewhere).isFailure);
      other.end();
    });
  }

  @TestMethod
  public takesNoNewCallOfAClosedModulesToolsButLetsItsRunningCallsEnd(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers: (() => void)[] = [];
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(resolve => answers.push(() => resolve(new ToolResult([])))));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, handler);
      registry.register("tasks", new ToolDescriptor({ ...ToolRegistryTests.SEARCH, name: "tasks_search" }, ["tasks_search"]), new ToolHandlerFixture(), ["tasks_search"], new ModuleLogFixture());
      const running = session.callAsync("notes_search", {});
      await handler.waitForCallAsync(1);

      registry.close("notes");
      const refused = await session.callAsync("notes_search", {});
      const listed = registry.listTools().map(t => t.name).join(",");
      const other = await session.callAsync("tasks_search", {});
      ToolRegistryTests.only(answers.splice(0))();

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, refused, "The tool notes_search is not available while its module turns off.");
      Assert.areEqual("tasks_search", listed);
      Assert.isFalse(other.isFailure);
      Assert.isFalse((await running).isFailure);
      Assert.areEqual(1, handler.calls.length);
    });
  }

  @TestMethod
  public failsACallStillWaitingForItsTurnWhenItsModuleClosesWithoutRunningItsHandler(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers: (() => void)[] = [];
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(resolve => answers.push(() => resolve(new ToolResult([])))));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "binding:folder" }, handler);
      const first = session.callAsync("notes_search", {});
      const waiting = session.callAsync("notes_search", {});
      await handler.waitForCallAsync(1);

      registry.close("notes");
      ToolRegistryTests.only(answers.splice(0))();

      Assert.isFalse((await first).isFailure);
      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, await waiting, "The tool notes_search is not available while its module turns off.");
      Assert.areEqual(1, handler.calls.length);
    });
  }

  @TestMethod
  public takesTurnsOnAResourceWithinASessionAndRefusesAnotherSession(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers: (() => void)[] = [];
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(resolve => answers.push(() => resolve(new ToolResult([])))));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "/note/a~1b~0c" }, handler);
      const other = registry.openSession("conversation-2", {});

      const first = session.callAsync("notes_search", { note: { "a/b~c": "plans" } });
      const second = session.callAsync("notes_search", { note: { "a/b~c": "plans" } });
      const elsewhere = session.callAsync("notes_search", { note: { "a/b~c": "ideas" } });
      await handler.waitForCallAsync(2);
      const refused = await other.callAsync("notes_search", { note: { "a/b~c": "plans" } });
      ToolRegistryTests.only(answers.splice(0, 1))();
      await first;
      await handler.waitForCallAsync(3);
      for (const answer of answers.splice(0))
        answer();

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, refused, "What the call acts on is held by another agent session.");
      Assert.isFalse((await second).isFailure);
      Assert.isFalse((await elsewhere).isFailure);
      Assert.areEqual(
        "{\"note\":{\"a/b~c\":\"plans\"}},{\"note\":{\"a/b~c\":\"ideas\"}},{\"note\":{\"a/b~c\":\"plans\"}}",
        handler.calls.map(t => JSON.stringify(t.arguments)).join(","));
    });
  }

  @TestMethod
  public takesTurnsOnABindingAndPassesTheTurnOverACallCancelledWhileItWaited(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers: (() => void)[] = [];
      const handler = new ToolHandlerFixture(() => new Promise<ToolResult>(resolve => answers.push(() => resolve(new ToolResult([])))));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "binding:folder" }, handler);
      const controller = new AbortController();

      const first = session.callAsync("notes_search", {});
      const cancelled = session.callAsync("notes_search", {}, { signal: controller.signal });
      const third = session.callAsync("notes_search", {});
      await handler.waitForCallAsync(1);
      controller.abort();
      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, await cancelled, "The call was cancelled.");
      ToolRegistryTests.only(answers.splice(0, 1))();
      await handler.waitForCallAsync(2);
      ToolRegistryTests.only(answers.splice(0, 1))();

      Assert.isFalse((await first).isFailure);
      Assert.isFalse((await third).isFailure);
      Assert.areEqual(2, handler.calls.length);
    });
  }

  @TestMethod
  public refusesACallWhoseResourceIsMissing(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, resource: "/note/id" }, new ToolHandlerFixture());
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, isResumable: true, resource: "binding:device" }, new ToolHandlerFixture());

      const outcomes = await Promise.all([{}, { note: "plans" }, { note: ["plans"] }, { note: { id: null } }].map(t => session.callAsync("notes_search", t)));
      const unbound = await session.callAsync("notes_append", {});

      for (const outcome of outcomes)
        ToolRegistryTests.assertFailure(ToolFailureCode.Refused, outcome, "The call has nothing at /note/id, which the tool takes turns on.");
      ToolRegistryTests.assertFailure(ToolFailureCode.Refused, unbound, "The call has nothing at binding:device, which the tool takes turns on.");
    });
  }

  @TestMethod
  public acceptsContentWhoseMarksAndSizesFit(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const items = [
        ToolContent.fromText("Saved.", null),
        ToolContent.fromText("A page.", "https://example.com"),
        ToolContent.fromText("An import.", "notes:import"),
        ToolContent.fromText("x".repeat(256 * 1024), "notes:opaque"),
        ToolContent.fromImage(ToolImageFixture.png(2_000, 1_000), "image/png", null),
        ToolContent.fromImage(ToolImageFixture.jpeg(1_000, 2_000), "image/jpeg", "https://example.com:8443")
      ];
      const limits = { textCharacters: 256 * 1024, imageBytes: 1_024, imageLongEdge: 2_000, imagePixels: 2_000_000 };
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, limits }, new ToolHandlerFixture(() => Promise.resolve(new ToolResult(items))));
      const image = ToolContent.fromImage(ToolImageFixture.png(100_000, 100_000), "image/png", null);
      ToolRegistryTests.register(
        registry,
        { ...ToolRegistryTests.APPEND, isResumable: true, outputSchema: { type: "object" } },
        new ToolHandlerFixture(() => Promise.resolve(new ToolResult([image], { count: 1 }))));

      const read = await session.callAsync("notes_search", {});
      const appended = await session.callAsync("notes_append", {});

      Assert.isFalse(read.isFailure);
      Assert.isFalse(appended.isFailure);
    });
  }

  @TestMethod
  public answersMalformedContentAsUnavailable(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const answers = [
        new ToolResult([ToolContent.fromText("A page.", "example.com")]),
        new ToolResult([ToolContent.fromText("A page.", "https://example.com/page")]),
        new ToolResult([ToolContent.fromText("A page.", "null")]),
        new ToolResult([ToolContent.fromText("An import.", "notes:")]),
        new ToolResult([ToolContent.fromText("An import.", "tasks:import")]),
        new ToolResult([], { count: 1 }),
        ...[
          ToolImageFixture.bytes([0x89, 0x50]),
          ToolImageFixture.png(10, 10, "IDAT"),
          ToolImageFixture.png(0, 10),
          ToolImageFixture.png(10, 0),
          ToolImageFixture.jpeg(10, 10)
        ].map(t => new ToolResult([ToolContent.fromImage(t, "image/png", null)])),
        ...[
          ToolImageFixture.bytes([0xff]),
          ToolImageFixture.bytes([0x00, 0xd8, 0xff, 0xc0]),
          ToolImageFixture.bytes([0xff, 0x00, 0xff, 0xc0]),
          ToolImageFixture.bytes([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11]),
          ToolImageFixture.bytes([0xff, 0xd8, 0x00, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x0a, 0x00, 0x0a, 0x03]),
          ToolImageFixture.png(10, 10)
        ].map(t => new ToolResult([ToolContent.fromImage(t, "image/jpeg", null)]))
      ];
      let answer = new ToolResult([]);
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(() => Promise.resolve(answer)));
      ToolRegistryTests.register(
        registry, { ...ToolRegistryTests.APPEND, isResumable: true, outputSchema: { type: "object" } }, new ToolHandlerFixture(() => Promise.resolve(new ToolResult([]))));

      const outcomes: (ToolResult | ToolFailure)[] = [];
      for (const result of answers) {
        answer = result;
        outcomes.push(await session.callAsync("notes_search", {}));
      }
      outcomes.push(await session.callAsync("notes_append", {}));

      for (const outcome of outcomes) {
        ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, outcome, "The tool's result does not fit its shape or its schema.");
        Assert.areEqual("notes.malformedResult", ToolRegistryTests.failure(outcome).moduleCode);
      }
    });
  }

  @TestMethod
  public answersContentOverItsLimitsAsTooLarge(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const limits = { textCharacters: 10, imageBytes: 30, imageLongEdge: 100, imagePixels: 5_000 };
      const padded = [...Buffer.from(ToolImageFixture.png(10, 10), "base64")];
      const limited = [
        new ToolResult([ToolContent.fromText("x".repeat(11), null)]),
        new ToolResult([ToolContent.fromImage(ToolImageFixture.bytes([...padded, 0, 0]), "image/png", null)]),
        new ToolResult([ToolContent.fromImage(ToolImageFixture.png(101, 10), "image/png", null)]),
        new ToolResult([ToolContent.fromImage(ToolImageFixture.png(100, 51), "image/png", null)])
      ];
      const unlimited = [
        new ToolResult([ToolContent.fromText("é".repeat(128 * 1024 + 1), null)]),
        new ToolResult([ToolContent.fromImage(ToolImageFixture.bytes([...padded, ...new Array<number>(1024 * 1024 - padded.length + 1).fill(0)]), "image/png", null)]),
        new ToolResult(Array.from({ length: 9 }, () => ToolContent.fromText("x".repeat(256 * 1024 - 100), null)))
      ];
      let answer = new ToolResult([]);
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, limits }, new ToolHandlerFixture(() => Promise.resolve(answer)));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, isResumable: true }, new ToolHandlerFixture(() => Promise.resolve(answer)));

      const outcomes: (ToolResult | ToolFailure)[] = [];
      for (const result of limited) {
        answer = result;
        outcomes.push(await session.callAsync("notes_search", {}));
      }
      for (const result of unlimited) {
        answer = result;
        outcomes.push(await session.callAsync("notes_append", {}));
      }

      Assert.areEqual(7, outcomes.length);
      for (const outcome of outcomes)
        ToolRegistryTests.assertFailure(ToolFailureCode.TooLarge, outcome, "The tool's result is over its limits.");
    });
  }

  @TestMethod
  public makesAResultThatDoesNotFitUncertainPastThePointOfNoReturn(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      ToolRegistryTests.register(registry, ToolRegistryTests.APPEND, new ToolHandlerFixture(() => Promise.resolve(new ToolResult([], { count: 1 }))));

      const outcome = await session.callAsync("notes_append", {});

      ToolRegistryTests.assertFailure(ToolFailureCode.OutcomeUncertain, outcome, "The tool's result does not fit its shape or its schema.");
      Assert.areEqual("notes.malformedResult", ToolRegistryTests.failure(outcome).moduleCode);
      Assert.areEqual("notes_status", ToolRegistryTests.failure(outcome).nextTool);
    });
  }

  @TestMethod
  public checksTheModulesFailureLikeAResult(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const failures = [
        new ToolFailure(ToolFailureCode.Refused, "Refused.", "tasks.locked"),
        new ToolFailure(ToolFailureCode.Refused, "Refused.", "notes.Locked"),
        new ToolFailure(ToolFailureCode.Refused, "Refused.", "notes"),
        new ToolFailure(ToolFailureCode.Refused, "Refused.", null, [], "notes_delete"),
        new ToolFailure(ToolFailureCode.OutcomeUncertain, "Uncertain.", null, [], "notes_status"),
        new ToolFailure(ToolFailureCode.Refused, "Refused.", null, [ToolContent.fromText("A page.", "example.com")]),
        new ToolFailure(ToolFailureCode.Refused, "Refused.", null, [ToolContent.fromText("x".repeat(256 * 1024 + 1), null)]),
        new ToolFailure(ToolFailureCode.Refused, "Refused.", null, Array.from({ length: 9 }, () => ToolContent.fromText("x".repeat(256 * 1024 - 100), null)))
      ];
      let thrown = new ToolFailure(ToolFailureCode.Refused, "Refused.");
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(() => Promise.reject(new ToolFailureException(thrown))));
      const uncertain = new ToolFailure(ToolFailureCode.OutcomeUncertain, "The note may have changed.", "notes.saving");
      ToolRegistryTests.register(
        registry, { ...ToolRegistryTests.APPEND, marksSending: true }, new ToolHandlerFixture(() => Promise.reject(new ToolFailureException(uncertain))));

      const outcomes: (ToolResult | ToolFailure)[] = [];
      for (const failure of failures) {
        thrown = failure;
        outcomes.push(await session.callAsync("notes_search", {}));
      }
      const unsent = await session.callAsync("notes_append", {});

      Assert.areEqual(
        "Unavailable,Unavailable,Unavailable,Unavailable,Unavailable,Unavailable,TooLarge,TooLarge",
        outcomes.map(t => ToolRegistryTests.failure(t).code).join(","));
      ToolRegistryTests.assertFailure(ToolFailureCode.OutcomeUncertain, unsent, "The note may have changed.");
      Assert.areEqual("notes.saving", ToolRegistryTests.failure(unsent).moduleCode);
      Assert.areEqual("notes_status", ToolRegistryTests.failure(unsent).nextTool);
    });
  }

  @TestMethod
  public answersAFailureWhoseModuleCodeIsNotAStringAsMalformedBeforeAnAbortAndWithinTheGrace(): Promise<void> {
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      const failure = new ToolFailure(ToolFailureCode.Refused, "Refused.", JSON.parse("42"));
      ToolRegistryTests.register(registry, ToolRegistryTests.SEARCH, new ToolHandlerFixture(() => Promise.reject(new ToolFailureException(failure))));
      const find = new ToolHandlerFixture(call => new Promise((_resolve, reject) =>
        call.signal.addEventListener("abort", () => reject(new ToolFailureException(failure)), { once: true })));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, name: "notes_find" }, find);

      const rejected = await session.callAsync("notes_search", {});
      const controller = new AbortController();
      const cancelled = session.callAsync("notes_find", {}, { signal: controller.signal });
      await find.waitForCallAsync(1);
      controller.abort();

      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, rejected, "The tool's result does not fit its shape or its schema.");
      Assert.areEqual("notes.malformedResult", ToolRegistryTests.failure(rejected).moduleCode);
      const ended = await cancelled;
      ToolRegistryTests.assertFailure(ToolFailureCode.Cancelled, ended, "The call was cancelled.");
      Assert.isNull(ToolRegistryTests.failure(ended).moduleCode);
    });
  }

  @TestMethod
  public refusesAToolWhoseSchemaTheValidatorRefuses(): void {
    const registry = ToolRegistryFixture.create();

    const input = Assert.throws(() => ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, inputSchema: { type: "string" } }), ArgumentException);
    const output = Assert.throws(() => ToolRegistryTests.register(registry, { ...ToolRegistryTests.SEARCH, outputSchema: {} }), ArgumentException);

    Assert.areEqual("inputSchema", input.parameterName);
    Assert.areEqual("outputSchema", output.parameterName);
    Assert.areEqual(0, registry.listTools().length);
  }

  @TestMethod
  public checksSchemasArgumentsAndStructuredFieldsThroughItsSchemaValidator(): Promise<void> {
    const checked: string[] = [];
    const schemas: IToolSchemaValidator = {
      checkSchema: (schema, parameterName) => {
        checked.push(`${parameterName} ${JSON.stringify(schema)}`);
      },
      findProblem: (_schema, value) => value["fits"] === false ? "The value does not fit its schema." : null
    };
    return ToolRegistryTests.withRegistryAsync(async (registry, session) => {
      let structured: JsonObject = { fits: true };
      const handler = new ToolHandlerFixture(() => Promise.resolve(new ToolResult([], structured)));
      ToolRegistryTests.register(registry, { ...ToolRegistryTests.APPEND, isResumable: true, outputSchema: { type: "object", title: "Count" } }, handler);

      const refused = await session.callAsync("notes_append", { fits: false });
      const fitting = await session.callAsync("notes_append", { fits: true });
      structured = { fits: false };
      const malformed = await session.callAsync("notes_append", {});

      Assert.areEqual("inputSchema {\"type\":\"object\"},outputSchema {\"type\":\"object\",\"title\":\"Count\"}", checked.join(","));
      ToolRegistryTests.assertFailure(ToolFailureCode.Refused, refused, "The value does not fit its schema.");
      Assert.isFalse(fitting.isFailure);
      ToolRegistryTests.assertFailure(ToolFailureCode.Unavailable, malformed, "The tool's result does not fit its shape or its schema.");
      Assert.areEqual(2, handler.calls.length);
    }, ToolRegistryFixture.create(undefined, schemas));
  }

  private static register(
    registry: ToolRegistry,
    descriptor: IToolDescriptor,
    handler: IToolHandler = new ToolHandlerFixture(),
    log: ModuleLogFixture = new ModuleLogFixture()): Registration {
    return registry.register("notes", new ToolDescriptor(descriptor, ToolRegistryTests.TOOLS), handler, ToolRegistryTests.TOOLS, log);
  }

  private static async withRegistryAsync(
    test: (registry: ToolRegistry, session: ToolSession) => Promise<void>,
    registry: ToolRegistry = ToolRegistryFixture.create()): Promise<void> {
    const session = registry.openSession("conversation-1", { folder: "/notes", device: null });
    try {
      await test(registry, session);
    }
    finally {
      session.end();
    }
  }

  private static assertFailure(code: ToolFailureCode, outcome: ToolResult | ToolFailure, message: string): void {
    const failure = ToolRegistryTests.failure(outcome);
    Assert.areEqual(code, failure.code);
    Assert.areEqual(message, failure.message);
  }

  private static track(outcome: Promise<unknown>): () => boolean {
    let isSettled = false;
    void outcome.then(() => {
      isSettled = true;
    });
    return () => isSettled;
  }

  private static failure(outcome: ToolResult | ToolFailure): ToolFailure {
    if (!outcome.isFailure)
      throw new Error("The call did not fail.");
    return outcome;
  }

  private static only<T>(values: readonly T[]): T {
    Assert.areEqual(1, values.length);
    const [value] = values;
    if (Object.isUndefined(value))
      throw new Error("Expected one value.");
    return value;
  }
}

@TestClass
export class ToolPermissionsTests {
  private static readonly TOOLS: readonly string[] = ["notes_delete", "notes_restore", "notes_status"];
  private static readonly DELETE: IToolDescriptor = {
    name: "notes_delete",
    description: "Deletes a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    deadline: { default: 100, maximum: 5_000 },
    marksSending: true,
    nextTool: "notes_status"
  };
  private static readonly RESTORE: IToolDescriptor = {
    name: "notes_restore",
    description: "Restores a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    deadline: { default: 2_000, maximum: 5_000 },
    nextTool: "notes_status"
  };
  private static readonly REQUEST: IPermissionRequest = {
    action: "notes.deleteItem",
    title: "Delete the note Plans",
    details: [],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce, PermissionOption.Deny]
  };

  @TestMethod
  public stopsTheDeadlineWhileARequestWaitsAndMovesTheCallsDeadlineLater(): Promise<void> {
    let grant: (decision: PermissionDecision) => void = () => undefined;
    const answerer = new PermissionAnswererFixture(() => new Promise(resolve => grant = resolve));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const deadlines: number[] = [];
      const signals: AbortSignal[] = [];
      const outcomes: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        signals.push(t.signal);
        deadlines.push(t.deadline);
        outcomes.push(await t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
        deadlines.push(t.deadline);
        return ToolHandlerFixture.untilAborted(t);
      });
      const timer = { ...ToolPermissionsTests.RESTORE, deadline: ToolPermissionsTests.DELETE.deadline, marksSending: true };
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      registry.register("notes", new ToolDescriptor(timer, ToolPermissionsTests.TOOLS), new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t)), ToolPermissionsTests.TOOLS,
        new ModuleLogFixture());

      const running = registry.openSession("conversation-1", {}).callAsync("notes_delete", {});
      await answerer.waitForQuestionAsync(1);
      const later = await registry.openSession("conversation-2", {}).callAsync("notes_restore", {});
      const wasAborted = signals.map(t => t.aborted).join(",");
      grant(PermissionDecision.AllowedOnce);
      const outcome = await running;

      ToolPermissionsTests.assertFailure(ToolFailureCode.TimedOut, "The call's deadline passed.", later);
      Assert.areEqual("false", wasAborted);
      ToolPermissionsTests.assertFailure(ToolFailureCode.TimedOut, "The call's deadline passed.", outcome);
      Assert.areEqual(PermissionDecision.AllowedOnce, outcomes.map(t => t.decision).join(","));
      Assert.areEqual(
        JSON.stringify([{ id: answerer.questions[0]?.id, risk: ToolRisk.Medium, decision: PermissionDecision.AllowedOnce, isRemembered: false }]),
        JSON.stringify(outcome.requests.map(t => t.toJson())));
      const [before, after] = deadlines;
      Assert.isTrue(Object.isNumber(before) && Object.isNumber(after) && after > before, deadlines.join(","));
    });
  }

  @TestMethod
  public endsACallAbortedWhileItsRequestWaitsAsWithdrawn(): Promise<void> {
    const answerer = new PermissionAnswererFixture(() => PermissionAnswererFixture.never());
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const outcomes: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        outcomes.push(await t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const caller = new AbortController();
      const session = registry.openSession("conversation-1", {});

      const cancelled = session.callAsync("notes_delete", {}, { signal: caller.signal });
      await answerer.waitForQuestionAsync(1);
      caller.abort();
      const ended = session.callAsync("notes_delete", {});
      await answerer.waitForQuestionAsync(2);
      session.end();

      const failures = [await cancelled, await ended];
      for (const failure of failures)
        ToolPermissionsTests.assertFailure(ToolFailureCode.Withdrawn, "The call was aborted while its permission request waited.", failure);
      Assert.isTrue(await WaitFixture.untilAsync(() => outcomes.length === 2, 5_000));
      Assert.areEqual(`${PermissionDecision.Withdrawn},${PermissionDecision.Withdrawn}`, outcomes.map(t => t.decision).join(","));
      Assert.areEqual("true,true", answerer.signals.map(t => t.aborted).join(","));
      Assert.areEqual(
        answerer.questions.map(t => `${t.id}|${PermissionDecision.Withdrawn}`).join(),
        failures.flatMap(t => t.requests.map(u => `${u.id}|${u.decision}`)).join());
    });
  }

  @TestMethod
  public withdrawsARequestRaisedAfterItsCallWasAborted(): Promise<void> {
    const answerer = new PermissionAnswererFixture();
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const outcomes: Promise<PermissionOutcome>[] = [];
      const handler = new ToolHandlerFixture(t => {
        t.signal.addEventListener("abort", () => outcomes.push(t.requestPermissionAsync(ToolPermissionsTests.REQUEST)), { once: true });
        return ToolHandlerFixture.untilAborted(t);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const caller = new AbortController();

      const running = registry.openSession("conversation-1", {}).callAsync("notes_delete", {}, { signal: caller.signal });
      await handler.waitForCallAsync(1);
      caller.abort();

      const failure = await running;
      const [outcome] = await Promise.all(outcomes);

      ToolPermissionsTests.assertFailure(ToolFailureCode.Cancelled, "The call was cancelled.", failure);
      Assert.isDefined(outcome);
      Assert.areEqual(PermissionDecision.Withdrawn, outcome.decision);
      Assert.areEqual(
        JSON.stringify([{ id: outcome.id, risk: ToolRisk.Medium, decision: PermissionDecision.Withdrawn, isRemembered: false }]),
        JSON.stringify(failure.requests.map(t => t.toJson())));
      Assert.areEqual(0, answerer.questions.length);
    });
  }

  @TestMethod
  public endsACallPastItsPointOfNoReturnOnlyAsOutcomeUncertain(): Promise<void> {
    const answerer = new PermissionAnswererFixture(() => PermissionAnswererFixture.never());
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const handler = new ToolHandlerFixture(async t => {
        await t.requestPermissionAsync({ ...ToolPermissionsTests.REQUEST, action: "notes.restoreItem" });
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.RESTORE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const caller = new AbortController();

      const running = registry.openSession("conversation-1", {}).callAsync("notes_restore", {}, { signal: caller.signal });
      await answerer.waitForQuestionAsync(1);
      caller.abort();

      ToolPermissionsTests.assertFailure(ToolFailureCode.OutcomeUncertain, "The call was aborted while its permission request waited.", await running);
    });
  }

  @TestMethod
  public deniesASecondRequestWhileOneWaitsAndAnyRequestAfterItsCallEnded(): Promise<void> {
    let grant: (decision: PermissionDecision) => void = () => undefined;
    const answerer = new PermissionAnswererFixture(() => new Promise(resolve => grant = resolve));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const calls: ToolCall[] = [];
      const outcomes: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        calls.push(t);
        const first = t.requestPermissionAsync(ToolPermissionsTests.REQUEST);
        outcomes.push(await t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
        grant(PermissionDecision.AllowedOnce);
        outcomes.push(await first);
        return new ToolResult([]);
      });
      const log = new ModuleLogFixture();
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, log);
      const session = registry.openSession("conversation-1", {});

      const outcome = await session.callAsync("notes_delete", {});
      const [call] = calls;
      Assert.isDefined(call);
      const late = await call.requestPermissionAsync(ToolPermissionsTests.REQUEST);
      session.end();
      const afterEnd = await call.requestPermissionAsync(ToolPermissionsTests.REQUEST);

      Assert.isFalse(outcome.isFailure);
      Assert.areEqual(`${PermissionDecision.Denied},${PermissionDecision.AllowedOnce}`, outcomes.map(t => t.decision).join(","));
      Assert.areEqual(
        JSON.stringify([PermissionDecision.Denied, false, PermissionDecision.Denied, false]),
        JSON.stringify([late, afterEnd].flatMap(t => [t.decision, t.isRemembered])));
      const ids = [...outcomes, late, afterEnd].map(t => t.id);
      Assert.areEqual(4, new Set(ids).size);
      Assert.areEqual(outcomes.map(t => t.id).toSorted().join(), outcome.requests.map(t => t.id).toSorted().join());
      Assert.areEqual(
        "The permission request for notes.deleteItem was denied: The call already has a permission request waiting.\n" +
          "The permission request for notes.deleteItem was denied: The call has already ended.\n" +
          "The permission request for notes.deleteItem was denied: The call has already ended.",
        log.lines.join("\n"));
      Assert.areEqual(1, answerer.questions.length);
    });
  }

  @TestMethod
  public listsEachRequestOfItsCallOnItsResultUnderTheIdItsQuestionAndOutcomeCarry(): Promise<void> {
    const answerer = new PermissionAnswererFixture();
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const outcomes: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        outcomes.push(await t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
        outcomes.push(await t.requestPermissionAsync({ ...ToolPermissionsTests.REQUEST, risk: ToolRisk.Low }));
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.RESTORE, ToolPermissionsTests.TOOLS), new ToolHandlerFixture(), ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const session = registry.openSession("conversation-1", {});

      const asked = await session.callAsync("notes_delete", {});
      const unasked = await session.callAsync("notes_restore", {});

      const ids = answerer.questions.map(t => t.id);
      Assert.areEqual(2, new Set(ids).size);
      Assert.areEqual(ids.join(), outcomes.map(t => t.id).join());
      Assert.areEqual(
        JSON.stringify([
          { id: ids[0], risk: ToolRisk.Medium, decision: PermissionDecision.AllowedOnce, isRemembered: false },
          { id: ids[1], risk: ToolRisk.Low, decision: PermissionDecision.AllowedOnce, isRemembered: false }
        ]),
        JSON.stringify(asked.requests.map(t => t.toJson())));
      Assert.areEqual(0, unasked.requests.length);
    });
  }

  @TestMethod
  public listsARememberedAnswerThatNeverReachesTheAnswerer(): Promise<void> {
    const answerer = new PermissionAnswererFixture(() => Promise.resolve(PermissionDecision.AllowedAlways));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const request = { ...ToolPermissionsTests.REQUEST, options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny] };
      const handler = new ToolHandlerFixture(async t => {
        await t.requestPermissionAsync(request);
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const session = registry.openSession("conversation-1", {});

      const answered = await session.callAsync("notes_delete", {});
      const remembered = await session.callAsync("notes_delete", {});

      Assert.areEqual(1, answerer.questions.length);
      Assert.areEqual(
        `${PermissionDecision.AllowedAlways}|false;${PermissionDecision.AllowedAlways}|true`,
        [answered, remembered].flatMap(t => t.requests.map(u => `${u.decision}|${u.isRemembered}`)).join(";"));
      Assert.areNotEqual(answered.requests[0]?.id, remembered.requests[0]?.id);
    });
  }

  @TestMethod
  public listsTheRequestsOfACallThatFailsWhetherDeniedOrExpired(): Promise<void> {
    const answerer = new PermissionAnswererFixture(t => t.request.title === "Delete the note Plans"
      ? Promise.resolve(PermissionDecision.Denied) : PermissionAnswererFixture.never());
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const handler = new ToolHandlerFixture(async t => {
        const outcome = await t.requestPermissionAsync({ ...ToolPermissionsTests.REQUEST, title: String(t.arguments["title"]) });
        throw new ToolFailureException(new ToolFailure(ToolFailureCode.Denied, `The person answered ${outcome.decision}.`));
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const session = registry.openSession("conversation-1", {});

      const outcomes = [
        await session.callAsync("notes_delete", { title: "Delete the note Plans" }),
        await session.callAsync("notes_delete", { title: "Delete the note Ideas" })
      ];

      Assert.areEqual(
        `The person answered ${PermissionDecision.Denied}.|The person answered ${PermissionDecision.Expired}.`,
        outcomes.map(t => t.isFailure ? t.message : String.empty).join("|"));
      Assert.areEqual(
        answerer.questions.map((t, i) => `${t.id}|${[PermissionDecision.Denied, PermissionDecision.Expired][i]}`).join(),
        outcomes.flatMap(t => t.requests.map(u => `${u.id}|${u.decision}`)).join());
    }, 200);
  }

  @TestMethod
  public givesTwoParallelCallsInOneSessionOnlyTheirOwnRequests(): Promise<void> {
    const gate = Promise.withResolvers<void>();
    const answerer = new PermissionAnswererFixture(() => gate.promise.then(() => PermissionDecision.AllowedOnce));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const handler = new ToolHandlerFixture(async t => {
        await t.requestPermissionAsync({ ...ToolPermissionsTests.REQUEST, title: String(t.arguments["title"]) });
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const session = registry.openSession("conversation-1", {});

      const running = ["Delete the note Plans", "Delete the note Ideas"].map(t => session.callAsync("notes_delete", { title: t }));
      await answerer.waitForQuestionAsync(2);
      gate.resolve();
      const outcomes = await Promise.all(running);

      const idOf = (title: string): string | undefined => answerer.questions.find(t => t.request.title === title)?.id;
      Assert.areEqual(2, new Set(answerer.questions.map(t => t.id)).size);
      Assert.areEqual(
        [idOf("Delete the note Plans"), idOf("Delete the note Ideas")].join(),
        outcomes.map(t => t.requests.map(u => u.id).join("+")).join());
    });
  }

  @TestMethod
  public recordsARequestWithAnUnreadableOrUnknownRiskAsHighRisk(): Promise<void> {
    const answerer = new PermissionAnswererFixture();
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const unreadable: IPermissionRequest = {
        ...ToolPermissionsTests.REQUEST,
        get risk(): ToolRisk {
          throw new Error("The risk can't be read.");
        }
      };
      const unknown: IPermissionRequest = JSON.parse(JSON.stringify({ ...ToolPermissionsTests.REQUEST, risk: "Severe" }));
      const handler = new ToolHandlerFixture(async t => {
        await t.requestPermissionAsync(unreadable);
        await t.requestPermissionAsync(unknown);
        return new ToolResult([]);
      });
      const log = new ModuleLogFixture();
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, log);

      const outcome = await registry.openSession("conversation-1", {}).callAsync("notes_delete", {});

      Assert.areEqual(
        `${ToolRisk.High}|${PermissionDecision.Denied},${ToolRisk.High}|${PermissionDecision.Denied}`,
        outcome.requests.map(t => `${t.risk}|${t.decision}`).join());
      Assert.areEqual(0, answerer.questions.length);
      Assert.areEqual(1, log.lines.filter(t => t === "A permission request of the tool notes_delete has a risk that could not be read, so it counts as high.").length);
    });
  }

  @TestMethod
  public listsARequestRefusedWhileAnotherWaitsAfterTheOneRaisedFirst(): Promise<void> {
    let grant: (decision: PermissionDecision) => void = () => undefined;
    const answerer = new PermissionAnswererFixture(() => new Promise(resolve => grant = resolve));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const refused: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        const first = t.requestPermissionAsync(ToolPermissionsTests.REQUEST);
        refused.push(await t.requestPermissionAsync({ ...ToolPermissionsTests.REQUEST, risk: ToolRisk.Low }));
        grant(PermissionDecision.AllowedOnce);
        await first;
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());

      const outcome = await registry.openSession("conversation-1", {}).callAsync("notes_delete", {});

      Assert.areEqual(
        JSON.stringify([
          { id: answerer.questions[0]?.id, risk: ToolRisk.Medium, decision: PermissionDecision.AllowedOnce, isRemembered: false },
          { id: refused[0]?.id, risk: ToolRisk.Low, decision: PermissionDecision.Denied, isRemembered: false }
        ]),
        JSON.stringify(outcome.requests.map(t => t.toJson())));
    });
  }

  @TestMethod
  public leavesOutARequestStillWaitingWhenItsCallReturns(): Promise<void> {
    let grant: (decision: PermissionDecision) => void = () => undefined;
    const answerer = new PermissionAnswererFixture(() => new Promise(resolve => grant = resolve));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const waiting: Promise<PermissionOutcome>[] = [];
      const handler = new ToolHandlerFixture(async t => {
        waiting.push(t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
        await answerer.waitForQuestionAsync(1);
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());

      const outcome = await registry.openSession("conversation-1", {}).callAsync("notes_delete", {});
      grant(PermissionDecision.AllowedOnce);
      const [late] = await Promise.all(waiting);

      Assert.areEqual(PermissionDecision.AllowedOnce, late?.decision);
      Assert.areEqual(0, outcome.requests.length);
    });
  }

  @TestMethod
  public async withdrawsARequestStillWaitingWhenItsReturnedCallsSessionEndsOrStops(): Promise<void> {
    const results: string[] = [];
    const finishes: ((registry: ToolRegistry, session: ToolSession) => void)[] = [
      (_registry, session) => session.end(),
      (registry, session) => registry.stopSession("app", session.id, "The person stopped it.")
    ];
    for (const finish of finishes) {
      const answerer = new PermissionAnswererFixture(() => PermissionAnswererFixture.never());
      await ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
        const waiting: Promise<PermissionOutcome>[] = [];
        const handler = new ToolHandlerFixture(async t => {
          waiting.push(t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
          await answerer.waitForQuestionAsync(1);
          return new ToolResult([]);
        });
        registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
        const session = registry.openSession("conversation-1", {});

        await session.callAsync("notes_delete", {});
        const isWaiting = answerer.signals[0]?.aborted === false;
        finish(registry, session);
        const [late] = await Promise.all(waiting);

        results.push(`${isWaiting} ${late?.decision} ${answerer.signals[0]?.aborted}`);
      });
    }

    Assert.areEqual(`true ${PermissionDecision.Withdrawn} true|true ${PermissionDecision.Withdrawn} true`, results.join("|"));
  }

  @TestMethod
  public keepsTheResourcesTurnWhileAReturnedCallsRequestWaits(): Promise<void> {
    let grant: (decision: PermissionDecision) => void = () => undefined;
    const answerer = new PermissionAnswererFixture(() => new Promise(resolve => grant = resolve));
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const steps: string[] = [];
      const handler = new ToolHandlerFixture(async t => {
        steps.push(`started ${String(t.arguments["note"])}`);
        if (steps.length === 1)
          void t.requestPermissionAsync(ToolPermissionsTests.REQUEST);
        await answerer.waitForQuestionAsync(1);
        return new ToolResult([]);
      });
      const descriptor = { ...ToolPermissionsTests.DELETE, inputSchema: { type: "object", properties: { note: { type: "string" } } }, resource: "/note" };
      registry.register("notes", new ToolDescriptor(descriptor, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());
      const session = registry.openSession("conversation-1", {});

      await session.callAsync("notes_delete", { note: "first" });
      const second = session.callAsync("notes_delete", { note: "first" }, { deadlineMilliseconds: 5_000 });
      await setImmediate();
      steps.push("granted");
      grant(PermissionDecision.AllowedOnce);
      await second;

      Assert.areEqual("started first,granted,started first", steps.join(","));
    });
  }

  @TestMethod
  public listsARememberedOnlyRequestWithNothingRememberedAsDenied(): Promise<void> {
    const answerer = new PermissionAnswererFixture();
    return ToolPermissionsTests.withRegistryAsync(answerer, async registry => {
      const outcomes: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        outcomes.push(await t.requestPermissionAsync({ ...ToolPermissionsTests.REQUEST, isRememberedOnly: true }));
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());

      const outcome = await registry.openSession("conversation-1", {}).callAsync("notes_delete", {});

      Assert.areEqual(
        JSON.stringify([{ id: outcomes[0]?.id, risk: ToolRisk.Medium, decision: PermissionDecision.Denied, isRemembered: false }]),
        JSON.stringify(outcome.requests.map(t => t.toJson())));
      Assert.areEqual(0, answerer.questions.length);
    });
  }

  @TestMethod
  public listsARequestDeniedForWantOfAnAnswerer(): Promise<void> {
    return ToolPermissionsTests.withRegistryAsync(null, async registry => {
      const outcomes: PermissionOutcome[] = [];
      const handler = new ToolHandlerFixture(async t => {
        outcomes.push(await t.requestPermissionAsync(ToolPermissionsTests.REQUEST));
        return new ToolResult([]);
      });
      registry.register("notes", new ToolDescriptor(ToolPermissionsTests.DELETE, ToolPermissionsTests.TOOLS), handler, ToolPermissionsTests.TOOLS, new ModuleLogFixture());

      const outcome = await registry.openSession("conversation-1", {}).callAsync("notes_delete", {});

      Assert.areEqual(
        JSON.stringify([{ id: outcomes[0]?.id, risk: ToolRisk.Medium, decision: PermissionDecision.Denied, isRemembered: false }]),
        JSON.stringify(outcome.requests.map(t => t.toJson())));
    });
  }

  private static async withRegistryAsync(answerer: PermissionAnswererFixture | null, test: (registry: ToolRegistry) => Promise<void>, waitMilliseconds?: number): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const center = new PermissionCenter("app", waitMilliseconds);
    center.open(new RememberedPermissionStore(settings.database));
    if (!Object.isNull(answerer))
      center.registerAnswerer("app", answerer, new ModuleLogFixture());
    await test(ToolRegistryFixture.create(center));
  }

  private static assertFailure(code: ToolFailureCode, message: string, outcome: ToolResult | ToolFailure): void {
    if (!outcome.isFailure)
      throw new Error("The call did not fail.");
    Assert.areEqual(`${code}|${message}`, `${outcome.code}|${outcome.message}`);
  }
}

@TestClass
export class ToolStopTests {
  private static readonly TOOLS: readonly string[] = ["notes_delete"];
  private static readonly DELETE: IToolDescriptor = {
    name: "notes_delete",
    description: "Deletes a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    deadline: { default: 5_000, maximum: 5_000 },
    isResumable: true
  };
  private static readonly REQUEST: IPermissionRequest = {
    action: "notes.deleteItem",
    title: "Delete the note Plans",
    details: [],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce, PermissionOption.Deny]
  };
  private static readonly STOPPED: string = "Agent control was stopped.";
  private static readonly STILL_STOPPED: string = "Agent control is stopped until the person resumes it.";

  @TestMethod
  public async stopsEveryCallInFlightAndRefusesLaterCallsUntilThePersonResumes(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const answerer = new PermissionAnswererFixture(() => PermissionAnswererFixture.never());
    const center = new PermissionCenter("app");
    center.open(new RememberedPermissionStore(settings.database));
    center.registerAnswerer("app", answerer, new ModuleLogFixture());
    const registry = ToolRegistryFixture.create(center);
    const outcomes: PermissionOutcome[] = [];
    const handler = new ToolHandlerFixture(async t => {
      if (t.arguments["ask"] === true)
        outcomes.push(await t.requestPermissionAsync(ToolStopTests.REQUEST));
      else if (t.arguments["wait"] === true)
        return ToolHandlerFixture.untilAborted(t);
      return new ToolResult([]);
    });
    registry.register("notes", new ToolDescriptor(ToolStopTests.DELETE, ToolStopTests.TOOLS), handler, ToolStopTests.TOOLS, new ModuleLogFixture());
    const first = registry.openSession("conversation-1", {});
    const second = registry.openSession("conversation-2", {});

    const running = first.callAsync("notes_delete", { wait: true });
    const asking = second.callAsync("notes_delete", { ask: true });
    await answerer.waitForQuestionAsync(1);
    registry.stopAll("The person took over.");
    const later = await first.callAsync("notes_delete", {});
    const third = registry.openSession("conversation-3", {});
    const whileStopped = await third.callAsync("notes_delete", {});
    const wasStopped = registry.isStopped;
    registry.resumeAll(null);
    const resumed = await third.callAsync("notes_delete", {});

    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STOPPED, await running);
    ToolStopTests.assertFailure(ToolFailureCode.Withdrawn, "The call was aborted while its permission request waited.", await asking);
    Assert.isTrue(await WaitFixture.untilAsync(() => outcomes.length === 1, 5_000));
    Assert.areEqual(PermissionDecision.Withdrawn, outcomes.map(t => t.decision).join(","));
    Assert.areEqual("true", answerer.signals.map(t => String(t.aborted)).join(","));
    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STILL_STOPPED, later);
    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STILL_STOPPED, whileStopped);
    Assert.isTrue(wasStopped);
    Assert.isFalse(registry.isStopped);
    Assert.isFalse(resumed.isFailure);
    Assert.areEqual(3, handler.calls.length);
  }

  @TestMethod
  public tellsEachListenerOnceAndWritesOneThatThrowsToItsModulesLog(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const failingLog = new ModuleLogFixture();
    const heard: string[] = [];
    registry.onStopped(t => heard.push(`stopped: ${t}`), log);
    registry.onStopped(() => {
      throw new Error("The strip failed.");
    }, failingLog);
    registry.onResumed(() => heard.push("resumed"), log);
    const removed = registry.onStopped(t => heard.push(`removed: ${t}`), log);
    removed[Symbol.dispose]();

    registry.resumeAll(null);
    registry.stopAll("A part missed its heartbeat.");
    registry.stopAll("The person took over.");
    registry.resumeAll(null);
    registry.resumeAll(null);

    Assert.areEqual("stopped: A part missed its heartbeat.,resumed", heard.join(","));
    Assert.areEqual(0, log.lines.length);
    Assert.areEqual(1, failingLog.lines.length);
    Assert.isTrue(failingLog.lines[0]?.startsWith("A listener for stopped or resumed agent control failed: Error: The strip failed.") === true, failingLog.lines.join("\n"));
  }

  @TestMethod
  public async refusesAResumeFromAModuleWhileOneOfItsCallsRuns(): Promise<void> {
    const registry = ToolRegistryFixture.create();
    const handler = new ToolHandlerFixture(t => ToolHandlerFixture.untilAborted(t));
    registry.register("notes", new ToolDescriptor(ToolStopTests.DELETE, ToolStopTests.TOOLS), handler, ToolStopTests.TOOLS, new ModuleLogFixture());

    const running = registry.openSession("conversation-1", {}).callAsync("notes_delete", {});
    await handler.waitForCallAsync(1);
    const refused = Assert.throws(() => registry.resumeAll("notes"), AgentControlException);
    registry.resumeAll("tasks");
    registry.stopAll("The person took over.");
    const outcome = await running;
    await setImmediate();
    registry.resumeAll("notes");

    Assert.areEqual(
      "The module notes can't resume agent control while it stops or while one of its tool calls runs, even past its abort; only a command the person runs resumes it.",
      refused.message);
    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STOPPED, outcome);
    Assert.isFalse(registry.isStopped);
  }

  @TestMethod
  public async refusesAResumeFromInsideTheStopAndFromAHandlerPastItsAbortUntilTheHandlerReturns(): Promise<void> {
    const registry = ToolRegistryFixture.create();
    const tries: string[] = [];
    const attempt = (when: string): void => {
      try {
        registry.resumeAll("notes");
        tries.push(`${when}: resumed`);
      }
      catch (error) {
        tries.push(`${when}: ${error instanceof AgentControlException ? "refused" : String(error)}`);
      }
    };
    const release = Promise.withResolvers<void>();
    const returned = Promise.withResolvers<void>();
    const handler = new ToolHandlerFixture(async t => {
      t.signal.addEventListener("abort", () => attempt("abort listener"), { once: true });
      await release.promise;
      attempt("past its abort");
      returned.resolve();
      return new ToolResult([]);
    });
    registry.register("notes", new ToolDescriptor(ToolStopTests.DELETE, ToolStopTests.TOOLS), handler, ToolStopTests.TOOLS, new ModuleLogFixture());
    registry.onStopped(() => attempt("stop listener"), new ModuleLogFixture());

    const running = registry.openSession("conversation-1", {}).callAsync("notes_delete", {});
    await handler.waitForCallAsync(1);
    registry.stopAll("The person took over.");
    const outcome = await running;
    release.resolve();
    await returned.promise;
    await setImmediate();
    attempt("after its handler returned");
    registry.stopAll("The person took over again.");
    const stoppedAgain = registry.isStopped;
    registry.resumeAll(null);

    Assert.areEqual(
      ["abort listener: refused", "stop listener: refused", "past its abort: refused", "after its handler returned: resumed", "stop listener: refused"].join(","),
      tries.join(","));
    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STOPPED, outcome);
    Assert.isTrue(stoppedAgain);
    Assert.isFalse(registry.isStopped);
  }

  @TestMethod
  public refusesAReasonThatIsBlankLongOrMoreThanOneLine(): void {
    const registry = ToolRegistryFixture.create();

    const refusals = [" ", "r".repeat(201), "Taken\nover"].map(t => Assert.throws(() => registry.stopAll(t), ArgumentException));
    registry.stopAll("r".repeat(200));

    Assert.areEqual(3, refusals.filter(t => t.message.startsWith("The reason must be one line that isn't blank, of at most 200 characters.")).length);
    Assert.isTrue(registry.isStopped);
  }

  @TestMethod
  public reportsTheFirstSessionTheLastEndAndEachStopAndResume(): void {
    const registry = ToolRegistryFixture.create();
    const changes: string[] = [];
    registry.onControlChanged(() => changes.push(`${String(registry.isStopped)}|${String(registry.isActing)}`));
    const removed = registry.onControlChanged(() => changes.push("removed"));
    removed[Symbol.dispose]();

    const first = registry.openSession("conversation-1", {});
    const second = registry.openSession("conversation-2", {});
    first.end();
    second.end();
    second.end();
    registry.stopAll("The person took over.");
    registry.resumeAll(null);

    Assert.areEqual("false|true,false|false,true|false,false|false", changes.join(","));
  }

  @TestMethod
  public hearsNoMoreOfAResumeOnceOneOfItsListenersStopsAgain(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const heard: string[] = [];
    registry.onControlChanged(() => heard.push(`control: ${String(registry.isStopped)}`));
    registry.onStopped(t => heard.push(`stopped: ${t}, ${String(registry.isStopped)}`), log);
    registry.onResumed(() => {
      heard.push(`resumed: ${String(registry.isStopped)}`);
      registry.stopAll("The part saw the person still away.");
    }, log);
    registry.onResumed(() => heard.push(`later resumed: ${String(registry.isStopped)}`), log);
    registry.stopAll("The person took over.");
    heard.length = 0;

    registry.resumeAll(null);

    Assert.areEqual(
      ["resumed: false", "stopped: The part saw the person still away., true", "control: true"].join(","),
      heard.join(","));
    Assert.isTrue(registry.isStopped);
  }

  @TestMethod
  public hearsANestedStopAndResumeOnceEachAndNotTheOuterResumeAfterThem(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const heard: string[] = [];
    let isFirst = true;
    registry.onControlChanged(() => heard.push(`control: ${String(registry.isStopped)}`));
    registry.onStopped(t => heard.push(`stopped: ${t}`), log);
    registry.onResumed(() => {
      heard.push(`first resumed: ${String(registry.isStopped)}`);
      if (!isFirst)
        return;
      isFirst = false;
      registry.stopAll("The part saw the person still away.");
      registry.resumeAll(null);
    }, log);
    registry.onResumed(() => heard.push(`later resumed: ${String(registry.isStopped)}`), log);
    registry.stopAll("The person took over.");
    heard.length = 0;

    registry.resumeAll(null);

    Assert.areEqual(
      [
        "first resumed: false", "stopped: The part saw the person still away.", "control: true",
        "first resumed: false", "later resumed: false", "control: false"
      ].join(","),
      heard.join(","));
    Assert.isFalse(registry.isStopped);
  }

  @TestMethod
  public hearsNoMoreOfAStopOnceOneOfItsListenersResumesAgain(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const heard: string[] = [];
    registry.onControlChanged(() => heard.push(`control: ${String(registry.isStopped)}`));
    registry.onResumed(() => heard.push(`resumed: ${String(registry.isStopped)}`), log);
    registry.onStopped(() => {
      heard.push(`stopped: ${String(registry.isStopped)}`);
      registry.resumeAll(null);
    }, log);
    registry.onStopped(() => heard.push(`later stopped: ${String(registry.isStopped)}`), log);

    registry.stopAll("The person took over.");

    Assert.areEqual(["stopped: true", "resumed: false", "control: false"].join(","), heard.join(","));
    Assert.isFalse(registry.isStopped);
  }

  @TestMethod
  public skipsAListenerThatAnEarlierListenerOfTheSameEventDisposed(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const heard: string[] = [];
    const later: Registration[] = [];
    registry.onStopped(() => later[0]?.[Symbol.dispose](), log);
    later.push(registry.onStopped(() => heard.push("stopped"), log));
    registry.onResumed(() => later[1]?.[Symbol.dispose](), log);
    later.push(registry.onResumed(() => heard.push("resumed"), log));
    registry.onSessionEnded(() => later[2]?.[Symbol.dispose](), log);
    later.push(registry.onSessionEnded(() => heard.push("ended"), log));
    registry.onControlChanged(() => later[3]?.[Symbol.dispose]());
    later.push(registry.onControlChanged(() => heard.push("control")));

    registry.stopAll("The person took over.");
    registry.resumeAll(null);
    registry.openSession("conversation-1", {}).end();

    Assert.areEqual(String.empty, heard.join(","));
    Assert.isFalse(registry.isStopped);
  }

  @TestMethod
  public async stopsOneSessionsCallsInFlightAndWithdrawsItsPermissionRequestWhileItAndTheOtherSessionsStayOpen(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const answerer = new PermissionAnswererFixture(() => PermissionAnswererFixture.never());
    const center = new PermissionCenter("app");
    center.open(new RememberedPermissionStore(settings.database));
    center.registerAnswerer("app", answerer, new ModuleLogFixture());
    const registry = ToolRegistryFixture.create(center);
    const outcomes: PermissionOutcome[] = [];
    const handler = new ToolHandlerFixture(async t => {
      if (t.arguments["ask"] === true)
        outcomes.push(await t.requestPermissionAsync(ToolStopTests.REQUEST));
      else if (t.arguments["wait"] === true)
        return ToolHandlerFixture.untilAborted(t);
      return new ToolResult([]);
    });
    registry.register("notes", new ToolDescriptor(ToolStopTests.DELETE, ToolStopTests.TOOLS), handler, ToolStopTests.TOOLS, new ModuleLogFixture());
    const heard: string[] = [];
    registry.onSessionStopped((session, reason) => heard.push(`${session}: ${reason}`), new ModuleLogFixture());
    const first = registry.openSession("conversation-1", {});
    const second = registry.openSession("conversation-2", {});

    const running = first.callAsync("notes_delete", { wait: true });
    const asking = first.callAsync("notes_delete", { ask: true });
    const other = second.callAsync("notes_delete", { wait: true });
    let isOtherSettled = false;
    void other.then(() => {
      isOtherSettled = true;
    });
    await answerer.waitForQuestionAsync(1);
    await handler.waitForCallAsync(3);
    registry.stopSession("browser", first.id, "The person took over the page.");
    registry.stopSession("browser", "no-such-session", "The person took over the page.");
    const later = await first.callAsync("notes_delete", {});
    const wasOtherSettled = isOtherSettled;
    const wasStopped = registry.isStopped;
    registry.stopAll("The person stopped agent control.");

    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STOPPED, await running);
    ToolStopTests.assertFailure(ToolFailureCode.Withdrawn, "The call was aborted while its permission request waited.", await asking);
    Assert.isTrue(await WaitFixture.untilAsync(() => outcomes.length === 1, 5_000));
    Assert.areEqual(PermissionDecision.Withdrawn, outcomes.map(t => t.decision).join(","));
    Assert.isFalse(later.isFailure);
    Assert.isFalse(wasOtherSettled);
    Assert.areEqual(4, handler.calls.length);
    Assert.isTrue(registry.isOpen(first));
    Assert.isFalse(wasStopped);
    Assert.areEqual(`${first.id}: The person took over the page.`, heard.join(","));
    ToolStopTests.assertFailure(ToolFailureCode.Stopped, ToolStopTests.STOPPED, await other);
  }

  @TestMethod
  public refusesASessionStopWithABadReasonOrWhileAStopRunsAndTellsEachListenerOnce(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const failingLog = new ModuleLogFixture();
    const session = registry.openSession("conversation-1", {});
    const refusals: string[] = [];
    const heard: string[] = [];
    const refuse = (action: () => void): void => {
      refusals.push(Assert.throws(action, AgentControlException).message);
    };
    registry.onStopped(() => refuse(() => registry.stopSession("browser", session.id, "The person took over the page.")), log);
    registry.onSessionStopped(() => {
      refuse(() => registry.stopSession("browser", session.id, "The person took over the page."));
      refuse(() => registry.resumeAll("browser"));
    }, log);
    registry.onSessionStopped(() => {
      throw new Error("The bar failed.");
    }, failingLog);
    registry.onSessionStopped((t, u) => heard.push(`${t === session.id ? "first" : t}: ${u}`), log);
    const removed = registry.onSessionStopped(() => heard.push("removed"), log);
    removed[Symbol.dispose]();

    const bad = [" ", "r".repeat(201), "Taken\nover"].map(t => Assert.throws(() => registry.stopSession("browser", session.id, t), ArgumentException));
    registry.stopSession("browser", session.id, "r".repeat(200));
    registry.stopAll("The person stopped agent control.");
    registry.stopSession("browser", session.id, "The person took over the page.");
    session.end();
    registry.stopSession("browser", session.id, "The person took over the page.");

    Assert.areEqual(3, bad.filter(t => t.message.startsWith("The reason must be one line that isn't blank, of at most 200 characters.")).length);
    Assert.areEqual(`first: ${"r".repeat(200)},first: The person took over the page.`, heard.join(","));
    Assert.areEqual(
      [
        "The module browser can't stop an agent session's turn while agent control or a session stops; only a command the person runs stops it.",
        "The module browser can't resume agent control while it stops or while one of its tool calls runs, even past its abort; only a command the person runs resumes it.",
        "The module browser can't stop an agent session's turn while agent control or a session stops; only a command the person runs stops it.",
        "The module browser can't stop an agent session's turn while agent control or a session stops; only a command the person runs stops it.",
        "The module browser can't resume agent control while it stops or while one of its tool calls runs, even past its abort; only a command the person runs resumes it."
      ].join("\n"),
      refusals.join("\n"));
    Assert.areEqual(0, log.lines.length);
    Assert.areEqual(2, failingLog.lines.length);
    Assert.isTrue(failingLog.lines[0]?.startsWith("A listener for stopped or resumed agent control failed: Error: The bar failed.") === true, failingLog.lines.join("\n"));
  }

  @TestMethod
  public refusesALaterListenersResumeAndSessionStopAfterAnEarlierListenerStopsAgentControlInsideASessionStop(): void {
    const registry = ToolRegistryFixture.create();
    const log = new ModuleLogFixture();
    const session = registry.openSession("conversation-1", {});
    const refusals: string[] = [];
    registry.onSessionStopped(() => registry.stopAll("The person stopped agent control."), log);
    registry.onSessionStopped(() => {
      refusals.push(Assert.throws(() => registry.resumeAll("browser"), AgentControlException).message);
      refusals.push(Assert.throws(() => registry.stopSession("browser", session.id, "Again."), AgentControlException).message);
    }, log);

    registry.stopSession("browser", session.id, "The person took over the page.");
    const stopped = registry.isStopped;
    registry.resumeAll("browser");

    Assert.areEqual(
      [
        "The module browser can't resume agent control while it stops or while one of its tool calls runs, even past its abort; only a command the person runs resumes it.",
        "The module browser can't stop an agent session's turn while agent control or a session stops; only a command the person runs stops it."
      ].join("\n"),
      refusals.join("\n"));
    Assert.isTrue(stopped);
    Assert.isFalse(registry.isStopped);
    Assert.areEqual(0, log.lines.length);
  }

  private static assertFailure(code: ToolFailureCode, message: string, outcome: ToolResult | ToolFailure): void {
    if (!outcome.isFailure)
      throw new Error("The call did not fail.");
    Assert.areEqual(`${code}|${message}`, `${outcome.code}|${outcome.message}`);
  }
}
