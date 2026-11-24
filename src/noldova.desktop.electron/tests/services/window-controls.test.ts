/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import type { MenuItemConstructorOptions } from "electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class WindowControlsTests {
  @TestMethod
  public async runsNoMenuRowOnceItsWindowHasClosed(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("darwin");
    const window = MainProcessStartFixture.firstWindow(electron);
    window.gainFocus();
    electron.ipcMain.send("desktop:menuBar", MainProcessStartFixture.trustedEvent("darwin"),
      { menus: [{ place: "desktop.file", title: "File", rows: [{ type: "Command", id: "desktop.file/desktop.close/0", label: "Close the tab", key: null, enabled: true, check: "None", checked: false }] }], undo: null });
    const file = electron.menu.templates.at(-1)?.[1]?.submenu;

    window.destroy();
    Assert.isTrue(Array.isArray(file));
    MainProcessStartFixture.click(file[0]);

    Assert.areEqual(0, window.webContents.sent.filter(t => t[0] === "desktop:menuCommand").length);
  }

  @TestMethod
  public async putsBackTheStandardMenuBarOnMacOsOnceTheWindowWhoseMenuItShowsHasClosed(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("darwin");
    const window = MainProcessStartFixture.firstWindow(electron);
    window.gainFocus();
    const standard = electron.menu.menu;
    electron.ipcMain.send("desktop:menuBar", MainProcessStartFixture.trustedEvent("darwin"),
      { menus: [{ place: "desktop.file", title: "File", rows: [{ type: "Command", id: "desktop.file/desktop.close/0", label: "Close the tab", key: null, enabled: true, check: "None", checked: false }] }], undo: null });
    const shown = electron.menu.menu;

    window.destroy();

    const templateOf = (menu: unknown): readonly MenuItemConstructorOptions[] => electron.menu.templates.find(t => t === menu) ?? [];
    const labels = (menu: unknown): string => templateOf(menu).map(t => t.label).join(",");
    const app = templateOf(electron.menu.menu)[0]?.submenu;
    Assert.areEqual("File", templateOf(shown).slice(1).map(t => t.label).join(","));
    Assert.areEqual("Edit,Window", templateOf(electron.menu.menu).slice(1).map(t => t.label).join(","));
    Assert.areEqual(labels(standard), labels(electron.menu.menu));
    Assert.isFalse(standard === electron.menu.menu);
    Assert.isTrue(Array.isArray(app) && app.some(t => t.role === "quit"));
  }

  @TestMethod
  public async keepsTheMenuBarWhenAWindowWhoseMenuItDoesNotShowCloses(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("darwin");
    const window = MainProcessStartFixture.firstWindow(electron);
    const standard = electron.menu.menu;
    const built = electron.menu.templates.length;

    window.gainFocus();
    window.destroy();

    Assert.isTrue(standard === electron.menu.menu);
    Assert.areEqual(built, electron.menu.templates.length);
  }

  @TestMethod
  public async keepsTheBarAWindowSendsWhileAnotherAppHasTheFocusAndShowsItOnceTheWindowHasTheFocusAgain(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("darwin");
    const window = MainProcessStartFixture.firstWindow(electron);
    const standard = electron.menu.menu;
    const bar = (title: string): unknown => ({ menus: [{ place: "desktop.file", title, rows: [] }], undo: null });
    const titles = (): string => (electron.menu.templates.find(t => t === electron.menu.menu) ?? []).slice(1).map(t => t.label).join(",");
    window.gainFocus();
    electron.ipcMain.send("desktop:menuBar", MainProcessStartFixture.trustedEvent("darwin"), bar("Focused"));
    const focused = titles();
    window.isFocusedNow = false;

    electron.ipcMain.send("desktop:menuBar", MainProcessStartFixture.trustedEvent("darwin"), bar("Late"));
    const late = titles();
    window.gainFocus();

    Assert.isFalse(standard === electron.menu.menu);
    Assert.areEqual("Focused", focused);
    Assert.areEqual("Focused", late);
    Assert.areEqual("Late", titles());
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("win32", true)
  @TestData("darwin", false)
  public async leavesTheMenuBarAloneOnWindowsAndLinuxAndForAnotherSender(platform: string, isTrusted: boolean): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    const built = electron.menu.templates.length;

    window.gainFocus();
    electron.ipcMain.send("desktop:menuBar", isTrusted ? MainProcessStartFixture.trustedEvent(platform) : { sender: { id: 1 }, senderFrame: null }, { menus: [], undo: null });
    window.gainFocus();

    Assert.areEqual(built, electron.menu.templates.length);
  }

  @TestMethod
  public async minimizesTogglesMaximizedAndClosesItsOwnWindowWithTheThreeWindowActionsOnly(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const window = MainProcessStartFixture.firstWindow(electron);
    window.calls.length = 0;

    const refused = electron.ipcMain.invoke("desktop:windowAction", { sender: { id: 1 }, senderFrame: null }, "Minimize");
    const answers = ["Minimize", "ToggleMaximized", "ToggleMaximized", "Maximize", "Restore", "minimize", "fullScreen", 5, "Close"]
      .map(t => electron.ipcMain.invoke("desktop:windowAction", trusted, t));

    Assert.areEqual(false, refused);
    Assert.areEqual(JSON.stringify([true, true, true, false, false, false, false, false, true]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["minimize", "maximize", "unmaximize", "close"]), JSON.stringify(window.calls));
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
    Assert.isTrue(electron.ipcMain.invoke("desktop:closeAnswer", trusted, MainProcessStartFixture.closeRequests(window)[0], false) === true);
  }

  @TestMethod
  @TestData(false, "maximize")
  @TestData(true, "unmaximize")
  public async togglesMaximizedFromTheWindowsOwnStateWhoeverChangedItLast(isMaximized: boolean, call: string): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const window = MainProcessStartFixture.firstWindow(electron);
    window.isMaximizedNow = isMaximized;
    window.calls.length = 0;

    const answer = electron.ipcMain.invoke("desktop:windowAction", trusted, "ToggleMaximized");

    Assert.areEqual(true, answer);
    Assert.areEqual(JSON.stringify([call]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async pointsTheDictionaryDownloadAtItsProfilesOwnFolderAtReadyAndTakesSpellingPreferencesOnlyFromItsOwnWindow(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const untrusted = { sender: { id: 1 }, senderFrame: null };

    const offer = electron.ipcMain.invoke("desktop:readSpelling", trusted);
    const refused = electron.ipcMain.invoke("desktop:readSpelling", untrusted);
    electron.ipcMain.send("desktop:spelling", trusted, false, ["en-US"]);
    electron.ipcMain.send("desktop:spelling", untrusted, true, []);
    electron.ipcMain.send("desktop:spelling", trusted, "yes", []);
    electron.ipcMain.send("desktop:spelling", trusted, true, "en-US");
    electron.ipcMain.send("desktop:spelling", trusted, true, [1]);
    electron.defaultSession.refusal = new Error("Refused.");
    electron.ipcMain.send("desktop:spelling", trusted, true, []);

    const profile = electron.app.calls.find(t => t.startsWith("setPath userData "))?.slice("setPath userData ".length) ?? String.empty;

    Assert.areEqual(`url ${pathToFileURL(join(profile, "Dictionaries")).href}/|languages |enabled false|languages |enabled true`, electron.defaultSession.spellCalls.join("|"));
    Assert.isTrue(electron.defaultSession.spellCalls[0]?.startsWith("url file:///") === true, electron.defaultSession.spellCalls.join("|"));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The spell checker refused the languages : Error: Refused.").length);
    Assert.areEqual("{\"languages\":[],\"fallback\":null}", JSON.stringify(offer));
    Assert.isNull(refused);
    Assert.areEqual(3, MainProcessStartFixture.readErrors(process, "The window's spelling preferences were rejected: ").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The list of shipped dictionaries could not be read, so no spelling language is offered: ").length);
  }

  @TestMethod
  public async forwardsEachMenuOfItsOwnWindowAndReplacesOrAddsAWordOnlyForIt(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const untrusted = { sender: { id: 1 }, senderFrame: null };
    const contents = electron.windows[0]?.webContents ?? null;
    Assert.isNotNull(contents);

    contents.askForMenu({ x: 10, y: 20, misspelledWord: "wrold", dictionarySuggestions: ["world", "wold"], menuSourceType: "mouse" });
    contents.askForMenu({ x: 3, y: 4, misspelledWord: String.empty, dictionarySuggestions: [], menuSourceType: "keyboard" });
    const answers = [
      electron.ipcMain.invoke("desktop:replaceMisspelling", trusted, "world"),
      electron.ipcMain.invoke("desktop:replaceMisspelling", untrusted, "world"),
      electron.ipcMain.invoke("desktop:replaceMisspelling", trusted, String.empty),
      electron.ipcMain.invoke("desktop:replaceMisspelling", trusted, 5),
      electron.ipcMain.invoke("desktop:replaceMisspelling", trusted, "x".repeat(101)),
      electron.ipcMain.invoke("desktop:addToDictionary", trusted, "Studio"),
      electron.ipcMain.invoke("desktop:addToDictionary", untrusted, "Studio"),
      electron.ipcMain.invoke("desktop:addToDictionary", trusted, "two words"),
      electron.ipcMain.invoke("desktop:addToDictionary", trusted, "x".repeat(101)),
      electron.ipcMain.invoke("desktop:addToDictionary", trusted, 5)
    ];

    Assert.areEqual(JSON.stringify([
      ["desktop:fieldMenu", { x: 10, y: 20, isKeyboard: false, word: "wrold", suggestions: ["world", "wold"] }],
      ["desktop:fieldMenu", { x: 3, y: 4, isKeyboard: true, word: String.empty, suggestions: [] }]
    ]), JSON.stringify(contents.sent.filter(t => t[0] === "desktop:fieldMenu")));
    Assert.areEqual("true,false,false,false,false,true,false,false,false,false", answers.join(","));
    Assert.areEqual("replaceMisspelling world", contents.calls.filter(t => t.startsWith("replace")).join("|"));
    Assert.areEqual("add Studio", electron.defaultSession.spellCalls.filter(t => t.startsWith("add")).join("|"));
  }

  @TestMethod
  public async editsItsOwnWindowWithTheSixEditActionsOnly(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    const answers = ["Undo", "Redo", "Cut", "Copy", "Paste", "SelectAll", "undo", "reload", 5].map(t => electron.ipcMain.invoke("desktop:edit", trusted, t));
    const refused = electron.ipcMain.invoke("desktop:edit", { sender: { id: 1 }, senderFrame: null }, "Copy");

    Assert.areEqual(JSON.stringify([true, true, true, true, true, true, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(false, refused);
    Assert.areEqual(JSON.stringify(["undo", "redo", "cut", "copy", "paste", "selectAll"]), JSON.stringify(window.webContents.calls));
  }
}
