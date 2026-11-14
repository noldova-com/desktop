/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellEvents, WebViewAnswered, WebViewEvent, WebViewEventKind, WebViewEvents } from "@noldova/desktop.protocol";

import type { WebViewProtocolEvent } from "../../../src/models/web-view-protocol-event.js";
import { EventRegistry } from "../../../src/services/registry/event-registry.js";
import { ModuleWebViewRelay } from "../../../src/services/web-views/module-web-view-relay.js";
import { WebViewCenter } from "../../../src/services/web-views/web-view-center.js";
import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ModuleWebViewRelayTests {
  private static readonly MAIN: number = 7;

  @TestMethod
  public async sendsAProtocolCallForItsModuleAndAnswersWithTheMainProcesssAnswer(): Promise<void> {
    const [center, sink] = ModuleWebViewRelayTests.create();
    center.check(ModuleWebViewRelayTests.MAIN);
    const relay = new ModuleWebViewRelay("notes", center);

    const sending = relay.sendAsync("1", "Page.navigate", { url: "https://example.com/" }, 2_000);
    center.answer(ModuleWebViewRelayTests.MAIN, new WebViewAnswered(1, { frameId: "main" }));
    const answer = await sending;

    Assert.areEqual("{\"frameId\":\"main\"}", JSON.stringify(answer));
    Assert.areEqual(
      "7 {\"call\":1,\"module\":\"notes\",\"action\":\"Send\",\"view\":\"1\",\"value\":{\"method\":\"Page.navigate\",\"params\":{\"url\":\"https://example.com/\"},\"timeoutMilliseconds\":2000}}",
      sink.sent.map(([event, connection]) => `${connection} ${JSON.stringify(event.payload)}`).join("\n"));
  }

  @TestMethod
  public hearsOnlyItsViewsProtocolEventsUntilItStopsListening(): void {
    const [center] = ModuleWebViewRelayTests.create();
    const registration = center.attach("notes");
    center.check(ModuleWebViewRelayTests.MAIN);
    const relay = new ModuleWebViewRelay("notes", center);
    const heard: WebViewProtocolEvent[] = [];

    const stop = relay.onProtocolEvent("1", t => heard.push(t));
    center.receive(ModuleWebViewRelayTests.MAIN, new WebViewEvents([
      ModuleWebViewRelayTests.protocol("1", "Network.requestWillBeSent", { requestId: "r-1" }, false),
      ModuleWebViewRelayTests.protocol("2", "Network.requestWillBeSent", { requestId: "r-2" }, false),
      new WebViewEvent("notes", "1", WebViewEventKind.Crashed),
      ModuleWebViewRelayTests.protocol("1", "Network.dataReceived", {}, true)
    ]));
    stop();
    center.receive(ModuleWebViewRelayTests.MAIN, new WebViewEvents([ModuleWebViewRelayTests.protocol("1", "Page.loadEventFired", {}, false)]));
    registration[Symbol.dispose]();

    Assert.areEqual("1 Network.requestWillBeSent {\"requestId\":\"r-1\"} false,1 Network.dataReceived {} true",
      heard.map(t => `${t.view} ${t.method} ${JSON.stringify(t.params)} ${String(t.isCut)}`).join(","));
  }

  private static protocol(view: string, method: string, params: JsonObject, isCut: boolean): WebViewEvent {
    return new WebViewEvent("notes", view, WebViewEventKind.Protocol, { method, params, isCut });
  }

  private static create(): [WebViewCenter, EventSinkFixture] {
    const sink = new EventSinkFixture();
    return [new WebViewCenter(new TextOutputFixture(), new EventRegistry(sink).declare(ShellEvents.webViewCommand)), sink];
  }
}
