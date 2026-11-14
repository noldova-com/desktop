/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class WindowTextLogTests {
  @TestMethod
  public async writesItsOwnWindowsModuleLinesToItsLogUnderTheModulesId(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = MainProcessStartFixture.trustedEvent("linux");

    electron.ipcMain.send("desktop:moduleLog", event, "notes", "Opened the list\r\nwith 3 notes\r2026-10-04T12:00:00.000Z shell: \u001b[1mfaked\n");
    electron.ipcMain.send("desktop:moduleLog", { ...event, senderFrame: null }, "notes", "Untrusted");
    electron.ipcMain.send("desktop:moduleLog", event, "Notes", "Not an id");
    electron.ipcMain.send("desktop:moduleLog", event, 7, "Not text");
    electron.ipcMain.send("desktop:moduleLog", event, "notes", 7);
    electron.ipcMain.send("desktop:moduleLog", event, "notes", `${"a ".repeat(32_767)}ab left out`);

    Assert.areEqual(JSON.stringify(["notes: Opened the list", "notes: with 3 notes", "notes: 2026-10-04T12:00:00.000Z shell: [1mfaked", `notes: ${"a ".repeat(32_767)}ab`]),
      JSON.stringify(process.errors.split("\n").filter(t => t.includes("notes: ")).map(t => t.slice(t.indexOf("notes: ")))));
    Assert.areEqual(0, process.errors.split("\n").filter(t => t.includes("Untrusted") || t.includes("Not ")).length);
  }

  @TestMethod
  public async writesItsOwnWindowsErrorsToItsLogRedactedAndUnderTheModulesIdWhenThereIsOne(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = MainProcessStartFixture.trustedEvent("linux");

    electron.ipcMain.send("desktop:windowError", event, null,
      `Error: The layout could not be saved.\u20282026-10-04T12:00:00.000Z Faked record\n    at save (${process.homeFolder}/noldova-desktop/window.js:1:2)\n`);
    electron.ipcMain.send("desktop:windowError", event, "clock", "Error: Its window part failed to activate.");
    electron.ipcMain.send("desktop:windowError", { ...event, senderFrame: null }, null, "Untrusted");
    electron.ipcMain.send("desktop:windowError", event, "Clock", "Not an id");
    electron.ipcMain.send("desktop:windowError", event, 7, "Not an id either");
    electron.ipcMain.send("desktop:windowError", event, null, 7);
    electron.ipcMain.send("desktop:windowError", event, null, `${"a ".repeat(32_767)}ab left out`);

    const lines = process.errors.split("\n").filter(t => t.includes("Window error")).map(t => t.slice(t.indexOf("Window error")));
    Assert.areEqual(JSON.stringify([
      "Window error: Error: The layout could not be saved.",
      "Window error: 2026-10-04T12:00:00.000Z Faked record",
      "Window error:     at save (~/noldova-desktop/window.js:1:2)",
      "Window error in clock: Error: Its window part failed to activate.",
      `Window error: ${"a ".repeat(32_767)}ab`
    ]), JSON.stringify(lines));
    Assert.areEqual(0, process.errors.split("\n").filter(t => t.includes("Untrusted") || t.includes("Not an id")).length);
  }

  @TestMethod
  public async writesTenErrorsFromAWindowThenOneNoticeAndLeavesOutTheRestOfTheMinute(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = MainProcessStartFixture.trustedEvent("linux");

    electron.ipcMain.send("desktop:windowError", event, "Clock", "Not counted");
    for (let index = 0; index < 12; index++)
      electron.ipcMain.send("desktop:windowError", event, null, `Error ${index}`);

    const lines = process.errors.split("\n").filter(t => t.includes("Window error") || t.includes("errors are left out")).map(t => t.slice(t.indexOf(" ") + 1));
    Assert.areEqual(JSON.stringify([
      ...Array.from({ length: 10 }, (_, index) => `Window error: Error ${index}`),
      "The window reported more than ten errors within a minute; the rest of that minute's errors are left out of the log."
    ]), JSON.stringify(lines));
  }
}
