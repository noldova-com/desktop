/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { ClientClosure, PermissionRevocation, ProcessRequest, PseudoTerminalRequest, RuntimeCommand } from "@noldova/desktop.runtime";
import type { IMethodHandler, IRuntimePartContext } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { type FakeMember, FakeMembersFixture } from "../../fixtures/fake-members.fixture.js";
import { FakeRaisersFixture } from "../../fixtures/fake-raisers.fixture.js";
import { PseudoTerminalLibraryFixture } from "../../fixtures/pseudo-terminal-library.fixture.js";

@TestClass
export class FakeRuntimePartContextTests {
  private static readonly FOLDER: string = path.resolve("project");
  private static readonly SERVICE: string = "clock.zones";
  private static readonly HANDLER: IMethodHandler = { handleAsync: () => Promise.resolve(null) };
  private static readonly MEMBERS: Readonly<Record<keyof IRuntimePartContext, FakeMember<IRuntimePartContext>>> = {
    database: ["fake", t => t.database],
    settings: ["fake", t => t.settings],
    log: ["fake", t => t.log],
    tools: ["fake", t => t.tools],
    permissions: ["fake", t => t.permissions],
    webViews: ["fake", t => t.webViews],
    files: ["fake", t => t.files],
    secrets: ["fake", t => t.secrets],
    appWindows: ["fake", t => t.appWindows],
    shortcuts: ["fake", t => t.shortcuts],
    getWorkFolderAsync: ["answered", t => t.getWorkFolderAsync()],
    beginWork: ["answered", t => t.beginWork("Saving the notes")],
    readEnvironmentAsync: ["answered", t => t.readEnvironmentAsync()],
    startProcessAsync: ["answered", t => t.startProcessAsync(new ProcessRequest("git", ["status"], FakeRuntimePartContextTests.FOLDER))],
    startPseudoTerminalAsync: ["answered", t => t.startPseudoTerminalAsync(new PseudoTerminalRequest(new PseudoTerminalLibraryFixture(), "bash", [], FakeRuntimePartContextTests.FOLDER, 80, 24, {}))],
    registerMethod: ["told", t => t.registerMethod("notes.read", FakeRuntimePartContextTests.HANDLER)],
    declareEvent: ["answered", t => t.declareEvent("notes.changed")],
    registerCommand: ["told", t => t.registerCommand(new RuntimeCommand("clock.tick", "Tick", null, null, FakeRuntimePartContextTests.HANDLER))],
    onClientClosed: ["kept", t => t.onClientClosed(() => undefined)],
    postNotification: ["answered", t => t.postNotification(new NotificationPost(QualifiedName.parse("clock.alarm"), "window", "Alarm", null, NotificationSeverity.Warning, null, [], null))],
    publishService: ["told", t => t.publishService(FakeRuntimePartContextTests.SERVICE, new Map<string, string>())],
    onDependencyChanged: ["registered", t => t.onDependencyChanged(() => undefined)],
    moduleId: ["property", t => t.moduleId],
    moduleFolder: ["property", t => t.moduleFolder],
    getService: ["answered", t => t.getService<Map<string, string>>(FakeRuntimePartContextTests.SERVICE, Map)],
    findService: ["answered", t => t.findService<ArrayBufferView>(FakeRuntimePartContextTests.SERVICE, ArrayBuffer.isView)]
  };

  @TestMethod
  public async standsInForEveryMemberOfTheInterface(): Promise<void> {
    Assert.areEqual(FakeMembersFixture.expected(FakeRuntimePartContextTests.MEMBERS), await FakeMembersFixture.observeAsync<IRuntimePartContext>(() => new FakeRuntimePartContext(), FakeRuntimePartContextTests.MEMBERS));
  }

  @TestMethod
  public async raisesAClosedClientToEachListenerAndWaitsForTheirWork(): Promise<void> {
    const context = new FakeRuntimePartContext();
    const heard: string[] = [];
    context.onClientClosed(t => {
      heard.push(`first ${t.connection}`);
    });
    context.onClientClosed(async t => {
      await Promise.resolve();
      heard.push(`second ${t.connection}`);
    });

    await context.raiseClientClosedAsync(new ClientClosure(3, null));

    Assert.areEqual("first 3|second 3", heard.join("|"));
  }

  @TestMethod
  public raisesADependencyChangeUntilTheListenersDisposerRuns(): void {
    const context = new FakeRuntimePartContext();
    const heard: string[] = [];
    const stop = context.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${isActive}`));

    context.raiseDependencyChanged("git", false);
    stop();
    context.raiseDependencyChanged("git", true);

    Assert.areEqual("git false", heard.join("|"));
  }

  @TestMethod
  public async keepsWhatAClosedClientsListenerRejectsWithWithoutStoppingTheRest(): Promise<void> {
    const context = new FakeRuntimePartContext();
    const heard: string[] = [];
    context.onClientClosed(() => Promise.reject(FakeRaisersFixture.FAILURE));
    context.onClientClosed(() => {
      throw FakeRaisersFixture.FAILURE;
    });
    context.onClientClosed(t => {
      heard.push(String(t.connection));
    });

    await context.raiseClientClosedAsync(new ClientClosure(3, null));

    Assert.areEqual("3", heard.join("|"));
    Assert.isTrue(context.errors.length === 2 && context.errors.every(t => t === FakeRaisersFixture.FAILURE));
  }

  @TestMethod
  public writesADependencyListenersErrorToTheModulesLogAsTheRuntimeDoes(): void {
    const context = new FakeRuntimePartContext();

    const heard = FakeRaisersFixture.heard(listener => context.onDependencyChanged(listener), () => context.raiseDependencyChanged("git", false));

    Assert.areEqual("third|fourth", heard);
    Assert.areEqual(0, context.errors.length);
    Assert.isTrue(FakeRaisersFixture.logged(context.log, "Its listener for a change of git failed:"));
  }

  @TestMethod
  public givesItsToolsAndPermissionsItsLogForTheirListenersErrors(): void {
    const context = new FakeRuntimePartContext();
    context.tools.onResumed(() => {
      throw FakeRaisersFixture.FAILURE;
    });
    context.permissions.onRevoked(() => {
      throw FakeRaisersFixture.FAILURE;
    });

    context.tools.raiseResumed();
    context.permissions.raiseRevoked(new PermissionRevocation("git.push", null, "folder"));

    Assert.areEqual(2, context.log.callsOf("write").length);
  }

  @TestMethod
  public makesEachFakeItHoldsStrictWithItself(): void {
    const context = new FakeRuntimePartContext();
    context.beStrict();

    const refused = [
      Assert.throws(() => context.onDependencyChanged(() => undefined), UnansweredCallException).member,
      Assert.throws(() => context.settings.reset("notes.sort"), UnansweredCallException).member,
      Assert.throws(() => context.log.write("hello"), UnansweredCallException).member,
      Assert.throws(() => context.webViews.relay.onProtocolEvent("notes.view", () => undefined), UnansweredCallException).member,
      Assert.throws(() => context.tools.stopAll("closing"), UnansweredCallException).member,
      Assert.throws(() => context.permissions.onRevoked(() => undefined), UnansweredCallException).member,
      Assert.throws(() => context.appWindows.onChanged(() => undefined), UnansweredCallException).member,
      Assert.throws(() => context.shortcuts.onChanged(() => undefined), UnansweredCallException).member
    ];

    Assert.areEqual("onDependencyChanged|reset|write|onProtocolEvent|stopAll|onRevoked|onChanged|onChanged", refused.join("|"));
  }
}
