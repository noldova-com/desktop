/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Event, Failure, FailureCode, Response, ShellEvents, WebViewAction, WebViewCommand, WebViewDeclaration } from "@noldova/desktop.protocol";

import { ProfileNotClearedException } from "../../src/exceptions/profile-not-cleared.exception.js";
import { WebViewHost } from "../../src/services/web-view-host.js";
import { WebViewOriginCheck } from "../../src/services/web-view-origin-check.js";
import { Condition } from "../fixtures/condition.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import type { FakeWebView } from "../fixtures/fake-web-view.fixture.js";
import { FakeWebViewFrame } from "../fixtures/fake-web-view-frame.fixture.js";
import { FakeWebViewEngine } from "../fixtures/fake-web-view-engine.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { UnlistableKeysFixture } from "../fixtures/unlistable-keys.fixture.js";
import { UnreadableSessionEngineFixture } from "../fixtures/unreadable-session-engine.fixture.js";

@TestClass
export class WebViewHostTests {
  private static readonly PARTITION: string = "persist:browser.workspace-1";
  private static readonly PANE: JsonObject = { name: "browser.pane" };
  private static readonly ALLOWED: readonly string[] = ["https://example.com", "https://*.example.org"];
  private static readonly PNG: string = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  private static readonly DECLARATION: WebViewDeclaration = WebViewDeclaration.fromJson({
    methods: [
      { name: "Page.captureScreenshot", parameters: { format: { values: ["png"] } } },
      { name: "Input.dispatchKeyEvent", parameters: { type: { required: true }, key: {}, code: {}, modifiers: {} } }
    ],
    events: ["Page.loadEventFired"]
  });
  private static readonly NEW_WINDOWS: WebViewDeclaration = new WebViewDeclaration(WebViewHostTests.DECLARATION.methods, WebViewHostTests.DECLARATION.events, [], true);
  private static readonly KEYS: WebViewDeclaration = WebViewDeclaration.fromJson({
    ...WebViewHostTests.DECLARATION.toJson(),
    keys: [{ name: "reload", keys: ["Mod+R", "F5"], macKeys: ["Mod+R"] }, { name: "newTab", keys: ["Mod+T"] }]
  });

  private calls: number = 0;

  @TestMethod
  public async opensAViewOnTheModulesOwnProfileAndAnswersItsPartitionBeforeAnyPageAttaches(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);

    const answer = await WebViewHostTests.openUnattachedAsync(electron);
    const session = electron.webViews.session(WebViewHostTests.PARTITION);

    Assert.areEqual(JSON.stringify({ view: { id: "1", module: "browser", pane: WebViewHostTests.PANE, profileKey: "workspace-1" }, partition: WebViewHostTests.PARTITION, keys: [] }),
      JSON.stringify(answer));
    Assert.areEqual(0, electron.webViews.views.length);
    Assert.areEqual("false,false,false,true", [session.checkHandler?.(), session.deviceHandler?.(), session.askPermission(500, "media"), session.askDisplayMedia(500)].join(","));
    Assert.areEqual(JSON.stringify([{ module: "browser", view: "1", kind: "Opened", details: { pane: WebViewHostTests.PANE, profileKey: "workspace-1" } }]),
      JSON.stringify(WebViewHostTests.windowEvents(window)));
  }

  @TestMethod
  public async attachesTheWindowsPageInTheViewsPartitionWithTheHostsDefaults(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openUnattachedAsync(electron);
    const view = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    const session = electron.webViews.session(WebViewHostTests.PARTITION);

    const answer = await WebViewHostTests.attachAsync(electron, "1", view.contents.id);

    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(answer));
    Assert.areEqual("1.3", view.contents.debugger.versions.join(","));
    Assert.areEqual(JSON.stringify([["Page.enable", {}], ["Page.setInterceptFileChooserDialog", { enabled: true }]]),
      JSON.stringify(view.contents.debugger.sent));
    Assert.areEqual("disable_non_proxied_udp", view.contents.rtcPolicy);
    Assert.areEqual(String.empty, view.contents.calls.join(","));
    Assert.areEqual("false,true", [session.askPermission(view.contents.id, "media"), session.askDisplayMedia(view.contents.id)].join(","));
    Assert.areEqual(JSON.stringify([
      { module: "browser", view: "1", kind: "Opened", details: { pane: WebViewHostTests.PANE, profileKey: "workspace-1" } },
      { module: "browser", view: "1", kind: "RequestRefused", details: { request: "permission", origin: "null" } },
      { module: "browser", view: "1", kind: "RequestRefused", details: { request: "permission", origin: "null" } }
    ]), JSON.stringify(WebViewHostTests.windowEvents(window)));
  }

  @TestMethod
  public async refusesAnAttachForAnotherModuleOrViewAnUnknownPageAPageOfAnotherWindowOrPartitionOrOneAnotherViewHoldsWithoutClosingTheView(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openUnattachedAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const held = WebViewHostTests.view(electron, 0);
    const own = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    const otherWindow = electron.webViews.createGuest(window.webContents.id + 100, WebViewHostTests.PARTITION);
    const otherPartition = electron.webViews.createGuest(window.webContents.id, "persist:browser.workspace-2");
    const noWindow = electron.webViews.createGuest(null, WebViewHostTests.PARTITION);
    const untrusted = { ...MainProcessStartFixture.trustedEvent("linux"), senderFrame: null };

    const refused = [
      await WebViewHostTests.attachAsync(electron, "1", own.contents.id, "notes"),
      await WebViewHostTests.attachAsync(electron, "9", own.contents.id),
      await WebViewHostTests.attachAsync(electron, "1", 999),
      await WebViewHostTests.attachAsync(electron, "1", otherWindow.contents.id),
      await WebViewHostTests.attachAsync(electron, "1", otherPartition.contents.id),
      await WebViewHostTests.attachAsync(electron, "1", noWindow.contents.id),
      await WebViewHostTests.attachAsync(electron, "1", held.contents.id),
      await WebViewHostTests.attachAsync(electron, "1", String(own.contents.id)),
      await electron.ipcMain.invoke("desktop:webViewAttach", untrusted, "browser", "1", own.contents.id)
    ];
    const attached = await WebViewHostTests.attachAsync(electron, "1", own.contents.id);

    Assert.areEqual("null,null,null,null,null,null,null,null,null", refused.map(t => JSON.stringify(t)).join(","));
    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(attached));
    Assert.areEqual("1.3|1.3", `${own.contents.debugger.versions.join(",")}|${held.contents.debugger.versions.join(",")}`);
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
  }

  @TestMethod
  public async refusesAnAttachFromAWindowThatDidntOpenTheView(): Promise<void> {
    const engine = new FakeWebViewEngine();
    const host = new WebViewHost(engine, new WebViewOriginCheck(), () => Promise.resolve(new Map([["browser", WebViewHostTests.DECLARATION]])), "linux",
      () => undefined, () => undefined, () => undefined, () => false, () => undefined, () => undefined, () => null);
    await host.openAsync(1, "browser", WebViewHostTests.PANE, "workspace-1");
    const inOther = engine.createGuest(2, WebViewHostTests.PARTITION);
    const inOwn = engine.createGuest(1, WebViewHostTests.PARTITION);

    const fromOther = await host.attachAsync(2, "browser", "1", inOther.contents.id);
    const fromOwn = await host.attachAsync(1, "browser", "1", inOwn.contents.id);

    Assert.isNull(fromOther);
    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(fromOwn));
    Assert.areEqual(0, inOther.contents.debugger.versions.length);
  }

  @TestMethod
  public async opensNoViewForAWindowThatClosedOrReloadedWhileTheDeclarationsWereRead(): Promise<void> {
    const engine = new FakeWebViewEngine();
    const declarations = Promise.withResolvers<ReadonlyMap<string, WebViewDeclaration>>();
    const sent: string[] = [];
    const host = new WebViewHost(engine, new WebViewOriginCheck(), () => declarations.promise, "linux", (windowId, event) => sent.push(`${windowId}:${event.kind}`),
      () => undefined, () => undefined, () => false, () => undefined, () => undefined, () => null);
    const closing = host.openAsync(1, "browser", WebViewHostTests.PANE, "workspace-1");
    const other = host.openAsync(2, "browser", WebViewHostTests.PANE, "workspace-1");
    host.closeWindow(1);
    declarations.resolve(new Map([["browser", WebViewHostTests.DECLARATION]]));
    const closed = await closing;
    const opened = await other;
    const reopened = await host.openAsync(1, "browser", WebViewHostTests.PANE, "workspace-1");

    Assert.isNull(closed);
    Assert.areEqual("1", JsonReader.fromValue(opened).readObject("view").readString("id"));
    Assert.areEqual("2", JsonReader.fromValue(reopened).readObject("view").readString("id"));
    Assert.areEqual("2:Opened,1:Opened", sent.join(","));
  }

  @TestMethod
  public async passesOnAFailureOtherThanAnInvalidValueWhileReadingAnOpen(): Promise<void> {
    const host = new WebViewHost(new FakeWebViewEngine(), new WebViewOriginCheck(), () => Promise.resolve(new Map([["browser", WebViewHostTests.DECLARATION]])), "linux",
      () => undefined, () => undefined, () => undefined, () => false, () => undefined, () => undefined, () => null);

    const thrown = await Assert.throwsAsync(async () => await host.openAsync(1, "browser", new Proxy({}, new UnlistableKeysFixture()), "workspace-1"), TypeError);

    Assert.areEqual(UnlistableKeysFixture.MESSAGE, thrown.message);
  }

  @TestMethod
  public async letsAWindowHoldAWebviewOnlyInThePartitionOfAViewItHasOpen(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const id = MainProcessStartFixture.firstWindow(electron).webContents.id;
    const isAllowed = (windowId: number, partition: string): boolean => electron.webViews.isAllowed(windowId, partition);

    const before = isAllowed(id, WebViewHostTests.PARTITION);
    await WebViewHostTests.openUnattachedAsync(electron);
    const opened = [isAllowed(id, WebViewHostTests.PARTITION), isAllowed(id, "persist:browser.workspace-2"), isAllowed(id + 100, WebViewHostTests.PARTITION)];
    electron.ipcMain.send("desktop:webViewClose", MainProcessStartFixture.trustedEvent("linux"), "browser", "1");
    const closed = isAllowed(id, WebViewHostTests.PARTITION);

    Assert.areEqual("false|true,false,false|false", `${String(before)}|${opened.join(",")}|${String(closed)}`);
  }

  @TestMethod
  public async refusesAViewForAModuleWithoutWebViewsJsonAPaneItDoesntOwnAnInvalidKeyOrAnUntrustedSender(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const untrusted = { ...MainProcessStartFixture.trustedEvent("linux"), senderFrame: null };

    const refused = [
      await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, "workspace-1", "notes"),
      await WebViewHostTests.openAsync(electron, { name: "notes.page" }),
      await WebViewHostTests.openAsync(electron, { name: "browser.pane", instance: " " }),
      await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, "Workspace"),
      await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, 7),
      await electron.ipcMain.invoke("desktop:webViewOpen", untrusted, "browser", WebViewHostTests.PANE, "workspace-1")
    ];

    Assert.areEqual("null,null,null,null,null,null", refused.map(t => String(t)).join(","));
    Assert.areEqual(0, electron.webViews.views.length);
  }

  @TestMethod
  public async closesAViewWhosePageCantTakeTheDebuggerOnAttach(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.webViews.prepare = t => {
      t.contents.debugger.isRefusingAttach = true;
    };
    await WebViewHostTests.openUnattachedAsync(electron);
    const view = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);

    const answer = await WebViewHostTests.attachAsync(electron, "1", view.contents.id);

    Assert.isNull(answer);
    Assert.areEqual(1, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "A web view lost its defaults, so it was closed.").length);
  }

  @TestMethod
  public async opensNoViewWhenTheDeclarationsCantBeRead(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    process.webViewsFailure = new Error("declarations.json is missing");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);

    Assert.isNull(await WebViewHostTests.openAsync(electron));
    Assert.isNull(await WebViewHostTests.openAsync(electron));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The modules' web view declarations could not be read, so no web view opens: Error: declarations.json is missing").length);
  }

  @TestMethod
  public async holdsUpTo32ViewsInAPane(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    for (let count = 0; count < 32; count += 1)
      await WebViewHostTests.openUnattachedAsync(electron);

    const beyondLimit = await WebViewHostTests.openUnattachedAsync(electron);
    const inOtherPane = await WebViewHostTests.openUnattachedAsync(electron, { name: "browser.pane", instance: "b" });

    Assert.isNull(beyondLimit);
    Assert.areEqual("33", JsonReader.fromValue(inOtherPane).readObject("view").readString("id"));
  }

  @TestMethod
  public async keepsAViewWithoutAPageOpenAnswersWhatNeedsThePageWithoutItAndSendsACommandOnceItsPageAttaches(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openUnattachedAsync(electron);

    const answers = [
      await electron.ipcMain.invoke("desktop:webViewAct", event, "browser", "1", "Back"),
      await electron.ipcMain.invoke("desktop:webViewFind", event, "browser", "1", { text: "a", matchCase: false }),
      await electron.ipcMain.invoke("desktop:webViewFind", event, "browser", "1", "next"),
      await electron.ipcMain.invoke("desktop:webViewZoom", event, "browser", "1", 2)
    ];
    const sending = this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: { format: "png" }, timeoutMilliseconds: 1000 });
    const back = await this.commandAsync(launcher, connection, WebViewAction.Back, "1");
    const listed = await this.commandAsync(launcher, connection, WebViewAction.List);
    const view = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    await WebViewHostTests.attachAsync(electron, "1", view.contents.id);
    const send = await sending;

    Assert.areEqual("null,null,null,2", answers.map(t => JSON.stringify(t)).join(","));
    Assert.areEqual(JSON.stringify({}), JSON.stringify(send["value"]));
    Assert.isTrue(view.contents.debugger.methods().includes("Page.captureScreenshot"));
    Assert.areEqual(JSON.stringify({ kind: "Unavailable" }), JSON.stringify(back["failure"]));
    Assert.areEqual(JSON.stringify([{ id: "1", module: "browser", pane: WebViewHostTests.PANE, profileKey: "workspace-1" }]), JSON.stringify(listed["value"]));
    Assert.areEqual("zoom 2", view.contents.calls.join(","));
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
  }

  @TestMethod
  public async loadsTheLatestNavigationOnceAPageAttachesAndAnswersEveryWaitingOneThen(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openUnattachedAsync(electron);
    electron.webViews.session(WebViewHostTests.PARTITION).addresses.set("example.com", ["93.184.215.14"]);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", ["https://example.com"]);

    const first = WebViewHostTests.settled(electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://example.com/a"));
    const second = WebViewHostTests.settled(electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://example.com/b"));
    await setImmediate();
    const wereWaiting = !first.isSettled && !second.isSettled;
    const view = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    await WebViewHostTests.attachAsync(electron, "1", view.contents.id);

    Assert.isTrue(wereWaiting);
    Assert.areEqual(JSON.stringify([{ kind: "Started" }, { kind: "Started" }]), JSON.stringify([await first.answer, await second.answer]));
    Assert.areEqual("load https://example.com/b", view.contents.calls.join(","));
  }

  @TestMethod
  public async answersAWaitingNavigationAsClosedWhenTheViewClosesBeforeAPageAttaches(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openUnattachedAsync(electron);

    const byWindow = WebViewHostTests.settled(electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "about:blank"));
    const byRuntime = this.commandAsync(launcher, connection, WebViewAction.Navigate, "1", "about:blank");
    await setImmediate();
    const wasWaiting = !byWindow.isSettled;
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "1");

    Assert.isTrue(wasWaiting);
    Assert.isNull(await byWindow.answer);
    Assert.areEqual(JSON.stringify({ kind: "ViewClosed" }), JSON.stringify((await byRuntime)["failure"]));
  }

  @TestMethod
  public async answersACallWaitingForAPageAsProfileClearedWhenTheViewsProfileIsClearedBeforeAPageAttaches(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openUnattachedAsync(electron);

    const sending = this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: {}, timeoutMilliseconds: 10000 });
    await setImmediate();
    const cleared = await this.commandAsync(launcher, connection, WebViewAction.ClearProfile, null, "workspace-1");

    Assert.areEqual(JSON.stringify({ kind: "ProfileCleared" }), JSON.stringify((await sending)["failure"]));
    Assert.isUndefined(cleared["failure"]);
  }

  @TestMethod
  public async closesOnlyAViewItKnowsByItsModuleAndId(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openUnattachedAsync(electron);

    electron.ipcMain.send("desktop:webViewClose", event, "notes", "1");
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "2");
    electron.ipcMain.send("desktop:webViewClose", event, "browser", 1);
    const before = WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length;
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "1");

    Assert.areEqual(0, before);
    Assert.areEqual("1", WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(","));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async closesAWindowsViewsWhenItsPageLoadsAgainButNotWhenAFrameLoadsOrThePageMovesInItsDocument(isMainFrame: boolean): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openUnattachedAsync(electron);

    window.webContents.startFrameLoading(isMainFrame);
    const before = WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length;
    window.webContents.startLoading();

    Assert.areEqual(0, before);
    Assert.areEqual("1", WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(","));
  }

  @TestMethod
  public async closesAViewTheOldPageOpensBetweenItsNavigationsStartAndCommitAndKeepsTheNewPagesViews(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);

    window.webContents.startLoading();
    await WebViewHostTests.openUnattachedAsync(electron);
    const beforeCommit = WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length;
    window.webContents.commitLoading();
    await WebViewHostTests.openUnattachedAsync(electron);
    window.webContents.commitLoading(pathToFileURL(join(tmpdir(), "dropped.txt")).href);

    Assert.areEqual(0, beforeCommit);
    Assert.areEqual("1", WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(","));
  }

  @TestMethod
  public async keepsAWindowsViewsWhenItsPageStartsANavigationTheWindowRefuses(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openUnattachedAsync(electron);

    window.webContents.startLoading(pathToFileURL(join(tmpdir(), "dropped.txt")).href);
    const refused = WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length;
    window.webContents.startLoading();

    Assert.areEqual(0, refused);
    Assert.areEqual("1", WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(","));
  }

  @TestMethod
  public async bindsANewPageInPlaceOfTheOldOneAndLoadsTheLastAddressAgain(): Promise<void> {
    const [electron, launcher, connection, process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const old = WebViewHostTests.view(electron, 0);
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    session.addresses.set("example.com", ["93.184.215.14"]);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", ["https://example.com"]);
    old.contents.show("https://example.com/a", "A");
    const fresh = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);

    const answer = await WebViewHostTests.attachAsync(electron, "1", fresh.contents.id);
    old.contents.show("https://example.com/stale", "Stale");
    const fromOld = session.request({ id: 1, url: "https://example.com/late", webContentsId: old.contents.id, resourceType: "mainFrame" });
    const fromFresh = session.request({ id: 2, url: "https://example.com/a", webContentsId: fresh.contents.id, resourceType: "mainFrame" });

    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(answer));
    Assert.areEqual(1, old.contents.debugger.detaches);
    Assert.areEqual("load https://example.com/a", fresh.contents.calls.join(","));
    Assert.areEqual("1.3", fresh.contents.debugger.versions.join(","));
    Assert.areEqual("false,true", [fromOld, fromFresh].join(","));
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "A page load was refused").length);
    Assert.isFalse(WebViewHostTests.windowEvents(window).some(t => t["kind"] === "Closed" || JSON.stringify(t).includes("stale")));
  }

  @TestMethod
  public async restoresEachKeptViewTheWindowExpectsInTheNextWebviewOfItsProfileInTheOrderTheWindowExpectsThem(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const [first, second] = [WebViewHostTests.view(electron, 0), WebViewHostTests.view(electron, 1)];
    electron.webViews.session(WebViewHostTests.PARTITION).addresses.set("example.com", ["93.184.215.14"]);
    for (const view of ["1", "2"])
      await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, view, ["https://example.com"]);
    first.contents.show("https://example.com/a");
    second.contents.show("https://example.com/b");
    const answers = await WebViewHostTests.keepAsync(electron, [["browser", "1"], ["browser", "2"], ["browser", "3"]]);
    for (const view of [first, second]) {
      view.contents.destroyed = true;
      view.contents.emit("destroyed");
    }
    const unexpected = electron.webViews.claim(window.webContents.id, WebViewHostTests.PARTITION);
    const expected = ["2", "1", "3", "2"].map(t => WebViewHostTests.expect(electron, t));

    const claims: boolean[] = [unexpected];
    const guests = [0, 1].map(() => electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION));
    for (const guest of guests) {
      claims.push(electron.webViews.claim(window.webContents.id, WebViewHostTests.PARTITION));
      electron.webViews.attached(window.webContents.id, guest.contents);
    }
    claims.push(electron.webViews.claim(window.webContents.id, WebViewHostTests.PARTITION));
    await Condition.waitAsync(() => guests.every(t => t.contents.calls.some(u => u.startsWith("restore"))));
    const attached = await WebViewHostTests.attachAsync(electron, "2", guests[0]?.contents.id);

    Assert.areEqual("[true,true,false]", JSON.stringify(answers));
    Assert.areEqual("true,true,false,false", expected.join(","));
    Assert.areEqual("false,true,true,false", claims.join(","));
    Assert.areEqual("restore 0 https://example.com/b state of https://example.com/b|restore 0 https://example.com/a state of https://example.com/a",
      guests.map(t => t.contents.calls.join(",")).join("|"));
    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(attached));
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
  }

  @TestMethod
  public async restoresAKeptViewInTheWebviewItsWindowExpectsBeforeItsOldPageIsDestroyedSoBackStillGoesBack(): Promise<void> {
    const [electron, launcher, connection, process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const old = WebViewHostTests.view(electron, 0);
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    session.addresses.set("example.com", ["93.184.215.14"]);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", ["https://example.com"]);
    for (const page of ["a", "b", "c"])
      old.contents.show(`https://example.com/${page}`);
    const kept = await WebViewHostTests.keepAsync(electron, [["browser", "1"]]);
    const expected = WebViewHostTests.expect(electron, "1");

    const guest = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    const claimed = electron.webViews.claim(window.webContents.id, WebViewHostTests.PARTITION);
    electron.webViews.attached(window.webContents.id, guest.contents);
    const fromOld = session.request({ id: 1, url: "https://example.com/late", webContentsId: old.contents.id, resourceType: "mainFrame" });
    old.contents.destroyed = true;
    old.contents.emit("destroyed");
    const attached = await WebViewHostTests.attachAsync(electron, "1", guest.contents.id);
    await Condition.waitAsync(() => guest.contents.history.length > 0 || guest.contents.calls.some(t => t.startsWith("load")));
    const back = await electron.ipcMain.invoke("desktop:webViewAct", MainProcessStartFixture.trustedEvent("linux"), "browser", "1", "Back");

    Assert.areEqual(JSON.stringify([[true], true, true]), JSON.stringify([kept, expected, claimed]));
    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(attached));
    Assert.areEqual(JSON.stringify({ kind: "Started" }), JSON.stringify(back));
    Assert.isFalse(fromOld);
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "A page load was refused").length);
    Assert.areEqual(`restore 2 ${["a", "b", "c"].map(t => `https://example.com/${t} state of https://example.com/${t}`).join(" ")},back`, guest.contents.calls.join(","));
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
  }

  @TestMethod
  public async tellsOnlyTheWindowWhenAViewIsMarkedControlledAndKeepsTheMarkThroughAPlacementAndARuntimeRestartUntilTheViewCloses(): Promise<void> {
    const [first, second] = [new FakeRuntimeConnection(), new FakeRuntimeConnection()];
    const launcher = new FakeRuntimeLauncher(first, second);
    const [electron] = await WebViewHostTests.startWithAsync(launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const marks = (): string => WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Controlled").map(t => String(WebViewHostTests.details(t)["isControlled"])).join(",");

    const answers = [await this.commandAsync(launcher, first, WebViewAction.SetControlled, "1", true), await this.commandAsync(launcher, first, WebViewAction.SetControlled, "1", true)];
    const marked = marks();
    const kept = await WebViewHostTests.keepAsync(electron, [["browser", "1"]]);
    const expected = WebViewHostTests.expect(electron, "1");
    const guest = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    const attached = await WebViewHostTests.attachAsync(electron, "1", guest.contents.id);
    const placed = marks();
    launcher.listener?.onDisconnected(null);
    answers.push(await this.commandAsync(launcher, second, WebViewAction.SetControlled, "1", true));
    const restarted = marks();
    answers.push(await this.commandAsync(launcher, second, WebViewAction.SetControlled, "1", false));
    answers.push(await this.commandAsync(launcher, second, WebViewAction.SetControlled, "1", true));
    electron.ipcMain.send("desktop:webViewClose", MainProcessStartFixture.trustedEvent("linux"), "browser", "1");
    answers.push(await this.commandAsync(launcher, second, WebViewAction.SetControlled, "1", false));

    Assert.areEqual(JSON.stringify([null, null, null, null, null, { kind: "ViewClosed" }]), JSON.stringify(answers.map(t => t["value"] ?? t["failure"])));
    Assert.areEqual("true|true|true|true,false,true", [marked, placed, restarted, marks()].join("|"));
    Assert.areEqual(JSON.stringify([[true], true, { isAttached: true }]), JSON.stringify([kept, expected, attached]));
    Assert.isFalse([...WebViewHostTests.runtimeEvents(first), ...WebViewHostTests.runtimeEvents(second)].some(t => t["kind"] === "Controlled"));
    Assert.areEqual(1, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
  }

  @TestMethod
  public async readsTheScrollOfEveryViewOfAMoveAtOnceSoTheWindowWaitsForOneBoundWhenNoPageAnswers(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const clock = electron.webViews.clock;
    for (const [index, url] of [[0, "https://example.com/a"], [1, "https://example.com/b"]] as const) {
      const view = WebViewHostTests.view(electron, index);
      view.contents.show(url);
      view.contents.debugger.replies.set("Page.getLayoutMetrics", () => new Promise(() => undefined));
    }
    const event = MainProcessStartFixture.trustedEvent("linux");

    electron.ipcMain.send("desktop:webViewKeep", event, [["browser", "1"], ["browser", "2"]]);
    await Condition.waitAsync(() => clock.waits.filter(t => t === 500).length === 2);
    const before = event.returnValue;
    clock.advance(500);
    await Condition.waitAsync(() => !Object.isUndefined(event.returnValue));

    Assert.areEqual(JSON.stringify([null, 2, [true, true], 500]), JSON.stringify([before ?? null, clock.waits.filter(t => t === 500).length, event.returnValue, clock.now()]));
  }

  @TestMethod
  public async claimsNoWebviewForAViewThatIsClosedOrIsInAnotherWindowAndBindsNoUnclaimedOneOrOneOfAnotherWindow(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const [live, closing] = [WebViewHostTests.view(electron, 0), WebViewHostTests.view(electron, 1)];
    live.contents.show("https://example.com/a");
    closing.contents.show("https://example.com/b");
    const untrusted = { ...MainProcessStartFixture.trustedEvent("linux"), senderFrame: null };
    electron.ipcMain.send("desktop:webViewKeep", untrusted, [["browser", "1"]]);
    const malformed = [await WebViewHostTests.keepAsync(electron, "browser"), await WebViewHostTests.keepAsync(electron, ["1", ["browser"]])];
    const answers = [untrusted.returnValue, await WebViewHostTests.keepAsync(electron, [["browser", "1"], ["browser", "2"]])];
    electron.ipcMain.send("desktop:webViewExpect", untrusted, "browser", "1");
    answers.push(untrusted.returnValue, WebViewHostTests.expect(electron, "1"), WebViewHostTests.expect(electron, "2"));
    closing.contents.destroyed = true;
    closing.contents.emit("destroyed");
    electron.ipcMain.send("desktop:webViewClose", MainProcessStartFixture.trustedEvent("linux"), "browser", "2");

    const claims = [electron.webViews.claim(window.webContents.id + 1, WebViewHostTests.PARTITION)];
    const stray = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    electron.webViews.attached(window.webContents.id, stray.contents);
    claims.push(electron.webViews.claim(window.webContents.id, WebViewHostTests.PARTITION));
    electron.webViews.attached(window.webContents.id + 1, stray.contents);
    claims.push(electron.webViews.claim(window.webContents.id, WebViewHostTests.PARTITION));

    Assert.areEqual("[[],[false,false]]", JSON.stringify(malformed));
    Assert.areEqual("false,true,true,false,true,true", answers.join(","));
    Assert.areEqual("false,true,false", claims.join(","));
    Assert.areEqual(String.empty, stray.contents.calls.join(","));
  }

  @TestMethod
  public async letsGoOfADestroyedPageWithoutClosingTheViewAndTakesTheNextOneForTheCommandsThatWait(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const gone = WebViewHostTests.view(electron, 0);

    gone.contents.destroyed = true;
    gone.contents.emit("destroyed");
    const sending = this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: { format: "png" }, timeoutMilliseconds: 1000 });
    const listed = await this.commandAsync(launcher, connection, WebViewAction.List);
    const fresh = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    const answer = await WebViewHostTests.attachAsync(electron, "1", fresh.contents.id);
    const send = await sending;

    Assert.areEqual(JSON.stringify({}), JSON.stringify(send["value"]));
    Assert.isFalse(gone.contents.debugger.methods().includes("Page.captureScreenshot"));
    Assert.isTrue(fresh.contents.debugger.methods().includes("Page.captureScreenshot"));
    Assert.areEqual(1, JsonReader.fromValue(listed).readObjectArray("value").length);
    Assert.areEqual(JSON.stringify({ isAttached: true }), JSON.stringify(answer));
    Assert.areEqual(0, gone.contents.debugger.detaches);
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
  }

  @TestMethod
  public async navigatesOnlyToAnAllowedOriginWhoseNameResolvesToAddressesTheCheckAllows(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const view = WebViewHostTests.view(electron, 0);
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    session.addresses.set("example.com", ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"]);
    session.addresses.set("a.example.org", ["10.0.0.5"]);

    const beforeOrigins = await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://example.com/");
    const set = await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", [...WebViewHostTests.ALLOWED, "https://93.184.215.14"]);
    const answers = [
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://example.com/docs"),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://93.184.215.14/"),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://a.example.org/"),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://b.example.org/"),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://example.net/"),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "about:blank"),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", 7),
      await electron.ipcMain.invoke("desktop:webViewNavigate", event, "notes", "1", "https://example.com/")
    ];
    const byRuntime = await this.commandAsync(launcher, connection, WebViewAction.Navigate, "1", "https://example.com/runtime");

    Assert.areEqual(JSON.stringify({ kind: "Refused", origin: "https://example.com" }), JSON.stringify(beforeOrigins));
    Assert.areEqual(JSON.stringify({ call: this.calls - 1 }), JSON.stringify(set));
    Assert.areEqual(JSON.stringify([
      { kind: "Started" },
      { kind: "Started" },
      { kind: "Refused", origin: "https://a.example.org" },
      { kind: "Refused", origin: "https://b.example.org" },
      { kind: "Refused", origin: "https://example.net" },
      { kind: "Started" },
      null,
      null
    ]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify({ call: this.calls, value: { kind: "Started" } }), JSON.stringify(byRuntime));
    Assert.areEqual("load https://example.com/docs,load https://93.184.215.14/,load about:blank,load https://example.com/runtime", view.contents.calls.join(","));
  }

  @TestMethod
  public async refusesAnAllowedOriginsEntryThatIsNotAnOrigin(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);

    const answer = await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", ["https://example.com/path"]);

    Assert.areEqual(JSON.stringify({ call: this.calls, failure: { kind: "NotAllowed" } }), JSON.stringify(answer));
  }

  @TestMethod
  public async movesThroughTheHistoryReloadsAndStopsOrAnswersThatThereIsNoHistory(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const view = WebViewHostTests.view(electron, 0);
    electron.webViews.session(WebViewHostTests.PARTITION).addresses.set("example.com", ["93.184.215.14"]);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", ["https://example.com"]);

    const act = async (action: string): Promise<unknown> => electron.ipcMain.invoke("desktop:webViewAct", event, "browser", "1", action);
    const empty = [await act("Back"), await act("Forward"), await act("Reload"), await act("Stop"), await act("open")];
    view.contents.show("https://example.com/a");
    view.contents.show("https://example.net/b");
    view.contents.show("https://example.com/c");
    view.contents.index = 1;
    view.contents.url = "https://example.net/b";
    view.contents.loading = true;
    const moved = [await act("Back"), await act("Forward"), await act("Reload"), await act("Stop")];
    view.contents.index = 2;
    view.contents.url = "https://example.com/c";
    const fromLast = [await act("Back"), await act("Reload")];
    const byRuntime = await this.commandAsync(launcher, connection, WebViewAction.Forward, "1");

    Assert.areEqual(JSON.stringify([{ kind: "NoHistory" }, { kind: "NoHistory" }, { kind: "NoHistory" }, { kind: "NoHistory" }, null]), JSON.stringify(empty));
    Assert.areEqual(JSON.stringify([{ kind: "Started" }, { kind: "Started" }, { kind: "Refused", origin: "https://example.net" }, { kind: "Started" }]), JSON.stringify(moved));
    Assert.areEqual(JSON.stringify([{ kind: "Refused", origin: "https://example.net" }, { kind: "Started" }]), JSON.stringify(fromLast));
    Assert.areEqual(JSON.stringify({ call: this.calls, value: { kind: "NoHistory" } }), JSON.stringify(byRuntime));
    Assert.areEqual("back,forward,stop,reload", view.contents.calls.join(","));
  }

  @TestMethod
  public async checksEveryRequestOfTheProfileAndReportsARefusedPage(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contentsId = WebViewHostTests.view(electron, 0).contents.id;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", [...WebViewHostTests.ALLOWED]);

    const passes = [
      session.request({ id: 1, url: "https://example.com/", webContentsId: contentsId, resourceType: "mainFrame" }),
      session.request({ id: 2, url: "https://cdn.example.net/app.js", webContentsId: contentsId, resourceType: "script" }),
      session.request({ id: 3, url: "https://a.example.org/frame", webContentsId: contentsId, resourceType: "subFrame" }),
      session.request({ id: 4, url: "https://example.net/", webContentsId: contentsId, resourceType: "mainFrame" }),
      session.request({ id: 5, url: "https://example.net/frame", webContentsId: contentsId, resourceType: "subFrame" }),
      session.request({ id: 6, url: "http://192.168.1.1/a.png", webContentsId: contentsId, resourceType: "image" }),
      session.request({ id: 7, url: "https://example.com/", resourceType: "mainFrame" }),
      session.request({ id: 8, url: "https://example.com/", webContentsId: 999, resourceType: "mainFrame" }),
      session.sendHeaders({ id: 9, url: "https://example.com/sw.js", webContentsId: contentsId, resourceType: "script", requestHeaders: { "Service-Worker": "script" } }),
      session.sendHeaders({ id: 10, url: "https://example.com/a.js", webContentsId: contentsId, resourceType: "script", requestHeaders: {} })
    ];

    Assert.areEqual("true,true,true,false,false,false,false,false,false,true", passes.join(","));
    Assert.areEqual(JSON.stringify([{ module: "browser", view: "1", kind: "NavigationRefused", details: { address: "https://example.net/", origin: "https://example.net", isRedirect: false } }]),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "NavigationRefused")));
  }

  @TestMethod
  public async fetchesAPagesIconThroughItsProfileLettingOnlyThatRequestPassWhileItRunsAndReportsItAndAnIconlessPageToTheWindowAlone(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", [...WebViewHostTests.ALLOWED]);
    session.addresses.set("example.com", ["93.184.215.14"]);
    session.icons.set("https://example.com/favicon.ico", new Uint8Array([1, 2, 3]));
    contents.onIsolated = () => Promise.resolve(WebViewHostTests.PNG);
    const icons = (): readonly unknown[] => WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Favicon").map(t => WebViewHostTests.details(t)["image"]);

    const before = session.request({ id: 1, url: "https://example.com/favicon.ico", resourceType: "other" });
    contents.emit("page-favicon-updated", {}, ["https://example.com/favicon.ico"]);
    await Condition.waitAsync(() => icons().length === 1);
    const after = session.request({ id: 2, url: "https://example.com/favicon.ico", resourceType: "other" });
    contents.emit("did-navigate");
    contents.emit("did-stop-loading");

    Assert.areEqual("false,false", [before, after].join(","));
    Assert.areEqual("https://example.com/favicon.ico allowed", session.iconReads.join(","));
    Assert.areEqual(JSON.stringify([`data:image/png;base64,${WebViewHostTests.PNG}`, null]), JSON.stringify(icons()));
    Assert.isFalse(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Favicon"));
  }

  @TestMethod
  public async refusesEveryLoopbackPortUntilTheRuntimesBlockedPortsArriveThenRefusesThemEvenWhenAllowedAndAcknowledgesEachNewerList(): Promise<void> {
    const [first, second] = [new FakeRuntimeConnection(), new FakeRuntimeConnection()];
    const read = Promise.withResolvers<Response>();
    first.deferred.set("desktop.readWebViewBlockedPorts", () => read.promise);
    second.answers.set("desktop.readWebViewBlockedPorts", Response.success("r", { serial: 1, ports: [4700] }));
    const launcher = new FakeRuntimeLauncher(first, second);
    const [electron] = await WebViewHostTests.startWithAsync(launcher);
    await WebViewHostTests.openAsync(electron);
    await this.commandAsync(launcher, first, WebViewAction.SetAllowedOrigins, "1", ["http://127.0.0.1:4600", "http://127.0.0.1:4700"]);
    const passes = (): string => WebViewHostTests.loopbackPasses(electron, [4600, 4700]);

    const beforeTheList = passes();
    read.resolve(Response.success("r", { serial: 2, ports: [4600] }));
    await Condition.waitAsync(() => WebViewHostTests.portAcknowledgements(first).length === 1);
    const fromTheRead = passes();
    launcher.listener?.onEvent(new Event(ShellEvents.webViewBlockedPorts, { serial: 3, ports: [4700] }));
    await Condition.waitAsync(() => WebViewHostTests.portAcknowledgements(first).length === 2);
    const fromTheEvent = passes();
    launcher.listener?.onEvent(new Event(ShellEvents.webViewBlockedPorts, { serial: 1, ports: [] }));
    await setImmediate();
    const afterAnOlderList = passes();
    launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => WebViewHostTests.portAcknowledgements(second).length === 1);
    const fromTheNextRuntime = passes();

    Assert.areEqual("false,false|false,true|true,false|true,false|true,false", [beforeTheList, fromTheRead, fromTheEvent, afterAnOlderList, fromTheNextRuntime].join("|"));
    Assert.areEqual("{\"serial\":2,\"ports\":[4600]},{\"serial\":3,\"ports\":[4700]}", WebViewHostTests.portAcknowledgements(first).join(","));
    Assert.areEqual("{\"serial\":1,\"ports\":[4700]}", WebViewHostTests.portAcknowledgements(second).join(","));
  }

  @TestMethod
  public async takesBlockedPortsOnlyFromTheConnectedRuntimeSoTheNextRuntimeAfterAnUpdateHasItsOwnApplied(): Promise<void> {
    const [first, second] = [new FakeRuntimeConnection(), new FakeRuntimeConnection()];
    const read = Promise.withResolvers<Response>();
    first.deferred.set("desktop.readWebViewBlockedPorts", () => read.promise);
    second.answers.set("desktop.readWebViewBlockedPorts", Response.success("r", { serial: 1, ports: [4700] }));
    const launcher = new FakeRuntimeLauncher(first, second);
    const [electron] = await WebViewHostTests.startWithAsync(launcher);
    await WebViewHostTests.openAsync(electron);
    await this.commandAsync(launcher, first, WebViewAction.SetAllowedOrigins, "1", ["http://127.0.0.1:4600", "http://127.0.0.1:4700"]);
    const passes = (): string => WebViewHostTests.loopbackPasses(electron, [4600, 4700]);

    launcher.listener?.onEvent(new Event(ShellEvents.updating, null));
    launcher.listener?.onEvent(new Event(ShellEvents.webViewBlockedPorts, { serial: 5, ports: [4600] }));
    await setImmediate();
    const whileUpdating = passes();
    const window = MainProcessStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => window.webContents.sent.some(t => t[0] === "desktop:updateSaveRequest"));
    const saveRequest = window.webContents.sent.find(t => t[0] === "desktop:updateSaveRequest");
    await electron.ipcMain.invoke("desktop:updateSaveAnswer", MainProcessStartFixture.trustedEvent("linux"), saveRequest?.[1], []);
    launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => WebViewHostTests.portAcknowledgements(second).length === 1);
    const fromTheNextRuntime = passes();
    read.resolve(Response.success("r", { serial: 9, ports: [4600] }));
    await setImmediate();
    const afterTheOldRuntimesLateAnswer = passes();

    Assert.areEqual("false,false|true,false|true,false", [whileUpdating, fromTheNextRuntime, afterTheOldRuntimesLateAnswer].join("|"));
    Assert.areEqual(0, WebViewHostTests.portAcknowledgements(first).length);
    Assert.areEqual("{\"serial\":1,\"ports\":[4700]}", WebViewHostTests.portAcknowledgements(second).join(","));
  }

  @TestMethod
  public async keepsRefusingEveryLoopbackPortAndLogsBlockedPortsItCannotReadOrThatAreNotValid(): Promise<void> {
    const [failing, empty] = [new FakeRuntimeConnection(), new FakeRuntimeConnection()];
    failing.answers.set("desktop.readWebViewBlockedPorts", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is busy.")));
    empty.answers.set("desktop.readWebViewBlockedPorts", Response.success("r", null));
    const launcher = new FakeRuntimeLauncher(failing);
    const [electron, process] = await WebViewHostTests.startWithAsync(launcher);
    const [, emptyProcess] = await WebViewHostTests.startWithAsync(new FakeRuntimeLauncher(empty));
    await WebViewHostTests.openAsync(electron);
    await this.commandAsync(launcher, failing, WebViewAction.SetAllowedOrigins, "1", ["http://127.0.0.1:4700"]);
    launcher.listener?.onEvent(new Event(ShellEvents.webViewBlockedPorts, { serial: 2, ports: [0] }));
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The runtime sent blocked loopback ports that are not valid, so they were not acknowledged: ").length === 1);
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(emptyProcess, "The runtime's blocked loopback ports could not be read").length === 1);

    Assert.areEqual("false", WebViewHostTests.loopbackPasses(electron, [4700]));
    Assert.areEqual(0, WebViewHostTests.portAcknowledgements(failing).length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime's blocked loopback ports could not be read, so web views refuse every loopback address: The runtime is busy.").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(emptyProcess, "The runtime's blocked loopback ports could not be read, so web views refuse every loopback address: null").length);
  }

  @TestMethod
  public async logsARefusedPageLoadWhoseWebContentsBelongToNoViewItOpenedButNoOtherRefusal(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const closedId = WebViewHostTests.view(electron, 0).contents.id;
    const contentsId = WebViewHostTests.view(electron, 1).contents.id;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    electron.ipcMain.send("desktop:webViewClose", MainProcessStartFixture.trustedEvent("linux"), "browser", "1");

    const passes = [
      session.request({ id: 1, url: "https://example.com/next", webContentsId: 999, resourceType: "mainFrame" }),
      session.request({ id: 2, url: "https://example.com/app.js", webContentsId: 999, resourceType: "script" }),
      session.request({ id: 3, url: "https://example.com/", resourceType: "mainFrame" }),
      session.request({ id: 4, url: "https://example.net/", webContentsId: contentsId, resourceType: "mainFrame" }),
      session.request({ id: 5, url: "https://example.com/late", webContentsId: closedId, resourceType: "mainFrame" })
    ];

    Assert.areEqual("stop|", [WebViewHostTests.view(electron, 0).contents.calls.join(","), WebViewHostTests.view(electron, 1).contents.calls.join(",")].join("|"));
    Assert.areEqual("false,false,false,false,false", passes.join(","));
    Assert.areEqual("A page load was refused because its web contents 999 belong to no web view Noldova Desktop opened: https://example.com/next",
      MainProcessStartFixture.readErrors(process, "A page load was refused").join("|"));
  }

  @TestMethod
  public async keepsNoIdForAViewWhoseWebContentsWereDestroyedBeforeItClosedSoARefusedPageFromThemIsLogged(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    contents.destroyed = true;
    electron.ipcMain.send("desktop:webViewClose", MainProcessStartFixture.trustedEvent("linux"), "browser", "1");

    const passes = session.request({ id: 1, url: "https://example.com/late", webContentsId: contents.id, resourceType: "mainFrame" });

    Assert.isFalse(passes);
    Assert.areEqual(`A page load was refused because its web contents ${contents.id} belong to no web view Noldova Desktop opened: https://example.com/late`,
      MainProcessStartFixture.readErrors(process, "A page load was refused").join("|"));
  }

  @TestMethod
  public async forgetsAClosedViewsWebContentsOnceTheyAreDestroyedSoALaterRefusedPageFromThemIsLogged(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    electron.ipcMain.send("desktop:webViewClose", MainProcessStartFixture.trustedEvent("linux"), "browser", "1");
    session.request({ id: 1, url: "https://example.com/before", webContentsId: contents.id, resourceType: "mainFrame" });

    contents.destroyed = true;
    contents.emit("destroyed");
    const after = session.request({ id: 2, url: "https://example.com/after", webContentsId: contents.id, resourceType: "mainFrame" });

    Assert.isFalse(after);
    Assert.areEqual(`A page load was refused because its web contents ${contents.id} belong to no web view Noldova Desktop opened: https://example.com/after`,
      MainProcessStartFixture.readErrors(process, "A page load was refused").join("|"));
  }

  @TestMethod
  public async refusesARedirectFromAResponseOnAPrivateAddressForAPublicName(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contentsId = WebViewHostTests.view(electron, 0).contents.id;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", ["https://example.com"]);

    session.redirect({ id: 1, url: "https://example.com/", redirectURL: "https://example.com/home", webContentsId: contentsId, ip: "93.184.215.14" });
    const publicRedirect = session.request({ id: 1, url: "https://example.com/home", webContentsId: contentsId, resourceType: "mainFrame" });
    session.redirect({ id: 2, url: "https://example.com/", redirectURL: "https://example.com/home", webContentsId: contentsId, ip: "10.0.0.5" });
    const privateRedirect = session.request({ id: 2, url: "https://example.com/home", webContentsId: contentsId, resourceType: "mainFrame" });
    session.redirect({ id: 3, url: "http://example.com/", redirectURL: "https://example.com/", webContentsId: contentsId });
    const upgrade = session.request({ id: 3, url: "https://example.com/", webContentsId: contentsId, resourceType: "mainFrame" });

    Assert.areEqual("true,false,true", [publicRedirect, privateRedirect, upgrade].join(","));
    Assert.areEqual(JSON.stringify([{ address: "https://example.com/home", origin: "https://example.com", isRedirect: true }]),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "NavigationRefused").map(t => t["details"])));
  }

  @TestMethod
  public async refusesWithoutAskingWhatAPageAsksForAndReportsIt(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    contents.url = "https://example.com/page";
    let certificate: boolean | null = null;
    let calledBack = 0;

    const popup = contents.openWindow("https://example.com/popup");
    const prevented = [
      session.download("https://example.com/file.zip", contents.id),
      contents.prevent("certificate-error", "https://example.com/", "net::ERR_CERT_INVALID", {}, (t: boolean) => {
        certificate = t;
      }),
      contents.prevent("select-client-certificate", "https://example.com/", [], () => {
        calledBack += 1;
      }),
      contents.prevent("login", { url: "https://example.com/" }, {}, () => {
        calledBack += 1;
      }),
      contents.prevent("will-attach-webview"),
      contents.navigateFrame("https://example.net/", true),
      contents.navigateFrame("about:srcdoc", false)
    ];
    contents.debugger.receive("Page.fileChooserOpened", { frameId: "f", mode: "selectSingle" });

    Assert.areEqual("deny", popup?.action);
    Assert.areEqual("true,true,true,true,true,true,false", prevented.join(","));
    Assert.areEqual("false,2", `${String(certificate)},${calledBack}`);
    Assert.areEqual("newWindow,download,certificate,certificate,authentication,nestedView,fileChooser",
      WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "RequestRefused").map(t => WebViewHostTests.details(t)["request"]).join(","));
    Assert.areEqual("https://example.com", WebViewHostTests.details(WebViewHostTests.windowEvents(window).find(t => t["kind"] === "RequestRefused"))["origin"]);
  }

  @TestMethod
  public async namesTheModuleItsWindowSentAndPaintsTheWindowsColorsOnAFramesRefusedPage(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await MainProcessStartFixture.showAsync(electron, "linux", window);
    const frame = new FakeWebViewFrame(5);
    const opened = WebViewHostTests.json(await electron.ipcMain.invoke("desktop:webViewOpen", MainProcessStartFixture.trustedEvent("linux"), "browser", WebViewHostTests.PANE,
      "workspace-1", "Web <Browser>"));
    const guest = electron.webViews.createGuest(window.webContents.id, JsonReader.fromValue(opened).readString("partition"));
    await WebViewHostTests.attachAsync(electron, JsonReader.fromValue(opened).readObject("view").readString("id"), guest.contents.id);

    guest.contents.navigateFrame("https://example.net/", false, frame);
    const page = Buffer.from((frame.pages[0] ?? String.empty).slice("data:text/html;base64,".length), "base64").toString("utf8");

    Assert.isTrue(page.includes("<h1>Web &lt;Browser&gt; doesn't open https://example.net</h1>"));
    Assert.isTrue(page.includes("background:#181818;color:#CCCCCC;"));
    Assert.areEqual(5, WebViewHostTests.details(WebViewHostTests.windowEvents(window).find(t => t["kind"] === "FrameNavigationRefused"))["frameId"]);
  }

  @TestMethod
  public async reportsTheViewsStateWheneverItChangesUntilItsContentsAreDestroyed(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;

    contents.loading = true;
    contents.emit("did-start-loading");
    contents.emit("did-start-loading");
    contents.loading = false;
    contents.show("https://example.com/", "Example");
    contents.emit("did-fail-load", {}, -105, "ERR_NAME_NOT_RESOLVED", "https://example.org/", true);
    contents.emit("did-fail-load", {}, -3, "ERR_ABORTED", "https://example.org/", true);
    contents.emit("did-fail-load", {}, -105, "ERR_NAME_NOT_RESOLVED", "https://example.org/frame", false);
    contents.destroyed = true;
    contents.show("https://example.com/gone", "Gone");

    Assert.areEqual(JSON.stringify([
      { address: String.empty, title: String.empty, isLoading: true, canGoBack: false, canGoForward: false },
      { address: "https://example.com/", title: "Example", isLoading: false, canGoBack: false, canGoForward: false },
      { address: "https://example.org/", code: -105, description: "ERR_NAME_NOT_RESOLVED" }
    ]), JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "State" || t["kind"] === "LoadFailed").map(t => t["details"])));
  }

  @TestMethod
  public async reportsNoStateFromALoadThatEndsAfterItsViewCrashedUntilTheModuleNavigatesItAgain(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", [...WebViewHostTests.ALLOWED]);
    electron.webViews.session(WebViewHostTests.PARTITION).addresses.set("example.com", ["93.184.215.14"]);
    const contents = WebViewHostTests.view(electron, 0).contents;

    contents.loading = true;
    contents.emit("did-start-loading");
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    contents.loading = false;
    contents.show("https://example.com/", "Example");
    contents.emit("page-title-updated");
    contents.emit("did-stop-loading");
    const navigated = await electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "https://example.com/next");
    contents.show("https://example.com/next", "Next");

    Assert.areEqual(JSON.stringify({ kind: "Started" }), JSON.stringify(navigated));
    Assert.areEqual(JSON.stringify([
      { kind: "State", details: { address: String.empty, title: String.empty, isLoading: true, canGoBack: false, canGoForward: false } },
      { kind: "Crashed" },
      { kind: "State", details: { address: "https://example.com/next", title: "Next", isLoading: false, canGoBack: true, canGoForward: false } }
    ]), JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "State" || t["kind"] === "Crashed").map(t => ({ kind: t["kind"], details: t["details"] }))));
  }

  @TestMethod
  public async reportsTheStateOfThePageThatBackOrForwardLoadsInACrashedView(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    await this.commandAsync(launcher, connection, WebViewAction.SetAllowedOrigins, "1", [...WebViewHostTests.ALLOWED]);
    electron.webViews.session(WebViewHostTests.PARTITION).addresses.set("example.com", ["93.184.215.14"]);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const act = async (action: string): Promise<unknown> => electron.ipcMain.invoke("desktop:webViewAct", event, "browser", "1", action);
    const move = (index: number, url: string, title: string): void => {
      contents.index = index;
      contents.url = url;
      contents.title = title;
      contents.emit("did-navigate");
    };

    contents.show("https://example.com/a", "A");
    contents.show("https://example.com/b", "B");
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    const back = await act("Back");
    move(0, "https://example.com/a", "A");
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    const forward = await act("Forward");
    move(1, "https://example.com/b", "B");

    Assert.areEqual(JSON.stringify([{ kind: "Started" }, { kind: "Started" }]), JSON.stringify([back, forward]));
    Assert.areEqual(JSON.stringify([
      { kind: "State", details: { address: "https://example.com/a", title: "A", isLoading: false, canGoBack: false, canGoForward: false } },
      { kind: "State", details: { address: "https://example.com/b", title: "B", isLoading: false, canGoBack: true, canGoForward: false } },
      { kind: "Crashed" },
      { kind: "State", details: { address: "https://example.com/a", title: "A", isLoading: false, canGoBack: false, canGoForward: true } },
      { kind: "Crashed" },
      { kind: "State", details: { address: "https://example.com/b", title: "B", isLoading: false, canGoBack: true, canGoForward: false } }
    ]), JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "State" || t["kind"] === "Crashed").map(t => ({ kind: t["kind"], details: t["details"] }))));
  }

  @TestMethod
  public async relaysADeclaredCallAndRefusesOthersWithTheirKind(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    const window = MainProcessStartFixture.firstWindow(electron);
    const debuggee = WebViewHostTests.view(electron, 0).contents.debugger;
    debuggee.replies.set("Page.captureScreenshot", () => Promise.resolve({ data: "AAAA" }));
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent("linux", window.id), ["Mod+K"]);
    const send = (method: string, params: JsonObject, module: string = "browser", view: string = "1"): Promise<JsonObject> =>
      this.commandAsync(launcher, connection, WebViewAction.Send, view, { method, params, timeoutMilliseconds: 1000 }, module);

    const answers = [
      await send("Page.captureScreenshot", { format: "png" }),
      await send("Page.captureScreenshot", { format: "jpeg" }),
      await send("Page.printToPDF", {}),
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "k", code: "KeyK", modifiers: 2 }),
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "k", code: "KeyK", modifiers: 0 }),
      await send("Input.dispatchKeyEvent", { type: "keyDown", code: "KeyK", modifiers: 2 }),
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "k", modifiers: 2.5 }),
      await send("Page.captureScreenshot", {}, "notes"),
      await send("Page.captureScreenshot", {}, "browser", "9")
    ].map(t => t["value"] ?? t["failure"]);

    Assert.areEqual(JSON.stringify([{ data: "AAAA" }, { kind: "NotAllowed" }, { kind: "NotAllowed" }, { kind: "ShortcutRefused" }, {}, { kind: "ShortcutRefused" }, {}, { kind: "NotOwned" },
      { kind: "ViewClosed" }]), JSON.stringify(answers));
    Assert.areEqual("Page.enable,Page.setInterceptFileChooserDialog,Emulation.setFocusEmulationEnabled,Page.captureScreenshot", debuggee.methods().join(","));
    Assert.areEqual("keyDown k,keyDown k", WebViewHostTests.view(electron, 0).contents.inputs.map(t => `${t.type} ${t.keyCode}`).join(","));
  }

  @TestMethod
  public async tellsItsWindowWhenACallToThePageStartsAndEndsHoldsThePagesFocusBeforeItAndReleasesItForThatWindowOnly(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    const window = MainProcessStartFixture.firstWindow(electron);
    const debuggee = WebViewHostTests.view(electron, 0).contents.debugger;
    const trusted = MainProcessStartFixture.trustedEvent("linux", window.id);

    await this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: { format: "png" }, timeoutMilliseconds: 1000 });
    await this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Input.dispatchKeyEvent", params: { type: "keyDown", key: "k", code: "KeyK", modifiers: 0 }, timeoutMilliseconds: 1000 });
    electron.ipcMain.send("desktop:webViewFocusRelease", trusted, "notes", "1");
    electron.ipcMain.send("desktop:webViewFocusRelease", MainProcessStartFixture.trustedEvent("linux", window.id + 1), "browser", "1");
    electron.ipcMain.send("desktop:webViewFocusRelease", trusted, "browser", "1");
    electron.ipcMain.send("desktop:webViewFocusRelease", trusted, "browser", "1");

    Assert.areEqual(JSON.stringify([{ module: "browser", view: "1", kind: "Start" }, { module: "browser", view: "1", kind: "End" }]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:webViewInput").map(t => t[1])));
    Assert.areEqual(JSON.stringify(["Emulation.setFocusEmulationEnabled true", "Page.captureScreenshot", "Emulation.setFocusEmulationEnabled false"]),
      JSON.stringify(debuggee.sent.filter(t => t[0] === "Emulation.setFocusEmulationEnabled" || t[0] === "Page.captureScreenshot").map(t => t[0] === "Page.captureScreenshot" ? t[0] : `${t[0]} ${JSON.stringify(t[1]).includes("true")}`)));
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("win32", true)
  @TestData("darwin", false)
  public async takesAnAppShortcutAndADeclaredKeyFromThePageAndLeavesItTheRest(platform: string, isF5Declared: boolean): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.KEYS }, platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent(platform, window.id), ["Mod+K"]);
    await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, "workspace-1", "browser", platform);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const press = (input: JsonObject): boolean => contents.prevent("before-input-event", input);

    const prevented = [
      press(WebViewHostTests.input("r", "KeyR", true, platform)),
      press(WebViewHostTests.input("r", "KeyR", true, platform, "keyDown", true)),
      press(WebViewHostTests.input("r", "KeyR", true, platform, "keyUp")),
      press(WebViewHostTests.input("t", "KeyT", true, platform, "rawKeyDown")),
      press(WebViewHostTests.input("F5", "F5", false, platform)),
      press(WebViewHostTests.input("x", "KeyX", true, platform)),
      press(WebViewHostTests.input("Escape", "Escape", false, platform)),
      press(WebViewHostTests.input("k", "KeyK", true, platform)),
      press(WebViewHostTests.input("k", "KeyK", true, platform, "keyDown", true))
    ];
    await Condition.waitAsync(() => WebViewHostTests.shortcuts(window).length > 0 && WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Opened"));

    const isMac = platform === "darwin";
    Assert.areEqual([true, true, false, true, isF5Declared, false, false, true, true].join(","), prevented.join(","));
    Assert.areEqual(JSON.stringify(["reload", "newTab", ...isF5Declared ? ["reload"] : []]),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Key").map(t => WebViewHostTests.details(t)["name"])));
    Assert.areEqual(JSON.stringify([{ key: "k", code: "KeyK", ctrlKey: !isMac, altKey: false, shiftKey: false, metaKey: isMac, press: 1 }]), JSON.stringify(WebViewHostTests.shortcuts(window)));
    Assert.isFalse(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Key"));
    Assert.isTrue(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Opened"));
  }

  @TestMethod
  @TestData("linux", "[\"Mod+R\",\"F5\",\"Mod+T\"]")
  @TestData("darwin", "[\"Mod+R\",\"Mod+T\"]")
  public async tellsTheWindowTheKeysTheModuleDeclaresForItsPaneOnItsPlatform(platform: string, keys: string): Promise<void> {
    const declaration = WebViewDeclaration.fromJson({ ...WebViewHostTests.KEYS.toJson(), loadingKeys: [{ name: "stop", keys: ["Escape"] }] });
    const [electron] = await WebViewHostTests.startAsync({ browser: declaration }, platform);

    const answer = await WebViewHostTests.openUnattachedAsync(electron, WebViewHostTests.PANE, "workspace-1", "browser", platform);

    Assert.areEqual(keys, JSON.stringify(answer?.["keys"]));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async givesThePaneItsDeclaredKeyAheadOfAnAppShortcutOnTheSameKeyAndItsLoadingKeyOnlyWhileThePageLoads(platform: string): Promise<void> {
    const declaration = WebViewDeclaration.fromJson({ ...WebViewHostTests.KEYS.toJson(), loadingKeys: [{ name: "stop", keys: ["Escape"] }] });
    const [electron, , connection] = await WebViewHostTests.startAsync({ browser: declaration }, platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent(platform, window.id), ["Mod+R", "Mod+K"]);
    await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, "workspace-1", "browser", platform);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const press = (key: string, code: string, isMod: boolean): boolean => contents.prevent("before-input-event", WebViewHostTests.input(key, code, isMod, platform));

    contents.loading = true;
    const whileLoading = [press("r", "KeyR", true), press("Escape", "Escape", false), press("k", "KeyK", true)];
    WebViewHostTests.answer(electron, platform, window, 1, true);
    contents.loading = false;
    const afterLoading = [press("Escape", "Escape", false), press("r", "KeyR", true)];
    await Condition.waitAsync(() => WebViewHostTests.shortcuts(window).length > 0);

    const isMac = platform === "darwin";
    Assert.areEqual("true,true,true|false,true", `${whileLoading.join(",")}|${afterLoading.join(",")}`);
    Assert.areEqual(JSON.stringify(["reload", "stop", "reload"]),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Key").map(t => WebViewHostTests.details(t)["name"])));
    Assert.areEqual(JSON.stringify([{ key: "k", code: "KeyK", ctrlKey: !isMac, altKey: false, shiftKey: false, metaKey: isMac, press: 1 }]), JSON.stringify(WebViewHostTests.shortcuts(window)));
    Assert.isFalse(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Key"));
    Assert.areEqual(0, contents.inputs.length);
  }

  @TestMethod
  public async letsAKeyTheRelaySendsReachThePageAndJudgesThePersonsPressesAroundIt(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.KEYS });
    await WebViewHostTests.openAsync(electron);
    const window = MainProcessStartFixture.firstWindow(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const prevented: boolean[] = [];
    const pressed: JsonObject[] = [];
    contents.onInput = () => {
      for (const input of pressed.splice(0))
        prevented.push(contents.prevent("before-input-event", input));
    };
    const relay = async (params: JsonObject, ...inputs: JsonObject[]): Promise<void> => {
      pressed.push(...inputs);
      await this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Input.dispatchKeyEvent", params, timeoutMilliseconds: 1000 });
    };
    const reload = WebViewHostTests.input("r", "KeyR", true, "linux");

    await relay({ type: "keyDown", key: "r", code: "KeyR", modifiers: 2 }, reload, reload);
    await relay({ type: "rawKeyDown", key: "r", modifiers: 2 }, { ...reload, code: "Numpad1" });
    await relay({ type: "keyDown", key: "r", code: "KeyQ", modifiers: 2 }, reload);
    await relay({ type: "keyDown", key: "r", code: "KeyR", modifiers: 10 }, reload);
    await relay({ type: "keyUp", key: "r", code: "KeyR", modifiers: 2 }, reload);
    await relay({ type: "keyDown", key: "t", code: "KeyT", modifiers: 2 });
    prevented.push(contents.prevent("before-input-event", WebViewHostTests.input("t", "KeyT", true, "linux")));

    Assert.areEqual("false,true,false,true,true,true,true", prevented.join(","));
    Assert.areEqual(5, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Key").length);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async givesADeclinedShortcutBackToThePageAsPressedWithTheKeysHeldBehindItInOrder(platform: string): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync(undefined, platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent(platform, window.id), ["Mod+T"]);
    await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, "workspace-1", "browser", platform);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const isMac = platform === "darwin";
    const mod = isMac ? "meta" : "control";
    const newPage = WebViewHostTests.input("t", "KeyT", true, platform);
    const press = (input: JsonObject): boolean => contents.prevent("before-input-event", input);
    const sent = (): string => contents.inputs.map(t => `${t.type} ${t.keyCode} ${t.modifiers.join("+")}`).join(",");

    const held = [
      press(newPage),
      press({ ...newPage, isAutoRepeat: true }),
      press({ ...newPage, type: "keyUp" }),
      press(WebViewHostTests.input("a", "KeyA", false, platform)),
      press(WebViewHostTests.input("a", "KeyA", false, platform, "keyUp"))
    ];
    const beforeAnswer = sent();
    WebViewHostTests.answer(electron, platform, window, 1, false);
    const replayed = sent();
    const passed = [
      press({ ...newPage, code: "KeyQ" }),
      press({ ...newPage, isAutoRepeat: true }),
      press(WebViewHostTests.input("a", "KeyA", false, platform, "keyDown", true)),
      press({ ...newPage, type: "keyUp" }),
      press(WebViewHostTests.input("a", "KeyA", false, platform)),
      press(WebViewHostTests.input("a", "KeyA", false, platform, "keyUp")),
      press(WebViewHostTests.input("a", "KeyA", false, platform, "char")),
      press(newPage),
      press({ ...newPage, isAutoRepeat: true }),
      press(WebViewHostTests.input("b", "KeyB", false, platform))
    ];
    contents.inputs.splice(0);
    WebViewHostTests.answer(electron, platform, window, 2, true);

    Assert.areEqual("true,true,true,true,true", held.join(","));
    Assert.areEqual(String.empty, beforeAnswer);
    Assert.areEqual(`keyDown t ${mod},keyDown t ${mod}+isautorepeat,keyUp t ${mod},keyDown a ,char a ,keyUp a `, replayed);
    Assert.areEqual("false,false,false,false,false,false,false,true,true,true", passed.join(","));
    Assert.areEqual(`keyDown t ${mod}+isautorepeat,keyDown b ,char b `, sent());
    Assert.areEqual(JSON.stringify([1, 2]), JSON.stringify(WebViewHostTests.shortcuts(window).map(t => t["press"])));
  }

  @TestMethod
  public async passesAKeyTheRelaySendsWhilePressAwaitsItsAnswerToThePageAsTheRelaysUnjudgedAndUncounted(): Promise<void> {
    const declaration = new WebViewDeclaration(WebViewHostTests.KEYS.methods, WebViewHostTests.KEYS.events, WebViewHostTests.KEYS.keys, true);
    const [electron, launcher, connection] = await WebViewHostTests.startAsync({ browser: declaration });
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent("linux", window.id), ["Mod+J"]);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const reload = WebViewHostTests.input("r", "KeyR", true, "linux");
    const prevented: boolean[] = [];
    contents.onInput = () => prevented.push(contents.prevent("before-input-event", reload));

    prevented.push(contents.prevent("before-input-event", WebViewHostTests.input("j", "KeyJ", true, "linux")));
    await this.commandAsync(launcher, connection, WebViewAction.Send, "1",
      { method: "Input.dispatchKeyEvent", params: { type: "keyDown", key: "r", code: "KeyR", modifiers: 2 }, timeoutMilliseconds: 1000 });
    contents.inputs.splice(0);
    WebViewHostTests.answer(electron, "linux", window, 1, true);
    const passedOn = contents.inputs.map(t => `${t.type} ${t.keyCode} ${t.modifiers.join("+")}`).join(",");
    contents.emit("input-event", {}, { type: "keyDown" });
    void contents.openWindow("https://example.com/relayed");
    prevented.push(contents.prevent("before-input-event", WebViewHostTests.input("a", "KeyA", false, "linux")));
    contents.emit("input-event", {}, { type: "keyDown" });
    void contents.openWindow("https://example.com/pressed");

    Assert.areEqual("true,true,false,false", prevented.join(","));
    Assert.areEqual("keyDown r control", passedOn);
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Key").length);
    Assert.areEqual("false,true", WebViewHostTests.requested(WebViewHostTests.windowEvents(window)).map(t => String(t["hadRecentInput"])).join(","));
  }

  @TestMethod
  public async replaysOnlyAPressItForwardedOnceAndNeverForASenderThatIsNotTheWindow(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent("linux", window.id), ["Mod+T"]);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;

    contents.prevent("before-input-event", WebViewHostTests.input("t", "KeyT", true, "linux"));
    for (const [press, hasRun] of [[2, false], ["1", false], [1.5, false], [null, false], [1, "no"], [1, null]])
      WebViewHostTests.answer(electron, "linux", window, press, hasRun);
    electron.ipcMain.send("desktop:webViewShortcutAnswer", MainProcessStartFixture.trustedEvent("linux", window.id + 1), 1, false);
    const beforeAnswer = contents.inputs.length;
    WebViewHostTests.answer(electron, "linux", window, 1, false);
    WebViewHostTests.answer(electron, "linux", window, 1, false);

    Assert.areEqual(0, beforeAnswer);
    Assert.areEqual("keyDown t control", contents.inputs.map(t => `${t.type} ${t.keyCode} ${t.modifiers.join("+")}`).join(","));
  }

  @TestMethod
  public async dropsTheAnswerForAViewThatClosedAndGivesNothingBackToAPageThatIsGone(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux", window.id);
    electron.ipcMain.send("desktop:webViewShortcuts", event, ["Mod+T"]);
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const closing = WebViewHostTests.view(electron, 0).contents;
    const gone = WebViewHostTests.view(electron, 1).contents;
    const newPage = WebViewHostTests.input("t", "KeyT", true, "linux");
    const typed = WebViewHostTests.input("a", "KeyA", false, "linux");

    const held = [closing.prevent("before-input-event", newPage), closing.prevent("before-input-event", typed), gone.prevent("before-input-event", newPage), gone.prevent("before-input-event", typed)];
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "1");
    WebViewHostTests.answer(electron, "linux", window, 1, false);
    gone.destroyed = true;
    gone.emit("destroyed");
    WebViewHostTests.answer(electron, "linux", window, 2, false);

    Assert.areEqual("true,true,true,true", held.join(","));
    Assert.areEqual(0, closing.inputs.length + gone.inputs.length);
    Assert.areEqual(JSON.stringify([1, 2]), JSON.stringify(WebViewHostTests.shortcuts(window).map(t => t["press"])));
  }

  @TestMethod
  public async relaysEveryKeyUntilTheWindowSetsShortcutsAndKeepsThemOverAListThatIsNotValid(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    const trusted = MainProcessStartFixture.trustedEvent("linux", MainProcessStartFixture.firstWindow(electron).id);
    const send = async (): Promise<JsonValue | undefined> => {
      const answer = await this.commandAsync(launcher, connection, WebViewAction.Send, "1",
        { method: "Input.dispatchKeyEvent", params: { type: "keyDown", key: "k", code: "KeyK", modifiers: 2 }, timeoutMilliseconds: 1000 });
      return answer["value"] ?? answer["failure"];
    };

    const before = await send();
    electron.ipcMain.send("desktop:webViewShortcuts", trusted, ["Mod+K"]);
    electron.ipcMain.send("desktop:webViewShortcuts", trusted, "Mod+J");
    electron.ipcMain.send("desktop:webViewShortcuts", trusted, ["Mod+J", 7]);
    electron.ipcMain.send("desktop:webViewShortcuts", trusted, ["Mod+Nope"]);
    const after = await send();

    Assert.areEqual(JSON.stringify([{}, { kind: "ShortcutRefused" }]), JSON.stringify([before, after]));
  }

  @TestMethod
  public async failsARelayCallThatTimesOutIsTooLargeOrThatTheEngineRefuses(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    await WebViewHostTests.openAsync(electron);
    const debuggee = WebViewHostTests.view(electron, 0).contents.debugger;
    const send = (timeoutMilliseconds: number): Promise<JsonObject> =>
      this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: {}, timeoutMilliseconds });

    debuggee.replies.set("Page.captureScreenshot", () => new Promise(() => undefined));
    const unanswered = send(1);
    await Condition.waitAsync(() => electron.webViews.clock.pending === 1);
    electron.webViews.clock.advance(1);
    const late = await unanswered;
    debuggee.replies.set("Page.captureScreenshot", () => Promise.resolve({ data: "A".repeat(4 * 1024 * 1024) }));
    const large = await send(1000);
    debuggee.replies.set("Page.captureScreenshot", () => Promise.reject(new Error("Unable to capture screenshot")));
    const refused = await send(1000);
    debuggee.replies.set("Page.captureScreenshot", () => Promise.reject("Target closed."));
    const refusedWithText = await send(1000);
    debuggee.replies.set("Page.captureScreenshot", () => Promise.resolve("text"));
    const shapeless = await send(1000);

    Assert.areEqual(JSON.stringify([
      { kind: "TimedOut" },
      { kind: "TooLarge" },
      { kind: "Protocol", code: -32000, message: "Unable to capture screenshot" },
      { kind: "Protocol", code: -32000, message: "Target closed." },
      { kind: "Protocol", code: -32000, message: "The engine's reply is not an object." }
    ]), JSON.stringify([late, large, refused, refusedWithText, shapeless].map(t => t["failure"])));
  }

  @TestMethod
  public async endsPendingCallsWhenTheViewCrashesItsProfileIsClearedOrItCloses(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync();
    const event = MainProcessStartFixture.trustedEvent("linux");
    for (let count = 0; count < 3; count += 1)
      await WebViewHostTests.openAsync(electron);
    for (const view of electron.webViews.views)
      view.contents.debugger.replies.set("Page.captureScreenshot", () => new Promise(() => undefined));
    const send = (view: string): void => launcher.listener?.onEvent(new Event(ShellEvents.webViewCommand,
      new WebViewCommand(++this.calls, "browser", WebViewAction.Send, view, { method: "Page.captureScreenshot", params: {}, timeoutMilliseconds: 10000 }).toJson()));

    send("1");
    send("2");
    await Condition.waitAsync(() => WebViewHostTests.screenshotsSent(electron) === 2);
    WebViewHostTests.view(electron, 0).contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "2");
    send("3");
    await Condition.waitAsync(() => WebViewHostTests.screenshotsSent(electron) === 3);
    const cleared = await this.commandAsync(launcher, connection, WebViewAction.ClearProfile, null, "workspace-1");
    const afterCrash = await this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: {}, timeoutMilliseconds: 10 });
    await Condition.waitAsync(() => WebViewHostTests.answers(connection).length === 5);

    Assert.areEqual(JSON.stringify([{ kind: "Crashed" }, { kind: "ViewClosed" }, { kind: "ProfileCleared" }, null, { kind: "Crashed" }]),
      JSON.stringify(WebViewHostTests.answers(connection).map(t => t["failure"] ?? null)));
    Assert.areEqual(JSON.stringify({ call: this.calls - 1 }), JSON.stringify(cleared));
    Assert.areEqual(1, electron.webViews.session(WebViewHostTests.PARTITION).clears);
    Assert.areEqual(this.calls, afterCrash["call"]);
  }

  @TestMethod
  public async listsOnlyTheModulesOwnViewsAndFailsAProfileClearTheEngineRefuses(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.DECLARATION, notes: new WebViewDeclaration() });
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron, { name: "notes.page", instance: "n1" }, "a", "notes");

    const browser = await this.commandAsync(launcher, connection, WebViewAction.List);
    const notes = await this.commandAsync(launcher, connection, WebViewAction.List, null, null, "notes");
    electron.webViews.session("persist:notes.a").clearFailure = new ProfileNotClearedException();
    const refused = await this.commandAsync(launcher, connection, WebViewAction.ClearProfile, null, "a", "notes");

    Assert.areEqual(JSON.stringify([{ id: "1", module: "browser", pane: WebViewHostTests.PANE, profileKey: "workspace-1" }]), JSON.stringify(browser["value"]));
    Assert.areEqual(JSON.stringify([{ id: "2", module: "notes", pane: { name: "notes.page", instance: "n1" }, profileKey: "a" }]), JSON.stringify(notes["value"]));
    Assert.areEqual(JSON.stringify({ kind: "Unavailable" }), JSON.stringify(refused["failure"]));
  }

  @TestMethod
  public async passesOnAFailureToReadTheProfileRatherThanAnsweringUnavailable(): Promise<void> {
    const host = new WebViewHost(new UnreadableSessionEngineFixture(), new WebViewOriginCheck(), () => Promise.resolve(new Map([["browser", WebViewHostTests.DECLARATION]])), "linux",
      () => undefined, () => undefined, () => undefined, () => false, () => undefined, () => undefined, () => null);

    const thrown = await Assert.throwsAsync(async () => await host.commandAsync(new WebViewCommand(1, "browser", WebViewAction.ClearProfile, null, "a")), RangeError);

    Assert.areEqual(UnreadableSessionEngineFixture.MESSAGE, thrown.message);
  }

  @TestMethod
  public async passesOnAFailureOfTheClearOtherThanTheProfileNotClearedRatherThanAnsweringUnavailable(): Promise<void> {
    const engine = new FakeWebViewEngine();
    engine.readSession(WebViewHostTests.PARTITION).clearFailure = new RangeError("The engine stopped.");
    const host = new WebViewHost(engine, new WebViewOriginCheck(), () => Promise.resolve(new Map([["browser", WebViewHostTests.DECLARATION]])), "linux",
      () => undefined, () => undefined, () => undefined, () => false, () => undefined, () => undefined, () => null);

    const thrown = await Assert.throwsAsync(async () => await host.commandAsync(new WebViewCommand(1, "browser", WebViewAction.ClearProfile, null, "workspace-1")), RangeError);

    Assert.areEqual("The engine stopped.", thrown.message);
  }

  @TestMethod
  public async passesDeclaredProtocolEventsToTheRuntimeOnlyCutToTheLimitAndDropsOneThatCantBeCut(): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const debuggee = WebViewHostTests.view(electron, 0).contents.debugger;

    debuggee.receive("Page.loadEventFired", { timestamp: 1 });
    debuggee.receive("Page.loadEventFired", { timestamp: 2 }, "child-session");
    debuggee.receive("Page.frameNavigated", { frame: {} });
    debuggee.receive("Page.loadEventFired", { timings: new Array<number>(20_000).fill(12_345), name: "d" });
    debuggee.receive("Page.loadEventFired", { long: "a".repeat(70_000), short: "b", nested: { longer: "c".repeat(80_000) } });
    await Condition.waitAsync(() => WebViewHostTests.runtimeEvents(connection).filter(t => t["kind"] === "Protocol").length === 2);
    const [small, cut] = WebViewHostTests.runtimeEvents(connection).filter(t => t["kind"] === "Protocol");
    const params = WebViewHostTests.json(WebViewHostTests.details(cut)["params"]);

    Assert.areEqual(JSON.stringify({ method: "Page.loadEventFired", params: { timestamp: 1 }, isCut: false }), JSON.stringify(small?.["details"]));
    Assert.isTrue(WebViewHostTests.details(cut)["isCut"] === true);
    Assert.isTrue(Buffer.byteLength(JSON.stringify(cut)) <= 64 * 1024, String(Buffer.byteLength(JSON.stringify(cut))));
    Assert.isTrue(Buffer.byteLength(JSON.stringify(cut)) > 64 * 1024 - 16, String(Buffer.byteLength(JSON.stringify(cut))));
    Assert.areEqual("b", params["short"]);
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Protocol").length);
  }

  @TestMethod
  public async keepsTheLatestEventsOfEachViewUntilTheRuntimeIsReadyAndMarksTheDrop(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    let connect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(resolve => {
      connect = resolve;
    }));
    const process = new FakeMainProcessEnvironment("linux");
    process.webViews = new Map([["browser", WebViewHostTests.DECLARATION]]);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;

    for (let page = 0; page < 300; page += 1)
      contents.show(`https://example.com/${page}`);
    connect(connection);
    await Condition.waitAsync(() => WebViewHostTests.runtimeEvents(connection).length === 257);
    const events = WebViewHostTests.runtimeEvents(connection);

    Assert.areEqual(JSON.stringify({ module: "browser", view: "1", kind: "Dropped", details: { count: 45 } }), JSON.stringify(events[0]));
    Assert.areEqual("https://example.com/44", WebViewHostTests.details(events[1])["address"]);
    Assert.areEqual("https://example.com/299", WebViewHostTests.details(events[256])["address"]);
    Assert.areEqual("64,64,64,64,1", connection.calls.map((t, i) => [t, connection.payloads[i]] as const).filter(t => t[0] === "desktop.webViewEvents")
      .map(t => JsonReader.fromValue(t[1]).readObjectArray("events").length).join(","));
  }

  @TestMethod
  public async closesAWindowsViewsWhenItClosesOrLoadsItsPageAgain(): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);

    window.webContents.startLoading();
    const afterReload = WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(",");
    await WebViewHostTests.openAsync(electron);
    window.destroy();
    const debuggee = WebViewHostTests.view(electron, 0).contents.debugger;
    debuggee.lose();
    await setImmediate();

    Assert.areEqual("1,2", afterReload);
    Assert.areEqual("stop", WebViewHostTests.view(electron, 2).contents.calls.join(","));
    Assert.areEqual("1,2", WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(","));
    Assert.areEqual("1,2,3", WebViewHostTests.runtimeEvents(connection).filter(t => t["kind"] === "Closed").map(t => t["view"]).join(","));
    Assert.areEqual("1.3", debuggee.versions.join(","));
  }

  @TestMethod
  public async stopsTheLoadOfAViewsLivePageAndLetsGoOfItsDebuggerWhenItsWindowCloses(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const [first, second] = [WebViewHostTests.view(electron, 0), WebViewHostTests.view(electron, 1)];
    first.contents.destroyed = true;

    window.destroy();

    Assert.areEqual("|stop", [first.contents.calls.join(","), second.contents.calls.join(",")].join("|"));
    Assert.areEqual("0,1", [first.contents.debugger.detaches, second.contents.debugger.detaches].join(","));
  }

  @TestMethod
  public async closesAViewOnceWhenItsWindowLoadsAgainWhileItsPageAttaches(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    let release: (reply: object) => void = () => undefined;
    electron.webViews.prepare = t => {
      t.contents.debugger.replies.set("Page.enable", () => new Promise(resolve => {
        release = resolve;
      }));
    };

    await WebViewHostTests.openUnattachedAsync(electron);
    const view = electron.webViews.createGuest(window.webContents.id, WebViewHostTests.PARTITION);
    const attaching = WebViewHostTests.attachAsync(electron, "1", view.contents.id);
    await Condition.waitAsync(() => view.contents.debugger.methods().length === 1);
    window.webContents.startLoading();
    release({});
    const answer = await attaching;

    Assert.isNull(answer);
    Assert.areEqual("stop", view.contents.calls.join(","));
    Assert.areEqual(1, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "A web view lost its defaults, so it was closed.").length);
  }

  @TestMethod
  public async closesAViewOnceWhenItIsClosedWhileANavigationAttachesAgain(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    let refuse: (error: Error) => void = () => undefined;
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    contents.debugger.lose();
    contents.debugger.replies.set("Page.enable", () => new Promise((_resolve, reject) => {
      refuse = reject;
    }));

    const navigation = Promise.resolve(electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "about:blank"));
    await Condition.waitAsync(() => contents.debugger.methods().length === 3);
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "1");
    refuse(new Error("Target closed."));
    const answer = await navigation;
    await setImmediate();

    Assert.areEqual(JSON.stringify({ kind: "Started" }), JSON.stringify(answer));
    Assert.areEqual(1, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "A web view lost its defaults, so it was closed.").length);
  }

  @TestMethod
  public async navigatesACrashedViewAfterAttachingAgainAndClosesTheViewWhenItCant(): Promise<void> {
    const [electron, , , process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const view = WebViewHostTests.view(electron, 0);
    const crash = (): void => {
      view.contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
      view.contents.debugger.lose();
    };
    const navigate = async (): Promise<unknown> => electron.ipcMain.invoke("desktop:webViewNavigate", event, "browser", "1", "about:blank");
    view.contents.loadFailure = new Error("ERR_ABORTED");

    crash();
    const reattached = await navigate();
    const versions = view.contents.debugger.versions.length;
    crash();
    view.contents.debugger.isRefusingAttach = true;
    const lost = await navigate();

    Assert.areEqual(JSON.stringify([{ kind: "Started" }, { kind: "Started" }]), JSON.stringify([reattached, lost]));
    Assert.areEqual(2, versions);
    Assert.areEqual(1, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "A web view lost its defaults, so it was closed.").length);
    Assert.areEqual("load about:blank,load about:blank,stop", view.contents.calls.join(","));
  }

  @TestMethod
  public async attachesAgainAfterADetachAndClosesTheViewWhenItCantFailingACallMeanwhile(): Promise<void> {
    const [electron, launcher, connection, process] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const debuggee = WebViewHostTests.view(electron, 0).contents.debugger;

    debuggee.lose();
    await Condition.waitAsync(() => debuggee.versions.length === 2);
    const reattached = debuggee.versions.length;
    debuggee.isRefusingAttach = true;
    debuggee.lose();
    launcher.listener?.onEvent(new Event(ShellEvents.webViewCommand,
      new WebViewCommand(++this.calls, "browser", WebViewAction.Send, "1", { method: "Page.captureScreenshot", params: {}, timeoutMilliseconds: 1000 }).toJson()));
    await Condition.waitAsync(() => WebViewHostTests.windowEvents(window).some(t => t["kind"] === "Closed") && WebViewHostTests.answers(connection).length === 1);

    Assert.areEqual(JSON.stringify({ kind: "ViewClosed" }), JSON.stringify(WebViewHostTests.answers(connection)[0]?.["failure"]));
    Assert.areEqual(2, reattached);
    Assert.areEqual(1, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Closed").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "A web view lost its defaults, so it was closed.").length);
  }

  @TestMethod
  public async logsARuntimeCommandThatIsNotValidAndLeavesItUnanswered(): Promise<void> {
    const [, launcher, connection, process] = await WebViewHostTests.startAsync();

    launcher.listener?.onEvent(new Event(ShellEvents.webViewCommand, { call: 1, module: "browser", action: "open" }));
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The runtime sent a web view command that is not valid, so it was not answered: ").length > 0);

    Assert.areEqual(0, WebViewHostTests.answers(connection).length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime sent a web view command that is not valid, so it was not answered: ").length);
  }

  @TestMethod
  public async passesANewWindowRequestToAModuleThatTakesThemWithItsReferrersOrigin(): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.NEW_WINDOWS });
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;

    const answers = [
      contents.openWindow("https://example.com/next", "https://example.com/page"),
      contents.openWindow("https://example.net/other", String.empty, "new-window"),
      contents.openWindow("https://example.com/data", "data:text/html,x", "background-tab")
    ];
    await Condition.waitAsync(() => WebViewHostTests.requested(WebViewHostTests.runtimeEvents(connection)).length === 3);

    const expected = JSON.stringify([
      { address: "https://example.com/next", hadRecentInput: false, origin: "https://example.com", disposition: "foreground-tab", fromPress: false },
      { address: "https://example.net/other", hadRecentInput: false, origin: null, disposition: "new-window", fromPress: false },
      { address: "https://example.com/data", hadRecentInput: false, origin: null, disposition: "background-tab", fromPress: false }
    ]);
    Assert.areEqual("deny,deny,deny", answers.map(t => t?.action).join(","));
    Assert.areEqual(expected, JSON.stringify(WebViewHostTests.requested(WebViewHostTests.windowEvents(window))));
    Assert.areEqual(expected, JSON.stringify(WebViewHostTests.requested(WebViewHostTests.runtimeEvents(connection))));
    Assert.areEqual(0, WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "RequestRefused").length);
  }

  @TestMethod
  public async refusesNewWindowRequestsOverFiveASecondAndAnAddressTooLong(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.NEW_WINDOWS });
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    contents.url = "https://example.com/page";

    for (let index = 0; index < 6; index++)
      contents.openWindow(`https://example.com/${index}`);
    electron.webViews.time += 999;
    contents.openWindow("https://example.com/6");
    electron.webViews.time += 1;
    contents.openWindow("https://example.com/7");
    contents.openWindow(`https://example.com/${"a".repeat(32768)}`);

    Assert.areEqual("0,1,2,3,4,7", WebViewHostTests.requested(WebViewHostTests.windowEvents(window)).map(t => String(t["address"]).slice(20)).join(","));
    Assert.areEqual(JSON.stringify(Array.from({ length: 3 }, () => ({ request: "newWindow", origin: "https://example.com" }))),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "RequestRefused").map(t => t["details"])));
  }

  @TestMethod
  public async saysWhetherThePersonsOwnInputReachedTheViewInTheLastFiveSeconds(): Promise<void> {
    const [electron, launcher, connection] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.NEW_WINDOWS });
    const window = MainProcessStartFixture.firstWindow(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const send = (fails: boolean): Promise<JsonObject> => {
      contents.onInput = () => {
        contents.emit("input-event", {}, { type: "rawKeyDown" });
        if (fails)
          throw new Error("The page is gone.");
      };
      return this.commandAsync(launcher, connection, WebViewAction.Send, "1", { method: "Input.dispatchKeyEvent", params: { type: "rawKeyDown", key: "k" }, timeoutMilliseconds: 1000 });
    };
    const ask = (): void => void contents.openWindow("https://example.com/next");

    ask();
    contents.emit("input-event", {}, { type: "mouseUp" });
    ask();
    contents.emit("input-event", {}, { type: "mouseDown" });
    electron.webViews.time += 4900;
    ask();
    electron.webViews.time += 200;
    ask();
    await send(false);
    ask();
    await send(true);
    ask();
    contents.emit("input-event", {}, { type: "keyDown" });
    ask();

    Assert.areEqual("false,false,true,false,false,false,true", WebViewHostTests.requested(WebViewHostTests.windowEvents(window)).map(t => String(t["hadRecentInput"])).join(","));
  }

  @TestMethod
  public async zoomsAViewByStepsWithinTheEngineLimitsAndReportsEachChangeToTheWindowAlone(): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const zoom = (change: unknown, view: string = "1", module: string = "browser"): unknown => electron.ipcMain.invoke("desktop:webViewZoom", event, module, view, change);

    const answers = [zoom(null), zoom("in"), zoom("in"), zoom(0.1), zoom("out"), zoom(7), zoom("in"), zoom("out"), zoom(1.07), zoom("out")];
    const refused = [zoom("sideways"), zoom("1"), zoom(Number.POSITIVE_INFINITY), zoom(1.5, "2"), zoom(1.5, "1", "notes")];
    contents.emit("zoom-changed", {}, "in");
    const afterWheelIn = zoom(null);
    contents.emit("zoom-changed", {}, "out");
    const afterWheelOut = zoom(null);
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    const crashed = [zoom("in"), zoom(2)];

    Assert.areEqual("1,1.1,1.25,0.25,0.25,5,5,4,1.07,1", (await Promise.all(answers)).join(","));
    Assert.areEqual(JSON.stringify([null, null, null, null, null]), JSON.stringify(await Promise.all(refused)));
    Assert.areEqual("1.1,1", [await afterWheelIn, await afterWheelOut].join(","));
    Assert.areEqual("1,1", (await Promise.all(crashed)).join(","));
    Assert.areEqual("zoom 1.1,zoom 1.25,zoom 0.25,zoom 5,zoom 4,zoom 1.07,zoom 1,zoom 1.1,zoom 1", contents.calls.filter(t => t.startsWith("zoom")).join(","));
    Assert.areEqual("1.1,1.25,0.25,5,4,1.07,1,1.1,1",
      WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Zoom").map(t => WebViewHostTests.details(t)["factor"]).join(","));
    Assert.isFalse(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Zoom"));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async zoomsOnThePersonsZoomKeysInTheViewAfterTheAppsShortcuts(platform: string): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync({ browser: WebViewHostTests.KEYS }, platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:webViewShortcuts", MainProcessStartFixture.trustedEvent(platform, window.id), ["Mod+0"]);
    await WebViewHostTests.openAsync(electron, WebViewHostTests.PANE, "workspace-1", "browser", platform);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const isMac = platform === "darwin";
    const press = (key: string, code: string, modifiers: { readonly mod?: boolean; readonly shift?: boolean; readonly alt?: boolean; readonly other?: boolean } = { mod: true },
      type: string = "keyDown"): boolean => {
      const mod = modifiers.mod === true;
      const other = modifiers.other === true;
      return contents.prevent("before-input-event",
        { type, key, code, isAutoRepeat: false, control: isMac ? other : mod, alt: modifiers.alt === true, shift: modifiers.shift === true, meta: isMac ? mod : other });
    };

    const beforeAnswer = [
      press("=", "Equal"),
      press("+", "Equal", { mod: true, shift: true }),
      press("+", "NumpadAdd"),
      press("-", "Minus"),
      press("-", "NumpadSubtract"),
      press("0", "Digit0")
    ];
    WebViewHostTests.answer(electron, platform, window, 1, true);
    const prevented = [
      ...beforeAnswer,
      press("0", "Numpad0"),
      press("+", String.empty),
      press("=", "Equal", {}),
      press("=", "Equal", { mod: true, alt: true }),
      press("=", "Equal", { other: true }),
      press("=", "Equal", { mod: true, other: true }),
      press("a", "KeyA"),
      press("=", "Equal", { mod: true }, "keyUp")
    ];
    await Condition.waitAsync(() => WebViewHostTests.shortcuts(window).length > 0);

    Assert.areEqual("true,true,true,true,true,true,true,true,false,false,false,false,false,false", prevented.join(","));
    Assert.areEqual("zoom 1.1,zoom 1.25,zoom 1.5,zoom 1.25,zoom 1.1,zoom 1,zoom 1.1", contents.calls.filter(t => t.startsWith("zoom")).join(","));
    Assert.areEqual(JSON.stringify(["0"]), JSON.stringify(WebViewHostTests.shortcuts(window).map(t => t["key"])));
  }

  @TestMethod
  public async findsInTheViewStepsThroughTheMatchesAndEndsTheSearchOnANewOneANavigationACrashOrAClose(): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const find = (request: unknown, view: string = "1"): Promise<unknown> => Promise.resolve(electron.ipcMain.invoke("desktop:webViewFind", event, "browser", view, request));
    const found = (requestId: number, active: number, matches: number, finalUpdate: boolean = true): void =>
      contents.emit("found-in-page", {}, { requestId, activeMatchOrdinal: active, matches, finalUpdate });

    const first = find({ text: "cat", matchCase: false });
    found(1, 1, 3, false);
    found(1, 1, 3);
    const next = find("next");
    found(2, 2, 3);
    const previous = find("previous");
    found(3, 3, 3);
    const replaced = find({ text: "dog", matchCase: true });
    const latest = find({ text: "dogs", matchCase: true });
    found(4, 1, 1);
    found(5, -1, 2);
    const ended = find({ text: String.empty, matchCase: false });
    const nextWithoutSearch = find("next");
    found(5, 1, 2);
    const refused = [find("sideways"), find(null), find([]), find({ text: 1, matchCase: false }), find({ text: "cat" }), find({ text: "cat", matchCase: false }, "9")];
    const navigated = find({ text: "cat", matchCase: false });
    contents.show("https://example.com/");
    const crashed = find({ text: "cat", matchCase: false });
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    const afterCrash = find({ text: "cat", matchCase: false });
    const closed = find({ text: "cat", matchCase: false }, "2");
    electron.ipcMain.send("desktop:webViewClose", event, "browser", "2");

    Assert.areEqual(JSON.stringify([{ matches: 3, active: 1 }, { matches: 3, active: 2 }, { matches: 3, active: 3 }, { isEnded: true }, { matches: 2, active: 0 },
      { matches: 0, active: 0 }, { matches: 0, active: 0 }]), JSON.stringify(await Promise.all([first, next, previous, replaced, latest, ended, nextWithoutSearch])));
    Assert.areEqual(JSON.stringify([null, null, null, null, null, null]), JSON.stringify(await Promise.all(refused)));
    Assert.areEqual(JSON.stringify([{ isEnded: true }, { isEnded: true }, { isEnded: true }, null]),
      JSON.stringify(await Promise.all([navigated, crashed, afterCrash, closed])));
    Assert.areEqual([
      "find 1 cat true true false", "find 2 cat true false false", "find 3 cat false false false",
      "stop find clearSelection", "find 4 dog true true true", "stop find clearSelection", "find 5 dogs true true true", "stop find clearSelection",
      "find 6 cat true true false", "stop find clearSelection", "find 7 cat true true false", "stop find clearSelection"
    ].join(","), contents.calls.filter(t => t.includes("find")).join(","));
    Assert.areEqual(JSON.stringify([{ matches: 3, active: 1 }, { matches: 3, active: 2 }, { matches: 3, active: 3 }, { matches: 2, active: 0 }]),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Found" && t["view"] === "1").map(t => t["details"])));
    Assert.isFalse(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Found"));
  }

  @TestMethod
  public async putsTheViewsZoomBackWhenANavigationOrARestartedPageLosesIt(): Promise<void> {
    const [electron] = await WebViewHostTests.startAsync();
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const zoom = (change: unknown): Promise<unknown> => Promise.resolve(electron.ipcMain.invoke("desktop:webViewZoom", event, "browser", "1", change));

    await zoom(1.25);
    contents.show("https://example.com/");
    contents.zoomFactor = 1;
    contents.show("https://example.org/");
    contents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
    contents.zoomFactor = 1;
    contents.show("https://example.org/again");

    Assert.areEqual("zoom 1.25,zoom 1.25,zoom 1.25", contents.calls.filter(t => t.startsWith("zoom")).join(","));
    Assert.areEqual(1.25, contents.zoomFactor);
    Assert.areEqual(1.25, await zoom(null));
  }

  @TestMethod
  public async settlesAFindTheEngineNeverAnswersAsTimedOutAtItsDeadline(): Promise<void> {
    const [electron, , connection] = await WebViewHostTests.startAsync();
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await WebViewHostTests.openAsync(electron);
    const contents = WebViewHostTests.view(electron, 0).contents;
    const clock = electron.webViews.clock;
    const find = (request: unknown): Promise<unknown> => Promise.resolve(electron.ipcMain.invoke("desktop:webViewFind", event, "browser", "1", request));
    let early: unknown;

    const unanswered = find({ text: "cat", matchCase: false }).then(t => {
      early = t;
      return t;
    });
    await Condition.waitAsync(() => clock.pending === 1);
    clock.advance(9999);
    await setImmediate();
    const beforeDeadline = early;
    clock.advance(1);
    const atDeadline = await unanswered;
    const answered = find("next");
    await Condition.waitAsync(() => clock.pending === 1);
    contents.emit("found-in-page", {}, { requestId: 2, activeMatchOrdinal: 2, matches: 3, finalUpdate: true });
    const raced = find("next");
    await Condition.waitAsync(() => clock.pending === 1);
    clock.advance(10_000);
    contents.emit("found-in-page", {}, { requestId: 3, activeMatchOrdinal: 3, matches: 3, finalUpdate: true });

    Assert.isUndefined(beforeDeadline);
    Assert.areEqual(JSON.stringify({ isTimedOut: true }), JSON.stringify(atDeadline));
    Assert.areEqual(JSON.stringify({ matches: 3, active: 2 }), JSON.stringify(await answered));
    Assert.areEqual(JSON.stringify({ matches: 3, active: 3 }), JSON.stringify(await raced));
    Assert.areEqual(0, clock.pending);
    Assert.areEqual("10000,10000,10000", clock.waits.join(","));
    Assert.areEqual(JSON.stringify([{ matches: 3, active: 2 }, { matches: 3, active: 3 }]),
      JSON.stringify(WebViewHostTests.windowEvents(window).filter(t => t["kind"] === "Found").map(t => t["details"])));
    Assert.isFalse(WebViewHostTests.runtimeEvents(connection).some(t => t["kind"] === "Found"));
  }

  private static async startAsync(declarations: Readonly<Record<string, WebViewDeclaration>> = { browser: WebViewHostTests.DECLARATION }, platform: string = "linux",
    fake: FakeElectron = new FakeElectron()):
    Promise<[FakeElectron, FakeRuntimeLauncher, FakeRuntimeConnection, FakeMainProcessEnvironment]> {
    const connection = new FakeRuntimeConnection();
    const launcher = new FakeRuntimeLauncher(connection);
    const process = new FakeMainProcessEnvironment(platform);
    process.webViews = new Map(Object.entries(declarations));
    const electron = await MainProcessStartFixture.startReadyAsync(platform, launcher, fake, new FakeDeviceIdentity(), process);
    return [electron, launcher, connection, process];
  }

  private static async startWithAsync(launcher: FakeRuntimeLauncher): Promise<[FakeElectron, FakeMainProcessEnvironment]> {
    const process = new FakeMainProcessEnvironment("linux");
    process.webViews = new Map([["browser", WebViewHostTests.DECLARATION]]);
    return [await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process), process];
  }

  private static loopbackPasses(electron: FakeElectron, ports: readonly number[]): string {
    const contentsId = WebViewHostTests.view(electron, 0).contents.id;
    const session = electron.webViews.session(WebViewHostTests.PARTITION);
    return ports.map(t => session.request({ id: t, url: `http://127.0.0.1:${t}/a.png`, webContentsId: contentsId, resourceType: "image" })).join(",");
  }

  private static portAcknowledgements(connection: FakeRuntimeConnection): string[] {
    return connection.payloads.filter((_, index) => connection.calls[index] === "desktop.webViewPortsBlocked").map(t => JSON.stringify(t));
  }

  private static async openAsync(electron: FakeElectron, pane: JsonObject = WebViewHostTests.PANE, profileKey: unknown = "workspace-1", module: string = "browser",
    platform: string = "linux"): Promise<JsonObject | null> {
    const opened = await WebViewHostTests.openUnattachedAsync(electron, pane, profileKey, module, platform);
    if (Object.isNull(opened))
      return null;
    const answer = JsonReader.fromValue(opened);
    const info = answer.readObject("view");
    const guest = electron.webViews.createGuest(MainProcessStartFixture.firstWindow(electron).webContents.id, answer.readString("partition"));
    await WebViewHostTests.attachAsync(electron, info.readString("id"), guest.contents.id, module, platform);
    return info.toJson();
  }

  private static async openUnattachedAsync(electron: FakeElectron, pane: JsonObject = WebViewHostTests.PANE, profileKey: unknown = "workspace-1", module: string = "browser",
    platform: string = "linux"): Promise<JsonObject | null> {
    const opened = await electron.ipcMain.invoke("desktop:webViewOpen", MainProcessStartFixture.trustedEvent(platform), module, pane, profileKey);
    return Object.isNull(opened) ? null : WebViewHostTests.json(opened);
  }

  private static async attachAsync(electron: FakeElectron, view: string, contentsId: unknown, module: string = "browser", platform: string = "linux"): Promise<unknown> {
    return await electron.ipcMain.invoke("desktop:webViewAttach", MainProcessStartFixture.trustedEvent(platform), module, view, contentsId);
  }

  private static input(key: string, code: string, isMod: boolean, platform: string, type: string = "keyDown", isAutoRepeat: boolean = false): JsonObject {
    const isMac = platform === "darwin";
    return { type, key, code, isAutoRepeat, control: isMod && !isMac, alt: false, shift: false, meta: isMod && isMac };
  }

  private static answer(electron: FakeElectron, platform: string, window: FakeMainProcessWindow, press: unknown, hasRun: unknown): void {
    electron.ipcMain.send("desktop:webViewShortcutAnswer", MainProcessStartFixture.trustedEvent(platform, window.id), press, hasRun);
  }

  private static shortcuts(window: FakeMainProcessWindow): JsonObject[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:webViewShortcut").map(t => WebViewHostTests.json(t[1]));
  }

  private static settled(answer: unknown): { readonly answer: Promise<unknown>; readonly isSettled: boolean } {
    const state = { answer: Promise.resolve(answer), isSettled: false };
    void state.answer.finally(() => {
      state.isSettled = true;
    });
    return state;
  }

  private static async keepAsync(electron: FakeElectron, views: unknown): Promise<unknown> {
    const event = MainProcessStartFixture.trustedEvent("linux");
    electron.ipcMain.send("desktop:webViewKeep", event, views);
    await Condition.waitAsync(() => !Object.isUndefined(event.returnValue));
    return event.returnValue;
  }

  private static expect(electron: FakeElectron, view: string): unknown {
    const event = MainProcessStartFixture.trustedEvent("linux");
    electron.ipcMain.send("desktop:webViewExpect", event, "browser", view);
    return event.returnValue;
  }

  private static view(electron: FakeElectron, index: number): FakeWebView {
    const view = electron.webViews.views[index];
    Assert.isDefined(view);
    return view;
  }

  private static windowEvents(window: FakeMainProcessWindow): JsonObject[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:webViewEvent").map(t => WebViewHostTests.json(t[1]));
  }

  private static requested(events: readonly JsonObject[]): JsonObject[] {
    return events.filter(t => t["kind"] === "NewWindowRequested").map(t => WebViewHostTests.details(t));
  }

  private static answers(connection: FakeRuntimeConnection): JsonObject[] {
    return connection.calls.map((t, i) => [t, connection.payloads[i]] as const).filter(t => t[0] === "desktop.webViewAnswered").map(t => WebViewHostTests.json(t[1]));
  }

  private static runtimeEvents(connection: FakeRuntimeConnection): JsonObject[] {
    return connection.calls.map((t, i) => [t, connection.payloads[i]] as const).filter(t => t[0] === "desktop.webViewEvents")
      .flatMap(t => JsonReader.fromValue(t[1]).readObjectArray("events").map(u => u.toJson()));
  }

  private static screenshotsSent(electron: FakeElectron): number {
    return electron.webViews.views.filter(t => t.contents.debugger.methods().includes("Page.captureScreenshot")).length;
  }

  private static json(value: unknown): JsonObject {
    return JsonReader.fromValue(value).toJson();
  }

  private static details(event: JsonObject | undefined): JsonObject {
    return JsonReader.fromValue(event).readObject("details").toJson();
  }

  private async commandAsync(launcher: FakeRuntimeLauncher, connection: FakeRuntimeConnection, action: WebViewAction, view: string | null = null, value: JsonValue = null,
    module: string = "browser"): Promise<JsonObject> {
    const call = ++this.calls;
    launcher.listener?.onEvent(new Event(ShellEvents.webViewCommand, new WebViewCommand(call, module, action, view, value).toJson()));
    await Condition.waitAsync(() => WebViewHostTests.answers(connection).some(t => t["call"] === call));
    const answer = WebViewHostTests.answers(connection).find(t => t["call"] === call);
    Assert.isDefined(answer);
    return answer;
  }
}
