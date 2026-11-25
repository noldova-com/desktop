/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import "@noldova/context.core";
import type { MenuItemConstructorOptions } from "electron";

import { Assert } from "@noldova/context.testing";
import { Installation, type LaunchSettings, type ProductTrayItem } from "@noldova/desktop.runtime";
import { MainProcess, MainProcessSettings, type IIpcEvent, type IUpdateCheckLock, type IUpdater } from "@noldova/desktop.electron";

import { Condition } from "./condition.fixture.js";
import { FakeMainProcessEnvironment } from "./fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "./fake-main-process-window.fixture.js";
import { FakeDeviceFiles } from "./fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "./fake-device-identity.fixture.js";
import { FakeElectron } from "./fake-electron.fixture.js";
import { FakePathCommand } from "./fake-path-command.fixture.js";
import { FakeRuntimeLauncher } from "./fake-runtime-launcher.fixture.js";
import { FakeUpdateCheckLock } from "./fake-update-check-lock.fixture.js";
import { FakeUpdateHandoff } from "./fake-update-handoff.fixture.js";

export class MainProcessStartFixture {
  public static readonly MODULE_URL: string = pathToFileURL("/noldova-desktop/node_modules/@noldova/desktop.electron/main.js").href;
  public static readonly DEVELOPMENT_APP_ID: string = `com.noldova.desktop.development.${createHash("sha256")
    .update(resolve(dirname(fileURLToPath(MainProcessStartFixture.MODULE_URL)), "..", "..", ".."))
    .digest("hex")
    .slice(0, 8)}`;

  public static readonly LOCAL_FEED: string = "http://127.0.0.1:47324/";
  public static readonly APPEARANCE: object = { background: "#181818", titleBar: "#181818", titleBarText: "#CCCCCC", titleBarHeight: 35 };

  public static async startAsync(
    electron: FakeElectron,
    process: FakeMainProcessEnvironment,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    files: FakeDeviceFiles = new FakeDeviceFiles(),
    pathCommand: FakePathCommand = new FakePathCommand(),
    installations: Installation[] = [],
    recordMainProcessAsync: (installation: Installation) => Promise<boolean> = () => Promise.resolve(true),
    createUpdater: (log: (text: string) => void, feed: string) => IUpdater | null = () => null,
    createUpdateLock: (log: (text: string) => void) => IUpdateCheckLock = () => new FakeUpdateCheckLock(),
    handoff: FakeUpdateHandoff = new FakeUpdateHandoff(),
    moduleUrl: string = MainProcessStartFixture.MODULE_URL,
    updateFeed: string | null = MainProcessStartFixture.LOCAL_FEED,
    tray: readonly ProductTrayItem[] | null = null): Promise<LaunchSettings[]> {
    const settings: LaunchSettings[] = [];
    await MainProcess.startAsync(electron, process, moduleUrl, (t, installation, log) => {
      settings.push(t);
      installations.push(installation);
      launcher.logs.push(log);
      return launcher;
    }, t => device.readAsync(t), (folder, fileName) => files.create(folder, fileName), t => pathCommand.create(t), recordMainProcessAsync, () => updateFeed, (_, feed, _logs, log) => {
      const updater = createUpdater(log, feed);
      return Object.isNull(updater) ? null : { updater, handoff };
    }, (_, log) => createUpdateLock(log), tray);
    return settings;
  }

  public static async startReadyAsync(
    platform: string,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    electron: FakeElectron = new FakeElectron(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    process: FakeMainProcessEnvironment = new FakeMainProcessEnvironment(platform),
    files: FakeDeviceFiles = new FakeDeviceFiles(),
    moduleUrl: string = MainProcessStartFixture.MODULE_URL,
    tray: readonly ProductTrayItem[] | null = null): Promise<FakeElectron> {
    await MainProcessStartFixture.startAsync(electron, process, launcher, device, files, undefined, undefined, undefined, undefined, undefined, undefined, moduleUrl, undefined, tray);
    await MainProcessStartFixture.openAsync(electron);
    await setImmediate();
    return electron;
  }

  public static async writeBarrierAsync(process: FakeMainProcessEnvironment, deviceFolder: string, barrier: string): Promise<Installation> {
    const installation = new Installation(Installation.locate(deviceFolder, process.execPath, process.platform), () => Promise.resolve(true));
    await mkdir(installation.folder, { recursive: true });
    await writeFile(installation.barrierFile, barrier);
    return installation;
  }

  public static async openAsync(electron: FakeElectron): Promise<void> {
    await electron.app.becomeReadyAsync();
    await Condition.waitAsync(() => electron.windows.length > 0);
  }

  public static async verifyMenuBarRefusedAsync(menuBar: string, reason: string): Promise<void> {
    const process = new FakeMainProcessEnvironment("darwin");
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const built = electron.menu.templates.length;

    electron.ipcMain.send("desktop:menuBar", MainProcessStartFixture.trustedEvent("darwin"), JSON.parse(menuBar));
    const errors = MainProcessStartFixture.readErrors(process, "The window sent a menu bar that is not valid, so the menu bar is unchanged: ");

    Assert.areEqual(built, electron.menu.templates.length);
    Assert.areEqual(1, errors.length);
    Assert.isTrue(errors[0]?.includes(reason) === true, errors.join("\n"));
  }

  public static readErrors(process: FakeMainProcessEnvironment, prefix: string): string[] {
    return process.errors.split("\n").map(t => t.slice(t.indexOf(" ") + 1)).filter(t => t.startsWith(prefix));
  }

  public static checkoutRoot(): string {
    return join(dirname(fileURLToPath(MainProcessStartFixture.MODULE_URL)), "..", "..", "..");
  }

  public static icon(name: string): string {
    return join(MainProcessStartFixture.checkoutRoot(), "assets", "icons", name);
  }

  public static async withIconsAsync(names: readonly string[], run: (icons: string, moduleUrl: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "desktop-app-icons-"));
    try {
      const icons = join(root, "assets", "icons");
      await mkdir(join(icons, "tray"), { recursive: true });
      await Promise.all(names.map(t => writeFile(join(icons, t), String.empty)));
      await run(icons, pathToFileURL(join(root, "node_modules", "@noldova", "desktop.electron", "main.js")).href);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  public static click(item: MenuItemConstructorOptions | undefined): void {
    const click: ((...values: never[]) => void) | undefined = item?.click;
    click?.();
  }

  public static firstWindow(electron: FakeElectron): FakeMainProcessWindow {
    const [window] = electron.windows;
    Assert.isDefined(window);
    return window;
  }

  public static async showAsync(electron: FakeElectron, platform: string, window: FakeMainProcessWindow): Promise<void> {
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent(platform, window.id), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
  }

  public static settings(platform: string): MainProcessSettings {
    return MainProcessSettings.fromModule(dirname(fileURLToPath(MainProcessStartFixture.MODULE_URL)), platform);
  }

  public static trustedEvent(platform: string, windowId: number = 1): IIpcEvent {
    return { sender: { id: windowId }, senderFrame: { url: MainProcessStartFixture.settings(platform).windowUrl, parent: null } };
  }

  public static closeRequests(window: FakeMainProcessWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:closeRequest").map(t => t[1]);
  }

  public static async answerSaveAsync(electron: FakeElectron, platform: string, window: FakeMainProcessWindow, count: number): Promise<void> {
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length >= count);
    await electron.ipcMain.invoke("desktop:closeAnswer", MainProcessStartFixture.trustedEvent(platform, window.id), MainProcessStartFixture.closeRequests(window)[count - 1], true);
  }
}
