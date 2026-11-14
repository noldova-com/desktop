/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ErrorHandler, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/context.exceptions";
import { QualifiedName, WebViewEvent, WebViewEventKind, WebViewInfo, WebViewPane } from "@noldova/desktop.protocol";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { WebViewClosedException } from "../../../src/app/exceptions/web-view-closed.exception";
import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { Layout } from "../../../src/app/models/layout/layout";
import { WebViewHandle } from "../../../src/app/models/web-view-handle";
import { WebViewService } from "../../../src/app/services/web-view.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { WindowPartHostFixture } from "../../fixtures/window-part-host.fixture";

@Component({
  selector: "nol-test-page",
  template: "<p></p>"
})
class TestPageComponent {
}

describe("WebViewHandle", () => {
  const { plan } = LayoutFixture;
  const pane = new WebViewPane(QualifiedName.parse("notes.note"), "plan");
  let bridge: PreloadBridgeFixture;
  let service: WebViewService;
  let injector: Injector;

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    const host = new WindowPartHostFixture();
    host.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: host },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } }
      ]
    });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(plan));
    service = TestBed.inject(WebViewService);
    injector = TestBed.inject(Injector);
    bridge.webViewCalls.length = 0;
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  function handle(): WebViewHandle {
    return new WebViewHandle(new WebViewInfo("1", "notes", pane, "workspace-1"), plan, injector, service, document.createElement("div"), document.createElement("webview"));
  }

  function event(kind: WebViewEventKind): WebViewEvent {
    return new WebViewEvent("notes", "1", kind);
  }

  it("keeps the view's identity, its tab, its injector and its elements, and starts unwanted, hidden and open", () => {
    const view = handle();

    expect([view.id, view.moduleId, view.pane, view.profileKey, view.tab, view.injector]).toEqual(["1", "notes", pane, "workspace-1", plan, injector]);
    expect([view.frame.localName, view.guest.localName, view.layer, view.isWanted, view.isShown, view.isClosed]).toEqual(["div", "webview", null, false, false, false]);
  });

  it("mounts its element in the part's element until it is closed", () => {
    const view = handle();
    const first = document.createElement("section");
    const second = document.createElement("section");

    view.mount(first);
    const inFirst = view.frame.parentElement;
    view.close();
    view.mount(second);

    expect([inFirst, view.frame.parentElement, second.childElementCount]).toEqual([first, null, 0]);
  });

  it("is wanted after a show and not after a hide, and ignores both once closed", () => {
    const view = handle();

    view.show();
    const shown = view.isWanted;
    view.hide();
    const hidden = view.isWanted;
    view.close();
    view.show();

    expect([shown, hidden, view.isWanted]).toEqual([true, false, false]);
  });

  it("moves, zooms and finds in the view through the main process, finding without matching case by default", async () => {
    const view = handle();
    bridge.webViewAnswer = { kind: "Started" };
    bridge.webViewZoom = 1.5;

    await Promise.all([view.navigateAsync("https://example.net/"), view.goBackAsync(), view.goForwardAsync(), view.reloadAsync(), view.stopAsync()]);
    const factors = await Promise.all([view.getZoomAsync(), view.setZoomAsync(1.5), view.zoomInAsync(), view.zoomOutAsync()]);
    await Promise.all([view.findAsync("plan"), view.findAsync("Plan", { matchCase: true }), view.findNextAsync(), view.findPreviousAsync()]);
    view.endFind();

    expect(factors).toEqual([1.5, 1.5, 1.5, 1.5]);
    expect(bridge.webViewCalls).toEqual([
      "navigate notes 1 https://example.net/", "act notes 1 Back", "act notes 1 Forward", "act notes 1 Reload", "act notes 1 Stop",
      "zoom notes 1 null", "zoom notes 1 1.5", "zoom notes 1 in", "zoom notes 1 out",
      "find notes 1 {\"text\":\"plan\",\"matchCase\":false}", "find notes 1 {\"text\":\"Plan\",\"matchCase\":true}", "find notes 1 \"next\"", "find notes 1 \"previous\"",
      "find notes 1 {\"text\":\"\",\"matchCase\":false}"
    ]);
  });

  it.each([Number.NaN, 0, -1, Number.POSITIVE_INFINITY])("refuses the zoom factor %d without asking the main process", async factor => {
    const view = handle();

    await expect(view.setZoomAsync(factor)).rejects.toThrowError(new ArgumentException("A web view's zoom is a finite factor above 0, 1 for 100%.", "factor"));
    expect(bridge.webViewCalls).toEqual([]);
  });

  it("opens no layer once closed", async () => {
    const view = handle();
    view.close();
    bridge.webViewCalls.length = 0;

    const layer = await view.openLayerAsync(() => Promise.resolve(TestPageComponent)).catch((error: unknown) => error);

    expect([layer instanceof WebViewClosedException, view.frame.childElementCount, bridge.webViewCalls]).toEqual([true, 0, []]);
  });

  it("passes each event to every listener subscribed when it came, until a listener stops", () => {
    const view = handle();
    const heard: string[] = [];
    let stopSecond: () => void = () => undefined;
    const stopFirst = view.subscribe(t => {
      heard.push(`first ${t.kind}`);
      stopSecond();
    });
    stopSecond = view.subscribe(t => heard.push(`second ${t.kind}`));

    view.receive(event(WebViewEventKind.Crashed));
    view.receive(event(WebViewEventKind.Crashed));
    stopFirst();
    view.receive(event(WebViewEventKind.Closed));

    expect(heard).toEqual(["first Crashed", "second Crashed", "first Crashed"]);
  });

  it("ends once, forgetting its listeners", () => {
    const view = handle();
    const heard: string[] = [];
    view.subscribe(t => heard.push(t.kind));

    const ends = [view.end(), view.end()];
    view.receive(event(WebViewEventKind.Crashed));

    expect(ends).toEqual([true, false]);
    expect([view.isClosed, heard, bridge.webViewCalls]).toEqual([true, [], []]);
  });

  it("asks the main process to close the view once, however often it's closed", () => {
    const view = handle();

    view.close();
    view.close();

    expect([view.isClosed, bridge.webViewCalls]).toEqual([true, ["close notes 1"]]);
  });
});
