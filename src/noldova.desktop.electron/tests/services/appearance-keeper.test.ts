/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { PreloadArgumentFixture } from "../fixtures/preload-argument.fixture.js";

@TestClass
export class AppearanceKeeperTests {
  @TestMethod
  public async showsTheWindowInTheAppearanceItsPageReports(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async showsTheWindowWithoutAnAppearanceItCannotUse(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), { background: "red" });
    await Condition.waitAsync(() => window.isShown);

    Assert.isNull(window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify(["The window reported an appearance that is not valid, so it is shown without it: JsonException: $.titleBar: The field is required."]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The window reported")));
  }

  @TestMethod
  public async keepsTheWindowHiddenWhenAChangedAppearanceComesBeforeTheFirstOne(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:appearance", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.isFalse(window.isShown);
  }

  @TestMethod
  public async keepsTheWindowsColorsWhenAChangedAppearanceCannotBeUsed(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);

    electron.ipcMain.send("desktop:appearance", MainProcessStartFixture.trustedEvent("linux"), { background: "red" });

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The window reported").length);
  }

  @TestMethod
  public async opensItsWindowWithTheDevicesLastAppearanceAndKeepsTheOneItsWindowReports(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.appearance.kept = { "desktop.mode": "Dark" };
    const process = new FakeMainProcessEnvironment("darwin", ["--device-dir=/devices/this"]);
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", undefined, undefined, undefined, process, files);
    const event = MainProcessStartFixture.trustedEvent("darwin");

    electron.ipcMain.send("desktop:keepAppearance", { sender: { id: 1 }, senderFrame: null }, { "desktop.mode": "System" });
    electron.ipcMain.send("desktop:keepAppearance", event, ["desktop.mode"]);
    electron.ipcMain.send("desktop:keepAppearance", event, { "desktop.theme": "x".repeat(4100) });
    electron.ipcMain.send("desktop:keepAppearance", event, { "desktop.mode": "Light" });
    MainProcessStartFixture.firstWindow(electron).destroy();
    electron.app.emit("activate");

    Assert.areEqual("/devices/this", files.created.find(t => t.fileName === "appearance.json")?.folder);
    Assert.areEqual("{\"desktop.mode\":\"Dark\"}", PreloadArgumentFixture.readAppearance(electron.windows[0]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify([{ "desktop.mode": "Light" }]), JSON.stringify(files.appearance.writes));
    Assert.areEqual("{\"desktop.mode\":\"Light\"}", PreloadArgumentFixture.readAppearance(electron.windows[1]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(2, MainProcessStartFixture.readErrors(process, "The window's appearance preferences are not valid, so they are not kept").length);
  }

  @TestMethod
  public async opensItsWindowInTheDefaultAppearanceWhenTheLastOneCannotBeReadAndReportsOneItCannotKeep(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.appearance.readFailure = new SyntaxError("Unexpected end of JSON input");
    files.appearance.writeFailure = new Error("The disk is full.");
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", undefined, undefined, undefined, process, files);

    electron.ipcMain.send("desktop:keepAppearance", MainProcessStartFixture.trustedEvent("linux"), { "desktop.mode": "Dark" });
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The device's appearance could not be kept").length > 0);

    Assert.areEqual("null", PreloadArgumentFixture.readAppearance(MainProcessStartFixture.firstWindow(electron).options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify(["The device's last appearance could not be read, so the window starts in the default appearance: SyntaxError: Unexpected end of JSON input"]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The device's last appearance")));
    Assert.areEqual(JSON.stringify(["The device's appearance could not be kept for the next start: Error: The disk is full."]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The device's appearance could not be kept")));
  }
}
