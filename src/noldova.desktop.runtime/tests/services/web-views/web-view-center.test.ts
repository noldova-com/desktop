/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate as yieldTurn } from "node:timers/promises";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  QualifiedName, Request, type Response, ShellEvents, ShellMethods, WebViewAction, WebViewAnswered, WebViewBlockedPorts, WebViewEvent, WebViewEventKind, WebViewEvents, WebViewFailure, WebViewFailureKind
} from "@noldova/desktop.protocol";
import { EventRegistry, RuntimeBuild, WebViewCenter, WebViewFailureException } from "@noldova/desktop.runtime";

import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import type { RawConnectionFixture } from "../../fixtures/raw-connection.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WebViewCenterPartsFixture } from "../../fixtures/web-view-center-parts.fixture.js";

@TestClass
export class WebViewCenterTests {
  private static readonly NOTE: JsonObject = { id: "1", module: "notes", pane: { name: "notes.note", instance: "plan" }, profileKey: "workspace-1" };

  @TestMethod
  public async failsEveryCallAsUnavailableWhileNoMainProcessIsConnectedOrWithoutAChannel(): Promise<void> {
    const { center } = WebViewCenterTests.create();
    const unconnected = new WebViewCenter(new TextOutputFixture());

    unconnected.check(7);
    const failures = [
      await Assert.throwsAsync(() => center.commandAsync("notes", WebViewAction.Reload, "1"), WebViewFailureException),
      await Assert.throwsAsync(() => unconnected.commandAsync("notes", WebViewAction.Reload, "1"), WebViewFailureException)
    ];

    Assert.areEqual("Unavailable|The web view call failed: Unavailable.,Unavailable|The web view call failed: Unavailable.", failures.map(t => `${t.failure.kind}|${t.message}`).join(","));
  }

  @TestMethod
  public async sendsEachCallToTheMainProcessAndSettlesItOnlyWithThatConnectionsAnswer(): Promise<void> {
    const { center, sink } = WebViewCenterTests.create();
    center.check(7);

    const navigating = center.commandAsync("notes", WebViewAction.Navigate, "1", "https://example.com/");
    const reloading = center.commandAsync("notes", WebViewAction.Reload, "1");
    center.answer(8, new WebViewAnswered(1, { kind: "Started" }));
    center.answer(7, new WebViewAnswered(9, { kind: "Started" }));
    center.answer(7, new WebViewAnswered(1, { kind: "Started" }));
    center.answer(7, new WebViewAnswered(2, null, new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Not allowed here.")));
    const answer = await navigating;
    const failure = await Assert.throwsAsync(() => reloading, WebViewFailureException);
    const invalid = await Assert.throwsAsync(() => center.commandAsync("notes", WebViewAction.Navigate, "1", String.empty), ArgumentException);

    Assert.areEqual("{\"kind\":\"Started\"}", JSON.stringify(answer));
    Assert.areEqual("Protocol|-32000|Not allowed here.", `${failure.failure.kind}|${failure.failure.code}|${failure.message}`);
    Assert.areEqual("value", invalid.parameterName);
    Assert.areEqual([
      "7 desktop.webViewCommand {\"call\":1,\"module\":\"notes\",\"action\":\"Navigate\",\"view\":\"1\",\"value\":\"https://example.com/\"}",
      "7 desktop.webViewCommand {\"call\":2,\"module\":\"notes\",\"action\":\"Reload\",\"view\":\"1\"}"
    ].join("\n"), WebViewCenterTests.format(sink));
  }

  @TestMethod
  public async mirrorsAModulesViewsFromTheMainProcessesListAndEventsAndLogsAListenerThatFails(): Promise<void> {
    const { center, sink, diagnostics } = WebViewCenterTests.create();
    center.check(7);
    const registration = center.attach("notes");
    const heard: string[] = [];
    center.listen("notes", t => heard.push(`${t.view} ${t.kind}`));
    const stop = center.listen("notes", () => {
      throw new Error("Not now.");
    });

    center.receive(7, new WebViewEvents([WebViewCenterTests.opened("2")]));
    center.answer(7, new WebViewAnswered(1, [WebViewCenterTests.NOTE, { ...WebViewCenterTests.NOTE, id: "2" }, { ...WebViewCenterTests.NOTE, id: "3", module: "files", pane: { name: "files.list" } }]));
    await yieldTurn();
    stop();
    center.receive(8, new WebViewEvents([new WebViewEvent("notes", "1", WebViewEventKind.Closed)]));
    center.receive(7, new WebViewEvents([new WebViewEvent("files", "3", WebViewEventKind.Crashed), new WebViewEvent("notes", "2", WebViewEventKind.Closed)]));
    const listed = center.list("notes").map(t => `${t.id} ${t.pane.instance} ${t.profileKey}`);
    registration[Symbol.dispose]();

    Assert.areEqual("1 plan workspace-1", listed.join(","));
    Assert.areEqual("2 Opened,1 Opened,2 Closed", heard.join(","));
    Assert.areEqual(String.empty, center.list("notes").join(","));
    Assert.areEqual("7 desktop.webViewCommand {\"call\":1,\"module\":\"notes\",\"action\":\"List\"}", WebViewCenterTests.format(sink));
    Assert.areEqual(2, diagnostics.text.split("A listener of the module notes failed to hear a web view event: Error: Not now.\n").length - 1);
  }

  @TestMethod
  public async closesTheMirroredViewsAndFailsTheCallsInFlightWhenTheMainProcessGoesThenListsFromTheNextOne(): Promise<void> {
    const { center, sink } = WebViewCenterTests.create();
    center.attach("notes");
    const heard: string[] = [];
    center.listen("notes", t => heard.push(`${t.view} ${t.kind}`));
    center.check(7);
    center.answer(7, new WebViewAnswered(1, [WebViewCenterTests.NOTE]));
    await yieldTurn();

    const reloading = center.commandAsync("notes", WebViewAction.Reload, "1");
    center.check(7);
    center.check(null);
    const failure = await Assert.throwsAsync(() => reloading, WebViewFailureException);
    center.check(9);
    center.answer(9, new WebViewAnswered(3, null));
    await yieldTurn();

    Assert.areEqual(WebViewFailureKind.Unavailable, failure.failure.kind);
    Assert.areEqual("1 Opened,1 Closed", heard.join(","));
    Assert.areEqual(String.empty, center.list("notes").join(","));
    Assert.areEqual([
      "7 desktop.webViewCommand {\"call\":1,\"module\":\"notes\",\"action\":\"List\"}",
      "7 desktop.webViewCommand {\"call\":2,\"module\":\"notes\",\"action\":\"Reload\",\"view\":\"1\"}",
      "9 desktop.webViewCommand {\"call\":3,\"module\":\"notes\",\"action\":\"List\"}"
    ].join("\n"), WebViewCenterTests.format(sink));
  }

  @TestMethod
  public async keepsANewerMirrorOfTheSameModuleAndLogsAListItCannotRead(): Promise<void> {
    const { center, diagnostics } = WebViewCenterTests.create();
    center.check(7);
    const first = center.attach("notes");
    const second = center.attach("notes");
    const other = center.attach("files");
    const heard: string[] = [];
    center.listen("notes", t => heard.push(`${t.view} ${t.kind}`));

    first[Symbol.dispose]();
    other[Symbol.dispose]();
    center.listen("files", () => heard.push("files"))();
    center.answer(7, new WebViewAnswered(2, [{ id: "1" }]));
    center.answer(7, new WebViewAnswered(3, [{ ...WebViewCenterTests.NOTE, module: "files", pane: { name: "files.list" } }]));
    await yieldTurn();
    center.receive(7, new WebViewEvents([WebViewCenterTests.opened("4"), new WebViewEvent("files", "5", WebViewEventKind.Crashed)]));
    second[Symbol.dispose]();

    Assert.areEqual("4 Opened", heard.join(","));
    Assert.isTrue(diagnostics.text.startsWith("The runtime could not list the web views of the module notes: "));
    Assert.areEqual(1, diagnostics.text.split("\n").length - 1);
  }

  @TestMethod
  public async sendsEachChangeOfTheBlockedPortsToTheMainProcessAndWaitsOnlyForItsAcknowledgementThatCoversTheChange(): Promise<void> {
    const sink = new EventSinkFixture();
    const events = new EventRegistry(sink);
    const center = new WebViewCenter(new TextOutputFixture(), events.declare(ShellEvents.webViewCommand), events.declare(ShellEvents.webViewBlockedPorts));
    const signal = new AbortController().signal;

    await center.waitForPortsAsync(center.blockPort(4600), signal);
    center.check(7);
    const read = [center.readPorts(7)?.toJson() ?? null, center.readPorts(8)];
    const waiting = center.waitForPortsAsync(center.blockPort(4700), signal);
    center.answerPorts(8, new WebViewBlockedPorts(2, [4600, 4700]));
    center.answerPorts(7, new WebViewBlockedPorts(1, [4600]));
    await yieldTurn();
    const isPendingBeforeItsAcknowledgement = await WaitFixture.isPendingAsync(waiting);
    center.answerPorts(7, new WebViewBlockedPorts(2, [4600, 4700]));
    await waiting;
    center.unblockPort(4600);
    center.unblockPort(4600);

    Assert.areEqual("[{\"serial\":1,\"ports\":[4600]},null]", JSON.stringify(read));
    Assert.isTrue(isPendingBeforeItsAcknowledgement);
    Assert.areEqual("7 desktop.webViewBlockedPorts {\"serial\":2,\"ports\":[4600,4700]}\n7 desktop.webViewBlockedPorts {\"serial\":3,\"ports\":[4700]}",
      WebViewCenterTests.format(sink));
  }

  @TestMethod
  public async settlesAPortWaitWhenTheMainProcessGoesOrWithoutAPortsChannelAndRejectsOneWhoseSignalAborts(): Promise<void> {
    const events = new EventRegistry(new EventSinkFixture());
    const center = new WebViewCenter(new TextOutputFixture(), events.declare(ShellEvents.webViewCommand), events.declare(ShellEvents.webViewBlockedPorts));
    const { center: unchanneled } = WebViewCenterTests.create();
    const stopping = new AbortController();
    center.check(7);
    unchanneled.check(7);

    const whileConnected = center.waitForPortsAsync(center.blockPort(4600), new AbortController().signal);
    center.check(null);
    await whileConnected;
    await unchanneled.waitForPortsAsync(unchanneled.blockPort(4600), stopping.signal);
    center.check(9);
    const aborted = center.waitForPortsAsync(center.blockPort(4700), stopping.signal);
    stopping.abort(new Error("The runtime is stopping."));
    const failures = [await Assert.throwsAsync(() => aborted, Error), await Assert.throwsAsync(() => center.waitForPortsAsync(1, stopping.signal), Error)];
    center.answerPorts(9, new WebViewBlockedPorts(5, []));

    Assert.areEqual("The runtime is stopping.,The runtime is stopping.", failures.map(t => t.message).join(","));
    Assert.areEqual("[4600,4700]", JSON.stringify(center.readPorts(9)?.ports));
  }

  private static create(): WebViewCenterPartsFixture {
    const sink = new EventSinkFixture();
    const diagnostics = new TextOutputFixture();
    return new WebViewCenterPartsFixture(new WebViewCenter(diagnostics, new EventRegistry(sink).declare(ShellEvents.webViewCommand)), sink, diagnostics);
  }

  private static opened(view: string): WebViewEvent {
    return new WebViewEvent("notes", view, WebViewEventKind.Opened, { pane: { name: "notes.note" }, profileKey: "workspace-2" });
  }

  private static format(sink: EventSinkFixture): string {
    return sink.sent.map(([event, connection]) => `${connection} ${event.name.text} ${JSON.stringify(event.payload)}`).join("\n");
  }
}

@TestClass
export class WebViewCenterHostTests {
  private static readonly ECHO: QualifiedName = QualifiedName.parse("clock.echo");

  @TestMethod
  public relaysAModulesCallsToTheMainProcessTakesOnlyItsAnswersAndEventsAndFailsThemWhileItIsGone(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("clock", WebViewCenterHostTests.createPart())], ["clock"]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const before = await WebViewCenterHostTests.callAsync(cli, "cli:1", WebViewCenterHostTests.ECHO, null);
      const { connection: main } = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      const listing = await UpdateBarrierFixture.readEventAsync(main, ShellEvents.webViewCommand);
      const view = { id: "1", module: "clock", pane: { name: "clock.face" }, profileKey: "workspace-1" };
      await WebViewCenterHostTests.callAsync(main, "main:1", ShellMethods.webViewAnswered, new WebViewAnswered(1, [view]).toJson());
      cli.sendMessages(new Request("cli:2", WebViewCenterHostTests.ECHO, null));
      const navigating = await UpdateBarrierFixture.readEventAsync(main, ShellEvents.webViewCommand);
      await WebViewCenterHostTests.callAsync(cli, "cli:3", ShellMethods.webViewAnswered, new WebViewAnswered(2, { kind: "Refused", origin: "https://example.net" }).toJson());
      const state = { address: "https://example.com/", title: "Example", isLoading: true, canGoBack: false, canGoForward: false };
      await WebViewCenterHostTests.callAsync(cli, "cli:4", ShellMethods.webViewEvents, new WebViewEvents([new WebViewEvent("clock", "1", WebViewEventKind.Crashed)]).toJson());
      await WebViewCenterHostTests.callAsync(main, "main:2", ShellMethods.webViewEvents, new WebViewEvents([new WebViewEvent("clock", "1", WebViewEventKind.State, state)]).toJson());
      await WebViewCenterHostTests.callAsync(main, "main:3", ShellMethods.webViewAnswered, new WebViewAnswered(2, { kind: "Started" }).toJson());
      const during = await RuntimeHostFixture.readAnswerAsync(cli);
      main[Symbol.dispose]();
      const after = await WebViewCenterHostTests.callAsync(cli, "cli:5", WebViewCenterHostTests.ECHO, null);

      Assert.areEqual("{\"call\":1,\"module\":\"clock\",\"action\":\"List\"}", JSON.stringify(listing.payload));
      Assert.areEqual("{\"call\":2,\"module\":\"clock\",\"action\":\"Navigate\",\"view\":\"1\",\"value\":\"https://example.com/\"}", JSON.stringify(navigating.payload));
      Assert.areEqual([
        "{\"failure\":\"Unavailable\",\"views\":[],\"heard\":[]}",
        "{\"kind\":\"Started\",\"views\":[\"1\"],\"heard\":[\"1 Opened\",\"1 State\"]}",
        "{\"failure\":\"Unavailable\",\"views\":[],\"heard\":[\"1 Opened\",\"1 State\",\"1 Closed\"]}"
      ].join("\n"), [before, during, after].map(t => JSON.stringify(t.payload)).join("\n"));
    });
  }

  private static async callAsync(connection: RawConnectionFixture, id: string, method: QualifiedName, payload: JsonValue): Promise<Response> {
    connection.sendMessages(new Request(id, method, payload));
    return RuntimeHostFixture.readAnswerAsync(connection);
  }

  private static createPart(): string {
    return [
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    const heard = [];",
      "    const report = outcome => ({ ...outcome, views: context.webViews.list().map(t => t.id), heard });",
      "    context.webViews.onViewEvent(t => heard.push(t.view + \" \" + t.kind));",
      "    context.registerMethod(\"clock.echo\", { handleAsync: async () => {",
      "      try {",
      "        return report({ kind: (await context.webViews.navigateAsync(\"1\", \"https://example.com/\")).kind });",
      "      }",
      "      catch (error) {",
      "        return report({ failure: error.failure.kind });",
      "      }",
      "    } });",
      "  }",
      String.empty,
      "  async deactivateAsync() {",
      "  }",
      "}",
      String.empty
    ].join("\n");
  }
}
