/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, KeyChord, type QualifiedName, Response } from "@noldova/desktop.protocol";

import { AppSurfaceFeed } from "../../src/services/app-surface-feed.js";
import { Condition } from "../fixtures/condition.fixture.js";

@TestClass
export class AppSurfaceFeedTests {
  private static readonly STOP: JsonObject = { key: "Mod+Shift+Period", command: "desktop.stopAgentControl", isGlobal: true };
  private static readonly MAC_KEYS: readonly JsonObject[] = ["Mod+Q", "Mod+H", "Mod+Alt+H", "Mod+M", "Mod+Shift+W"].map(t => ({ key: t, command: null, isGlobal: false }));

  @TestMethod
  public sendsNothingUntilConnectedAndThenBothWholeLists(): void {
    const [feed, sent] = AppSurfaceFeedTests.create("win32");

    feed.openWindow(1, "window:4242:0");
    feed.receiveStopKey(KeyChord.parse("Mod+Shift+Period"));
    const before = sent.length;
    feed.connect();

    Assert.areEqual(0, before);
    Assert.areEqual(JSON.stringify([
      ["desktop.appWindowsChanged", { windows: [{ handle: 4242, processId: 77 }] }],
      ["desktop.appShortcutsChanged", { shortcuts: [AppSurfaceFeedTests.STOP] }],
      ["desktop.mainWindowChanged", { title: String.empty, isVisible: false, isPainted: false }]
    ]), JSON.stringify(sent));
  }

  @TestMethod
  @TestData("window:4242:0", 4242)
  @TestData("window:1:0", 1)
  @TestData("window:2884542:1", 2884542)
  @TestData("window:0:0", null)
  @TestData("window:-3:0", null)
  @TestData("window:12x:0", null)
  @TestData("window:1e3:0", null)
  @TestData("window:9007199254740993:0", null)
  @TestData("screen:4242:0", null)
  @TestData("window:4242", null)
  @TestData(String.empty, null)
  public readsTheHandleFromTheWindowsMediaSource(sourceId: string, handle: number | null): void {
    const [feed] = AppSurfaceFeedTests.create("linux");

    feed.openWindow(1, sourceId);

    Assert.areEqual(JSON.stringify({ windows: [{ handle, processId: 77 }] }), JSON.stringify(feed.windowList.toJson()));
  }

  @TestMethod
  public listsAWindowWithoutAMediaSourceWithANullHandleAndForgetsAClosedWindow(): void {
    const [feed, sent] = AppSurfaceFeedTests.create("linux");
    feed.connect();

    feed.openWindow(1, null);
    feed.openWindow(2, "window:9:0");
    feed.receiveShortcuts(2, { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }] });
    feed.closeWindow(2);

    Assert.areEqual(JSON.stringify([
      { windows: [] },
      { windows: [{ handle: null, processId: 77 }] },
      { windows: [{ handle: null, processId: 77 }, { handle: 9, processId: 77 }] },
      { windows: [{ handle: null, processId: 77 }] }
    ]), JSON.stringify(AppSurfaceFeedTests.payloads(sent, "desktop.appWindowsChanged")));
    Assert.areEqual(JSON.stringify([
      { shortcuts: [] },
      { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }] },
      { shortcuts: [] }
    ]), JSON.stringify(AppSurfaceFeedTests.payloads(sent, "desktop.appShortcutsChanged")));
  }

  @TestMethod
  public sendsOnlyAListThatChanged(): void {
    const [feed, sent] = AppSurfaceFeedTests.create("linux");
    const shortcuts = { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }] };
    feed.openWindow(1, "window:5:0");
    feed.connect();

    feed.receiveShortcuts(1, shortcuts);
    feed.receiveShortcuts(1, shortcuts);
    feed.receiveStopKey(null);
    feed.openWindow(1, "window:5:0");

    Assert.areEqual("desktop.appWindowsChanged,desktop.appShortcutsChanged,desktop.mainWindowChanged,desktop.appShortcutsChanged", sent.map(t => t[0]).join(","));
  }

  @TestMethod
  @TestData("win32", false)
  @TestData("linux", false)
  @TestData("darwin", true)
  public putsTheStopKeyFirstAsGlobalTakesEachKeyOnceAndAddsTheMacMenuKeysOnlyOnMacOs(platform: string, hasMenuKeys: boolean): void {
    const [feed] = AppSurfaceFeedTests.create(platform);
    feed.openWindow(1, "window:5:0");
    feed.openWindow(2, "window:6:0");
    feed.receiveStopKey(KeyChord.parse("Mod+Shift+Period"));

    feed.receiveShortcuts(1, { shortcuts: [
      { key: "Mod+Shift+Period", command: "desktop.stopAgentControl", isGlobal: false },
      { key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: true },
      { key: "Mod+Q", command: "notes.quickOpen", isGlobal: false }
    ] });
    feed.receiveShortcuts(2, { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }, { key: "F2", command: "notes.rename", isGlobal: false }] });

    Assert.areEqual(JSON.stringify({ shortcuts: [
      AppSurfaceFeedTests.STOP,
      { key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false },
      { key: "Mod+Q", command: "notes.quickOpen", isGlobal: false },
      { key: "F2", command: "notes.rename", isGlobal: false },
      ...hasMenuKeys ? AppSurfaceFeedTests.MAC_KEYS.slice(1) : []
    ] }), JSON.stringify(feed.shortcutList.toJson()));
  }

  @TestMethod
  @TestData("win32", 1)
  @TestData("darwin", 2)
  public takesModAndCtrlAsOneKeyOnlyOffMacOs(platform: string, count: number): void {
    const [feed] = AppSurfaceFeedTests.create(platform);
    feed.openWindow(1, "window:5:0");

    feed.receiveShortcuts(1, { shortcuts: [{ key: "Mod+K", command: "notes.find", isGlobal: false }, { key: "Ctrl+K", command: "notes.kill", isGlobal: false }] });

    Assert.areEqual(count, feed.shortcutList.shortcuts.filter(t => !Object.isNull(t.command)).length);
  }

  @TestMethod
  public keepsTheLastShortcutsWhenAReportIsInvalidOrFromAWindowItDoesNotKnow(): void {
    const [feed, sent, logged] = AppSurfaceFeedTests.create("linux");
    feed.openWindow(1, "window:5:0");
    feed.connect();
    feed.receiveShortcuts(1, { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }] });
    const before = sent.length;

    feed.receiveShortcuts(1, { shortcuts: [{ key: "Mod+Nope", command: "notes.find", isGlobal: false }] });
    feed.receiveShortcuts(1, "Mod+K");
    feed.receiveShortcuts(1, { shortcuts: [{ key: "Mod+K", command: " ", isGlobal: false }] });
    feed.receiveShortcuts(2, { shortcuts: [{ key: "Mod+K", command: "notes.find", isGlobal: false }] });

    Assert.areEqual(before, sent.length);
    Assert.areEqual("Mod+B", feed.shortcutList.shortcuts.map(t => t.key.text).join(","));
    Assert.areEqual(3, logged.filter(t => t.startsWith("The window's shortcuts could not be read, so the runtime keeps the last ones: ")).length);
  }

  @TestMethod
  public async logsAListTheRuntimeRefusesAndSendsItAgainAtTheNextChange(): Promise<void> {
    const sent: [string, JsonObject][] = [];
    const logged: string[] = [];
    let isRefusing = true;
    const feed = new AppSurfaceFeed("linux", 77, (method: QualifiedName, payload: JsonObject) => {
      sent.push([method.text, payload]);
      return Promise.resolve(isRefusing ? Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")) : Response.success("r", null));
    }, t => logged.push(t));
    feed.openWindow(1, "window:5:0");
    feed.connect();
    await Condition.waitAsync(() => logged.length === 3);
    isRefusing = false;

    feed.receiveStopKey(KeyChord.parse("F12"));
    feed.receiveStopKey(KeyChord.parse("F11"));

    Assert.areEqual(["desktop.appWindowsChanged", "desktop.appShortcutsChanged", "desktop.mainWindowChanged", "desktop.appWindowsChanged", "desktop.appShortcutsChanged", "desktop.mainWindowChanged",
      "desktop.appShortcutsChanged"].join(","), sent.map(t => t[0]).join(","));
    Assert.areEqual(JSON.stringify([
      "The runtime was not told desktop.appWindowsChanged, so it is sent again at the next change: The database is busy.",
      "The runtime was not told desktop.appShortcutsChanged, so it is sent again at the next change: The database is busy.",
      "The runtime was not told desktop.mainWindowChanged, so it is sent again at the next change: The database is busy."
    ]), JSON.stringify(logged));
  }

  @TestMethod
  public async logsNothingForAListTheRuntimeMissedByGoingAndSendsItAgainAtTheNextChange(): Promise<void> {
    const sent: string[] = [];
    const logged: string[] = [];
    let isGone = true;
    const feed = new AppSurfaceFeed("linux", 77, (method: QualifiedName) => {
      sent.push(method.text);
      return Promise.resolve(isGone ? Response.failure("r", new Failure(FailureCode.Disconnected, "The runtime is not connected.")) : Response.success("r", null));
    }, t => logged.push(t));
    feed.connect();
    feed.openWindow(1, "window:5:0");
    await setImmediate();
    isGone = false;

    feed.receiveStopKey(KeyChord.parse("F12"));

    Assert.areEqual(["desktop.appWindowsChanged", "desktop.appShortcutsChanged", "desktop.mainWindowChanged", "desktop.appWindowsChanged", "desktop.appWindowsChanged", "desktop.appShortcutsChanged",
      "desktop.mainWindowChanged"].join(","), sent.join(","));
    Assert.areEqual(0, logged.length);
  }

  @TestMethod
  public async keepsANewerListSentWhenAnOlderSendIsRefused(): Promise<void> {
    const sent: string[] = [];
    const answers: ((response: Response) => void)[] = [];
    const feed = new AppSurfaceFeed("linux", 77, (method: QualifiedName, payload: JsonObject) => {
      sent.push(`${method.text} ${JSON.stringify(payload)}`);
      const answer = Promise.withResolvers<Response>();
      answers.push(answer.resolve);
      return answer.promise;
    }, () => undefined);
    feed.connect();
    feed.openWindow(1, "window:5:0");

    answers[0]?.(Response.failure("r", new Failure(FailureCode.Unavailable, "The runtime did not answer in time.")));
    await setImmediate();
    feed.receiveStopKey(null);

    Assert.areEqual(JSON.stringify([
      "desktop.appWindowsChanged {\"windows\":[]}",
      "desktop.appShortcutsChanged {\"shortcuts\":[]}",
      "desktop.mainWindowChanged {\"title\":\"\",\"isVisible\":false,\"isPainted\":false}",
      "desktop.appWindowsChanged {\"windows\":[{\"handle\":5,\"processId\":77}]}"
    ]), JSON.stringify(sent));
  }

  @TestMethod
  public sendsBothListsAgainOnEachConnectionAndNothingWhileDisconnected(): void {
    const [feed, sent] = AppSurfaceFeedTests.create("linux");
    feed.openWindow(1, "window:5:0");
    feed.connect();

    feed.disconnect();
    feed.closeWindow(1);
    const whileDisconnected = sent.length;
    feed.connect();

    Assert.areEqual(3, whileDisconnected);
    Assert.areEqual(JSON.stringify([{ windows: [{ handle: 5, processId: 77 }] }, { windows: [] }]), JSON.stringify(AppSurfaceFeedTests.payloads(sent, "desktop.appWindowsChanged")));
    Assert.areEqual(2, AppSurfaceFeedTests.payloads(sent, "desktop.appShortcutsChanged").length);
  }

  @TestMethod
  public reportsTheFirstOpenWindowsTitleVisibilityAndPaintAsTheMainWindow(): void {
    const [feed, sent] = AppSurfaceFeedTests.create("linux");
    feed.openWindow(1, "window:5:0");
    feed.openWindow(2, "window:6:0");
    feed.connect();

    feed.describeWindow(1, "Notes", false, false);
    feed.describeWindow(2, "Second", true, true);
    feed.describeWindow(3, "Unknown", true, true);
    feed.describeWindow(1, "Notes", true, false);
    feed.describeWindow(1, "Notes", true, true);
    feed.closeWindow(1);
    feed.closeWindow(2);

    Assert.areEqual(JSON.stringify([
      { title: String.empty, isVisible: false, isPainted: false },
      { title: "Notes", isVisible: false, isPainted: false },
      { title: "Notes", isVisible: true, isPainted: false },
      { title: "Notes", isVisible: true, isPainted: true },
      { title: "Second", isVisible: true, isPainted: true },
      { title: String.empty, isVisible: false, isPainted: false }
    ]), JSON.stringify(AppSurfaceFeedTests.payloads(sent, "desktop.mainWindowChanged")));
  }

  private static create(platform: string): [AppSurfaceFeed, [string, JsonObject][], string[]] {
    const sent: [string, JsonObject][] = [];
    const logged: string[] = [];
    const feed = new AppSurfaceFeed(platform, 77, (method: QualifiedName, payload: JsonObject) => {
      sent.push([method.text, payload]);
      return Promise.resolve(Response.success("r", null));
    }, t => logged.push(t));
    return [feed, sent, logged];
  }

  private static payloads(sent: readonly [string, JsonObject][], method: string): JsonObject[] {
    return sent.filter(t => t[0] === method).map(t => t[1]);
  }
}
