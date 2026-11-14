/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Event, Failure, FailureCode, Response, ShellEvents, UpdateReady } from "@noldova/desktop.protocol";
import { DataDirectory, Installation, ProductInfo, RuntimeDiscovery } from "@noldova/desktop.runtime";
import { type IIpcEvent, InstallerNotHeldException } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { FakeUpdateHandoff } from "../fixtures/fake-update-handoff.fixture.js";
import { FakeUpdater } from "../fixtures/fake-updater.fixture.js";

@TestClass
export class UpdateRestartTests {
  @TestMethod
  @TestData("win32")
  @TestData("linux")
  public async quitsAtOnceWithoutAskingAgainOnceTheHandoffSucceeds(platform: string): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await UpdateRestartTests.restartToUpdateAsync(platform, handoff, async electron => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify(["999.0.0"]), JSON.stringify(handoff.handedOff));
      Assert.isFalse(electron.app.calls.includes("quit prevented"));
      Assert.areEqual(0, electron.nativeUpdater.installs);
    });
  }

  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  public async keepsItsFoldersForTheNewVersionThatWindowsOrMacOSStartsWithoutArguments(platform: string): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const kept: (JsonReader | null)[] = [];
    const before = Date.now();
    await UpdateRestartTests.restartToUpdateAsync(platform, handoff, async (electron, mainProcess) => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0") || electron.nativeUpdater.installs > 0);

      Assert.areEqual(JSON.stringify([{ version: "999.0.0", arguments: [`--device-dir=${dirname(mainProcess.temporaryFolder)}`] }]),
        JSON.stringify(kept.map(t => ({ version: t?.readString("version"), arguments: t?.readStringArray("arguments") }))));
      const written = Number(kept[0]?.readNumber("written"));
      Assert.isTrue(written >= before && written <= Date.now(), String(written));
    }, null, true, process.pid, mainProcess => {
      handoff.handOff = async () => {
        kept.push(await UpdateRestartTests.readKeptAsync(mainProcess));
        return 5230;
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async quitsAfterAHandoffItsBarrierCannotRecordAndLogsItOnce(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async (electron, mainProcess) => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify(["999.0.0"]), JSON.stringify(handoff.handedOff));
      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess, "The process that took over the update could not be recorded in the update's barrier: ").length);
    }, null, true, process.pid, (_mainProcess, installation) => {
      handoff.handOff = async () => {
        await rm(installation.barrierFile);
        await mkdir(installation.barrierFile);
        return process.pid;
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async keepsNoFoldersOnLinuxWhereTheRestartPassesThemOn(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const kept: unknown[] = [];
    await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async electron => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify([null]), JSON.stringify(kept));
    }, null, true, process.pid, mainProcess => {
      handoff.handOff = async () => {
        kept.push(await UpdateRestartTests.readKeptAsync(mainProcess));
        return null;
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async failsTheUpdateWithoutHandingItOffWhenItCannotKeepItsFolders(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await UpdateRestartTests.restartToUpdateAsync("win32", handoff, async electron => {
      const trusted = MainProcessStartFixture.trustedEvent("win32");
      await Condition.waitAsync(() => !Object.isNull(JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readNullableString("reason")));

      Assert.areEqual("Noldova Desktop Sample couldn't keep its data and device folders for the new version, so the update wasn't installed.",
        JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readNullableString("reason"));
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, null, true, process.pid, mainProcess => mkdir(join(UpdateRestartTests.keptFile(mainProcess), "held"), { recursive: true }));
  }

  @TestMethod
  public async logsTheKeptFoldersItCouldNotRemoveAfterAHandoffThatFailed(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await UpdateRestartTests.restartToUpdateAsync("win32", handoff, async (_electron, mainProcess) => {
      await Condition.waitAsync(() => MainProcessStartFixture.readErrors(mainProcess, "The update failed: ").length === 1);

      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess, "The folders kept for the new version could not be removed after the update failed: ").length);
      Assert.areEqual(JSON.stringify(["The update failed: The update's installer couldn't be held unchanged for its start (Windows error 32)."]), JSON.stringify(MainProcessStartFixture.readErrors(mainProcess, "The update failed: ")));
    }, null, true, process.pid, mainProcess => {
      handoff.handOff = async () => {
        const file = UpdateRestartTests.keptFile(mainProcess);
        await rm(file);
        await mkdir(join(file, "held"), { recursive: true });
        throw new InstallerNotHeldException(32);
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async stopsItsTrayHostMonitorAndTrayBeforeItExitsAfterTheHandoff(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async (electron, mainProcess) => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(1, mainProcess.programs.starts.length);
      Assert.areEqual(1, mainProcess.programs.stops);
      Assert.isUndefined(electron.tray.shown);
    });
  }

  @TestMethod
  public async restartsToTheUpdateFromTheTrayThroughTheSameHandoff(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await UpdateRestartTests.restartToUpdateAsync("win32", handoff, async electron => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify(["999.0.0"]), JSON.stringify(handoff.handedOff));
    }, null, true, process.pid, () => Promise.resolve(), electron => {
      const item = electron.menu.templates.find(t => t === electron.tray.shown?.menus.at(-1))?.find(t => t.label === "Restart to update to 999.0.0");
      Assert.isDefined(item);
      MainProcessStartFixture.click(item);
      return true;
    });
  }

  @TestMethod
  public async quitsThroughSquirrelOnMacOSWithoutAskingAgainOnceTheHandoffSucceeds(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.resolve(5230);
    await UpdateRestartTests.restartToUpdateAsync("darwin", handoff, async electron => {
      await Condition.waitAsync(() => electron.nativeUpdater.installs > 0);

      Assert.areEqual(1, electron.nativeUpdater.installs);
      Assert.isTrue(MainProcessStartFixture.firstWindow(electron).isGone);
      Assert.isTrue(electron.app.calls.includes("quit"));
      Assert.isFalse(electron.app.calls.includes("quit prevented"));
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    });
  }

  @TestMethod
  @TestData("win32")
  @TestData("linux")
  @TestData("darwin")
  public async stillAsksBeforeQuittingAfterAHandoffThatFailed(platform: string): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.reject(new InstallerNotHeldException(32));
    await UpdateRestartTests.restartToUpdateAsync(platform, handoff, async (electron, mainProcess) => {
      const trusted = MainProcessStartFixture.trustedEvent(platform);
      await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readNullableString("reason") === "The update's installer couldn't be held unchanged for its start (Windows error 32).");

      const window = MainProcessStartFixture.firstWindow(electron);
      electron.app.quit();
      await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
      electron.ipcMain.invoke("desktop:closeAnswer", MainProcessStartFixture.trustedEvent(platform), MainProcessStartFixture.closeRequests(window)[0], false);

      Assert.isTrue(electron.app.calls.includes("quit prevented"));
      Assert.isFalse(electron.app.calls.includes("exit 0"));
      Assert.areEqual(0, electron.nativeUpdater.installs);
      Assert.isFalse(existsSync(UpdateRestartTests.keptFile(mainProcess)));
    });
  }

  @TestMethod
  public async getsItsRuntimeBackByItselfOnceAHandoffFailedAfterTheRuntimeStopped(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.reject(new InstallerNotHeldException(32));
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.update", Response.success("r", new UpdateReady([], []).toJson()));
    const runtime = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    try {
      Assert.isDefined(runtime.pid);
      await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async (electron, mainProcess, _installation, launcher) => {
        const [own] = launcher.listeners;
        target.onCall = () => {
          if (target.calls.at(-1) === "desktop.update")
            own?.onEvent(new Event(ShellEvents.updating, null));
          else if (target.calls.at(-1) === "desktop.stop") {
            runtime.kill();
            own?.onDisconnected(null);
          }
        };
        const window = MainProcessStartFixture.firstWindow(electron);
        const trusted = MainProcessStartFixture.trustedEvent("linux");
        await Condition.waitAsync(() => window.webContents.sent.some(t => t[0] === "desktop:updateSaveRequest"));
        electron.ipcMain.invoke("desktop:updateSaveAnswer", trusted, window.webContents.sent.find(t => t[0] === "desktop:updateSaveRequest")?.[1], []);
        await Condition.waitAsync(() => launcher.calls.filter(t => t === "attach main IfIdle").length === 2);
        await Condition.waitAsync(() => JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:startupState").at(-1)?.[1]) === JSON.stringify({ kind: "Ready", details: [] }));

        Assert.isTrue(window.webContents.sent.some(t => t[0] === "desktop:startupState" && JsonReader.fromValue(t[1]).readString("kind") === "Updating"));
        Assert.areEqual("The update's installer couldn't be held unchanged for its start (Windows error 32).", JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readNullableString("reason"));
        Assert.areEqual(JSON.stringify(["The update failed: The update's installer couldn't be held unchanged for its start (Windows error 32)."]), JSON.stringify(MainProcessStartFixture.readErrors(mainProcess, "The update failed")));
        Assert.isFalse(electron.app.calls.includes("exit 0"));
      }, target, true, runtime.pid);
    }
    finally {
      runtime.kill();
    }
  }

  @TestMethod
  public async explainsAndQuitsWhenAskingMacOSToInstallTheUpdateThrows(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.resolve(5230);
    await UpdateRestartTests.restartToUpdateAsync("darwin", handoff, async (electron, mainProcess) => {
      electron.nativeUpdater.onInstall = () => {
        throw new Error("No update available, can't quit and install");
      };
      electron.dialog.failure = new Error("The dialog could not be shown.");
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(1, electron.dialog.boxes.length);
      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess,
        "The update was handed off, but macOS could not be asked to install it and start the new version, so the main process quits instead: Error: No update available").length);
    });
  }

  @TestMethod
  public async explainsAndQuitsWhenMacOSCannotBeAskedToInstallTheUpdate(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.resolve(5230);
    await UpdateRestartTests.restartToUpdateAsync("darwin", handoff, async (electron, mainProcess) => {
      electron.nativeUpdater.onInstall = () => void Promise.resolve().then(() => electron.nativeUpdater.emit("error", new Error("No update available, can't quit and install")));
      electron.dialog.failure = new Error("The dialog could not be shown.");
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify([{
        message: "macOS will install the update once Noldova Desktop Sample quits, but Noldova Desktop Sample can't open again by itself.",
        detail: "Open Noldova Desktop Sample once the update has installed."
      }]), JSON.stringify(electron.dialog.boxes.map(t => ({ message: t.options.message, detail: t.options.detail }))));
      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess,
        "The update was handed off, but macOS could not be asked to install it and start the new version, so the main process quits instead: Error: No update available").length);
      Assert.isFalse(electron.app.calls.includes("quit prevented"));
    });
  }

  @TestMethod
  public async asksAboutWorkInTheInstallationsDataDirectoriesBeforeAnUpdateAndChangesNothingWhenCancelled(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async (electron, mainProcess, _installation, launcher) => {
      const window = MainProcessStartFixture.firstWindow(electron);
      await Condition.waitAsync(() => UpdateRestartTests.quitQuestions(window).length === 1);
      launcher.logs.at(-1)?.("The update's runtime launch was retried.");
      const answered = electron.ipcMain.invoke("desktop:quitAnswer", MainProcessStartFixture.trustedEvent("linux"), "Cancel");
      await Condition.waitAsync(() => target.isClosed);

      Assert.areEqual(2, launcher.logs.length);
      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess, "The update's runtime launch was retried.").length);
      Assert.areEqual(true, answered);
      Assert.areEqual(true, JsonReader.fromValue(UpdateRestartTests.quitQuestions(window)[0]).readBoolean("isUpdate"));
      Assert.isNull(UpdateRestartTests.quitQuestions(window)[1]);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public holdsTheRuntimesQuitWhileItRestartsToUpdateAndAnswersItOnceTheUpdateIsCancelled(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    return UpdateRestartTests.restartToUpdateAsync("linux", handoff, async (electron, _desktop, _installation, launcher) => {
      const window = MainProcessStartFixture.firstWindow(electron);
      const trusted = MainProcessStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => UpdateRestartTests.quitQuestions(window).length === 1);

      launcher.listeners[0]?.onEvent(new Event(ShellEvents.quitting, null));
      await setImmediate();
      const held = MainProcessStartFixture.closeRequests(window).length;
      electron.ipcMain.invoke("desktop:quitAnswer", trusted, "Cancel");
      await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
      electron.ipcMain.invoke("desktop:closeAnswer", trusted, MainProcessStartFixture.closeRequests(window)[0], false);
      await Condition.waitAsync(() => launcher.connections[0]?.calls.includes("desktop.quitAnswered") === true);

      Assert.areEqual(0, held);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public holdsAQuitWhileItRestartsToUpdateAndQuitsAsUsualOnceTheUpdateIsCancelled(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    return UpdateRestartTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = MainProcessStartFixture.firstWindow(electron);
      const trusted = MainProcessStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => UpdateRestartTests.quitQuestions(window).length === 1);

      electron.app.quit();
      const held = MainProcessStartFixture.closeRequests(window).length;
      electron.ipcMain.invoke("desktop:quitAnswer", trusted, "Cancel");
      await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
      electron.ipcMain.invoke("desktop:closeAnswer", trusted, MainProcessStartFixture.closeRequests(window)[0], false);

      Assert.areEqual(0, held);
      Assert.isTrue(electron.app.calls.includes("quit prevented"));
      Assert.isTrue(target.isClosed);
      Assert.areEqual(0, handoff.handedOff.length);
    }, target);
  }

  @TestMethod
  public logsABarrierItCannotRemoveOnceARuntimeRefusesTheUpdate(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.update", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));
    return UpdateRestartTests.restartToUpdateAsync("linux", handoff, async (electron, mainProcess, installation) => {
      using _rm = new FailingFileCallFixture("rm", installation.barrierFile, "EBUSY");

      await Condition.waitAsync(() => MainProcessStartFixture.readErrors(mainProcess, "The update's barrier could not be removed").length === 1);

      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public async stopsWaitingForWorkAndChangesNothingWhenCancelledWhileWaiting(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = MainProcessStartFixture.firstWindow(electron);
      const trusted = MainProcessStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => UpdateRestartTests.quitQuestions(window).length === 1);
      const waited = electron.ipcMain.invoke("desktop:quitAnswer", trusted, "Wait");
      const cancelled = electron.ipcMain.invoke("desktop:quitAnswer", trusted, "Cancel");
      await Condition.waitAsync(() => target.isClosed);

      Assert.areEqual(true, waited);
      Assert.areEqual(true, cancelled);
      Assert.areEqual(1, target.calls.filter(t => t === "desktop.work").length);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public async changesNothingWhenItsWindowClosesBeforeItCanAskAboutWork(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    await UpdateRestartTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = MainProcessStartFixture.firstWindow(electron);
      await Condition.waitAsync(() => target.calls.includes("desktop.work"));
      await setImmediate();
      window.destroy();
      await Condition.waitAsync(() => target.isClosed);

      Assert.areEqual(0, UpdateRestartTests.quitQuestions(window).length);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target, false);
  }

  private static async restartToUpdateAsync(
    platform: string,
    handoff: FakeUpdateHandoff,
    run: (electron: FakeElectron, mainProcess: FakeMainProcessEnvironment, installation: Installation, launcher: FakeRuntimeLauncher) => Promise<void>,
    target: FakeRuntimeConnection | null = null,
    paints: boolean = true,
    runtimeProcessId: number = process.pid,
    beforeRestartAsync: (mainProcess: FakeMainProcessEnvironment, installation: Installation) => Promise<unknown> = () => Promise.resolve(),
    start: (electron: FakeElectron, trusted: IIpcEvent) => unknown = (electron, trusted) => electron.ipcMain.invoke("desktop:updateAction", trusted, "Restart")): Promise<void> {
    await UpdateRestartTests.withReadyFileAsync(async record => {
      const folder = await mkdtemp(join(tmpdir(), "desktop-restart-"));
      try {
        const files = new FakeDeviceFiles();
        files.updateReady.kept = record;
        const mainProcess = new FakeMainProcessEnvironment(platform, [`--device-dir=${folder}`], { SystemRoot: process.env["SystemRoot"] });
        mainProcess.processId = process.pid;
        mainProcess.temporaryFolder = join(folder, "temporary");
        const electron = new FakeElectron();
        const installations: Installation[] = [];
        const launcher = Object.isNull(target) ? new FakeRuntimeLauncher() : new FakeRuntimeLauncher(new FakeRuntimeConnection(), target);
        await MainProcessStartFixture.startAsync(electron, mainProcess, launcher, new FakeDeviceIdentity(), files, new FakePathCommand(), installations, () => Promise.resolve(true),
          () => new FakeUpdater(String(record["file"])), undefined, handoff);
        await MainProcessStartFixture.openAsync(electron);
        const [installation] = installations;
        Assert.isDefined(installation);
        if (!Object.isNull(target)) {
          const root = join(folder, "data");
          const discovery = new DataDirectory(root).discoveryFile;
          await mkdir(dirname(discovery), { recursive: true });
          await writeFile(discovery, JSON.stringify(new RuntimeDiscovery("127.0.0.1:52000", "capability-token", runtimeProcessId, mainProcess.execPath, "0.0.1", 1, "build-fingerprint").toJson()));
          await installation.recordAsync(root);
          if (paints)
            UpdateRestartTests.paint(electron, platform, MainProcessStartFixture.firstWindow(electron));
        }
        const trusted = MainProcessStartFixture.trustedEvent(platform);
        await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readString("kind") === "Ready");
        await beforeRestartAsync(mainProcess, installation);

        const isStarted = start(electron, trusted);

        Assert.areEqual(true, isStarted);
        await run(electron, mainProcess, installation, launcher);
      }
      finally {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    });
  }

  private static keptFile(mainProcess: FakeMainProcessEnvironment): string {
    return join(mainProcess.temporaryFolder, `${ProductInfo.current.slug}-restart-${basename(Installation.locate(mainProcess.temporaryFolder, mainProcess.execPath, mainProcess.platform))}.json`);
  }

  private static async readKeptAsync(mainProcess: FakeMainProcessEnvironment): Promise<JsonReader | null> {
    const file = UpdateRestartTests.keptFile(mainProcess);
    return existsSync(file) ? JsonReader.parse(await readFile(file, "utf8")) : null;
  }

  private static async withReadyFileAsync(run: (record: JsonObject) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-update-ready-"));
    try {
      const file = join(folder, "Noldova Desktop Sample-linux-x64.AppImage");
      await writeFile(file, "Noldova Desktop Sample 999.0.0");
      await run({ version: "999.0.0", file, sha512: createHash("sha512").update("Noldova Desktop Sample 999.0.0").digest("base64"), notified: false });
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static paint(electron: FakeElectron, platform: string, window: FakeMainProcessWindow): void {
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent(platform, window.id), MainProcessStartFixture.APPEARANCE);
  }

  private static quitQuestions(window: FakeMainProcessWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:quitQuestion").map(t => t[1]);
  }
}
