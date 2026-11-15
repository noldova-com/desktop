/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ErrorHandler, InjectionToken, Injector, inject } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/context.exceptions";
import { QualifiedName, type WebViewEvent, WebViewEventKind, WebViewNavigationKind, WebViewPane } from "@noldova/desktop.protocol";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { WebViewClosedException } from "../../../src/app/exceptions/web-view-closed.exception";
import { WebViewNotOpenedException } from "../../../src/app/exceptions/web-view-not-opened.exception";
import { ContributionMatch } from "../../../src/app/models/contribution-match";
import { Layout } from "../../../src/app/models/layout/layout";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import type { WebViewHandle } from "../../../src/app/models/web-view-handle";
import { CommandService } from "../../../src/app/services/command.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { LiveViewService } from "../../../src/app/services/live-view.service";
import { TabDragService } from "../../../src/app/services/tab-drag.service";
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

const LAYER_NAME = new InjectionToken<string>("layer name");

@Component({
  selector: "nol-test-mark",
  template: "<p class=\"nol-test-mark\">{{ name }}</p>"
})
class TestMarkComponent {
  protected readonly name: string = inject(LAYER_NAME);
}

@Component({
  selector: "nol-test-broken-mark",
  template: "<p></p>"
})
class TestBrokenMarkComponent {
  public constructor() {
    throw new Error("The mark has no activity.");
  }
}

describe("WebViewService", () => {
  const { plan, todo } = LayoutFixture;
  const pane = new WebViewPane(QualifiedName.parse("notes.note"), "plan");
  let bridge: PreloadBridgeFixture;
  let service: WebViewService;
  let liveViews: LiveViewService;
  let slot: HTMLElement;
  let host: HTMLElement;
  let errors: unknown[];

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    const parts = new WindowPartHostFixture();
    for (const tab of [plan, todo])
      parts.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    errors = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: parts },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
    const registry = LayoutFixture.createRegistry();
    await LayoutServiceFixture.prepareAsync(registry, [plan, todo].reduce((layout, tab) => layout.openDocument(tab), Layout.createDefault(registry)));
    service = TestBed.inject(WebViewService);
    liveViews = TestBed.inject(LiveViewService);
    slot = document.createElement("div");
    document.body.append(slot);
    host = document.createElement("div");
    Object.assign(host.style, { position: "fixed", left: "1.5rem", top: "2rem", width: "20rem", height: "12.5rem" });
    document.body.append(host);
    liveViews.show(plan, slot, false);
    TestBed.tick();
    bridge.webViewCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    host.remove();
    slot.remove();
    PreloadBridgeFixture.remove();
  });

  function openAsync(injector: Injector = TestBed.inject(Injector)): Promise<WebViewHandle> {
    return service.openAsync("notes", pane, plan, "workspace-1", injector);
  }

  function attach(handle: WebViewHandle, contentsId: number): void {
    handle.guest.getWebContentsId = (): number => contentsId;
    handle.guest.dispatchEvent(new Event("dom-ready"));
  }

  function rem(value: number): number {
    return value / Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function boxOf(element: Element): readonly number[] {
    const box = element.getBoundingClientRect();
    return [box.left, box.top, box.width, box.height].map(t => rem(t));
  }

  function layerInjector(): Injector {
    return Injector.create({ providers: [{ provide: LAYER_NAME, useValue: "Ada clicks Save" }], parent: TestBed.inject(Injector) });
  }

  it("opens a view for an open pane, hidden and unmounted, as a webview element in the main process's partition, and refuses a pane that isn't open or a view the main process refuses", async () => {
    const handle = await openAsync();
    TestBed.inject(LayoutService).close(todo);
    TestBed.tick();
    const closedPane = await service.openAsync("notes", new WebViewPane(QualifiedName.parse("notes.note"), "todo"), todo, "workspace-1", TestBed.inject(Injector)).catch((error: unknown) => error);
    bridge.isWebViewOpened = false;
    const refused = await openAsync().catch((error: unknown) => error);

    expect([handle.id, handle.pane.toJson(), handle.profileKey, handle.isClosed]).toEqual(["1", { name: "notes.note", instance: "plan" }, "workspace-1", false]);
    expect([handle.guest.localName, handle.guest.getAttributeNames().sort(), handle.guest.getAttribute("partition"), handle.guest.getAttribute("src")])
      .toEqual(["webview", ["allowpopups", "class", "partition", "src", "style"], "persist:notes.workspace-1", "about:blank"]);
    expect([handle.guest.parentElement, handle.frame.isConnected, handle.frame.style.visibility]).toEqual([handle.frame, false, "hidden"]);
    expect(closedPane).toBeInstanceOf(WebViewNotOpenedException);
    expect(refused).toBeInstanceOf(WebViewNotOpenedException);
    expect(bridge.webViewCalls).toEqual(["open notes {\"name\":\"notes.note\",\"instance\":\"plan\"} workspace-1", "open notes {\"name\":\"notes.note\",\"instance\":\"plan\"} workspace-1"]);
  });

  it("refuses a view the main process opened with no partition, and closes it", async () => {
    bridge.webViewPartition = " ";
    const blank = await openAsync().catch((error: unknown) => error);
    bridge.webViewPartition = 7;
    const notText = await openAsync().catch((error: unknown) => error);

    expect(blank).toBeInstanceOf(WebViewNotOpenedException);
    expect(notText).toBeInstanceOf(Error);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["close notes 1"]);
  });

  it("fills the part's element with the view, follows its size, and moves the view to another element", async () => {
    const handle = await openAsync();
    const other = document.body.appendChild(document.createElement("div"));
    Object.assign(other.style, { position: "fixed", left: "30rem", top: "1rem", width: "10rem", height: "6rem" });

    handle.mount(host);
    handle.mount(host);
    handle.show();
    const filled = [boxOf(handle.frame), boxOf(handle.guest)];
    host.style.width = "25rem";
    const grown = boxOf(handle.guest);
    handle.mount(other);
    const moved = [boxOf(handle.guest), host.childElementCount, other.childElementCount];
    other.remove();

    expect(filled).toEqual([[1.5, 2, 20, 12.5], [1.5, 2, 20, 12.5]]);
    expect(grown).toEqual([1.5, 2, 25, 12.5]);
    expect(moved).toEqual([[30, 1, 10, 6], 0, 1]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual([]);
  });

  it("shows a view while its part shows it and its pane shows, one view of a pane at a time, keeping each in place, and closes it with its pane", async () => {
    const first = await openAsync();
    const second = await openAsync();
    first.mount(host);
    second.mount(host);
    const visibility = (): string[] => [first, second].map(t => getComputedStyle(t.guest).visibility);

    first.show();
    const firstShown = visibility();
    second.show();
    const secondShown = visibility();
    liveViews.hide(plan, slot);
    TestBed.tick();
    const paneHidden = visibility();
    liveViews.show(plan, slot, false);
    TestBed.tick();
    const paneShown = visibility();
    second.hide();
    const hidden = visibility();
    const boxes = [first, second].map(t => boxOf(t.guest));
    TestBed.inject(LayoutService).close(plan);
    TestBed.tick();

    expect([firstShown, secondShown, paneHidden, paneShown, hidden]).toEqual([
      ["visible", "hidden"], ["hidden", "visible"], ["hidden", "hidden"], ["hidden", "visible"], ["hidden", "hidden"]
    ]);
    expect(boxes).toEqual([[1.5, 2, 20, 12.5], [1.5, 2, 20, 12.5]]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["close notes 1", "close notes 2"]);
    expect([first.isClosed, second.isClosed, host.childElementCount]).toEqual([true, true, 0]);
  });

  it("keeps a view's element and its page in the window while another tab of its slot shows, out of sight and inert, and shows it again with no new page", async () => {
    const handle = await openAsync();
    const content = liveViews.show(plan, slot, false).element;
    const pane = document.createElement("div");
    Object.assign(pane.style, { position: "relative", width: "20rem", height: "12.5rem" });
    content.append(pane);
    handle.mount(pane);
    attach(handle, 7);
    handle.show();
    await vi.waitFor(() => expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["attach notes 1 7"]));

    liveViews.hide(plan, slot);
    liveViews.show(todo, slot, false);
    TestBed.tick();
    const behind = [handle.frame.isConnected, handle.guest.isConnected, getComputedStyle(handle.guest).visibility, Object.isNull(handle.guest.closest("[inert]"))];
    liveViews.hide(todo, slot);
    liveViews.show(plan, slot, false);
    TestBed.tick();

    expect(behind).toEqual([true, true, "hidden", false]);
    expect([handle.frame.parentElement, getComputedStyle(handle.guest).visibility, Object.isNull(handle.guest.closest("[inert]"))]).toEqual([pane, "visible", true]);
    expect(boxOf(handle.guest).slice(2)).toEqual([20, 12.5]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["attach notes 1 7"]);
  });

  it("binds the view's page each time its element attaches, and closes a view the main process won't bind", async () => {
    const handle = await openAsync();
    const failure = new Error("attach");

    handle.mount(host);
    attach(handle, 7);
    await vi.waitFor(() => expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["attach notes 1 7"]));
    attach(handle, 9);
    await vi.waitFor(() => expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["attach notes 1 7", "attach notes 1 9"]));
    bridge.webViewAttached = Promise.reject(failure);
    attach(handle, 10);
    await vi.waitFor(() => expect(errors).toEqual([failure]));
    const afterFailure = handle.isClosed;
    bridge.webViewAttached = Promise.resolve(null);
    attach(handle, 11);
    await vi.waitFor(() => expect(handle.isClosed).toBe(true));
    attach(handle, 12);
    await Promise.resolve();

    expect(afterFailure).toBe(false);
    expect([host.childElementCount, handle.frame.isConnected]).toEqual([0, false]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["attach notes 1 7", "attach notes 1 9", "attach notes 1 10", "attach notes 1 11", "close notes 1"]);
  });

  it("lets a tab drag pass over every view and gives the views the pointer back when it ends", async () => {
    const first = await openAsync();
    first.mount(host);
    first.show();
    const drag = TestBed.inject(TabDragService);
    const pointers = (handles: readonly WebViewHandle[]): string[] => handles.map(t => getComputedStyle(t.guest).pointerEvents);
    const event = new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 10, clientY: 10, bubbles: true });
    const before = pointers([first]);

    slot.addEventListener("pointerdown", () => drag.begin(plan, event), { once: true });
    slot.dispatchEvent(event);
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: 200, clientY: 200 }));
    TestBed.tick();
    const second = await openAsync();
    second.mount(host);
    const during = pointers([first, second]);
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, button: 0, clientX: 200, clientY: 200 }));
    TestBed.tick();

    expect(before).toEqual(["auto"]);
    expect(during).toEqual(["none", "none"]);
    expect(pointers([first, second])).toEqual(["auto", "auto"]);
  });

  it("answers a view's moves, and rejects them once the view is closed or the main process no longer knows it", async () => {
    const handle = await openAsync();

    bridge.webViewAnswer = { kind: "Refused", origin: "https://example.net" };
    const refused = await handle.navigateAsync("https://example.net/");
    bridge.webViewAnswer = { kind: "NoHistory" };
    const moves = await Promise.all([handle.goBackAsync(), handle.goForwardAsync(), handle.reloadAsync(), handle.stopAsync()]);
    bridge.webViewAnswer = null;
    const unknown = await handle.reloadAsync().catch((error: unknown) => error);
    handle.close();
    handle.close();
    const closed = await Promise.all([handle.navigateAsync("https://example.com/"), handle.goBackAsync()].map(t => t.catch((error: unknown) => error)));

    expect([refused.kind, refused.origin]).toEqual([WebViewNavigationKind.Refused, "https://example.net"]);
    expect(moves.map(t => t.kind)).toEqual(Array.from({ length: 4 }, () => WebViewNavigationKind.NoHistory));
    expect([unknown, ...closed].map(t => t instanceof WebViewClosedException)).toEqual([true, true, true]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual([
      "navigate notes 1 https://example.net/", "act notes 1 Back", "act notes 1 Forward", "act notes 1 Reload", "act notes 1 Stop", "act notes 1 Reload", "close notes 1"
    ]);
  });

  it("passes each view its own events, ignores other modules' and malformed ones, and forgets and removes a view the main process closed", async () => {
    const handle = await openAsync();
    handle.mount(host);
    const heard: WebViewEvent[] = [];
    const failure = new Error("listener");
    handle.subscribe(t => heard.push(t));
    const stop = handle.subscribe(() => {
      throw failure;
    });

    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Crashed" });
    stop();
    bridge.publishWebViewEvent({ module: "notes", view: "9", kind: "Crashed" });
    bridge.publishWebViewEvent({ module: "files", view: "1", kind: "Crashed" });
    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Exploded" });
    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Closed" });
    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Crashed" });
    handle.close();

    expect(heard.map(t => `${t.module} ${t.view} ${t.kind}`)).toEqual(["notes 1 Crashed", "notes 1 Closed"]);
    expect(errors).toEqual([failure]);
    expect([handle.isClosed, host.childElementCount, bridge.webViewCalls.some(t => t.startsWith("close"))]).toEqual([true, 0, false]);
  });

  it("removes a view once when its own listener closes it on the main process's Closed event", async () => {
    const handle = await openAsync();
    handle.mount(host);
    handle.subscribe(t => {
      if (t.kind === WebViewEventKind.Closed)
        handle.close();
    });

    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Closed" });

    expect([handle.isClosed, host.childElementCount, bridge.webViewCalls.filter(t => t.startsWith("close")).length]).toEqual([true, 0, 1]);
  });

  it("closes a view whose pane closed while the main process opened it", async () => {
    const opening = openAsync();
    TestBed.inject(LayoutService).close(plan);
    const refused = await opening.catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(WebViewNotOpenedException);
    expect(bridge.webViewCalls).toEqual(["open notes {\"name\":\"notes.note\",\"instance\":\"plan\"} workspace-1", "close notes 1"]);
  });

  it("zooms a view and finds in it, rejecting a factor that isn't one and every call once the view is closed or the main process no longer knows it", async () => {
    const handle = await openAsync();

    bridge.webViewZoom = 1.1;
    const factors = await Promise.all([handle.getZoomAsync(), handle.setZoomAsync(1.1), handle.zoomInAsync(), handle.zoomOutAsync()]);
    const invalid = await Promise.all([Number.NaN, 0, -1, Number.POSITIVE_INFINITY].map(t => handle.setZoomAsync(t).catch((error: unknown) => error)));
    bridge.webViewFound = Promise.resolve({ matches: 3, active: 1 });
    const found = await Promise.all([handle.findAsync("plan"), handle.findAsync("Plan", { matchCase: true }), handle.findNextAsync(), handle.findPreviousAsync()]);
    handle.endFind();
    bridge.webViewZoom = null;
    bridge.webViewFound = Promise.resolve(null);
    const unknown = await Promise.all([handle.getZoomAsync().catch((error: unknown) => error), handle.findNextAsync().catch((error: unknown) => error)]);
    const failure = new Error("find");
    bridge.webViewFound = Promise.reject(failure);
    handle.endFind();
    await Promise.resolve();
    handle.close();
    const closed = await Promise.all([handle.zoomInAsync(), handle.findAsync("plan")].map(t => t.catch((error: unknown) => error)));
    handle.endFind();

    expect(factors).toEqual([1.1, 1.1, 1.1, 1.1]);
    expect(invalid.map(t => t instanceof ArgumentException ? t.parameterName : t)).toEqual(["factor", "factor", "factor", "factor"]);
    expect(found).toEqual(Array.from({ length: 4 }, () => ({ matches: 3, active: 1, isTimedOut: false, isEnded: false })));
    expect([...unknown, ...closed].map(t => t instanceof WebViewClosedException)).toEqual([true, true, true, true]);
    expect(errors).toEqual([failure]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual([
      "zoom notes 1 null", "zoom notes 1 1.1", "zoom notes 1 in", "zoom notes 1 out",
      "find notes 1 {\"text\":\"plan\",\"matchCase\":false}", "find notes 1 {\"text\":\"Plan\",\"matchCase\":true}", "find notes 1 \"next\"", "find notes 1 \"previous\"",
      "find notes 1 {\"text\":\"\",\"matchCase\":false}", "zoom notes 1 null", "find notes 1 \"next\"", "find notes 1 {\"text\":\"\",\"matchCase\":false}", "close notes 1"
    ]);
  });

  it("does nothing more for a closed view", async () => {
    const handle = await openAsync();

    handle.close();
    handle.mount(host);
    handle.show();
    handle.hide();

    expect([host.childElementCount, bridge.webViewCalls]).toEqual([0, ["open notes {\"name\":\"notes.note\",\"instance\":\"plan\"} workspace-1", "close notes 1"]]);
  });

  it("closes its views when the window goes", async () => {
    const handle = await openAsync();

    handle.mount(host);
    handle.show();
    TestBed.resetTestingModule();

    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["close notes 1"]);
    expect([handle.isClosed, host.childElementCount]).toEqual([true, 0]);
  });

  it("asks the main process to keep the page of each open view in the window, in its order there, before its tab moves to another group or its content leaves", async () => {
    const [first, second, unmounted, closed] = [await openAsync(), await openAsync(), await openAsync(), await openAsync()];
    second.mount(host);
    first.mount(host);
    closed.mount(host);
    closed.close();
    const layout = TestBed.inject(LayoutService);
    const keeps = (): string[] => bridge.webViewCalls.filter(t => t.startsWith("keep"));

    layout.activate(todo);
    layout.activate(plan);
    const inGroup = keeps();
    liveViews.prepareLeave(todo);
    const otherLeft = keeps();
    layout.place(plan, new SplitDropTarget(layout.layout().documents.id, PanelEdge.Right));
    const moved = keeps();
    bridge.webViewCalls.length = 0;
    liveViews.prepareLeave(plan);
    const left = keeps();

    expect([inGroup, otherLeft, moved, left, unmounted.isClosed]).toEqual([[], [], ["keep notes 2", "keep notes 1"], ["keep notes 2", "keep notes 1"], false]);
  });

  it("tells the main process a view closes while its element is still in the window, then takes the element out", async () => {
    const handle = await openAsync();
    handle.mount(host);
    const connected: boolean[] = [];
    vi.spyOn(bridge, "closeWebView").mockImplementation(() => {
      connected.push(handle.guest.isConnected);
    });

    handle.close();

    expect([connected, handle.guest.isConnected]).toEqual([[true], false]);
  });

  it("tells the main process the window's shortcut keys but Mod+Slash, which a focused page keeps", () => {
    const keys = TestBed.inject(CommandService).shortcuts().keys.map(t => t.text);

    expect([keys.includes("Mod+Slash"), bridge.webViewKeys.at(-1)]).toEqual([true, keys.filter(t => t !== "Mod+Slash")]);
  });

  it("runs a shortcut pressed in a view as one pressed in the window", () => {
    const dispatch = vi.spyOn(TestBed.inject(CommandService), "dispatch").mockReturnValue(true);

    bridge.publishWebViewShortcut({ key: "b", code: "KeyB", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false });

    expect(dispatch.mock.calls.map(([t]) => `${t.type} ${t.key} ${t.code} ${t.ctrlKey} ${t.metaKey}`)).toEqual(["keydown b KeyB true false"]);
  });

  it("opens a layer over the view with the part's component, made with the part's injector, filling the view, above it, taking no pointer, and showing and hiding with it", async () => {
    const handle = await openAsync(layerInjector());
    handle.mount(host);
    handle.show();

    const layer = await handle.openLayerAsync(() => Promise.resolve(TestMarkComponent));
    TestBed.tick();
    const element = handle.frame.querySelector(".nol-web-view-layer");
    const mark = element?.querySelector(".nol-test-mark") ?? null;
    if (Object.isNullOrUndefined(element) || Object.isNull(mark))
      throw new Error("The layer didn't open.");
    const center = handle.guest.getBoundingClientRect();
    const top = document.elementFromPoint(center.left + center.width / 2, center.top + center.height / 2);
    const shown = getComputedStyle(element).visibility;
    handle.hide();
    const hidden = getComputedStyle(element).visibility;

    expect(layer.componentRef.instance).toBeInstanceOf(TestMarkComponent);
    expect(mark.textContent).toBe("Ada clicks Save");
    expect(boxOf(element)).toEqual(boxOf(handle.guest));
    expect([handle.guest.nextElementSibling, getComputedStyle(element).pointerEvents, top]).toEqual([element, "none", handle.guest]);
    expect([shown, hidden]).toEqual(["visible", "hidden"]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual([]);
  });

  it("closes a layer once: by its close, by a second layer of the view, or by its view closing", async () => {
    const handle = await openAsync(layerInjector());
    handle.mount(host);
    const first = await handle.openLayerAsync(() => Promise.resolve(TestMarkComponent));
    let isFirstClosed = false;
    void first.closed.then(() => {
      isFirstClosed = true;
    });
    const second = await handle.openLayerAsync(() => Promise.resolve(TestMarkComponent));
    await first.closed;
    const afterSecond = handle.frame.querySelectorAll(".nol-web-view-layer").length;
    second.close();
    second.close();
    const afterClose = handle.frame.querySelectorAll(".nol-web-view-layer").length;
    const third = await handle.openLayerAsync(() => Promise.resolve(TestMarkComponent));
    handle.close();
    await third.closed;

    expect([isFirstClosed, afterSecond, afterClose, handle.frame.querySelectorAll(".nol-web-view-layer").length]).toEqual([true, 1, 0, 0]);
    expect(bridge.webViewCalls.filter(t => !t.startsWith("open"))).toEqual(["close notes 1"]);
  });

  it("rejects a layer whose view closed while its component loaded, and leaves none for a component that throws or a load that fails", async () => {
    const handle = await openAsync(layerInjector());
    const failure = new Error("load");

    const broken = await handle.openLayerAsync(() => Promise.resolve(TestBrokenMarkComponent)).catch((error: unknown) => error);
    const failed = await handle.openLayerAsync(() => Promise.reject(failure)).catch((error: unknown) => error);
    let load: (component: typeof TestMarkComponent) => void = () => undefined;
    const closing = handle.openLayerAsync(() => new Promise<typeof TestMarkComponent>(resolve => {
      load = resolve;
    }));
    handle.close();
    load(TestMarkComponent);
    const closedMeanwhile = await closing.catch((error: unknown) => error);

    expect(broken).toEqual(new Error("The mark has no activity."));
    expect(failed).toBe(failure);
    expect(closedMeanwhile).toBeInstanceOf(WebViewClosedException);
    expect(handle.frame.querySelectorAll(".nol-web-view-layer").length).toBe(0);
  });
});
