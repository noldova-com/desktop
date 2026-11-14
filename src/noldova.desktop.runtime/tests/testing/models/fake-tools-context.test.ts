/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolDescriptor, ToolRegistry, ToolRisk } from "@noldova/desktop.runtime";
import type { IToolDescriptor, IToolsContext } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeToolsContext } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";
import { ToolHandlerFixture } from "../../fixtures/tool-handler.fixture.js";

@TestClass
export class FakeToolsContextTests {
  private static readonly SEARCH: IToolDescriptor = {
    name: "notes_search",
    description: "Searches the notes.",
    inputSchema: { type: "object" },
    hints: { isReadOnly: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 5_000, maximum: 30_000 }
  };
  private static readonly SESSION: string = "session-1";
  private static readonly REASON: string = "person";
  private static readonly MEMBERS: Readonly<Record<keyof IToolsContext, FakeMember<IToolsContext>>> = {
    register: ["registered", t => t.register(FakeToolsContextTests.SEARCH, new ToolHandlerFixture())],
    openSession: ["answered", t => t.openSession("notes", { folder: "f1" })],
    onSessionEnded: ["registered", t => t.onSessionEnded(() => undefined)],
    openEndpointAsync: ["answered", t => t.openEndpointAsync({ handleAsync: () => Promise.resolve() })],
    stopAll: ["told", t => t.stopAll(FakeToolsContextTests.REASON)],
    stopSession: ["told", t => t.stopSession(FakeToolsContextTests.SESSION, FakeToolsContextTests.REASON)],
    onSessionStopped: ["registered", t => t.onSessionStopped(() => undefined)],
    resumeAll: ["told", t => t.resumeAll()],
    onStopped: ["registered", t => t.onStopped(() => undefined)],
    onResumed: ["registered", t => t.onResumed(() => undefined)],
    isStopped: ["property", t => t.isStopped]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeToolsContextTests.MEMBERS), await FakeMembersFixture.observeAsync<IToolsContext>(() => new FakeToolsContext(), FakeToolsContextTests.MEMBERS));
  }

  @TestMethod
  public async servesItsRegistrationsAndListenersThroughTheAnswersOfAToolRegistry(): Promise<void> {
    const registry = new ToolRegistry();
    const log = new FakeModuleLog();
    const tools = new FakeToolsContext(log);
    const handler = new ToolHandlerFixture();
    const heard: string[] = [];
    const named = [FakeToolsContextTests.SEARCH.name];
    tools.answer("register", (descriptor, toolHandler) => registry.register("notes", new ToolDescriptor(descriptor, named), toolHandler, named, log));
    tools.answer("onSessionEnded", listener => registry.onSessionEnded(listener, log));
    tools.answer("onSessionStopped", listener => registry.onSessionStopped(listener, log));
    tools.answer("onStopped", listener => registry.onStopped(listener, log));
    tools.answer("onResumed", listener => registry.onResumed(listener, log));

    const registration = tools.register(FakeToolsContextTests.SEARCH, handler);
    tools.onSessionEnded(() => heard.push("ended"));
    tools.onSessionStopped((_session, reason) => heard.push(`session stopped ${reason}`));
    const stopped = tools.onStopped(t => heard.push(`stopped ${t}`));
    tools.onResumed(() => heard.push("resumed"));
    const session = registry.openSession("notes", {});
    const outcome = await session.callAsync(FakeToolsContextTests.SEARCH.name, {});
    tools.raiseStopped("fake");
    registry.stopSession("notes", session.id, "person");
    registry.stopAll("person");
    stopped[Symbol.dispose]();
    registry.resumeAll(null);
    registry.stopAll("again");
    session.end();
    const listed = registry.listTools().length;
    registration[Symbol.dispose]();

    Assert.isFalse(outcome.isFailure);
    Assert.areEqual(1, handler.calls.length);
    Assert.areEqual("session stopped person|stopped person|resumed|ended", heard.join("|"));
    Assert.areEqual(1, listed);
    Assert.areEqual(0, registry.listTools().length);
    Assert.areEqual(0, tools.activeCallsOf("register").length);
    Assert.areEqual(1, tools.activeCallsOf("onResumed").length);
  }

  @TestMethod
  public keepsNoRegistrationItsAnswerRefuses(): void {
    const tools = new FakeToolsContext();
    const refusal = new Error("The tool notes_search is already registered.");
    tools.answer("register", () => {
      throw refusal;
    });

    Assert.areEqual(refusal, Assert.throws(() => tools.register(FakeToolsContextTests.SEARCH, new ToolHandlerFixture()), Error));
    Assert.areEqual(1, tools.callsOf("register").length);
    Assert.areEqual(0, tools.activeCallsOf("register").length);
  }

  @TestMethod
  public raisesToEachListenerUntilItsRegistrationIsDisposed(): void {
    const tools = new FakeToolsContext();
    const heard: string[] = [];
    const registrations = [
      tools.onSessionEnded(t => heard.push(`ended ${t}`)),
      tools.onSessionStopped((t, reason) => heard.push(`stopped ${t} ${reason}`)),
      tools.onStopped(t => heard.push(`all stopped ${t}`)),
      tools.onResumed(() => heard.push("resumed"))
    ];
    const raiseAll = (round: string): void => {
      tools.raiseSessionEnded(round);
      tools.raiseSessionStopped(round, "person");
      tools.raiseStopped(round);
      tools.raiseResumed();
    };

    raiseAll("1");
    for (const registration of registrations)
      registration[Symbol.dispose]();
    raiseAll("2");

    Assert.areEqual("ended 1|stopped 1 person|all stopped 1|resumed", heard.join("|"));
  }

  @TestMethod
  public sessionEndedSkipsARemovedListenerAndWritesAThrownErrorToTheLog(): void {
    const log = new FakeModuleLog();
    const tools = new FakeToolsContext(log);

    const heard = FakeRaisersFixture.heard(listener => {
      const registration = tools.onSessionEnded(listener);
      return () => registration[Symbol.dispose]();
    }, () => tools.raiseSessionEnded("session-1"));

    Assert.areEqual("third|fourth", heard);
    Assert.areEqual(0, tools.errors.length);
    Assert.isTrue(FakeRaisersFixture.logged(log, "A listener for ended agent sessions failed: "));
  }

  @TestMethod
  public sessionStoppedSkipsARemovedListenerAndWritesAThrownErrorToTheLog(): void {
    const log = new FakeModuleLog();
    const tools = new FakeToolsContext(log);

    const heard = FakeRaisersFixture.heard(listener => {
      const registration = tools.onSessionStopped(listener);
      return () => registration[Symbol.dispose]();
    }, () => tools.raiseSessionStopped("session-1", "person"));

    Assert.areEqual("third|fourth", heard);
    Assert.areEqual(0, tools.errors.length);
    Assert.isTrue(FakeRaisersFixture.logged(log, "A listener for stopped or resumed agent control failed: "));
  }

  @TestMethod
  public stoppedSkipsARemovedListenerAndWritesAThrownErrorToTheLog(): void {
    const log = new FakeModuleLog();
    const tools = new FakeToolsContext(log);

    const heard = FakeRaisersFixture.heard(listener => {
      const registration = tools.onStopped(listener);
      return () => registration[Symbol.dispose]();
    }, () => tools.raiseStopped("person"));

    Assert.areEqual("third|fourth", heard);
    Assert.areEqual(0, tools.errors.length);
    Assert.isTrue(FakeRaisersFixture.logged(log, "A listener for stopped or resumed agent control failed: "));
  }

  @TestMethod
  public resumedSkipsARemovedListenerAndWritesAThrownErrorToTheLog(): void {
    const log = new FakeModuleLog();
    const tools = new FakeToolsContext(log);

    const heard = FakeRaisersFixture.heard(listener => {
      const registration = tools.onResumed(listener);
      return () => registration[Symbol.dispose]();
    }, () => tools.raiseResumed());

    Assert.areEqual("third|fourth", heard);
    Assert.areEqual(0, tools.errors.length);
    Assert.isTrue(FakeRaisersFixture.logged(log, "A listener for stopped or resumed agent control failed: "));
  }
}
