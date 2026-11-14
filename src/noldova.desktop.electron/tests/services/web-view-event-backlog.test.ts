/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";

import { WebViewEventBacklog } from "../../src/services/web-view-event-backlog.js";

@TestClass
export class WebViewEventBacklogTests {
  @TestMethod
  public givesTheEventsInTheOrderTheyCameAndEmptiesItself(): void {
    const backlog = new WebViewEventBacklog(3);
    backlog.push(WebViewEventBacklogTests.crashed("1"));
    backlog.push(WebViewEventBacklogTests.crashed("2"));

    const taken = backlog.take();

    Assert.areEqual("1 Crashed,2 Crashed", WebViewEventBacklogTests.describe(taken));
    Assert.areEqual(0, backlog.take().length);
  }

  @TestMethod
  public dropsAViewsOldestEventsOverItsLimitAndCountsThemFirst(): void {
    const backlog = new WebViewEventBacklog(2);
    backlog.push(new WebViewEvent("browser", "1", WebViewEventKind.Zoom, { factor: 1 }));
    backlog.push(WebViewEventBacklogTests.crashed("2"));
    backlog.push(new WebViewEvent("browser", "1", WebViewEventKind.Zoom, { factor: 2 }));
    backlog.push(new WebViewEvent("browser", "1", WebViewEventKind.Zoom, { factor: 3 }));
    backlog.push(new WebViewEvent("browser", "1", WebViewEventKind.Zoom, { factor: 4 }));

    const taken = backlog.take();

    Assert.areEqual("1 Dropped {\"count\":2},2 Crashed,1 Zoom {\"factor\":3},1 Zoom {\"factor\":4}", WebViewEventBacklogTests.describe(taken));
  }

  @TestMethod
  public countsAgainFromNothingAfterATake(): void {
    const backlog = new WebViewEventBacklog(1);
    backlog.push(WebViewEventBacklogTests.crashed("1"));
    backlog.push(WebViewEventBacklogTests.crashed("1"));
    backlog.take();
    backlog.push(WebViewEventBacklogTests.crashed("1"));

    Assert.areEqual("1 Crashed", WebViewEventBacklogTests.describe(backlog.take()));
  }

  private static crashed(view: string): WebViewEvent {
    return new WebViewEvent("browser", view, WebViewEventKind.Crashed);
  }

  private static describe(events: readonly WebViewEvent[]): string {
    return events.map(t => Object.keys(t.details).length === 0 ? `${t.view} ${t.kind}` : `${t.view} ${t.kind} ${JSON.stringify(t.details)}`).join(",");
  }
}
