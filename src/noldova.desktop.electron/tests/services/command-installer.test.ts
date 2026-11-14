/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PathCommandException, PathCommandOutcome } from "@noldova/desktop.electron";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class CommandInstallerTests {
  @TestMethod
  public async installsTheCommandOnMacosForItsOwnWindowAndShowsWhatHappened(): Promise<void> {
    const electron = new FakeElectron();
    const pathCommand = new FakePathCommand();
    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("darwin"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), pathCommand);
    await MainProcessStartFixture.openAsync(electron);
    electron.dialog.answers.push(0, 0, 0, 0);
    const answers = [await electron.ipcMain.invoke("desktop:installCommand", { sender: { id: 1 }, senderFrame: null })];

    for (const outcome of [PathCommandOutcome.Installed, PathCommandOutcome.AlreadyInstalled, PathCommandOutcome.Occupied, PathCommandOutcome.Missing, PathCommandOutcome.Cancelled]) {
      pathCommand.outcome = outcome;
      answers.push(await electron.ipcMain.invoke("desktop:installCommand", MainProcessStartFixture.trustedEvent("darwin")));
    }

    Assert.areEqual(JSON.stringify([false, true, true, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["/electron/electron", "/electron/electron", "/electron/electron", "/electron/electron", "/electron/electron"]), JSON.stringify(pathCommand.executablePaths));
    Assert.areEqual(JSON.stringify([
      [1, "info", "The noldova-desktop command is installed.", "/usr/local/bin/noldova-desktop links to the command inside Noldova Desktop Sample. Terminals opened from now on run it as noldova-desktop."],
      [1, "info", "The noldova-desktop command is already installed.", "/usr/local/bin/noldova-desktop already links to the command inside this Noldova Desktop Sample."],
      [1, "warning", "The noldova-desktop command was not installed.", "/usr/local/bin/noldova-desktop is a file that is not a link, so Noldova Desktop Sample leaves it alone. Move or remove it, then install the command again."],
      [1, "warning", "The noldova-desktop command was not installed.", "This build of Noldova Desktop Sample has no command to link; an installed Noldova Desktop Sample has one."]
    ]), JSON.stringify(electron.dialog.boxes.map(t => [t.windowId, t.options.type, t.options.message, t.options.detail])));
  }

  @TestMethod
  public async refusesTheCommandOffMacosAndShowsAndLogsAFailureToInstallIt(): Promise<void> {
    const linux = new FakeElectron();
    const mac = new FakeElectron();
    const process = new FakeMainProcessEnvironment("darwin");
    const pathCommand = new FakePathCommand();
    await MainProcessStartFixture.startAsync(linux, new FakeMainProcessEnvironment("linux"));
    await MainProcessStartFixture.startAsync(mac, process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), pathCommand);
    await MainProcessStartFixture.openAsync(linux);
    await MainProcessStartFixture.openAsync(mac);
    mac.dialog.answers.push(0);
    pathCommand.failure = new PathCommandException("/usr/local/bin/noldova-desktop", new Error("Command failed: /usr/bin/osascript"));

    const refused = await linux.ipcMain.invoke("desktop:installCommand", MainProcessStartFixture.trustedEvent("linux"));
    const failed = await mac.ipcMain.invoke("desktop:installCommand", MainProcessStartFixture.trustedEvent("darwin"));
    pathCommand.failure = new RangeError("The fixture broke.");
    const unexpected = await Assert.throwsAsync(async () => await mac.ipcMain.invoke("desktop:installCommand", MainProcessStartFixture.trustedEvent("darwin")), RangeError);

    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify([refused, failed]));
    Assert.areEqual(0, linux.dialog.boxes.length);
    Assert.areEqual(JSON.stringify([[1, "warning", "The noldova-desktop command was not installed.", "The noldova-desktop command could not be linked at /usr/local/bin/noldova-desktop: Error: Command failed: /usr/bin/osascript"]]),
      JSON.stringify(mac.dialog.boxes.map(t => [t.windowId, t.options.type, t.options.message, t.options.detail])));
    Assert.isTrue(process.errors.includes("The noldova-desktop command could not be linked at /usr/local/bin/noldova-desktop: Error: Command failed: /usr/bin/osascript"), process.errors);
    Assert.areEqual("The fixture broke.", unexpected.message);
  }
}
