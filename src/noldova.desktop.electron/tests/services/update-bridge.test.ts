/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Event, Failure, FailureCode, Response, ShellEvents } from "@noldova/desktop.protocol";
import { UpdateFeedUnreachableException } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { FakeUpdateCheckLock } from "../fixtures/fake-update-check-lock.fixture.js";
import { FakeUpdateHandoff } from "../fixtures/fake-update-handoff.fixture.js";
import { FakeUpdater } from "../fixtures/fake-updater.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class UpdateBridgeTests {
  @TestMethod
  public async tellsOnlyItsOwnWindowThatUpdatesAreOffAndActsOnNoUpdate(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();

    fixture.send("settingsChanged", { name: "desktop.updateChecks", device: FakeDeviceIdentity.ID, value: "OnRequest", isSet: true });
    const state = fixture.electron.ipcMain.invoke("desktop:readUpdate", MainProcessStartFixture.trustedEvent("linux"));
    const refused = fixture.electron.ipcMain.invoke("desktop:readUpdate", { sender: { id: 1 }, senderFrame: null });
    const acted = fixture.electron.ipcMain.invoke("desktop:updateAction", MainProcessStartFixture.trustedEvent("linux"), "Check");

    Assert.areEqual(JSON.stringify({ kind: "Off", version: null, progress: null, checkedAt: null, reason: null, mustMove: false }), JSON.stringify(state));
    Assert.isNull(refused);
    Assert.areEqual(false, acted);
    Assert.areEqual(0, fixture.files.created.filter(t => t[1] === "update-ready.json").length);
  }

  @TestMethod
  public async checksOnlyForItsOwnWindowAndPushesEachStateToItsWindows(): Promise<void> {
    const updater = new FakeUpdater();
    const files = new FakeDeviceFiles();
    const process = new FakeMainProcessEnvironment("linux");
    const connection = new FakeRuntimeConnection();
    const lock = new FakeUpdateCheckLock();
    const electron = await UpdateBridgeTests.startWithUpdaterAsync(process, updater, files, connection, new FakeElectron(), new FakeDeviceIdentity(), lock);
    await Condition.waitAsync(() => connection.payloads.some(t => JSON.stringify(t).includes("desktop.updateChecks")) && files.updateReady.reads === 1);
    const window = MainProcessStartFixture.firstWindow(electron);
    const trusted = MainProcessStartFixture.trustedEvent("linux");

    const refused = electron.ipcMain.invoke("desktop:updateAction", { sender: { id: 1 }, senderFrame: null }, "Check");
    const acted = electron.ipcMain.invoke("desktop:updateAction", trusted, "Check");
    await Condition.waitAsync(() => UpdateBridgeTests.updateStates(window).length >= 2);
    const state = electron.ipcMain.invoke("desktop:readUpdate", trusted);
    window.isGone = true;
    electron.ipcMain.invoke("desktop:updateAction", trusted, "Check");
    await Condition.waitAsync(() => lock.releases === 2);

    Assert.areEqual(false, refused);
    Assert.areEqual(true, acted);
    Assert.areEqual(JSON.stringify(["Checking", "UpToDate"]), JSON.stringify(UpdateBridgeTests.updateStates(window)));
    Assert.areEqual("UpToDate", JsonReader.fromValue(state).readString("kind"));
    Assert.areEqual(1, files.created.filter(t => t[1] === "update-ready.json").length);
    Assert.areEqual(3, files.updateReady.reads);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The updater reported: started").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The update lock reported: started").length);
  }

  @TestMethod
  public async clearsWhatAnEarlierHandoffLeftOnceItStartsItsUpdates(): Promise<void> {
    const electron = new FakeElectron();
    const handoff = new FakeUpdateHandoff();
    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(), [],
      () => Promise.resolve(true), () => new FakeUpdater(), undefined, handoff);
    const before = handoff.clears;

    await MainProcessStartFixture.openAsync(electron);
    await Condition.waitAsync(() => handoff.clears > 0);

    Assert.areEqual(0, before);
    Assert.areEqual(1, handoff.clears);
  }

  @TestMethod
  public async refusesToRestartToAnUpdateItsHandoffCannotInstallWithoutStoppingAnything(): Promise<void> {
    await UpdateBridgeTests.withReadyFileAsync(async record => {
      const handoff = new FakeUpdateHandoff();
      handoff.refusal = "This copy can't install updates.";
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const electron = new FakeElectron();
      await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), files, new FakePathCommand(), [],
        () => Promise.resolve(true), () => new FakeUpdater(String(record["file"])), undefined, handoff);
      await MainProcessStartFixture.openAsync(electron);
      const trusted = MainProcessStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readString("kind") === "Failed");

      const isStarted = electron.ipcMain.invoke("desktop:updateAction", trusted, "Restart");

      Assert.areEqual(false, isStarted);
      Assert.areEqual("This copy can't install updates.", JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readNullableString("reason"));
      Assert.areEqual(0, handoff.handedOff.length);
    });
  }

  @TestMethod
  public postsAReadyUpdateOnceOverItsRuntimeConnection(): Promise<void> {
    return UpdateBridgeTests.withReadyFileAsync(async record => {
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const connection = new FakeRuntimeConnection();
      connection.answers.set("desktop.postNotification", Response.success("r", null));

      const electron = await UpdateBridgeTests.startWithUpdaterAsync(new FakeMainProcessEnvironment("linux"), new FakeUpdater(String(record["file"])), files, connection);
      await Condition.waitAsync(() => files.updateReady.writes.length > 0 && connection.calls.includes("desktop.readSetting"));

      Assert.areEqual(JSON.stringify([{
        kind: "desktop.updateReady",
        key: "999.0.0",
        title: "Noldova Desktop Sample 999.0.0 is ready to install.",
        severity: "Info",
        actions: [{ title: "Restart to update", command: { name: "desktop.restartToUpdate", arguments: null } }]
      }]), JSON.stringify(connection.payloads.filter((_, index) => connection.calls[index] === "desktop.postNotification")));
      Assert.areEqual(JSON.stringify([{ ...record, notified: true }]), JSON.stringify(files.updateReady.writes));
      Assert.areEqual("Ready", JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", MainProcessStartFixture.trustedEvent("linux"))).readString("kind"));
    });
  }

  @TestMethod
  public waitsForItsRuntimeBeforePostingAReadyUpdateFoundAtStart(): Promise<void> {
    return UpdateBridgeTests.withReadyFileAsync(async record => {
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const connection = new FakeRuntimeConnection();
      connection.answers.set("desktop.postNotification", Response.success("r", null));
      let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
      const process = new FakeMainProcessEnvironment("linux");

      const electron = await UpdateBridgeTests.startWithUpdaterAsync(process, new FakeUpdater(String(record["file"])), files, connection, new FakeElectron(), new FakeDeviceIdentity(),
        new FakeUpdateCheckLock(), new FakeRuntimeLauncher(new Promise(resolve => {
          arrive = resolve;
        })));
      await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", MainProcessStartFixture.trustedEvent("linux"))).readString("kind") === "Ready");
      const errorsBeforeReady = MainProcessStartFixture.readErrors(process, "The runtime refused the ready update's notification").length;
      arrive(connection);
      await Condition.waitAsync(() => files.updateReady.writes.length > 0);

      Assert.areEqual(0, errorsBeforeReady);
      Assert.areEqual(1, connection.calls.filter(t => t === "desktop.postNotification").length);
    });
  }

  @TestMethod
  public postsAReadyUpdateWithoutTheDevicesIdentityAndKeepsItUnpostedWhileTheRuntimeRefuses(): Promise<void> {
    return UpdateBridgeTests.withReadyFileAsync(async record => {
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const connection = new FakeRuntimeConnection();
      connection.answers.set("desktop.postNotification", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
      const device = new FakeDeviceIdentity();
      device.failure = new Error("EACCES");

      const process = new FakeMainProcessEnvironment("linux");
      const refused = "The runtime refused the ready update's notification, so the main process posts it again when the runtime is ready: The database is busy.";

      await UpdateBridgeTests.startWithUpdaterAsync(process, new FakeUpdater(String(record["file"])), files, connection, new FakeElectron(), device);
      await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, refused).length > 0);

      Assert.areEqual(0, files.updateReady.writes.length);
      Assert.isTrue(connection.calls.includes("desktop.postNotification"));
    });
  }

  @TestMethod
  public async showsThatAppMustMoveOnlyOnMacOSOutsideAnApplicationsFolder(): Promise<void> {
    const mustMove: unknown[] = [];

    for (const [platform, isInApplications] of [["darwin", false], ["darwin", true], ["linux", false]] as const) {
      const updater = new FakeUpdater();
      updater.check = () => Promise.reject(new UpdateFeedUnreachableException());
      const electron = new FakeElectron();
      electron.app.isInApplications = isInApplications;
      const trusted = MainProcessStartFixture.trustedEvent(platform);
      await UpdateBridgeTests.startWithUpdaterAsync(new FakeMainProcessEnvironment(platform), updater, new FakeDeviceFiles(), new FakeRuntimeConnection(), electron);

      electron.ipcMain.invoke("desktop:updateAction", trusted, "Check");
      await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readString("kind") === "Failed");
      mustMove.push(JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readBoolean("mustMove"));
    }

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(mustMove));
  }

  @TestMethod
  public async logsAnUpdateChecksSettingItCannotRead(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));

    await UpdateBridgeTests.startWithUpdaterAsync(process, new FakeUpdater(), new FakeDeviceFiles(), connection);

    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The setting desktop.updateChecks could not be read for this device, so the main process keeps its last value: ").length > 0);

    Assert.areEqual(JSON.stringify(["The setting desktop.updateChecks could not be read for this device, so the main process keeps its last value: The database is busy."]), JSON.stringify(MainProcessStartFixture.readErrors(process, "The setting desktop.updateChecks could not be read for this device, so the main process keeps its last value: ")));
  }

  @TestMethod
  public async remembersTheUpdateChecksSettingOfThisDevice(): Promise<void> {
    const files = new FakeDeviceFiles();
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const launcher = new FakeRuntimeLauncher(connection);
    await UpdateBridgeTests.startWithUpdaterAsync(new FakeMainProcessEnvironment("linux"), new FakeUpdater(), files, connection, new FakeElectron(), new FakeDeviceIdentity(), new FakeUpdateCheckLock(), launcher);
    await Condition.waitAsync(() => connection.calls.includes("desktop.readSetting"));

    launcher.listener?.onEvent(new Event(ShellEvents.settingsChanged, { name: "desktop.updateChecks", device: FakeDeviceIdentity.ID, value: "OnRequest", isSet: true }));
    await Condition.waitAsync(() => files.state.writes.length > 0);

    Assert.areEqual(JSON.stringify([{ updateChecks: "OnRequest" }]), JSON.stringify(files.state.writes));
  }

  @TestMethod
  public async startsFromTheUpdateChecksSettingItRemembered(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.state.kept = { updateChecks: "OnRequest" };
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const launcher = new FakeRuntimeLauncher(connection);
    await UpdateBridgeTests.startWithUpdaterAsync(new FakeMainProcessEnvironment("linux"), new FakeUpdater(), files, connection, new FakeElectron(), new FakeDeviceIdentity(), new FakeUpdateCheckLock(), launcher);
    await Condition.waitAsync(() => connection.calls.includes("desktop.readSetting"));

    launcher.listener?.onEvent(new Event(ShellEvents.settingsChanged, { name: "desktop.updateChecks", device: FakeDeviceIdentity.ID, value: "OnRequest", isSet: true }));
    launcher.listener?.onEvent(new Event(ShellEvents.settingsChanged, { name: "desktop.updateChecks", device: FakeDeviceIdentity.ID, value: "AtStart", isSet: true }));
    await Condition.waitAsync(() => files.state.writes.length > 0);

    Assert.areEqual(JSON.stringify([{ updateChecks: "AtStart" }]), JSON.stringify(files.state.writes));
  }

  @TestMethod
  public stopsCheckingForUpdatesWhenQuitting(): Promise<void> {
    return UpdateBridgeTests.withReadyFileAsync(async record => {
      const updater = new FakeUpdater(String(record["file"]));
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const electron = await UpdateBridgeTests.startWithUpdaterAsync(new FakeMainProcessEnvironment("linux"), updater, files);
      const trusted = MainProcessStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readUpdate", trusted)).readString("kind") === "Ready");

      electron.app.emit("will-quit");
      const acted = electron.ipcMain.invoke("desktop:updateAction", trusted, "Check");

      Assert.areEqual(false, acted);
      Assert.areEqual(0, updater.checks);
    });
  }

  private static async startWithUpdaterAsync(
    process: FakeMainProcessEnvironment,
    updater: FakeUpdater,
    files: FakeDeviceFiles = new FakeDeviceFiles(),
    connection: FakeRuntimeConnection = new FakeRuntimeConnection(),
    electron: FakeElectron = new FakeElectron(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    lock: FakeUpdateCheckLock = new FakeUpdateCheckLock(),
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(connection)): Promise<FakeElectron> {
    await MainProcessStartFixture.startAsync(electron, process, launcher, device, files, new FakePathCommand(), [], () => Promise.resolve(true), log => {
      log("The updater reported: started");
      return updater;
    }, log => {
      log("The update lock reported: started");
      return lock;
    });
    await MainProcessStartFixture.openAsync(electron);
    await setImmediate();
    return electron;
  }

  private static updateStates(window: FakeMainProcessWindow): string[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:updateState").map(t => JsonReader.fromValue(t[1]).readString("kind"));
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
}
