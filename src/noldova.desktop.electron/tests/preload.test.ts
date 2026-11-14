/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { PreloadSettings } from "../src/models/preload-settings.js";
import { FakePreloadElectron } from "./fixtures/fake-preload-electron.fixture.js";

@TestClass
export class PreloadTests {
  @TestMethod
  public exposesExactlyItsMembersWithItsPlatformAndTheAppearanceItsWindowWasOpenedWith(): void {
    const api = FakePreloadElectron.load(new PreloadSettings({ background: "#181818" }).toArgument()).api("desktop");

    Assert.areEqual([
      "platform", "processor", "appearance", "notifyReady", "notifyAppearance", "onCloseRequest", "answerClose", "onUpdateSaveRequest", "answerUpdateSave", "readStartup", "onStartup", "actOnStartup",
      "readLayout", "writeLayout", "request", "onEvent", "readBuild", "copyText", "copyImage", "openLogFolder", "copyDetails", "openLink", "showInFolder", "openFile", "chooseFolder", "chooseFilePath", "saveFile", "chooseFiles", "grantFiles", "installCommand", "readUpdate", "onUpdate", "actOnUpdate",
      "keepAppearance", "readSpelling", "keepSpelling", "onFieldMenu", "replaceMisspelling", "addToDictionary", "edit", "setMenuBar", "onMenuCommand", "onNotificationOpened", "onQuitQuestion",
      "answerQuit", "readTrayAvailable", "onTrayAvailable", "readFullScreen", "onFullScreen", "readMaximized", "onMaximized", "actOnWindow", "openWebView", "attachWebView",
      "navigateWebView", "actOnWebView", "zoomWebView", "findInWebView", "closeWebView", "setWebViewShortcuts", "setAppShortcuts", "onWebViewEvent", "onWebViewShortcut", "onWebViewInput",
      "releaseWebViewFocus", "logModule", "logError"
    ].join(","), Object.keys(api).join(","));
    Assert.areEqual(process.platform, api["platform"]);
    Assert.areEqual(process.arch, api["processor"]);
    Assert.areEqual("{\"background\":\"#181818\"}", JSON.stringify(api["appearance"]));
  }

  @TestMethod
  public startsWithoutAnAppearanceWhenItsWindowWasOpenedWithNone(): void {
    Assert.isNull(FakePreloadElectron.load().api("desktop")["appearance"]);
  }

  @TestMethod
  public exposesItsBridgeUnderTheNameAndChannelsItsSettingsGive(): void {
    const electron = FakePreloadElectron.load(`--desktop-preload=${JSON.stringify({ bridge: "other", pastedByteLimit: 1, appearance: null, channels: { page: "other:page", ready: "other:ready" } })}`);

    PreloadTests.invoke(electron.api("other")["notifyReady"], "ready");

    Assert.areEqual(JSON.stringify([["other:ready", "ready"]]), JSON.stringify(electron.sent.slice(1)));
    Assert.areEqual("other:page", electron.sent[0]?.[0]);
    Assert.throws(() => PreloadTests.invoke(electron.api("other")["notifyAppearance"], "appearance"), TypeError);
  }

  @TestMethod
  @TestData(null, Error)
  @TestData("--desktop-preload={not json", SyntaxError)
  @TestData("--desktop-preload=[]", TypeError)
  @TestData("--desktop-preload={\"bridge\":\"\",\"pastedByteLimit\":1,\"channels\":{}}", TypeError)
  @TestData("--desktop-preload={\"bridge\":\"desktop\",\"pastedByteLimit\":-1,\"channels\":{}}", TypeError)
  @TestData("--desktop-preload={\"bridge\":\"desktop\",\"pastedByteLimit\":1,\"channels\":null}", TypeError)
  public refusesToStartWithoutValidSettings(argument: string | null, failure: typeof Error): void {
    Assert.throws(() => FakePreloadElectron.load(argument), failure);
  }

  @TestMethod
  public async refusesAnAnswerOtherThanTrueOrFalseToAYesOrNoQuestion(): Promise<void> {
    const electron = FakePreloadElectron.load();
    electron.answer = (): unknown => "yes";

    const failure = await Assert.throwsAsync(async () => await PreloadTests.invoke(electron.api("desktop")["copyText"], "text"), TypeError);

    Assert.areEqual("The main process answered with something other than true or false on desktop:copyText", failure.message);
  }

  @TestMethod
  public sendsEachNoticeOnItsOwnChannel(): void {
    const electron = FakePreloadElectron.load();
    const api = electron.api("desktop");

    PreloadTests.invoke(api["notifyReady"], "ready");
    PreloadTests.invoke(api["notifyAppearance"], "appearance");
    PreloadTests.invoke(api["keepAppearance"], "preferences");
    PreloadTests.invoke(api["keepSpelling"], true, ["en-US"]);
    PreloadTests.invoke(api["setMenuBar"], "menus");
    PreloadTests.invoke(api["closeWebView"], "browser", "1");
    PreloadTests.invoke(api["setWebViewShortcuts"], ["Mod+K"]);
    PreloadTests.invoke(api["setAppShortcuts"], "shortcuts");
    PreloadTests.invoke(api["releaseWebViewFocus"], "browser", "1");
    PreloadTests.invoke(api["logModule"], "clock", "line");
    PreloadTests.invoke(api["logError"], null, "error");

    Assert.areEqual(JSON.stringify([
      ["desktop:ready", "ready"],
      ["desktop:appearance", "appearance"],
      ["desktop:keepAppearance", "preferences"],
      ["desktop:spelling", true, ["en-US"]],
      ["desktop:menuBar", "menus"],
      ["desktop:webViewClose", "browser", "1"],
      ["desktop:webViewShortcuts", ["Mod+K"]],
      ["desktop:appShortcuts", "shortcuts"],
      ["desktop:webViewFocusRelease", "browser", "1"],
      ["desktop:moduleLog", "clock", "line"],
      ["desktop:windowError", null, "error"]
    ]), JSON.stringify(electron.sent.slice(1)));
  }

  @TestMethod
  public async namesItsPageOnceAsItLoadsAndSendsThatNameWithEachRequest(): Promise<void> {
    const first = FakePreloadElectron.load();
    const second = FakePreloadElectron.load();
    const page = first.sent[0]?.[1];

    await PreloadTests.invoke(first.api("desktop")["request"], "notes.open", null);
    await PreloadTests.invoke(first.api("desktop")["request"], "notes.close", null);

    Assert.areEqual(JSON.stringify([["desktop:page", page]]), JSON.stringify(first.sent));
    Assert.isTrue(Object.isString(page) && page.length > 0);
    Assert.areNotEqual(page, second.sent[0]?.[1]);
    Assert.areEqual(JSON.stringify([["desktop:request", "notes.open", null, page], ["desktop:request", "notes.close", null, page]]), JSON.stringify(first.invoked));
  }

  @TestMethod
  public async asksEachQuestionOnItsOwnChannelAndAnswersWithTheReply(): Promise<void> {
    const electron = FakePreloadElectron.load();
    const api = electron.api("desktop");

    const replies = await Promise.all([
      PreloadTests.invoke(api["answerClose"], "request", true),
      PreloadTests.invoke(api["answerUpdateSave"], "request", ["Notes couldn't save"]),
      PreloadTests.invoke(api["readStartup"]),
      PreloadTests.invoke(api["actOnStartup"], "retry"),
      PreloadTests.invoke(api["readLayout"]),
      PreloadTests.invoke(api["writeLayout"], "layout"),
      PreloadTests.invoke(api["request"], "notes.open", "payload"),
      PreloadTests.invoke(api["readBuild"]),
      PreloadTests.invoke(api["copyText"], "text"),
      PreloadTests.invoke(api["copyImage"], "bytes"),
      PreloadTests.invoke(api["openLogFolder"]),
      PreloadTests.invoke(api["copyDetails"], "details"),
      PreloadTests.invoke(api["openLink"], "https://example.com/"),
      PreloadTests.invoke(api["showInFolder"], "/home/ada/report.pdf"),
      PreloadTests.invoke(api["openFile"], "/home/ada/notes.md"),
      PreloadTests.invoke(api["chooseFolder"]),
      PreloadTests.invoke(api["chooseFilePath"], "options"),
      PreloadTests.invoke(api["saveFile"], "photo.png", "bytes"),
      PreloadTests.invoke(api["chooseFiles"], "notes", "options"),
      PreloadTests.invoke(api["installCommand"]),
      PreloadTests.invoke(api["readUpdate"]),
      PreloadTests.invoke(api["actOnUpdate"], "Check"),
      PreloadTests.invoke(api["readSpelling"]),
      PreloadTests.invoke(api["replaceMisspelling"], "world"),
      PreloadTests.invoke(api["addToDictionary"], "Noldova Desktop Sample"),
      PreloadTests.invoke(api["edit"], "Copy"),
      PreloadTests.invoke(api["answerQuit"], "wait"),
      PreloadTests.invoke(api["readTrayAvailable"]),
      PreloadTests.invoke(api["readFullScreen"]),
      PreloadTests.invoke(api["readMaximized"]),
      PreloadTests.invoke(api["actOnWindow"], "Minimize"),
      PreloadTests.invoke(api["openWebView"], "browser", "pane", "workspace-1"),
      PreloadTests.invoke(api["attachWebView"], "browser", "1", 7),
      PreloadTests.invoke(api["navigateWebView"], "browser", "1", "https://example.com/"),
      PreloadTests.invoke(api["actOnWebView"], "browser", "1", "back"),
      PreloadTests.invoke(api["zoomWebView"], "browser", "1", "in"),
      PreloadTests.invoke(api["findInWebView"], "browser", "1", "next")
    ]);

    Assert.areEqual(JSON.stringify([
      ["desktop:closeAnswer", "request", true],
      ["desktop:updateSaveAnswer", "request", ["Notes couldn't save"]],
      ["desktop:readStartup"],
      ["desktop:startupAction", "retry"],
      ["desktop:readLayout"],
      ["desktop:writeLayout", "layout"],
      ["desktop:request", "notes.open", "payload", electron.sent[0]?.[1]],
      ["desktop:readBuild"],
      ["desktop:copyText", "text"],
      ["desktop:copyImage", "bytes"],
      ["desktop:openLogFolder"],
      ["desktop:copyDetails", "details"],
      ["desktop:openLink", "https://example.com/"],
      ["desktop:showInFolder", "/home/ada/report.pdf"],
      ["desktop:openFile", "/home/ada/notes.md"],
      ["desktop:chooseFolder"],
      ["desktop:chooseFilePath", "options"],
      ["desktop:saveFile", "photo.png", "bytes"],
      ["desktop:chooseFiles", "notes", "options", electron.sent[0]?.[1]],
      ["desktop:installCommand"],
      ["desktop:readUpdate"],
      ["desktop:updateAction", "Check"],
      ["desktop:readSpelling"],
      ["desktop:replaceMisspelling", "world"],
      ["desktop:addToDictionary", "Noldova Desktop Sample"],
      ["desktop:edit", "Copy"],
      ["desktop:quitAnswer", "wait"],
      ["desktop:readTrayAvailable"],
      ["desktop:readFullScreen"],
      ["desktop:readMaximized"],
      ["desktop:windowAction", "Minimize"],
      ["desktop:webViewOpen", "browser", "pane", "workspace-1"],
      ["desktop:webViewAttach", "browser", "1", 7],
      ["desktop:webViewNavigate", "browser", "1", "https://example.com/"],
      ["desktop:webViewAct", "browser", "1", "back"],
      ["desktop:webViewZoom", "browser", "1", "in"],
      ["desktop:webViewFind", "browser", "1", "next"]
    ]), JSON.stringify(electron.invoked));
    Assert.areEqual(JSON.stringify(electron.invoked.map(t => t.length % 2 === 0)), JSON.stringify(replies));
  }

  @TestMethod
  public async offersADroppedFileByItsPathAPastedOneByItsBytesAndAnOversizedPasteByItsSizeAlone(): Promise<void> {
    const electron = FakePreloadElectron.load();
    const file = (name: string, type: string, size: number, bytes: number[] = []): object =>
      ({ name, type, size, arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer) });
    const dropped = file("report.pdf", "application/pdf", 1204);
    electron.paths.set(dropped, "/home/ada/report.pdf");

    const reply = await PreloadTests.invoke(electron.api("desktop")["grantFiles"], "notes",
      [dropped, file("image.png", "image/png", 3, [1, 2, 3]), file("clip.bin", String.empty, 64 * 1024 * 1024 + 1)], "options");
    const refused = await PreloadTests.invoke(electron.api("desktop")["grantFiles"], "notes", ["not a file"], "options");

    const [channel, module, offered, options, page] = electron.invoked[0] ?? [];
    Assert.areEqual("desktop:grantFiles|notes|options|true", `${channel}|${module}|${options}|${page === electron.sent[0]?.[1]}`);
    Assert.areEqual(JSON.stringify([
      { name: "report.pdf", type: "application/pdf", path: "/home/ada/report.pdf", size: 1204 },
      { name: "image.png", type: "image/png", bytes: [1, 2, 3], size: 3 },
      { name: "clip.bin", type: String.empty, size: 64 * 1024 * 1024 + 1 }
    ]), JSON.stringify(offered, (_key, value: unknown) => value instanceof Uint8Array ? Array.from(value) : value));
    Assert.areEqual("[null]", JSON.stringify(electron.invoked[1]?.[2]));
    Assert.areEqual("false|false", `${reply}|${refused}`);
    Assert.areEqual(JSON.stringify(["desktop:windowError", null, "A file could not be offered, because its path could not be read: Not a file."]), JSON.stringify(electron.sent[1]));
  }

  @TestMethod
  public async passesOnAFailureOtherThanAnUnreadablePathWhileOfferingAFile(): Promise<void> {
    const electron = FakePreloadElectron.load();
    const file = { name: "report.pdf", type: "application/pdf", size: 1204, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
    const failure = new RangeError("The file was taken away.");
    electron.failures.set(file, failure);

    const thrown = await Assert.throwsAsync(async () => await PreloadTests.invoke(electron.api("desktop")["grantFiles"], "notes", [file], "options"), RangeError);

    Assert.areEqual(failure, thrown);
    Assert.areEqual(0, electron.invoked.length);
    Assert.areEqual(1, electron.sent.length);
  }

  @TestMethod
  public async offersByTheirSizeAloneThePastesThatWouldTakeOneCallPast64MiB(): Promise<void> {
    const electron = FakePreloadElectron.load();
    const file = (name: string, size: number): object => ({ name, type: String.empty, size, arrayBuffer: () => Promise.resolve(new Uint8Array([1]).buffer) });

    await PreloadTests.invoke(electron.api("desktop")["grantFiles"], "notes", [file("a.bin", 40 * 1024 * 1024), file("b.bin", 30 * 1024 * 1024), file("c.bin", 24 * 1024 * 1024)], "options");

    Assert.areEqual(JSON.stringify([
      { name: "a.bin", type: String.empty, bytes: [1], size: 40 * 1024 * 1024 },
      { name: "b.bin", type: String.empty, size: 30 * 1024 * 1024 },
      { name: "c.bin", type: String.empty, bytes: [1], size: 24 * 1024 * 1024 }
    ]), JSON.stringify(electron.invoked[0]?.[2], (_key, value: unknown) => value instanceof Uint8Array ? Array.from(value) : value));
  }

  @TestMethod
  @TestData("onCloseRequest", "desktop:closeRequest", 1)
  @TestData("onUpdateSaveRequest", "desktop:updateSaveRequest", 1)
  @TestData("onStartup", "desktop:startupState", 1)
  @TestData("onEvent", "desktop:runtimeEvent", 2)
  @TestData("onMenuCommand", "desktop:menuCommand", 1)
  @TestData("onFieldMenu", "desktop:fieldMenu", 1)
  @TestData("onNotificationOpened", "desktop:notificationOpened", 1)
  @TestData("onQuitQuestion", "desktop:quitQuestion", 1)
  @TestData("onUpdate", "desktop:updateState", 1)
  @TestData("onTrayAvailable", "desktop:trayAvailable", 1)
  @TestData("onFullScreen", "desktop:fullScreen", 1)
  @TestData("onMaximized", "desktop:maximized", 1)
  @TestData("onWebViewEvent", "desktop:webViewEvent", 1)
  @TestData("onWebViewShortcut", "desktop:webViewShortcut", 1)
  @TestData("onWebViewInput", "desktop:webViewInput", 1)
  public passesEachEventToItsListenerUntilTheListenerIsRemoved(member: string, channel: string, valueCount: number): void {
    const electron = FakePreloadElectron.load();
    const heard: unknown[][] = [];
    const values = ["first", "second"].slice(0, valueCount);

    const remove = PreloadTests.invoke(electron.api("desktop")[member], (...received: unknown[]) => heard.push(received));
    electron.emit(channel, ...values);
    PreloadTests.invoke(remove);
    electron.emit(channel, ...values);

    Assert.areEqual(JSON.stringify([values]), JSON.stringify(heard));
    Assert.areEqual(0, electron.count(channel));
  }

  private static invoke(method: unknown, ...values: unknown[]): unknown {
    if (!(method instanceof Function))
      throw new TypeError(String(method));
    const result: unknown = method(...values);
    return result;
  }
}
