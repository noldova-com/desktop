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
import { WebViewAction, type WebViewAnswered, WebViewDeclaration, type WebViewEvent, WebViewInfo, WebViewPane } from "@noldova/desktop.protocol";

import { OpenWebView } from "../../src/services/open-web-view.js";
import { WebViewOriginCheck } from "../../src/services/web-view-origin-check.js";
import { Condition } from "../fixtures/condition.fixture.js";
import type { FakeWebViewContents } from "../fixtures/fake-web-view-contents.fixture.js";
import { FakeWebView } from "../fixtures/fake-web-view.fixture.js";
import { FakeWebViewSession } from "../fixtures/fake-web-view-session.fixture.js";

class FakeWaits {
  private readonly waits: Map<number, Set<() => void>> = new Map();

  public waitAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const waits = this.waits.get(milliseconds) ?? new Set<() => void>();
      this.waits.set(milliseconds, waits);
      waits.add(resolve);
      signal.addEventListener("abort", () => {
        waits.delete(resolve);
        reject(new Error("The wait was aborted."));
      }, { once: true });
    });
  }

  public count(milliseconds: number): number {
    return this.waits.get(milliseconds)?.size ?? 0;
  }

  public elapse(milliseconds: number): void {
    const waits = this.waits.get(milliseconds) ?? new Set<() => void>();
    for (const resolve of [...waits]) {
      waits.delete(resolve);
      resolve();
    }
  }
}

class OpenWebViewHarness {
  public static readonly PARTITION: string = "persist:browser.workspace-1";

  public readonly view: FakeWebView = new FakeWebView(7, 3, OpenWebViewHarness.PARTITION);
  public readonly session: FakeWebViewSession = new FakeWebViewSession();
  public readonly waits: FakeWaits = new FakeWaits();
  public readonly events: WebViewEvent[] = [];
  public readonly presses: string[] = [];
  public readonly shortcuts: string[] = [];
  public readonly inputs: string[] = [];
  public readonly lost: Promise<void>;
  public readonly open: OpenWebView;
  public time: number = 0;
  public isLost: boolean = false;
  public onInput: () => void = () => undefined;

  private markLost: () => void = () => undefined;

  public constructor(declaration: WebViewDeclaration, platform: string = "linux") {
    this.lost = new Promise(resolve => {
      this.markLost = () => {
        this.isLost = true;
        resolve();
      };
    });
    this.open = new OpenWebView(new WebViewInfo("1", "browser", WebViewPane.fromJson({ name: "browser.pane" }), "workspace-1"), 3, OpenWebViewHarness.PARTITION, this.session,
      new WebViewOriginCheck(), declaration, t => this.report(t), t => this.shortcuts.includes(t.key), t => this.press(t.key), platform,
      (t, signal) => this.waits.waitAsync(t, signal), () => this.time, () => this.markLost(), t => {
        this.inputs.push(t);
        this.onInput();
      });
  }

  public get contents(): FakeWebView["contents"] {
    return this.view.contents;
  }

  public async startAsync(): Promise<OpenWebViewHarness> {
    Assert.isTrue(await this.open.bindAsync(this.view.contents));
    this.events.length = 0;
    return this;
  }

  public describe(): string {
    return this.events.map(t => `${t.kind} ${JSON.stringify(t.details)}`).join("|");
  }

  private report(event: WebViewEvent): void {
    this.events.push(event);
  }

  private press(key: string): void {
    this.presses.push(key);
  }
}

@TestClass
export class OpenWebViewTests {
  private static readonly DECLARATION: WebViewDeclaration = WebViewDeclaration.fromJson({
    methods: [
      { name: "Page.captureScreenshot", parameters: { format: { values: ["png"] } } },
      { name: "Input.dispatchKeyEvent", parameters: { type: { required: true }, key: {}, code: {}, modifiers: {} } }
    ],
    events: ["Page.loadEventFired"]
  });
  private static readonly NEW_WINDOWS: WebViewDeclaration = new WebViewDeclaration(OpenWebViewTests.DECLARATION.methods, OpenWebViewTests.DECLARATION.events, [], true);
  private static readonly KEYS: WebViewDeclaration = WebViewDeclaration.fromJson({
    ...OpenWebViewTests.DECLARATION.toJson(),
    keys: [{ name: "reload", keys: ["Mod+R"] }]
  });
  private static readonly TEXT: WebViewDeclaration = WebViewDeclaration.fromJson({ methods: [{ name: "Input.insertText", parameters: { text: { required: true } } }] });
  private static readonly SCREENSHOT: string = "Page.captureScreenshot";
  private static readonly MOUSE: string = "Input.dispatchMouseEvent";
  private static readonly FOCUS_EMULATION: string = "Emulation.setFocusEmulationEnabled";
  private static readonly PAGE_CALLS: WebViewDeclaration = WebViewDeclaration.fromJson({
    methods: [
      { name: "Input.dispatchMouseEvent", parameters: { type: { required: true }, x: {}, y: {} } },
      { name: "DOM.focus", parameters: { backendNodeId: {} } },
      { name: "Emulation.setFocusEmulationEnabled", parameters: { enabled: { required: true } } },
      { name: "Input.dispatchKeyEvent", parameters: { type: { required: true }, key: {}, code: {}, modifiers: {} } },
      { name: "Input.insertText", parameters: { text: { required: true } } },
      { name: "Input.dispatchTouchEvent", parameters: { type: { required: true }, touchPoints: {} } },
      { name: "Input.synthesizeTapGesture", parameters: { x: { required: true }, y: { required: true } } }
    ]
  });

  private static readonly PAGE_CALLS_AND_WINDOWS: WebViewDeclaration = new WebViewDeclaration(OpenWebViewTests.PAGE_CALLS.methods, OpenWebViewTests.PAGE_CALLS.events, [], true);

  @TestMethod
  public async bindsItsPageWithoutLoadingItAndAttachesToTheProtocolWithItsDefaults(): Promise<void> {
    const harness = new OpenWebViewHarness(OpenWebViewTests.DECLARATION);
    const before = harness.open.contents;

    const isBound = await harness.open.bindAsync(harness.contents);

    Assert.isNull(before);
    Assert.isTrue(isBound);
    Assert.areEqual(String.empty, harness.contents.calls.join(","));
    Assert.areEqual("disable_non_proxied_udp", harness.contents.rtcPolicy);
    Assert.areEqual("1.3", harness.contents.debugger.versions.join(","));
    Assert.areEqual(JSON.stringify([["Page.enable", {}], ["Page.setInterceptFileChooserDialog", { enabled: true }]]),
      JSON.stringify(harness.contents.debugger.sent));
    Assert.areEqual(7, harness.open.contents?.id);
    Assert.areEqual(OpenWebViewHarness.PARTITION, harness.open.partition);
    Assert.areEqual(1, harness.open.zoom);
  }

  @TestMethod
  public async reportsTheViewLostWhenItsPageCantTakeTheProtocol(): Promise<void> {
    const harness = new OpenWebViewHarness(OpenWebViewTests.DECLARATION);
    harness.contents.debugger.isRefusingAttach = true;

    const isBound = await harness.open.bindAsync(harness.contents);

    Assert.isFalse(isBound);
    await harness.lost;
  }

  @TestMethod
  public async bindsTheSamePageOnceAndNothingAfterItCloses(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    const later = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION);

    const again = await harness.open.bindAsync(harness.contents);
    harness.open.close();
    const afterClose = await harness.open.bindAsync(later.contents);

    Assert.areEqual("true,false", [again, afterClose].join(","));
    Assert.areEqual("1.3", harness.contents.debugger.versions.join(","));
    Assert.areEqual(0, later.contents.debugger.versions.length);
    Assert.isNull(harness.open.contents);
  }

  @TestMethod
  public async answersADeclaredCommandWithTheEnginesReply(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.debugger.replies.set(OpenWebViewTests.SCREENSHOT, () => Promise.resolve({ data: "AA==", size: { width: 2 } }));

    const answer = await harness.open.sendAsync(4, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000);

    Assert.areEqual("4 {\"data\":\"AA==\",\"size\":{\"width\":2}} none", OpenWebViewTests.describe(answer));
    Assert.areEqual(0, harness.waits.count(1000));
  }

  @TestMethod
  public async refusesAReplyThatIsNotAJsonObjectAllTheWayDown(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    const replies: unknown[] = [[1, 2], "text", { size: { width: Number.NaN } }, { taken: new Date(0) }];

    const answers: string[] = [];
    for (const reply of replies) {
      harness.contents.debugger.replies.set(OpenWebViewTests.SCREENSHOT, () => Promise.resolve(reply));
      const answer = await harness.open.sendAsync(5, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000);
      answers.push(`${OpenWebViewTests.describe(answer)} ${answer.failure?.message ?? String.empty}`);
    }

    Assert.areEqual(Array.from({ length: 4 }, () => "5 null Protocol The engine's reply is not an object.").join("|"), answers.join("|"));
  }

  @TestMethod
  public async refusesACommandTheDeclarationDoesntAllowWithoutSendingIt(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const answers = [
      await harness.open.sendAsync(1, "Runtime.evaluate", { expression: "1" }, 1000),
      await harness.open.sendAsync(2, OpenWebViewTests.SCREENSHOT, { format: "jpeg" }, 1000)
    ];

    Assert.areEqual("1 null NotAllowed|2 null NotAllowed", answers.map(t => OpenWebViewTests.describe(t)).join("|"));
    Assert.areEqual("Page.enable,Page.setInterceptFileChooserDialog", harness.contents.debugger.methods().join(","));
  }

  @TestMethod
  public async sendsARelayedKeyStraightToItsPageAndNotThroughTheProtocol(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const answers = [
      await harness.open.sendAsync(1, "Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", modifiers: 9 }, 1000),
      await harness.open.sendAsync(2, "Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", modifiers: 9 }, 1000)
    ];

    Assert.areEqual("1 {} none|2 {} none", answers.map(t => OpenWebViewTests.describe(t)).join("|"));
    Assert.areEqual(JSON.stringify([{ type: "keyDown", keyCode: "Left", modifiers: ["alt", "shift"] }, { type: "keyUp", keyCode: "Left", modifiers: ["alt", "shift"] }]),
      JSON.stringify(harness.contents.inputs));
    Assert.isFalse(harness.contents.debugger.methods().includes("Input.dispatchKeyEvent"));
  }

  @TestMethod
  public async typesRelayedTextStraightIntoItsPageAndRefusesAValueThatIsNoText(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.TEXT).startAsync();

    const answer = await harness.open.sendAsync(3, "Input.insertText", { text: "héllo" }, 1000);
    const refused = await harness.open.sendAsync(4, "Input.insertText", { text: 7 }, 1000);

    Assert.areEqual("3 {} none", OpenWebViewTests.describe(answer));
    Assert.areEqual("4 null Protocol The text input names no text.", `${OpenWebViewTests.describe(refused)} ${refused.failure?.message ?? String.empty}`);
    Assert.areEqual("héllo", harness.contents.texts.join("|"));
    Assert.isFalse(harness.contents.debugger.methods().includes("Input.insertText"));
  }

  @TestMethod
  public async failsARelayedKeyItsPageCantTakeWithoutSendingAnything(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const answers = [
      await harness.open.sendAsync(1, "Input.dispatchKeyEvent", { type: "keyDown", code: "KeyA" }, 1000),
      await harness.open.sendAsync(2, "Input.dispatchKeyEvent", { type: "mouseMoved", key: "a" }, 1000)
    ];

    Assert.areEqual(Array.from({ length: 2 }, (_, t) => `${t + 1} null Protocol The key event names no key, or a type the page's input doesn't take.`).join("|"),
      answers.map(t => `${OpenWebViewTests.describe(t)} ${t.failure?.message ?? String.empty}`).join("|"));
    Assert.areEqual(0, harness.contents.inputs.length);
  }

  @TestMethod
  public async endsACommandTheEngineDoesntAnswerInTime(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.debugger.replies.set(OpenWebViewTests.SCREENSHOT, () => new Promise(() => undefined));

    const answering = harness.open.sendAsync(6, OpenWebViewTests.SCREENSHOT, { format: "png" }, 2500);
    harness.waits.elapse(2500);

    Assert.areEqual("6 null TimedOut", OpenWebViewTests.describe(await answering));
  }

  @TestMethod
  public async refusesAShortcutTheRelaySends(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.shortcuts.push("k");

    const answer = await harness.open.sendAsync(8, "Input.dispatchKeyEvent", { type: "keyDown", key: "k", code: "KeyK", modifiers: 2 }, 1000);

    Assert.areEqual("8 null ShortcutRefused", OpenWebViewTests.describe(answer));
  }

  @TestMethod
  public async endsTheCommandsInFlightAndRemovesTheViewWhenItCloses(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.debugger.replies.set(OpenWebViewTests.SCREENSHOT, () => new Promise(() => undefined));
    const answering = harness.open.sendAsync(9, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000);

    harness.open.close();
    harness.open.close();

    Assert.areEqual("9 null ViewClosed", OpenWebViewTests.describe(await answering));
    Assert.areEqual(1, harness.contents.debugger.detaches);
    Assert.isTrue(harness.contents.calls.includes("stop"));
    Assert.areEqual("1 null Unavailable", OpenWebViewTests.describe(await harness.open.sendAsync(1, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000)));
  }

  @TestMethod
  public async endsTheCommandsInFlightAndRefusesMoreWhenThePageCrashes(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.debugger.replies.set(OpenWebViewTests.SCREENSHOT, () => new Promise(() => undefined));
    const answering = harness.open.sendAsync(3, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000);

    harness.contents.emit("render-process-gone", {}, { reason: "crashed" });

    Assert.areEqual("3 null Crashed", OpenWebViewTests.describe(await answering));
    Assert.areEqual("3 null Crashed", OpenWebViewTests.describe(await harness.open.sendAsync(3, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000)));
    Assert.areEqual("Crashed {}", harness.describe());
  }

  @TestMethod
  public async attachesAgainWhenTheProtocolDetachesAndReportsTheViewLostWhenItCant(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.debugger.replies.set(OpenWebViewTests.SCREENSHOT, () => new Promise(() => undefined));
    const answering = harness.open.sendAsync(2, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000);
    harness.contents.debugger.isRefusingAttach = true;

    harness.contents.debugger.lose();

    Assert.areEqual("2 null Unavailable", OpenWebViewTests.describe(await answering));
    await harness.lost;
    Assert.areEqual("1.3", harness.contents.debugger.versions.join(","));
  }

  @TestMethod
  public async waitsForItsNextPageRatherThanReportingTheViewLostWhenItsPageClosesUnderTheProtocol(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.debugger.replies.set("Page.enable", () => Promise.reject(new Error("target closed while handling command")));

    harness.contents.debugger.lose();
    await new Promise<void>(resolve => setImmediate(resolve));

    Assert.isFalse(harness.isLost);
    Assert.isNull(harness.open.contents);
  }

  @TestMethod
  public async refusesAPageThatClosesWhileItBindsWithoutReportingTheViewLost(): Promise<void> {
    const harness = new OpenWebViewHarness(OpenWebViewTests.DECLARATION);
    harness.contents.debugger.replies.set("Page.enable", () => Promise.reject(new Error("target closed while handling command")));

    const isBound = await harness.open.bindAsync(harness.contents);

    Assert.isFalse(isBound);
    Assert.isFalse(harness.isLost);
    Assert.isNull(harness.open.contents);
  }

  @TestMethod
  public async reportsADeclaredProtocolEventOfTheTopSessionWhoseParamsAreJson(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    harness.contents.debugger.receive("Page.loadEventFired", { timestamp: 12.5, frame: { ids: ["a"] } });
    harness.contents.debugger.receive("Page.loadEventFired", { timestamp: Number.NaN });
    harness.contents.debugger.receive("Page.loadEventFired", { taken: new Date(0) });
    harness.contents.debugger.receive("Page.loadEventFired", [1]);
    harness.contents.debugger.receive("Page.loadEventFired", { timestamp: 1 }, "child-session");
    harness.contents.debugger.receive("Network.requestWillBeSent", { requestId: "1" });

    Assert.areEqual("Protocol {\"method\":\"Page.loadEventFired\",\"params\":{\"timestamp\":12.5,\"frame\":{\"ids\":[\"a\"]}},\"isCut\":false}", harness.describe());
  }

  @TestMethod
  public async refusesAFileChooserThePageOpens(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.url = "https://example.com/form";

    harness.contents.debugger.receive("Page.fileChooserOpened", { mode: "selectSingle" });

    Assert.areEqual("RequestRefused {\"request\":\"fileChooser\",\"origin\":\"https://example.com\"}", harness.describe());
  }

  @TestMethod
  public async answersAFindWithTheFinalUpdatesCount(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const finding = harness.open.findAsync("needle", true);
    harness.contents.emit("found-in-page", {}, { requestId: 1, activeMatchOrdinal: 2, matches: 5, finalUpdate: true });

    Assert.areEqual(JSON.stringify({ matches: 5, active: 2 }), JSON.stringify(await finding));
    Assert.isTrue(harness.contents.calls.includes("find 1 needle true true true"));
    Assert.areEqual("Found {\"matches\":5,\"active\":2}", harness.describe());
    Assert.areEqual(0, harness.waits.count(10_000));
  }

  @TestMethod
  public async waitsPastAnUpdateThatIsNotFinalForTheFinalOne(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const finding = harness.open.findAsync("needle", false);
    harness.contents.emit("found-in-page", {}, { requestId: 1, activeMatchOrdinal: 1, matches: 1, finalUpdate: false });
    harness.contents.emit("found-in-page", {}, { requestId: 1, activeMatchOrdinal: 1, matches: 4, finalUpdate: true });

    Assert.areEqual(JSON.stringify({ matches: 4, active: 1 }), JSON.stringify(await finding));
    Assert.areEqual("Found {\"matches\":4,\"active\":1}", harness.describe());
  }

  @TestMethod
  public async answersAFindWithNoFinalUpdateAsTimedOutRatherThanACount(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const finding = harness.open.findAsync("needle", false);
    harness.contents.emit("found-in-page", {}, { requestId: 1, activeMatchOrdinal: 1, matches: 1, finalUpdate: false });
    Assert.areEqual(1, harness.waits.count(10_000));
    harness.waits.elapse(10_000);

    Assert.areEqual(JSON.stringify({ isTimedOut: true }), JSON.stringify(await finding));
    Assert.areEqual(String.empty, harness.describe());
  }

  @TestMethod
  public async stepsTheLastSearchAndAnswersNothingFoundWithoutOne(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const withoutSearch = await harness.open.stepFindAsync(true);
    const first = harness.open.findAsync("needle", false);
    const stepping = harness.open.stepFindAsync(false);
    harness.contents.emit("found-in-page", {}, { requestId: 2, activeMatchOrdinal: 3, matches: 4, finalUpdate: true });

    Assert.areEqual(JSON.stringify({ matches: 0, active: 0 }), JSON.stringify(withoutSearch));
    Assert.areEqual(JSON.stringify([{ matches: 4, active: 3 }, { matches: 4, active: 3 }]), JSON.stringify([await first, await stepping]));
    Assert.isTrue(harness.contents.calls.includes("find 2 needle false false false"));
    Assert.areEqual(JSON.stringify({ matches: 0, active: 0 }), JSON.stringify(await harness.open.findAsync(String.empty, false)));
  }

  @TestMethod
  public async endsTheSearchWhenThePageNavigates(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const finding = harness.open.findAsync("needle", false);
    harness.contents.show("https://example.com/next");

    Assert.areEqual(JSON.stringify({ isEnded: true }), JSON.stringify(await finding));
    Assert.isTrue(harness.contents.calls.includes("stop find clearSelection"));
  }

  @TestMethod
  public async navigatesOnlyToAnAllowedOriginWhoseAddressesAreAllowed(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);
    harness.session.addresses.set("example.com", ["93.184.216.34"]);
    harness.session.addresses.set("example.org", ["10.0.0.2"]);

    const navigations = [
      await harness.open.navigateAsync("https://example.com/page"),
      await harness.open.navigateAsync("https://other.example.net/"),
      await harness.open.navigateAsync("about:blank")
    ];
    harness.open.setAllowedOrigins(["https://example.org"]);
    navigations.push(await harness.open.navigateAsync("https://example.org/"));

    Assert.areEqual(JSON.stringify([{ kind: "Started" }, { kind: "Refused", origin: "https://other.example.net" }, { kind: "Started" }, { kind: "Refused", origin: "https://example.org" }]),
      JSON.stringify(navigations));
    Assert.areEqual("load https://example.com/page,load about:blank", harness.contents.calls.join(","));
  }

  @TestMethod
  public async refusesAnAllowedOriginWhoseNameDoesntResolve(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);

    const navigation = await harness.open.navigateAsync("https://example.com/page");

    Assert.areEqual(JSON.stringify({ kind: "Refused", origin: "https://example.com" }), JSON.stringify(navigation));
    Assert.areEqual(String.empty, harness.contents.calls.join(","));
  }

  @TestMethod
  public async movesThroughAllowedHistoryAndReloadsAndStops(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);
    harness.session.addresses.set("example.com", ["93.184.216.34"]);

    const empty = await harness.open.actAsync(WebViewAction.Back);
    harness.contents.show("https://example.com/one");
    harness.contents.show("https://example.com/two");
    harness.contents.calls.length = 0;
    const back = await harness.open.actAsync(WebViewAction.Back);
    const forward = await harness.open.actAsync(WebViewAction.Forward);
    const reload = await harness.open.actAsync(WebViewAction.Reload);
    const notLoading = await harness.open.actAsync(WebViewAction.Stop);
    harness.contents.loading = true;
    const stop = await harness.open.actAsync(WebViewAction.Stop);

    Assert.areEqual(JSON.stringify([{ kind: "NoHistory" }, { kind: "Started" }, { kind: "NoHistory" }, { kind: "Started" }, { kind: "NoHistory" }, { kind: "Started" }]),
      JSON.stringify([empty, back, forward, reload, notLoading, stop]));
    Assert.areEqual("back,reload,stop", harness.contents.calls.join(","));
  }

  @TestMethod
  public async reportsTheStateOnceForEachChange(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    harness.contents.show("https://example.com/one", "One");
    harness.contents.emit("did-stop-loading");
    harness.contents.title = "Renamed";
    harness.contents.emit("page-title-updated");

    Assert.areEqual([
      "State {\"address\":\"https://example.com/one\",\"title\":\"One\",\"isLoading\":false,\"canGoBack\":false,\"canGoForward\":false}",
      "State {\"address\":\"https://example.com/one\",\"title\":\"Renamed\",\"isLoading\":false,\"canGoBack\":false,\"canGoForward\":false}"
    ].join("|"), harness.describe());
  }

  @TestMethod
  public async reportsAMainFrameLoadFailureButNotAnAbortedLoad(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    harness.contents.emit("did-fail-load", {}, -105, "ERR_NAME_NOT_RESOLVED", "https://example.com/", true);
    harness.contents.emit("did-fail-load", {}, -3, "ERR_ABORTED", "https://example.com/", true);
    harness.contents.emit("did-fail-load", {}, -105, "ERR_NAME_NOT_RESOLVED", "https://example.com/frame", false);

    Assert.areEqual("LoadFailed {\"address\":\"https://example.com/\",\"code\":-105,\"description\":\"ERR_NAME_NOT_RESOLVED\"}", harness.describe());
  }

  @TestMethod
  public async zoomsWithinItsLimitsAndReportsEachChange(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const factors = [harness.open.setZoom(9), harness.open.setZoom(5), harness.open.stepZoom(-1), harness.open.setZoom(0.1), harness.open.stepZoom(1)];

    Assert.areEqual("5,5,4,0.25,0.33", factors.join(","));
    Assert.areEqual("zoom 5,zoom 4,zoom 0.25,zoom 0.33", harness.contents.calls.filter(t => t.startsWith("zoom")).join(","));
    Assert.areEqual("Zoom {\"factor\":5}|Zoom {\"factor\":4}|Zoom {\"factor\":0.25}|Zoom {\"factor\":0.33}", harness.describe());
    Assert.areEqual(0.33, harness.open.zoom);
  }

  @TestMethod
  public async zoomsByThePlatformsZoomKeysOnly(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const prevented = [
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("=", "Equal", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("-", "Minus", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("-", "Minus", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("0", "Digit0", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("=", "Equal", false))
    ];

    Assert.areEqual("true,true,true,true,false", prevented.join(","));
    Assert.areEqual("Zoom {\"factor\":1.1}|Zoom {\"factor\":1}|Zoom {\"factor\":0.9}|Zoom {\"factor\":1}", harness.describe());
  }

  @TestMethod
  public async turnsADeclaredKeyIntoAKeyEventAndAShortcutIntoAPress(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.KEYS).startAsync();
    harness.shortcuts.push("k");

    const prevented = [
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("r", "KeyR", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("r", "KeyR", true, "keyDown", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("r", "KeyR", true, "keyUp")),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("k", "KeyK", true)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("x", "KeyX", true))
    ];

    Assert.areEqual("true,true,false,true,false", prevented.join(","));
    Assert.areEqual("Key {\"name\":\"reload\"}", harness.describe());
    Assert.areEqual("k", harness.presses.join(","));
  }

  @TestMethod
  public async asksForANewWindowOnlyWhenItsDeclaredAndTellsWhetherAPersonJustActed(): Promise<void> {
    const refusing = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    const asking = await new OpenWebViewHarness(OpenWebViewTests.NEW_WINDOWS).startAsync();

    const refused = refusing.contents.openWindow("https://example.com/new", "https://example.com/page");
    const first = asking.contents.openWindow("https://example.com/new", "https://example.com/page");
    asking.contents.emit("input-event", {}, { type: "mouseDown" });
    asking.time = 4000;
    asking.contents.openWindow("https://example.com/other");

    Assert.areEqual(JSON.stringify([{ action: "deny" }, { action: "deny" }]), JSON.stringify([refused, first]));
    Assert.areEqual("RequestRefused {\"request\":\"newWindow\",\"origin\":\"null\"}", refusing.describe());
    Assert.areEqual([
      "NewWindowRequested {\"address\":\"https://example.com/new\",\"hadRecentInput\":false,\"origin\":\"https://example.com\"}",
      "NewWindowRequested {\"address\":\"https://example.com/other\",\"hadRecentInput\":true,\"origin\":null}"
    ].join("|"), asking.describe());
  }

  @TestMethod
  public async refusesARequestOutsideItsOriginsAndAPageRedirectedToAPrivateAddress(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);

    const allowed = harness.open.allowsRequest({ id: 1, url: "https://example.com/", resourceType: "mainFrame" });
    const outside = harness.open.allowsRequest({ id: 2, url: "https://other.example.net/", resourceType: "mainFrame" });
    harness.open.noteRedirect({ id: 3, url: "https://example.com/", redirectURL: "https://example.com/next", ip: "10.0.0.2" });
    const redirected = harness.open.allowsRequest({ id: 3, url: "https://example.com/next", resourceType: "mainFrame" });
    harness.open.noteRedirect({ id: 4, url: "https://example.com/", redirectURL: "https://example.com/later", ip: "93.184.216.34" });
    const publicRedirect = harness.open.allowsRequest({ id: 4, url: "https://example.com/later", resourceType: "mainFrame" });

    Assert.areEqual("true,false,false,true", [allowed, outside, redirected, publicRedirect].join(","));
    Assert.areEqual([
      "NavigationRefused {\"address\":\"https://other.example.net/\",\"origin\":\"https://other.example.net\",\"isRedirect\":false}",
      "NavigationRefused {\"address\":\"https://example.com/next\",\"origin\":\"https://example.com\",\"isRedirect\":true}"
    ].join("|"), harness.describe());
  }

  @TestMethod
  public async refusesPermissionsTheContentsAskFor(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const certificate = harness.contents.prevent("certificate-error", "https://example.com", "ERR_CERT", {}, () => undefined);
    const login = harness.contents.prevent("login", { url: "https://example.com" }, {}, () => undefined);
    const nested = harness.contents.prevent("will-attach-webview");

    Assert.areEqual("true,true,true", [certificate, login, nested].join(","));
    Assert.areEqual("RequestRefused,RequestRefused,RequestRefused", harness.events.map(t => t.kind).join(","));
  }

  @TestMethod
  public async letsGoOfItsPageWhenItIsDestroyedAndHearsNothingMoreFromIt(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    const old = harness.contents;
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;

    old.destroyed = true;
    old.emit("destroyed");
    const without = harness.open.contents;
    const send = await harness.open.sendAsync(4, OpenWebViewTests.SCREENSHOT, { format: "png" }, 1000);
    const isBound = await harness.open.bindAsync(fresh);
    old.emit("render-process-gone", {}, { reason: "crashed" });
    old.show("https://example.com/");
    old.debugger.lose();
    const isFramePrevented = old.prevent("will-frame-navigate", "https://example.com/", true);

    Assert.isNull(without);
    Assert.isTrue(isFramePrevented);
    Assert.areEqual("4 null Unavailable", OpenWebViewTests.describe(send));
    Assert.isTrue(isBound);
    Assert.areEqual(8, harness.open.contents?.id);
    Assert.areEqual(String.empty, harness.describe());
    Assert.areEqual("1.3", fresh.debugger.versions.join(","));
  }

  @TestMethod
  public async refusesARequestForAPageDestroyedBeforeItWasLetGoOfWithoutAnOrigin(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.contents.destroyed = true;

    harness.open.refuse("permission");

    Assert.areEqual("RequestRefused {\"request\":\"permission\",\"origin\":\"null\"}", harness.describe());
  }

  @TestMethod
  public async answersWithoutAPageThatNeedsOneAndLoadsTheLatestNavigationOnceOneBinds(): Promise<void> {
    const harness = new OpenWebViewHarness(OpenWebViewTests.DECLARATION);
    harness.open.setAllowedOrigins(["https://example.com"]);
    harness.session.addresses.set("example.com", ["93.184.216.34"]);

    const acted = await harness.open.actAsync(WebViewAction.Reload);
    const found = [await harness.open.findAsync("needle", false), await harness.open.stepFindAsync(true)];
    const zoom = harness.open.setZoom(2);
    const first = harness.open.navigateAsync("https://example.com/a");
    const second = harness.open.navigateAsync("https://example.com/b");
    await harness.open.bindAsync(harness.contents);

    Assert.isNull(acted);
    Assert.areEqual("null,null", found.map(t => JSON.stringify(t)).join(","));
    Assert.areEqual(2, zoom);
    Assert.areEqual(JSON.stringify([{ kind: "Started" }, { kind: "Started" }]), JSON.stringify([await first, await second]));
    Assert.areEqual("zoom 2,load https://example.com/b", harness.contents.calls.join(","));
  }

  @TestMethod
  public async answersAWaitingNavigationWithNullWhenItClosesFirst(): Promise<void> {
    const harness = new OpenWebViewHarness(OpenWebViewTests.DECLARATION);

    const waiting = harness.open.navigateAsync("about:blank");
    harness.open.close();

    Assert.isNull(await waiting);
    Assert.isNull(await harness.open.navigateAsync("about:blank"));
  }

  @TestMethod
  public async answersANavigationWithNullWhenItClosesWhileTheAddressResolves(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);
    harness.session.addresses.set("example.com", ["93.184.216.34"]);

    const navigation = harness.open.navigateAsync("https://example.com/page");
    harness.open.close();

    Assert.isNull(await navigation);
    Assert.isFalse(harness.contents.calls.includes("load https://example.com/page"));
  }

  @TestMethod
  public async loadsItsLastAddressInANewPageAndLetsGoOfTheOldPagesProtocol(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);
    harness.session.addresses.set("example.com", ["93.184.216.34"]);
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;
    harness.contents.show("https://example.com/a");
    harness.contents.url = "about:blank";
    harness.contents.emit("did-navigate-in-page");

    await harness.open.bindAsync(fresh);

    Assert.areEqual(1, harness.contents.debugger.detaches);
    Assert.areEqual("load https://example.com/a", fresh.calls.join(","));
  }

  @TestMethod
  public async restoresTheHistoryItKeptInANewPageThatLoadedNothingInsteadOfLoadingItsAddressWhileItsDebuggerWaitsForThatPage(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = OpenWebViewTests.rendererless();

    harness.open.keep();
    OpenWebViewTests.destroy(harness);
    const before = harness.open.isRestorable;
    const navigation = harness.open.bindAsync(fresh, true);

    Assert.isTrue(before);
    Assert.isTrue(await navigation);
    Assert.areEqual("restore 0 https://example.com/a state of https://example.com/a", fresh.calls.join(","));
    Assert.isFalse(harness.open.isRestorable);
  }

  @TestMethod
  public async loadsItsAddressWhenItsRestoreFailsBeforeThePageCommittedAnythingButNotOnceItHas(): Promise<void> {
    const calls: string[] = [];
    for (const committed of [String.empty, "https://example.com/a"]) {
      const harness = await OpenWebViewTests.showAsync();
      const fresh = OpenWebViewTests.rendererless();
      fresh.restoreAnswer = () => Promise.reject(new Error("The page failed to load."));
      fresh.url = committed;
      harness.open.keep();
      OpenWebViewTests.destroy(harness);

      await harness.open.bindAsync(fresh, true);
      await Condition.waitAsync(() => fresh.calls.length > 1 || committed !== String.empty);
      await harness.open.navigateAsync("https://example.com/c");
      calls.push(fresh.calls.map(t => t.split(" ")[0]).join(" "));
    }

    Assert.areEqual("restore load load|restore load", calls.join("|"));
  }

  @TestMethod
  public async restoresNothingAndLoadsNothingOnceAHistoryActionStartedWhileItCheckedTheKeptAddress(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;
    fresh.loading = true;
    harness.open.keep();
    OpenWebViewTests.destroy(harness);

    const binding = harness.open.bindAsync(fresh, true);
    const stopped = await harness.open.actAsync(WebViewAction.Stop);
    const isBound = await binding;

    Assert.areEqual(JSON.stringify([true, { kind: "Started" }, "stop"]), JSON.stringify([isBound, stopped, fresh.calls.join(",")]));
  }

  @TestMethod
  public async loadsNotItsAddressWhenItsRestoreFailsAfterANavigationStarted(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = OpenWebViewTests.rendererless();
    let fail: (error: Error) => void = () => undefined;
    fresh.restoreAnswer = () => new Promise((_, reject) => {
      fail = reject;
    });
    harness.open.keep();
    OpenWebViewTests.destroy(harness);
    await harness.open.bindAsync(fresh, true);
    await harness.open.navigateAsync("https://example.com/c");

    fail(new Error("The restore was cut short."));
    await harness.open.navigateAsync("https://example.com/d");

    Assert.areEqual("restore 0,load https://example.com/c,load https://example.com/d", fresh.calls.map(t => t.split(" ").slice(0, 2).join(" ")).join(","));
  }

  @TestMethod
  public async loadsItsAddressRatherThanAHistoryKeptBeforeItsPageNavigatedAgain(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;

    harness.open.keep();
    harness.contents.show("https://example.com/b");
    OpenWebViewTests.destroy(harness);
    const isRestorable = harness.open.isRestorable;
    await harness.open.bindAsync(fresh, true);

    Assert.isFalse(isRestorable);
    Assert.areEqual("load https://example.com/b", fresh.calls.join(","));
  }

  @TestMethod
  public async loadsItsAddressAndDropsTheKeptHistoryInANewPageThatHasLoadedAPage(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;

    harness.open.keep();
    OpenWebViewTests.destroy(harness);
    await harness.open.bindAsync(fresh);

    Assert.areEqual("load https://example.com/a", fresh.calls.join(","));
    Assert.isFalse(harness.open.isRestorable);
  }

  @TestMethod
  public async loadsANavigationAskedForWhileItHadNoPageRatherThanTheKeptHistory(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = OpenWebViewTests.rendererless();

    harness.open.keep();
    OpenWebViewTests.destroy(harness);
    const navigation = harness.open.navigateAsync("https://example.com/c");
    await harness.open.bindAsync(fresh, true);

    Assert.areEqual(JSON.stringify({ kind: "Started" }), JSON.stringify(await navigation));
    Assert.areEqual("load https://example.com/c", fresh.calls.join(","));
  }

  @TestMethod
  public async restoresNoKeptHistoryWhoseAddressItMayNoLongerShow(): Promise<void> {
    const harness = await OpenWebViewTests.showAsync();
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;

    harness.open.keep();
    OpenWebViewTests.destroy(harness);
    harness.open.setAllowedOrigins([]);
    await harness.open.bindAsync(fresh, true);

    Assert.areEqual(String.empty, fresh.calls.join(","));
  }

  @TestMethod
  public async restoresNoKeptHistoryOnceItClosesOrWhenItsCurrentEntryIsntTheAddressItShowed(): Promise<void> {
    const unbound = new OpenWebViewHarness(OpenWebViewTests.DECLARATION);
    const elsewhere = await OpenWebViewTests.showAsync();
    const closed = await OpenWebViewTests.showAsync();

    unbound.open.keep();
    elsewhere.contents.history = ["https://example.com/a", "https://example.com/b"];
    elsewhere.contents.index = 1;
    elsewhere.open.keep();
    OpenWebViewTests.destroy(elsewhere);
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;
    await elsewhere.open.bindAsync(fresh, true);
    closed.open.keep();
    OpenWebViewTests.destroy(closed);
    closed.open.close();

    Assert.isFalse(unbound.open.isRestorable);
    Assert.areEqual("load https://example.com/a", fresh.calls.join(","));
    Assert.isFalse(closed.open.isRestorable);
  }

  @TestMethod
  public async keepsNothingFromAPageThatShowsAnotherAddressThanItCommittedOrIsGoing(): Promise<void> {
    const elsewhere = await OpenWebViewTests.showAsync();
    const going = await OpenWebViewTests.showAsync();

    elsewhere.contents.url = "https://example.com/elsewhere";
    elsewhere.open.keep();
    OpenWebViewTests.destroy(elsewhere);
    going.contents.destroyed = true;
    going.open.keep();
    OpenWebViewTests.destroy(going);

    Assert.isFalse(elsewhere.open.isRestorable);
    Assert.isFalse(going.open.isRestorable);
  }

  @TestMethod
  public async holdsThePagesFocusBeforeACallToThePageAndTellsTheWindowItEndedOnlyOnceThePagesRendererHasAnsweredARoundTripAfterIt(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    let reply: (value: unknown) => void = () => undefined;
    let roundTrip: (value: unknown) => void = () => undefined;
    const pressed = new Promise<void>(sent => {
      harness.contents.debugger.replies.set(OpenWebViewTests.MOUSE, () => new Promise(resolve => {
        reply = resolve;
        sent();
      }));
    });
    const reached = new Promise<void>(started => {
      harness.contents.onIsolated = () => {
        started();
        return new Promise(resolve => {
          roundTrip = resolve;
        });
      };
    });
    let isAnswered = false;

    const answering = harness.open.sendAsync(1, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 4, y: 5 }, 1000).finally(() => {
      isAnswered = true;
    });
    const whileSending = [...harness.inputs];
    await pressed;
    const order = harness.contents.debugger.sent.filter(t => t[0] === OpenWebViewTests.FOCUS_EMULATION || t[0] === OpenWebViewTests.MOUSE).map(t => `${t[0]} ${JSON.stringify(t[1])}`);
    reply({});
    await reached;
    const whileRoundTrip = [[...harness.inputs], [...harness.contents.isolated], isAnswered];
    roundTrip(0);
    const answer = await answering;

    Assert.areEqual("[\"Start\"]", JSON.stringify(whileSending));
    Assert.areEqual(JSON.stringify([`${OpenWebViewTests.FOCUS_EMULATION} {"enabled":true}`, `${OpenWebViewTests.MOUSE} {"type":"mousePressed","x":4,"y":5}`]), JSON.stringify(order));
    Assert.areEqual(JSON.stringify([["Start"], ["1999 0"], false]), JSON.stringify(whileRoundTrip));
    Assert.areEqual("1 {} none", OpenWebViewTests.describe(answer));
    Assert.areEqual("[\"Start\",\"End\"]", JSON.stringify(harness.inputs));
  }

  @TestMethod
  public async letsThePersonsKeysReachThePageWhileACallToThePageIsOpenTheStatedLimit(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    let roundTrip: (value: unknown) => void = () => undefined;
    const reached = new Promise<void>(started => {
      harness.contents.onIsolated = () => {
        started();
        return new Promise(resolve => {
          roundTrip = resolve;
        });
      };
    });
    const before = harness.contents.prevent("before-input-event", OpenWebViewTests.input("a", "KeyA", false));

    const answering = harness.open.sendAsync(1, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 4, y: 5 }, 1000);
    await reached;
    const during = [
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("b", "KeyB", false)),
      harness.contents.prevent("before-input-event", OpenWebViewTests.input("b", "KeyB", false, "keyUp"))
    ];
    roundTrip(0);
    await answering;

    Assert.areEqual("false|false,false", `${before}|${during.join(",")}`);
  }

  @TestMethod
  public async endsTheWindowsNoticeOfACallThatFailsOrWhoseRoundTripFailsOnlyOnceATimedOutCallLandsAndSendsNoneForKeysOrText(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    harness.contents.debugger.replies.set("DOM.focus", () => Promise.reject(new Error("No node with that id.")));
    harness.contents.onIsolated = () => Promise.reject(new Error("The frame was removed."));

    const failed = await harness.open.sendAsync(1, "DOM.focus", { backendNodeId: 9 }, 1000);
    const roundTripFailed = await harness.open.sendAsync(2, OpenWebViewTests.MOUSE, { type: "mouseMoved", x: 1, y: 1 }, 1000);
    let land: (value: unknown) => void = () => undefined;
    harness.contents.debugger.replies.set(OpenWebViewTests.MOUSE, () => new Promise(resolve => {
      land = resolve;
    }));
    harness.contents.onIsolated = () => Promise.resolve(0);
    const timing = harness.open.sendAsync(3, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 1, y: 1 }, 1000);
    harness.waits.elapse(1000);
    const timedOut = await timing;
    const afterTimeout = [...harness.inputs];
    const ended = new Promise<void>(resolve => {
      harness.onInput = () => {
        if (harness.inputs.length === 6)
          resolve();
      };
    });
    land({});
    await ended;
    await harness.open.sendAsync(4, "Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 0 }, 1000);
    await harness.open.sendAsync(5, "Input.insertText", { text: "a" }, 1000);

    Assert.areEqual("1 null Protocol|2 {} none|3 null TimedOut", [failed, roundTripFailed, timedOut].map(t => OpenWebViewTests.describe(t)).join("|"));
    Assert.areEqual(JSON.stringify(["Start", "End", "Start", "End", "Start"]), JSON.stringify(afterTimeout));
    Assert.areEqual(JSON.stringify(["Start", "End", "Start", "End", "Start", "End"]), JSON.stringify(harness.inputs));
    Assert.areEqual(3, harness.contents.isolated.length);
  }

  @TestMethod
  public async refusesAModulesFocusEmulationNamingTheRuleWhetherOrNotItIsDeclaredAndSendsNothing(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    const undeclared = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();

    const answers = [
      await harness.open.sendAsync(1, OpenWebViewTests.FOCUS_EMULATION, { enabled: false }, 1000),
      await undeclared.open.sendAsync(2, OpenWebViewTests.FOCUS_EMULATION, { enabled: true }, 1000)
    ];

    Assert.areEqual("1 null NotAllowed|2 null NotAllowed", answers.map(t => OpenWebViewTests.describe(t)).join("|"));
    const rule = "The host owns focus emulation, so a module may not send Emulation.setFocusEmulationEnabled.";
    Assert.areEqual(`${rule}|${rule}`, answers.map(t => t.failure?.message ?? "none").join("|"));
    Assert.areEqual("[]", JSON.stringify([...harness.contents.debugger.sent, ...undeclared.contents.debugger.sent].filter(t => t[0] === OpenWebViewTests.FOCUS_EMULATION)));
    Assert.areEqual("[]", JSON.stringify([...harness.inputs, ...undeclared.inputs]));
  }

  @TestMethod
  public async holdsThePagesFocusOnceForCallsToThePageNotForKeysOrTextReleasesItOnceAndHoldsItAgainAfterAReleaseAndForANewPageWhoseBindEndsTheOldPagesHold(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    const fresh = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;
    const emulations = (contents: typeof fresh): string => JSON.stringify(contents.debugger.sent.filter(t => t[0] === OpenWebViewTests.FOCUS_EMULATION).map(t => t[1]));
    const click = (call: number): Promise<WebViewAnswered> => harness.open.sendAsync(call, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 1, y: 1 }, 1000);

    await harness.open.sendAsync(1, "Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 0 }, 1000);
    await harness.open.sendAsync(2, "Input.insertText", { text: "a" }, 1000);
    const beforePageCalls = emulations(harness.contents);
    await click(3);
    await click(4);
    harness.open.releaseFocus();
    harness.open.releaseFocus();
    await click(5);
    await harness.open.bindAsync(fresh);
    const detachedOnBind = harness.contents.debugger.detaches;
    harness.open.releaseFocus();
    await click(6);
    harness.open.releaseFocus();

    Assert.areEqual("[]", beforePageCalls);
    Assert.areEqual(JSON.stringify([{ enabled: true }, { enabled: false }, { enabled: true }]), emulations(harness.contents));
    Assert.areEqual(JSON.stringify([{ enabled: true }, { enabled: false }]), emulations(fresh));
    Assert.areEqual(1, detachedOnBind);
  }

  @TestMethod
  public async sendsACallToThePageWhenThePageRefusesTheHoldTriesTheHoldAgainNextTimeForgetsARefusedReleaseAndHoldsNothingOnACrashedPage(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    const click = (call: number): Promise<WebViewAnswered> => harness.open.sendAsync(call, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 1, y: 1 }, 1000);
    harness.contents.debugger.replies.set(OpenWebViewTests.FOCUS_EMULATION, () => Promise.reject(new Error("Not supported.")));

    const refused = await click(1);
    harness.contents.debugger.replies.delete(OpenWebViewTests.FOCUS_EMULATION);
    const heldNext = await click(2);
    const releasing = new Promise<void>(reached => {
      harness.contents.debugger.replies.set(OpenWebViewTests.FOCUS_EMULATION, () => {
        reached();
        return Promise.reject(new Error("The page is gone."));
      });
    });
    harness.open.releaseFocus();
    await releasing;
    harness.contents.debugger.replies.delete(OpenWebViewTests.FOCUS_EMULATION);
    const heldAfterRelease = await click(3);
    harness.contents.emit("render-process-gone", {}, { reason: "crashed" });
    const afterCrash = await click(4);

    Assert.areEqual("1 {} none|2 {} none|3 {} none|4 null Crashed", [refused, heldNext, heldAfterRelease, afterCrash].map(t => OpenWebViewTests.describe(t)).join("|"));
    Assert.areEqual(JSON.stringify([{ enabled: true }, { enabled: true }, { enabled: false }, { enabled: true }]),
      JSON.stringify(harness.contents.debugger.sent.filter(t => t[0] === OpenWebViewTests.FOCUS_EMULATION).map(t => t[1])));
    Assert.areEqual(3, harness.contents.debugger.sent.filter(t => t[0] === OpenWebViewTests.MOUSE).length);
  }

  @TestMethod
  public async tellsTheWindowOfThePersonsPressInThePageWhileACallToThePageIsOpenButNotOfTheRelaysOwnPressOrOutsideACall(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    let roundTrip: (value: unknown) => void = () => undefined;
    const reached = new Promise<void>(started => {
      harness.contents.onIsolated = () => {
        started();
        return new Promise(resolve => {
          roundTrip = resolve;
        });
      };
    });
    harness.contents.debugger.replies.set(OpenWebViewTests.MOUSE, () => {
      harness.contents.emit("input-event", {}, { type: "mouseDown" });
      return Promise.resolve({});
    });

    harness.contents.emit("input-event", {}, { type: "mouseDown" });
    const answering = harness.open.sendAsync(1, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 1, y: 1 }, 1000);
    await reached;
    for (const type of ["mouseDown", "mouseUp", "touchStart", "rawKeyDown"])
      harness.contents.emit("input-event", {}, { type });
    roundTrip(0);
    await answering;
    harness.contents.emit("input-event", {}, { type: "mouseDown" });

    Assert.areEqual(JSON.stringify(["Start", "Press", "Press", "End"]), JSON.stringify(harness.inputs));
  }

  @TestMethod
  public async tellsTheWindowOfThePersonsPressThatLandsDuringARelayedPressOrMoveButNotOfThePressesTheRelaySent(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    const emit = (types: readonly string[]): void => {
      for (const type of types)
        harness.contents.emit("input-event", {}, { type });
    };
    const sendAsync = async (call: number, method: string, params: JsonObject, during: readonly string[], afterward: readonly string[] = []): Promise<void> => {
      harness.contents.debugger.replies.set(method, () => {
        emit(during);
        return Promise.resolve({});
      });
      harness.contents.onIsolated = () => {
        emit(afterward);
        return Promise.resolve(0);
      };
      await harness.open.sendAsync(call, method, params, 1000);
    };

    await sendAsync(1, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 1, y: 1 }, ["mouseDown", "mouseDown"]);
    await sendAsync(2, OpenWebViewTests.MOUSE, { type: "mousePressed", x: 1, y: 1 }, [], ["mouseDown"]);
    await sendAsync(3, OpenWebViewTests.MOUSE, { type: "mouseMoved", x: 1, y: 1 }, ["mouseDown"]);
    await sendAsync(4, "Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [] }, ["touchStart"]);
    await sendAsync(5, "Input.synthesizeTapGesture", { x: 1, y: 1 }, ["mouseDown"]);

    Assert.areEqual(JSON.stringify(["Start", "Press", "End", "Start", "Press", "End", "Start", "Press", "End", "Start", "End", "Start", "End"]), JSON.stringify(harness.inputs));
  }

  @TestMethod
  public async takesEachTouchPointOfARelayedTouchForTheRelaysAndCountsNoPressOfThePersonsAsRecentWhileARelayedKeyIsUnanswered(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS_AND_WINDOWS).startAsync();
    const reply = (method: string, types: readonly string[]): void => {
      harness.contents.debugger.replies.set(method, () => {
        for (const type of types)
          harness.contents.emit("input-event", {}, { type });
        return Promise.resolve({});
      });
    };
    reply("Input.dispatchTouchEvent", ["touchStart", "touchStart"]);
    reply("Input.dispatchKeyEvent", ["mouseDown"]);

    await harness.open.sendAsync(1, "Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }, 1000);
    await harness.open.sendAsync(2, "Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 0 }, 1000);
    harness.contents.openWindow("https://example.com/new");

    Assert.areEqual(JSON.stringify(["Start", "End"]), JSON.stringify(harness.inputs));
    Assert.isTrue(harness.describe().includes("\"hadRecentInput\":false"), harness.describe());
  }

  @TestMethod
  public async takesOnlyTheNewPointsOfARelayedTouchForTheRelaysSoThePersonsPressWhileAFingerIsAddedToAHeldOneIsTold(): Promise<void> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.PAGE_CALLS).startAsync();
    const sendAsync = async (call: number, type: string, touchPoints: readonly JsonObject[], during: readonly string[]): Promise<void> => {
      harness.contents.debugger.replies.set("Input.dispatchTouchEvent", () => {
        for (const event of during)
          harness.contents.emit("input-event", {}, { type: event });
        return Promise.resolve({});
      });
      await harness.open.sendAsync(call, "Input.dispatchTouchEvent", { type, touchPoints: [...touchPoints] }, 1000);
    };

    await sendAsync(1, "touchStart", [{ id: 1, x: 1, y: 1 }], ["touchStart"]);
    await sendAsync(2, "touchStart", [{ id: 1, x: 1, y: 1 }, { id: 2, x: 2, y: 2 }], ["touchStart", "touchStart"]);
    await sendAsync(3, "touchEnd", [], []);
    await sendAsync(4, "touchStart", [{ id: 1, x: 1, y: 1 }], ["touchStart", "touchStart"]);

    Assert.areEqual(JSON.stringify(["Start", "End", "Start", "Press", "End", "Start", "End", "Start", "Press", "End"]), JSON.stringify(harness.inputs));
  }

  private static describe(answer: WebViewAnswered): string {
    return `${answer.call} ${JSON.stringify(answer.value)} ${answer.failure?.kind ?? "none"}`;
  }

  private static async showAsync(): Promise<OpenWebViewHarness> {
    const harness = await new OpenWebViewHarness(OpenWebViewTests.DECLARATION).startAsync();
    harness.open.setAllowedOrigins(["https://example.com"]);
    harness.session.addresses.set("example.com", ["93.184.216.34"]);
    harness.contents.show("https://example.com/a");
    return harness;
  }

  private static rendererless(): FakeWebViewContents {
    const contents = new FakeWebView(8, 3, OpenWebViewHarness.PARTITION).contents;
    contents.debugger.replies.set("Page.enable", () => contents.started.then(() => ({})));
    return contents;
  }

  private static destroy(harness: OpenWebViewHarness): void {
    harness.contents.destroyed = true;
    harness.contents.emit("destroyed");
  }

  private static input(key: string, code: string, isControl: boolean, type: string = "keyDown", isAutoRepeat: boolean = false): JsonObject {
    return { type, key, code, isAutoRepeat, control: isControl, alt: false, shift: false, meta: false };
  }
}
