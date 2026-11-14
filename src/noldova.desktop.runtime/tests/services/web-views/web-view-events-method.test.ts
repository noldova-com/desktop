/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellEvents, WebViewEvent, WebViewEventKind, WebViewEvents } from "@noldova/desktop.protocol";

import { RequestContext } from "../../../src/models/request-context.js";
import { EventRegistry } from "../../../src/services/registry/event-registry.js";
import { WebViewCenter } from "../../../src/services/web-views/web-view-center.js";
import { WebViewEventsMethod } from "../../../src/services/web-views/web-view-events-method.js";
import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class WebViewEventsMethodTests {
  private static readonly MAIN: number = 7;

  @TestMethod
  public async deliversTheEventsOfTheConnectedMainProcessOnlyAndAnswersNull(): Promise<void> {
    const center = new WebViewCenter(new TextOutputFixture(), new EventRegistry(new EventSinkFixture()).declare(ShellEvents.webViewCommand));
    const registration = center.attach("notes");
    center.check(WebViewEventsMethodTests.MAIN);
    const heard: string[] = [];
    center.listen("notes", t => heard.push(`${t.view} ${t.kind}`));
    const method = new WebViewEventsMethod(center);
    const opened = new WebViewEvent("notes", "1", WebViewEventKind.Opened, { pane: { name: "notes.note" }, profileKey: "workspace-1" });

    const ignored = await method.handleAsync(WebViewEventsMethodTests.context(WebViewEventsMethodTests.MAIN + 1, new WebViewEvents([opened])));
    const answer = await method.handleAsync(WebViewEventsMethodTests.context(WebViewEventsMethodTests.MAIN, new WebViewEvents([opened, new WebViewEvent("notes", "1", WebViewEventKind.Crashed)])));
    const listed = center.list("notes").map(t => t.id);
    registration[Symbol.dispose]();

    Assert.isNull(ignored);
    Assert.isNull(answer);
    Assert.areEqual("1 Opened,1 Crashed", heard.join(","));
    Assert.areEqual("1", listed.join(","));
  }

  @TestMethod
  public async refusesAPayloadThatIsNoEventList(): Promise<void> {
    const method = new WebViewEventsMethod(new WebViewCenter(new TextOutputFixture()));

    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", { events: [{ module: "notes" }] }, new AbortController().signal, WebViewEventsMethodTests.MAIN)), Error);
  }

  private static context(connection: number, events: WebViewEvents): RequestContext {
    return new RequestContext("main", events.toJson(), new AbortController().signal, connection);
  }
}
