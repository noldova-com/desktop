/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Event, NotificationBroadcast, QualifiedName, RecentCommands, ShellEvents } from "@noldova/desktop.protocol";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class RuntimeEventsTests {
  @TestMethod
  public async givesItsWindowsTheNotificationStateForTheirOwnDeviceOnly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    await RuntimeEventsTests.invokeAsync(electron, "desktop:readLayout", MainProcessStartFixture.trustedEvent("linux"));
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lostLauncher = new FakeRuntimeLauncher();
    const lost = await MainProcessStartFixture.startReadyAsync("linux", lostLauncher, new FakeElectron(), unidentified);
    await RuntimeEventsTests.invokeAsync(lost, "desktop:readLayout", MainProcessStartFixture.trustedEvent("linux"));
    const broadcast = (devices: readonly string[]): Event => new Event(ShellEvents.notifications, new NotificationBroadcast([], devices, ["notes"], 4).toJson());

    launcher.listener?.onEvent(broadcast([FakeDeviceIdentity.ID, "desk"]));
    launcher.listener?.onEvent(broadcast(["desk"]));
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [] }));
    lostLauncher.listener?.onEvent(broadcast([FakeDeviceIdentity.ID]));

    Assert.areEqual(
      JSON.stringify([
        ["desktop:runtimeEvent", "desktop.notifications", { notifications: [], isDoNotDisturb: true, mutedModules: ["notes"], sequence: 4 }],
        ["desktop:runtimeEvent", "desktop.notifications", { notifications: [], isDoNotDisturb: false, mutedModules: ["notes"], sequence: 4 }]
      ]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
    Assert.areEqual(
      JSON.stringify([["desktop:runtimeEvent", "desktop.notifications", { notifications: [], isDoNotDisturb: false, mutedModules: ["notes"], sequence: 4 }]]),
      JSON.stringify(MainProcessStartFixture.firstWindow(lost).webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime's event desktop.notifications could not be passed to the window").length);
  }

  @TestMethod
  public async passesTheRuntimesEventsToItsWindowsThatRemain(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);

    launcher.listener?.onEvent(new Event(new QualifiedName("notes", "changed"), { path: "/notes/a.md" }));
    window.isGone = true;
    launcher.listener?.onEvent(new Event(new QualifiedName("notes", "changed"), null));

    Assert.areEqual(
      JSON.stringify([["desktop:runtimeEvent", "notes.changed", { path: "/notes/a.md" }]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
  }

  @TestMethod
  public async passesAnEventForOneWindowToThatWindowAlone(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);

    launcher.listener?.onEvent(new Event(new QualifiedName("terminal", "output"), "mine", window.webContents.id));
    launcher.listener?.onEvent(new Event(new QualifiedName("terminal", "output"), "another's", window.webContents.id + 1));

    Assert.areEqual(
      JSON.stringify([["desktop:runtimeEvent", "terminal.output", "mine"]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
  }

  @TestMethod
  public async passesASettingChangeOnlyToTheDeviceItConcernsWithoutItsDevice(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    const changed = new QualifiedName("desktop", "settingsChanged");

    launcher.listener?.onEvent(new Event(changed, { name: "desktop.mode", value: "Dark", isSet: true }));
    launcher.listener?.onEvent(new Event(changed, { name: "desktop.panelSize", device: FakeDeviceIdentity.ID, value: 13, isSet: false }));
    launcher.listener?.onEvent(new Event(changed, { name: "desktop.panelSize", device: "another", value: 16, isSet: true }));
    launcher.listener?.onEvent(new Event(changed, { value: 17 }));

    Assert.areEqual(
      JSON.stringify([
        ["desktop:runtimeEvent", "desktop.settingsChanged", { name: "desktop.mode", value: "Dark", isSet: true }],
        ["desktop:runtimeEvent", "desktop.settingsChanged", { name: "desktop.panelSize", value: 13, isSet: false }]
      ]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime's event desktop.settingsChanged could not be passed to the window").length);
  }

  @TestMethod
  public async passesOnlyTheSettingChangesForNoDeviceWhileItsOwnDeviceIsUnknown(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), unidentified);
    const window = MainProcessStartFixture.firstWindow(electron);
    await RuntimeEventsTests.invokeAsync(electron, "desktop:readLayout", MainProcessStartFixture.trustedEvent("linux"));
    const changed = new QualifiedName("desktop", "settingsChanged");

    launcher.listener?.onEvent(new Event(changed, { name: "desktop.mode", value: "Dark", isSet: true }));
    launcher.listener?.onEvent(new Event(changed, { name: "desktop.panelSize", device: FakeDeviceIdentity.ID, value: 13, isSet: false }));

    Assert.areEqual(
      JSON.stringify([["desktop:runtimeEvent", "desktop.settingsChanged", { name: "desktop.mode", value: "Dark", isSet: true }]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
  }

  @TestMethod
  public async passesRecentCommandsOnlyToTheDeviceThatRanThemWithoutItsDevice(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    await RuntimeEventsTests.invokeAsync(electron, "desktop:readLayout", MainProcessStartFixture.trustedEvent("linux"));

    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, new RecentCommands(["notes.newNote"], FakeDeviceIdentity.ID).toJson()));
    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, new RecentCommands(["clock.show"], "another").toJson()));
    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, { device: FakeDeviceIdentity.ID }));

    Assert.areEqual(
      JSON.stringify([["desktop:runtimeEvent", "desktop.recentCommandsChanged", { ids: ["notes.newNote"] }]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime's event desktop.recentCommandsChanged could not be passed to the window").length);
  }

  @TestMethod
  public async passesRecentCommandsForNoDeviceWhileItsOwnDeviceIsUnknown(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), unidentified);
    const window = MainProcessStartFixture.firstWindow(electron);
    await RuntimeEventsTests.invokeAsync(electron, "desktop:readLayout", MainProcessStartFixture.trustedEvent("linux"));

    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, new RecentCommands(["notes.newNote"]).toJson()));
    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, new RecentCommands(["clock.show"], FakeDeviceIdentity.ID).toJson()));

    Assert.areEqual(
      JSON.stringify([["desktop:runtimeEvent", "desktop.recentCommandsChanged", { ids: ["notes.newNote"] }]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:runtimeEvent")));
  }

  private static async invokeAsync(electron: FakeElectron, channel: string, event: IIpcEvent, ...values: unknown[]): Promise<JsonObject> {
    return JsonReader.fromValue(await electron.ipcMain.invoke(channel, event, ...values)).toJson();
  }
}
