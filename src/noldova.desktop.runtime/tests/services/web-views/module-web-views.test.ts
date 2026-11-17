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
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellEvents, WebViewAction, WebViewAnswered, WebViewEvent, WebViewEventKind, WebViewEvents } from "@noldova/desktop.protocol";
import { EventRegistry, MethodRegistry, ServiceRegistry, WebViewCenter, type WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleWebViewsTests {
  @TestMethod
  public async drivesTheModulesOwnViewsThroughTheMainProcessAndListsThemFromItsAnswers(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const sink = new EventSinkFixture();
    const center = new WebViewCenter(new TextOutputFixture(), new EventRegistry(sink).declare(ShellEvents.webViewCommand));
    center.check(7);
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, center);

    const navigating = context.webViews.navigateAsync("1", "https://example.net/");
    const moving = context.webViews.actAsync("1", WebViewAction.Back);
    const allowing = context.webViews.setAllowedOriginsAsync("1", ["https://example.com"]);
    const controlling = context.webViews.setControlledAsync("1", true);
    const clearing = context.webViews.clearProfileAsync("workspace-1");
    const sending = context.webViews.relay.sendAsync("1", "Page.captureScreenshot", { format: "png" }, 5000);
    const answers = [{ kind: "Refused", origin: "https://example.net" }, { kind: "NoHistory" }, null, null, null, { data: "AAAA" }];
    center.answer(7, new WebViewAnswered(1, [{ id: "1", module: "notes", pane: { name: "notes.note", instance: "plan" }, profileKey: "workspace-1" }]));
    answers.forEach((t, index) => center.answer(7, new WebViewAnswered(index + 2, t)));
    const moves = [await navigating, await moving];
    await allowing;
    await controlling;
    await clearing;
    const reply = await sending;
    const notMove = await Assert.throwsAsync(() => context.webViews.actAsync("1", WebViewAction.List), ArgumentException);
    await yieldTurn();

    Assert.areEqual("Refused https://example.net,NoHistory null", moves.map(t => `${t.kind} ${t.origin}`).join(","));
    Assert.areEqual("{\"data\":\"AAAA\"}", JSON.stringify(reply));
    Assert.areEqual("action", notMove.parameterName);
    Assert.areEqual("1 plan", context.webViews.list().map(t => `${t.id} ${t.pane.instance}`).join(","));
    Assert.areEqual([
      "{\"call\":1,\"module\":\"notes\",\"action\":\"List\"}",
      "{\"call\":2,\"module\":\"notes\",\"action\":\"Navigate\",\"view\":\"1\",\"value\":\"https://example.net/\"}",
      "{\"call\":3,\"module\":\"notes\",\"action\":\"Back\",\"view\":\"1\"}",
      "{\"call\":4,\"module\":\"notes\",\"action\":\"SetAllowedOrigins\",\"view\":\"1\",\"value\":[\"https://example.com\"]}",
      "{\"call\":5,\"module\":\"notes\",\"action\":\"SetControlled\",\"view\":\"1\",\"value\":true}",
      "{\"call\":6,\"module\":\"notes\",\"action\":\"ClearProfile\",\"value\":\"workspace-1\"}",
      "{\"call\":7,\"module\":\"notes\",\"action\":\"Send\",\"view\":\"1\",\"value\":{\"method\":\"Page.captureScreenshot\",\"params\":{\"format\":\"png\"},\"timeoutMilliseconds\":5000}}"
    ].join("\n"), sink.sent.map(([event]) => JSON.stringify(event.payload)).join("\n"));
  }

  @TestMethod
  public async passesTheRelaysEventsOnlyToItsViewsListenersAndTheOthersToTheModulesUntilItDeactivates(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const center = new WebViewCenter(new TextOutputFixture(), new EventRegistry(new EventSinkFixture()).declare(ShellEvents.webViewCommand));
    center.check(7);
    const context = ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, center);
    const viewEvents: string[] = [];
    const protocolEvents: WebViewProtocolEvent[] = [];
    context.webViews.onViewEvent(t => viewEvents.push(`${t.view} ${t.kind}`));
    const stop = context.webViews.relay.onProtocolEvent("1", t => protocolEvents.push(t));
    const state = { address: "https://example.com/", title: "Example", isLoading: false, canGoBack: false, canGoForward: false };
    const loaded = { method: "Page.loadEventFired", params: { timestamp: 1 }, isCut: true };

    center.receive(7, new WebViewEvents([
      new WebViewEvent("notes", "1", WebViewEventKind.Protocol, loaded),
      new WebViewEvent("notes", "2", WebViewEventKind.Protocol, { ...loaded, isCut: false }),
      new WebViewEvent("notes", "1", WebViewEventKind.State, state)
    ]));
    stop();
    center.receive(7, new WebViewEvents([new WebViewEvent("notes", "1", WebViewEventKind.Protocol, loaded)]));
    context[Symbol.dispose]();
    center.receive(7, new WebViewEvents([new WebViewEvent("notes", "1", WebViewEventKind.Crashed)]));

    Assert.areEqual("1 State", viewEvents.join(","));
    Assert.areEqual("1 Page.loadEventFired {\"timestamp\":1} true", protocolEvents.map(t => `${t.view} ${t.method} ${JSON.stringify(t.params)} ${t.isCut}`).join(","));
  }
}
