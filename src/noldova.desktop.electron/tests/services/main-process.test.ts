/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mock } from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildIdentity, Event, Failure, FailureCode, PreShellData, Response, RuntimeHandover, ShellEvents, UpdateProcess, UpdateSaved } from "@noldova/desktop.protocol";
import { CallUnansweredException, ConnectionClosedException, DataDirectory, DataDirectoryLocator, DeviceFolder, Installation, PreShellDataFoundException, ProcessPresence, ProductInfo, RuntimeBuild, RuntimeEntry, RuntimeHandoverException, UpdateBarrier, UpdateBarrierState, UpdateBarrierStatus, UpdateInProgressException } from "@noldova/desktop.runtime";
import { type IIpcEvent, UnusableFolderException } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FailingLoadElectron } from "../fixtures/failing-load-electron.fixture.js";
import { FailingLoadWindow } from "../fixtures/failing-load-window.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { FolderWatchFixture } from "../fixtures/folder-watch.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class MainProcessTests {
  private static readonly IF_IDLE: object = { policy: "IfIdle", keepsWhileShared: true };
  private static readonly WINDOWS: string = "desktop.appWindowsChanged";
  private static readonly SHORTCUTS: string = "desktop.appShortcutsChanged";
  private static readonly MAC_KEYS: readonly JsonObject[] = ["Mod+Q", "Mod+H", "Mod+Alt+H", "Mod+M", "Mod+Shift+W"].map(t => ({ key: t, command: null, isGlobal: false }));

  @TestMethod
  public async namesItselfAndKeepsOneInstanceInTheSandbox(): Promise<void> {
    const electron = new FakeElectron();

    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("win32"));

    Assert.areEqual(
      JSON.stringify(["setName Noldova Desktop Sample", "requestSingleInstanceLock", "enableSandbox", `setAppUserModelId ${MainProcessStartFixture.DEVELOPMENT_APP_ID}`]),
      JSON.stringify(electron.app.calls.filter(t => !t.startsWith("setPath"))));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public async givesItsRuntimeLauncherTheMainProcessLog(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const launcher = new FakeRuntimeLauncher();

    await MainProcessStartFixture.startAsync(new FakeElectron(), process, launcher);
    launcher.logs[0]?.("The runtime's launch was retried.");

    Assert.areEqual(1, launcher.logs.length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime's launch was retried.").length);
  }

  @TestMethod
  public async makesEveryCallElectronAllowsOnlyBeforeReadyBeforeItsFirstAwait(): Promise<void> {
    const electron = new FakeElectron(true, true);
    const process = new FakeMainProcessEnvironment("linux");

    const started = MainProcessStartFixture.startAsync(electron, process);
    electron.app.isReady = true;
    await started;

    Assert.areEqual(JSON.stringify(["setPath userData", "appendSwitch enable-features", "requestSingleInstanceLock", "enableSandbox"]),
      JSON.stringify(electron.app.calls.map(t => t.split(" ").slice(0, 2).join(" "))
        .filter(t => ["setPath userData", "appendSwitch enable-features", "requestSingleInstanceLock", "enableSandbox"].includes(t))));
    Assert.areEqual(1, electron.protocol.schemes.length);
  }

  @TestMethod
  public async quitsWhenAnotherInstanceRuns(): Promise<void> {
    const electron = new FakeElectron(false);
    const process = new FakeMainProcessEnvironment("win32");

    await MainProcessStartFixture.startAsync(electron, process);
    await electron.app.becomeReadyAsync();

    Assert.areEqual(
      JSON.stringify(["setName Noldova Desktop Sample", "requestSingleInstanceLock", "quit"]), JSON.stringify(electron.app.calls.filter(t => !t.startsWith("setPath"))));
    Assert.areEqual(0, electron.app.count("window-all-closed"));
    Assert.areEqual(0, electron.windows.length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "Another main process owns this data directory, so this one (1000) quits and asks that one to show its window.").length);
  }

  @TestMethod
  public async writesTheLinesStillWaitingForItsLogBeforeItQuits(): Promise<void> {
    await MainProcessTests.withDataAsync(async (data, launcher, electron) => {
      const file = join(data, "logs", "main.log");
      let atQuit = String.empty;
      electron.app.on("will-quit", () => {
        atQuit = readFileSync(file, "utf8");
      });

      launcher.logs[0]?.("The first line before quitting.");
      launcher.logs[0]?.("The last line before quitting.");
      electron.app.emit("will-quit");

      const first = atQuit.indexOf(" The first line before quitting.");
      Assert.isTrue(first >= 0 && atQuit.indexOf(" The last line before quitting.") > first, atQuit);
    });
  }

  @TestMethod
  public async writesTheLinesStillWaitingForItsLogBeforeItQuitsAfterAFailure(): Promise<void> {
    await MainProcessTests.withDataAsync(async (data, launcher, electron, process) => {
      const file = join(data, "logs", "main.log");
      let atExit = String.empty;
      electron.app.exiting = () => {
        atExit = readFileSync(file, "utf8");
      };
      electron.dialog.answers.push(2);

      launcher.logs[0]?.("The line before the failure.");
      for (const listener of process.exceptionListeners)
        listener(new Error("The main process broke."));
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      const before = atExit.indexOf(" The line before the failure.");
      Assert.isTrue(before >= 0 && atExit.indexOf(" chose Quit.") > before, atExit);
    });
  }

  @TestMethod
  public async recordsItsQuitAtTheEndOfTheLogOfTheMainProcessThatOwnsTheDataDirectory(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const owned = join(data, "owned");
      const unused = join(data, "unused");
      await mkdir(join(owned, "logs"), { recursive: true });
      await mkdir(unused);
      await writeFile(join(owned, "logs", "main.log"), "2026-10-21T08:00:00.000Z The owner's line.\n");

      await MainProcessStartFixture.startAsync(new FakeElectron(false), new FakeMainProcessEnvironment("linux", [`--data-dir=${owned}`]));
      await MainProcessStartFixture.startAsync(new FakeElectron(false), new FakeMainProcessEnvironment("linux", [`--data-dir=${unused}`]));

      const lines = (await readFile(join(owned, "logs", "main.log"), "utf8")).trimEnd().split("\n");
      Assert.areEqual(2, lines.length);
      Assert.areEqual("2026-10-21T08:00:00.000Z The owner's line.", lines[0]);
      Assert.isTrue(/^\d{4}-\d\d-\d\dT[\d:.]+Z Another main process owns this data directory, so this one \(1000\) quits and asks that one to show its window\.$/.test(lines[1] ?? String.empty), lines[1]);
      Assert.areEqual(JSON.stringify(["main.log"]), JSON.stringify(await readdir(join(owned, "logs"))));
      Assert.isFalse(existsSync(join(unused, "logs")));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async opensItsWindowNoLargerThanNineTenthsOfASmallPrimaryDisplay(): Promise<void> {
    const electron = new FakeElectron();
    electron.screen.primaryWorkArea = { x: 0, y: 25, width: 1024, height: 743 };

    await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(), electron);
    const window = MainProcessStartFixture.firstWindow(electron);

    Assert.areEqual("921,668", [window.options.width, window.options.height].join(","));
  }

  @TestMethod
  public async deniesEveryPermission(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");

    Assert.isTrue(electron.defaultSession.request("media") === false);
    Assert.isTrue(electron.defaultSession.check() === false);
  }

  @TestMethod
  public async closesOnlyAfterThePageSaysItSaved(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    window.close();
    window.close();
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
    await setImmediate();
    const [request] = MainProcessStartFixture.closeRequests(window);

    Assert.areEqual(1, MainProcessStartFixture.closeRequests(window).length);
    Assert.isFalse(window.isGone);
    Assert.isTrue(electron.ipcMain.invoke("desktop:closeAnswer", MainProcessStartFixture.trustedEvent("linux"), request, true) === true);
    await Condition.waitAsync(() => window.isGone);
  }

  @TestMethod
  public async staysOpenWhenThePageKeepsUnsavedWork(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    window.close();
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
    electron.ipcMain.invoke("desktop:closeAnswer", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.closeRequests(window)[0], false);
    await setImmediate();
    window.close();
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 2);

    Assert.isFalse(window.isGone);
    Assert.areEqual(2, MainProcessStartFixture.closeRequests(window).length);
    window.destroy();
  }

  @TestMethod
  public async savesItsWindowThenAsksBeforeQuittingWithWorkInProgressAndQuitsOnceItHasFinished(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    MainProcessTests.answerStops(connection, [MainProcessTests.busy()]);
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    MainProcessTests.paint(electron, "linux", window);

    window.close();
    const stopsBeforeSaving = MainProcessTests.stops(connection).length;
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => MainProcessTests.quitQuestions(window).length === 1);
    const untrusted = electron.ipcMain.invoke("desktop:quitAnswer", { ...event, senderFrame: null }, "Wait");
    const waiting = electron.ipcMain.invoke("desktop:quitAnswer", event, "Wait");
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: ["Indexing the project", "Saving the notes"], sequence: 2 }));
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: "Saving" }));
    const requestsWhileWorking = MainProcessStartFixture.closeRequests(window).length;
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: [], sequence: 3 }));
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 2);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual("0,false,true,1", [stopsBeforeSaving, untrusted, waiting, requestsWhileWorking].join(","));
    Assert.areEqual(JSON.stringify([
      { descriptions: ["Indexing the project"], isWaiting: false, isUpdate: false },
      { descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false },
      { descriptions: ["Indexing the project", "Saving the notes"], isWaiting: true, isUpdate: false },
      null
    ]), JSON.stringify(MainProcessTests.quitQuestions(window)));
    Assert.areEqual(2000, connection.timeouts[connection.calls.lastIndexOf("desktop.work")]);
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE, MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(connection)));
    Assert.isTrue(electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsAsItsQuitDoesWhenTheRuntimeAsksAndForwardsNothingToItsWindows(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);

    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));
    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await setImmediate();

    Assert.areEqual(1, MainProcessStartFixture.closeRequests(window).length);
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(connection)));
    Assert.isFalse(connection.calls.includes("desktop.quitAnswered"));
    Assert.isFalse(window.webContents.sent.some(t => t[1] === "desktop.quitting"));
  }

  @TestMethod
  public async tellsTheRuntimeOnceItStayedWhenAWindowCannotSaveOrThePersonKeepsIt(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    MainProcessTests.answerStops(connection, [MainProcessTests.busy()]);
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    MainProcessTests.paint(electron, "linux", window);

    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 1);
    electron.ipcMain.invoke("desktop:closeAnswer", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.closeRequests(window)[0], false);
    await Condition.waitAsync(() => connection.calls.includes("desktop.quitAnswered"));
    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 2);
    await Condition.waitAsync(() => MainProcessTests.quitQuestions(window).length === 1);
    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    electron.ipcMain.invoke("desktop:quitAnswer", MainProcessStartFixture.trustedEvent("linux"), "Cancel");
    await Condition.waitAsync(() => connection.calls.filter(t => t === "desktop.quitAnswered").length === 2);
    await setImmediate();

    Assert.areEqual("[{\"answer\":\"SaveFailed\"},{\"answer\":\"Stayed\"}]", JSON.stringify(connection.payloads.filter((_t, u) => connection.calls[u] === "desktop.quitAnswered")));
    Assert.isFalse(window.isGone);
    Assert.isFalse(electron.app.calls.includes("quit"));
    window.destroy();
  }

  @TestMethod
  public async savesAgainBeforeStoppingTheWorkWhenThePersonChoosesToAndStaysWhenTheyCancel(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    MainProcessTests.answerStops(connection, [
      MainProcessTests.busy(), MainProcessTests.busy(), Response.failure("r", new Failure(FailureCode.Internal, "The runtime is already stopping."))
    ]);
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    MainProcessTests.paint(electron, "linux", window);

    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => MainProcessTests.quitQuestions(window).length === 1);
    electron.ipcMain.invoke("desktop:quitAnswer", event, "Cancel");
    await setImmediate();
    const isOpenAfterCancelling = !window.isGone && MainProcessStartFixture.closeRequests(window).length === 1;
    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 2);
    await Condition.waitAsync(() => MainProcessTests.quitQuestions(window).length === 3);
    electron.ipcMain.invoke("desktop:quitAnswer", event, "Stop");
    await Condition.waitAsync(() => MainProcessStartFixture.closeRequests(window).length === 3);
    const stopsBeforeSaving = MainProcessTests.stops(connection).length;
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 3);
    await Condition.waitAsync(() => window.isGone);

    Assert.isTrue(isOpenAfterCancelling);
    Assert.areEqual(2, stopsBeforeSaving);
    Assert.areEqual(JSON.stringify({ policy: "StopWork", keepsWhileShared: true }), JSON.stringify(MainProcessTests.stops(connection).at(-1)));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime could not be stopped as Noldova Desktop Sample quits: The runtime is already stopping.").length);
    Assert.isTrue(electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheRuntimeIsKeptForAnotherClientOrStopsWhileIdle(): Promise<void> {
    const kept = new FakeRuntimeConnection();
    kept.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    kept.answers.set("desktop.stop", Response.success("r", { keptFor: 1 }));
    const shared = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(kept));
    const idle = new FakeRuntimeConnection();
    const alone = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(idle));
    const first = MainProcessStartFixture.firstWindow(shared);
    const second = MainProcessStartFixture.firstWindow(alone);

    first.close();
    second.close();
    await MainProcessStartFixture.answerSaveAsync(shared, "linux", first, 1);
    await MainProcessStartFixture.answerSaveAsync(alone, "linux", second, 1);
    await Condition.waitAsync(() => first.isGone && second.isGone);

    Assert.areEqual(0, MainProcessTests.quitQuestions(first).length + MainProcessTests.quitQuestions(second).length);
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(kept)));
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(idle)));
    Assert.isTrue(shared.app.calls.includes("quit") && alone.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheWorkCannotBeReadInTimeOrTheRuntimeLeavesWhileItAsks(): Promise<void> {
    const slow = new FakeRuntimeConnection();
    slow.deferred.set("desktop.work", () => Promise.reject(new CallUnansweredException("desktop.work")));
    slow.answers.set("desktop.stop", MainProcessTests.busy());
    const process = new FakeMainProcessEnvironment("linux");
    const unanswered = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(slow), new FakeElectron(), new FakeDeviceIdentity(), process);
    const busy = new FakeRuntimeConnection();
    busy.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    busy.answers.set("desktop.stop", MainProcessTests.busy());
    const launcher = new FakeRuntimeLauncher(busy, new Promise<FakeRuntimeConnection>(() => undefined));
    const leaving = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const first = MainProcessStartFixture.firstWindow(unanswered);
    const second = MainProcessStartFixture.firstWindow(leaving);
    MainProcessTests.paint(unanswered, "linux", first);
    MainProcessTests.paint(leaving, "linux", second);

    first.close();
    await MainProcessStartFixture.answerSaveAsync(unanswered, "linux", first, 1);
    await MainProcessStartFixture.answerSaveAsync(unanswered, "linux", first, 2);
    await Condition.waitAsync(() => first.isGone);
    second.close();
    await MainProcessStartFixture.answerSaveAsync(leaving, "linux", second, 1);
    await Condition.waitAsync(() => MainProcessTests.quitQuestions(second).length === 1);
    launcher.listener?.onDisconnected(null);
    await MainProcessStartFixture.answerSaveAsync(leaving, "linux", second, 2);
    await Condition.waitAsync(() => second.isGone);

    Assert.areEqual(0, MainProcessTests.quitQuestions(first).length);
    Assert.areEqual(2000, slow.timeouts[slow.calls.lastIndexOf("desktop.work")]);
    Assert.areEqual(
      1,
      MainProcessStartFixture.readErrors(process, "The runtime's work could not be read before quitting, so Noldova Desktop Sample quits without asking: CallUnansweredException: The runtime did not answer desktop.work in time.").length);
    Assert.areEqual("null", JSON.stringify(MainProcessTests.quitQuestions(second).at(-1)));
    Assert.areEqual(1, MainProcessTests.stops(busy).length);
  }

  @TestMethod
  public async quitsWithoutAskingWhileNoRuntimeIsConnectedOrWhenItCannotBeStoppedOrItsWorkCannotBeRead(): Promise<void> {
    const connecting = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(() => undefined)));
    const failing = new FakeRuntimeConnection();
    failing.answers.set("desktop.stop", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));
    const process = new FakeMainProcessEnvironment("linux");
    const refused = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(failing), new FakeElectron(), new FakeDeviceIdentity(), process);
    const unread = new FakeRuntimeConnection();
    unread.answers.set("desktop.stop", MainProcessTests.busy());
    const unreadable = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(unread));
    const going = new FakeRuntimeConnection();
    const launcher = new FakeRuntimeLauncher(going, new Promise<FakeRuntimeConnection>(() => undefined));
    going.deferred.set("desktop.stop", () => {
      launcher.listener?.onDisconnected(null);
      return Promise.resolve(MainProcessTests.busy());
    });
    const gone = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const apps = [connecting, refused, unreadable, gone];
    const windows = apps.map(t => MainProcessStartFixture.firstWindow(t));
    unread.answers.set("desktop.work", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));

    for (const app of apps) {
      const window = MainProcessStartFixture.firstWindow(app);
      MainProcessTests.paint(app, "linux", window);
      window.close();
      await MainProcessStartFixture.answerSaveAsync(app, "linux", window, 1);
    }
    await MainProcessStartFixture.answerSaveAsync(unreadable, "linux", MainProcessStartFixture.firstWindow(unreadable), 2);
    await MainProcessStartFixture.answerSaveAsync(gone, "linux", MainProcessStartFixture.firstWindow(gone), 2);
    await Condition.waitAsync(() => windows.every(t => t.isGone));

    Assert.areEqual(0, windows.map(t => MainProcessTests.quitQuestions(t).length).reduce((t, u) => t + u, 0));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime could not be stopped as Noldova Desktop Sample quits: The runtime is stopping.").length);
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE, MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(unread)));
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(going)));
    Assert.isTrue(apps.every(t => t.app.calls.includes("quit")));
  }

  @TestMethod
  public async opensAWindowWhenStartedAgainWhileInTheTray(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);

    fixture.electron.app.emit("second-instance");
    fixture.electron.app.emit("second-instance");

    Assert.areEqual(2, fixture.electron.windows.length);
    Assert.areEqual(false, fixture.electron.windows[1]?.isGone);
  }

  @TestMethod
  public async opensNoWindowWhenStartedAgainBeforeItsLaunchBarrierIsChecked(): Promise<void> {
    const electron = new FakeElectron();
    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux"));
    await electron.app.becomeReadyAsync();

    electron.app.emit("second-instance");
    const whileChecking = electron.windows.length;
    await Condition.waitAsync(() => electron.windows.length > 0);
    electron.app.emit("second-instance");

    Assert.areEqual(0, whileChecking);
    Assert.areEqual(1, electron.windows.length);
  }

  @TestMethod
  public async opensNoWindowFromTheHintTheIconOrAnotherStartWhileAQuitRunsOrOnceItExits(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.electron.notifications.created.length === 1);
    const stopping = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("desktop.stop", () => stopping.promise);

    fixture.click("Quit Noldova Desktop Sample");
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.stop"));
    fixture.electron.notifications.created[0]?.click();
    fixture.electron.app.emit("second-instance");
    fixture.click("Open Noldova Desktop Sample");
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    const windowsWhileQuitting = fixture.electron.windows.length;
    stopping.resolve(Response.success("r", null));
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));
    fixture.electron.notifications.created[0]?.click();
    fixture.electron.app.emit("second-instance");

    Assert.areEqual(1, windowsWhileQuitting);
    Assert.areEqual(1, fixture.electron.windows.length);
  }

  @TestMethod
  public async opensNoWindowFromTheDockWhileAQuitRunsOnMacOS(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const stopping = Promise.withResolvers<Response>();
    connection.deferred.set("desktop.stop", () => stopping.promise);
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "darwin", window, 1);
    await Condition.waitAsync(() => window.isGone);

    electron.app.quit();
    await Condition.waitAsync(() => connection.calls.includes("desktop.stop"));
    electron.app.emit("activate");
    const windowsWhileQuitting = electron.windows.length;
    stopping.resolve(Response.success("r", null));
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));
    electron.app.emit("activate");

    Assert.areEqual(1, windowsWhileQuitting);
    Assert.areEqual(1, electron.windows.length);
  }

  @TestMethod
  public async opensAWindowWhenTheTrayIconGoesAwayWhileNoWindowIsOpen(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);

    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);
    const windowsInTray = fixture.electron.windows.length;
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });

    Assert.areEqual(1, windowsInTray);
    Assert.areEqual(2, fixture.electron.windows.length);
    Assert.isUndefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async asksInANewWindowOnceItHasPaintedWhenQuitFromTheTrayWithWorkAndNoWindowOpen(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    MainProcessTests.answerStops(fixture.connection, [MainProcessTests.busy()]);
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);

    fixture.click("Quit Noldova Desktop Sample");
    await Condition.waitAsync(() => fixture.electron.windows.length === 2);
    const asking = fixture.electron.windows[1];
    Assert.isDefined(asking);
    await setImmediate();
    const questionsBeforePaint = MainProcessTests.quitQuestions(asking).length;
    fixture.electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("win32", asking.id), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => MainProcessTests.quitQuestions(asking).length === 1);
    fixture.electron.ipcMain.invoke("desktop:quitAnswer", MainProcessStartFixture.trustedEvent("win32", asking.id), "Stop");
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", asking, 1);
    await Condition.waitAsync(() => asking.isGone);

    Assert.areEqual(0, questionsBeforePaint);
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE, { policy: "StopWork", keepsWhileShared: true }]), JSON.stringify(MainProcessTests.stops(fixture.connection)));
    Assert.isTrue(fixture.electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheWindowOpenedToAskClosesBeforeItPaints(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    MainProcessTests.answerStops(fixture.connection, [MainProcessTests.busy()]);
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);

    fixture.click("Quit Noldova Desktop Sample");
    await Condition.waitAsync(() => fixture.electron.windows.length === 2);
    const asking = fixture.electron.windows[1];
    Assert.isDefined(asking);
    asking.destroy();
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));

    Assert.areEqual(0, MainProcessTests.quitQuestions(asking).length);
    Assert.areEqual(JSON.stringify([MainProcessTests.IF_IDLE, MainProcessTests.IF_IDLE]), JSON.stringify(MainProcessTests.stops(fixture.connection)));
  }

  @TestMethod
  public async keepsRunningOnMacOSWhenTheLastWindowClosesWithoutAHintAndQuitsWhenAsked(): Promise<void> {
    const files = new FakeDeviceFiles();
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", undefined, undefined, undefined, undefined, files);
    const window = MainProcessStartFixture.firstWindow(electron);

    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "darwin", window, 1);
    await Condition.waitAsync(() => window.isGone);
    electron.app.emit("window-all-closed");
    const callsInBackground = electron.app.calls.filter(t => t.startsWith("quit")).length;
    electron.app.quit();
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));

    Assert.areEqual(0, callsInBackground);
    Assert.areEqual(0, electron.notifications.created.length);
    Assert.areEqual(JSON.stringify([{ trayIcon: true }]), JSON.stringify(files.state.writes));
  }

  @TestMethod
  public async logsAnUnexpectedStartFailureInFullAndShowsIt(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new TypeError("A defect.")), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = MainProcessStartFixture.trustedEvent("linux");

    await Condition.waitAsync(() => process.errors.includes("so the window offers to try again"));

    Assert.isTrue(process.errors.includes("The runtime could not be started or reached, so the window offers to try again: TypeError: A defect."));
    Assert.isTrue(process.errors.includes("main-process.test"), "the log keeps the error's stack");
    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["TypeError: A defect."] }), JSON.stringify(electron.ipcMain.invoke("desktop:readStartup", event)));
  }

  @TestMethod
  public async keepsItsOwnNameInItsLogWhenTheAccountIsNamedAfterOneOfItsWords(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux", [], {}, "/home/noldova");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);

    electron.ipcMain.send("desktop:windowError", MainProcessStartFixture.trustedEvent("linux"), "clock",
      `Error: Its window part failed to save ${process.homeFolder}/notes.json for noldova while Noldova Desktop Sample was closing.`);

    Assert.areEqual(JSON.stringify(["Window error in clock: Error: Its window part failed to save ~/notes.json for [redacted] while Noldova Desktop Sample was closing."]),
      JSON.stringify(process.errors.split("\n").filter(t => t.includes("Window error")).map(t => t.slice(t.indexOf("Window error")))));
  }

  @TestMethod
  public async stopsWaitingForAWindowThatIsGone(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    window.close();
    window.destroy();
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async sendsNoCloseRequestToAWindowThatIsGone(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    window.isGone = true;
    window.close();
    await setImmediate();

    Assert.areEqual(0, MainProcessStartFixture.closeRequests(window).length);
    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async quitsWhenTheLastWindowClosesWithoutATrayIcon(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");

    MainProcessStartFixture.firstWindow(electron).destroy();
    electron.app.emit("window-all-closed");
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));

    Assert.areEqual("quit prevented", electron.app.calls.at(-2));
  }

  @TestMethod
  public async bringsItsWindowForwardWhenStartedAgainAndLeavesAWindowNotShownYetToShowWhenReady(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.app.emit("second-instance");
    const beforeShown = [...window.calls];
    await MainProcessStartFixture.showAsync(electron, "linux", window);
    electron.app.emit("second-instance");
    window.isMinimizedNow = true;
    electron.app.emit("second-instance");

    Assert.areEqual(0, beforeShown.length);
    Assert.areEqual(JSON.stringify(["show", "focus", "restore", "focus"]), JSON.stringify(window.calls.filter(t => ["show", "focus", "restore"].includes(t))));
  }

  @TestMethod
  public async givesItsLauncherTheInstallationInTheDeviceFolderItIsGiven(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const installations: Installation[] = [];
      await MainProcessStartFixture.startAsync(
        new FakeElectron(), new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment), undefined, undefined, undefined, undefined, installations);
      const [installation] = installations;
      Assert.isDefined(installation);
      const [holder] = await ProcessPresence.create(process.platform).stampAsync([[process.pid, "main"]]);
      Assert.isDefined(holder);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));

      const status = await installation.checkAsync(RuntimeBuild.identity.productVersion);

      Assert.areEqual(join(folder, "installations"), dirname(installation.folder));
      Assert.areEqual(UpdateBarrierStatus.Held, status);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async opensNoWindowAndExitsWhileAnotherMainProcessInstallsAnUpdate(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      electron.dialog.answers.push(0);
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const mainProcess = new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment);
      const installations: Installation[] = [];
      const launcher = new FakeRuntimeLauncher();
      const [holder] = await ProcessPresence.create(process.platform).stampAsync([[process.pid, "main"]]);
      Assert.isDefined(holder);
      const installation = await MainProcessStartFixture.writeBarrierAsync(mainProcess, folder, JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));
      await MainProcessStartFixture.startAsync(electron, mainProcess, launcher, undefined, undefined, undefined, installations);

      await electron.app.becomeReadyAsync();
      electron.app.emit("activate");
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));
      electron.app.emit("activate");

      Assert.areEqual(installation.folder, installations[0]?.folder);
      Assert.areEqual(0, electron.windows.length);
      Assert.areEqual(0, launcher.calls.length);
      Assert.areEqual(JSON.stringify(["Noldova Desktop Sample is installing an update."]), JSON.stringify(electron.dialog.boxes.map(t => t.options.message)));
      Assert.isTrue(existsSync(installation.barrierFile));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async removesABarrierAnUpdateLeftBeforeItsHandoffLogsItAndOpensItsWindow(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const mainProcess = new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment);
      const installation = await MainProcessStartFixture.writeBarrierAsync(mainProcess, folder,
        JSON.stringify(new UpdateBarrier(new UpdateProcess(process.pid, 1, 2, "main"), "0.3.0", UpdateBarrierState.Closing, null).toJson()));
      await MainProcessStartFixture.startAsync(electron, mainProcess, new FakeRuntimeLauncher());

      await MainProcessStartFixture.openAsync(electron);

      Assert.areEqual(0, electron.dialog.boxes.length);
      Assert.isFalse(existsSync(installation.barrierFile));
      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess, "An update stopped before its handoff, so its launch barrier was removed.").length);
      MainProcessStartFixture.firstWindow(electron).destroy();
      electron.app.emit("will-quit");
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async logsWhenItsLaunchBarriersFolderStopsBeingWatched(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const mainProcess = new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment);
      const installations: Installation[] = [];
      await MainProcessStartFixture.startAsync(electron, mainProcess, new FakeRuntimeLauncher(), undefined, undefined, undefined, installations);
      const [installation] = installations;
      Assert.isDefined(installation);
      await mkdir(installation.folder, { recursive: true });
      const watches = new FolderWatchFixture(installation.folder);
      try {
        await MainProcessStartFixture.openAsync(electron);
        watches.change();
        await setImmediate();

        watches.fail("EPERM: operation not permitted, watch");

        Assert.areEqual(1, watches.count);
        Assert.isFalse(electron.app.calls.includes("exit 0"));
        Assert.areEqual(
          JSON.stringify(["The launch barrier's folder could not be watched, so another main process's update can't close this one: Error: EPERM: operation not permitted, watch"]),
          JSON.stringify(MainProcessStartFixture.readErrors(mainProcess, "The launch barrier's folder could not be watched")));
      }
      finally {
        watches[Symbol.dispose]();
        MainProcessStartFixture.firstWindow(electron).destroy();
        electron.app.emit("will-quit");
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async quitsAndLogsWhenItCannotTellThePersonThatAnUpdateIsInstalling(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      electron.dialog.failure = new Error("No display");
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const mainProcess = new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment);
      const launcher = new FakeRuntimeLauncher();
      await MainProcessStartFixture.writeBarrierAsync(mainProcess, folder, "{\"holder\":");
      await MainProcessStartFixture.startAsync(electron, mainProcess, launcher);

      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(0, electron.windows.length);
      Assert.areEqual(0, launcher.calls.length);
      Assert.areEqual(1, MainProcessStartFixture.readErrors(mainProcess, "The launch barrier could not be settled: Error: No display").length);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async quitsAndLogsWhenItCannotTellThePersonThatTheRuntimeStartFoundAnUpdate(): Promise<void> {
    const electron = new FakeElectron();
    electron.dialog.failure = new Error("No display");
    const process = new FakeMainProcessEnvironment("linux");

    const launcher = new FakeRuntimeLauncher(new UpdateInProgressException(UpdateBarrierStatus.Held));

    await MainProcessStartFixture.startAsync(electron, process, launcher);
    await Condition.waitAsync(() => launcher.calls.length === 1);
    await electron.app.becomeReadyAsync();
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));
    for (const window of electron.windows)
      window.destroy();

    Assert.areEqual(1, electron.dialog.boxes.length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The launch barrier could not be settled: Error: No display").length);
  }

  @TestMethod
  public async quitsWhenItLosesTheRuntimeAfterAnotherMainProcessClosedTheInstallation(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      const launcher = new FakeRuntimeLauncher();
      const installations: Installation[] = [];
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const mainProcess = new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment);
      await MainProcessStartFixture.startAsync(electron, mainProcess, launcher, undefined, undefined, undefined, installations);
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => launcher.connections.length === 1);
      const [installation] = installations;
      Assert.isDefined(installation);
      const [other] = await ProcessPresence.create(process.platform).stampAsync([[process.ppid, "main"]]);
      Assert.isDefined(other);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(other, "0.3.0", UpdateBarrierState.Closing, null).toJson()));

      launcher.listener?.onDisconnected(null);
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.isTrue(existsSync(installation.barrierFile));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async savesEveryWindowForAnUpdateAndQuitsWhenAnotherMainProcessClosesTheInstallation(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      const launcher = new FakeRuntimeLauncher();
      const installations: Installation[] = [];
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const mainProcess = new FakeMainProcessEnvironment(process.platform, [`--device-dir=${folder}`], environment);
      await MainProcessStartFixture.startAsync(electron, mainProcess, launcher, undefined, undefined, undefined, installations);
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => launcher.connections.length === 1);
      const [installation] = installations;
      Assert.isDefined(installation);
      const [coordinator] = await ProcessPresence.create(process.platform).stampAsync([[process.pid, "main"]]);
      Assert.isDefined(coordinator);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(coordinator, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));
      const window = MainProcessStartFixture.firstWindow(electron);
      const event = MainProcessStartFixture.trustedEvent(process.platform);
      const connection = launcher.connections[0];
      await Condition.waitAsync(() => connection?.calls.includes("desktop.readWindowBounds") === true);
      connection?.answers.set("desktop.writeWindowBounds", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));

      window.bounds = { x: 40, y: 60, width: 900, height: 640 };
      window.change("move");
      launcher.listener?.onEvent(new Event(ShellEvents.updating, null));
      await Condition.waitAsync(() => window.webContents.sent.some(t => t[0] === "desktop:updateSaveRequest"));
      const request = window.webContents.sent.find(t => t[0] === "desktop:updateSaveRequest");
      const untrusted = electron.ipcMain.invoke("desktop:updateSaveAnswer", { ...event, senderFrame: null }, request?.[1], []);
      const answered = electron.ipcMain.invoke("desktop:updateSaveAnswer", event, request?.[1], ["Notes couldn't save"]);
      await Condition.waitAsync(() => connection?.calls.includes("desktop.updateSaved") === true);
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(coordinator, "0.3.0", UpdateBarrierState.Closing, null).toJson()));
      launcher.listener?.onDisconnected(null);
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.isTrue(window.webContents.sent.some(t => t[0] === "desktop:startupState" && JSON.stringify(t[1]) === JSON.stringify({ kind: "Updating", details: ["0.3.0"] })));
      Assert.isFalse(untrusted === true);
      Assert.isTrue(answered === true);
      Assert.areEqual(JSON.stringify(new UpdateSaved(1000, ["Notes couldn't save"]).toJson()), JSON.stringify(connection?.payloads.at(-1)));
      Assert.areEqual(
        JSON.stringify(["desktop.writeWindowBounds", "desktop.updateSaved"]),
        JSON.stringify(connection?.calls.filter(t => t === "desktop.writeWindowBounds" || t === "desktop.updateSaved")));
      Assert.areEqual(
        JSON.stringify(["The window's bounds could not be saved: WindowStateRefusedException: The runtime refused desktop.writeWindowBounds: The database is busy."]),
        JSON.stringify(MainProcessStartFixture.readErrors(mainProcess, "The window's bounds could not be saved")));
      Assert.areEqual(mainProcess.programs.starts.length, mainProcess.programs.stops);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async recordsItselfInItsInstallationAndLogsWhenItCannotButStartsAnyway(): Promise<void> {
    const recorded = await MainProcessTests.startRecordingAsync(true);
    const notFound = await MainProcessTests.startRecordingAsync(false);
    const failed = await MainProcessTests.startRecordingAsync(new Error("EACCES: permission denied, mkdir"));

    Assert.areEqual(0, MainProcessStartFixture.readErrors(recorded, "This main process could not be recorded").length);
    Assert.areEqual(JSON.stringify(["This main process could not be recorded in its installation, so an update may not wait for it: Noldova Desktop Sample could not find its own process in the process table."]),
      JSON.stringify(MainProcessStartFixture.readErrors(notFound, "This main process could not be recorded")));
    Assert.areEqual(JSON.stringify(["This main process could not be recorded in its installation, so an update may not wait for it: Error: EACCES: permission denied, mkdir"]),
      JSON.stringify(MainProcessStartFixture.readErrors(failed, "This main process could not be recorded")));
  }

  @TestMethod
  public async opensOneWindowWhenActivatedBeforeItsLaunchBarrierIsChecked(): Promise<void> {
    const electron = new FakeElectron();
    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("darwin"));
    await electron.app.becomeReadyAsync();

    electron.app.emit("activate");
    const whileChecking = electron.windows.length;
    await Condition.waitAsync(() => electron.windows.length > 0);
    electron.app.emit("activate");

    Assert.areEqual(0, whileChecking);
    Assert.areEqual(1, electron.windows.length);
  }

  @TestMethod
  public async opensAWindowWhenActivatedWithoutOne(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("darwin");

    electron.app.emit("activate");
    Assert.areEqual(1, electron.windows.length);
    MainProcessStartFixture.firstWindow(electron).destroy();
    electron.app.emit("second-instance");
    electron.app.emit("activate");

    Assert.areEqual(2, electron.windows.length);
  }

  @TestMethod
  public async keepsItsProfileInTheCheckoutsDataDirectoryAndRunsTheRuntimeUnderElectronsNode(): Promise<void> {
    const electron = new FakeElectron();
    const process = new FakeMainProcessEnvironment("linux", ["electron", "main.js"], { KEPT: "yes" });
    const checkout = join(dirname(fileURLToPath(MainProcessStartFixture.MODULE_URL)), "..", "..", "..");
    const dataDirectory = DataDirectoryLocator.locate(false, {}, process.homeFolder, checkout);

    const [settings] = await MainProcessStartFixture.startAsync(electron, process);

    Assert.areEqual(JSON.stringify([`setPath userData ${join(dataDirectory.root, "main")}`]), JSON.stringify(electron.app.calls.filter(t => t.startsWith("setPath"))));
    Assert.areEqual(dataDirectory.root, settings?.dataDirectory.root);
    Assert.areEqual(JSON.stringify(["/electron/electron", RuntimeEntry.entryPath, "linux"]), JSON.stringify([settings?.executablePath, settings?.entryPath, settings?.platform]));
    Assert.areEqual(JSON.stringify({ KEPT: "yes", ELECTRON_RUN_AS_NODE: "1" }), JSON.stringify(settings?.environment));
  }

  @TestMethod
  public async usesTheDataDirectoryAndProfileItIsGiven(): Promise<void> {
    const electron = new FakeElectron();
    const data = join(dirname(fileURLToPath(MainProcessStartFixture.MODULE_URL)), "test-data");

    const [settings] = await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`, "--user-data-dir=/profile"]));

    Assert.areEqual(data, settings?.dataDirectory.root);
    Assert.isTrue(electron.app.calls.every(t => !t.startsWith("setPath")));
  }

  @TestMethod
  public async resolvesRelativeFoldersAgainstTheFolderItWasStartedInBeforeUsingThem(): Promise<void> {
    const electron = new FakeElectron(true, true);
    const files = new FakeDeviceFiles();
    const process = new FakeMainProcessEnvironment("linux", ["/opt/noldova-desktop/noldova-desktop", "--data-dir=data", "--device-dir=./device"]);

    const [settings] = await MainProcessStartFixture.startAsync(electron, process, undefined, undefined, files);

    const data = join(process.workingDirectory, "data");
    Assert.areEqual(data, settings?.dataDirectory.root);
    Assert.areEqual(`setPath userData ${new DataDirectory(data).profileFolder}`, electron.app.calls.find(t => t.startsWith("setPath")));
    Assert.isTrue(files.created.length > 0 && files.created.every(([folder]) => folder.startsWith(join(process.workingDirectory, "device"))), JSON.stringify(files.created));
  }

  @TestMethod
  @TestData("/home/person/work", "/home/person/work")
  @TestData(null, null)
  public async resolvesRelativeFoldersOfAnAppImageAgainstTheFolderItsLauncherWasStartedIn(startFolder: string | null, expected: string | null): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux", ["/electron/electron", "--data-dir=data", "--device-dir=device"], {
      APPIMAGE: "/home/person/Applications/Noldova Desktop Sample.AppImage",
      APPDIR: "/electron",
      ...Object.isNull(startFolder) ? {} : { OWD: startFolder }
    });
    const files = new FakeDeviceFiles();

    const [settings] = await MainProcessStartFixture.startAsync(new FakeElectron(true, true), process, undefined, undefined, files);

    const folder = expected ?? process.workingDirectory;
    Assert.areEqual(resolve(folder, "data"), settings?.dataDirectory.root);
    Assert.isTrue(files.created.length > 0 && files.created.every(([t]) => t.startsWith(resolve(folder, "device"))), JSON.stringify(files.created));
  }

  @TestMethod
  @TestData("--lang=en-US")
  @TestData("--data-dir=")
  @TestData("--data-dir= ")
  public async keepsAPackagedBuildsDataInThePersonsDataDirectory(argument: string): Promise<void> {
    const electron = new FakeElectron(true, true);
    const process = new FakeMainProcessEnvironment("linux", [argument]);

    const [settings] = await MainProcessStartFixture.startAsync(electron, process);

    Assert.areEqual(DataDirectoryLocator.locate(true, {}, process.homeFolder, "/unused").root, settings?.dataDirectory.root);
  }

  @TestMethod
  public async treatsAStartThroughElectronsDefaultAppAsDevelopmentWhateverItsProgramIsCalled(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/noldova-desktop/noldova-desktop"));
    const electron = new FakeElectron(true, true);
    const process = new FakeMainProcessEnvironment("win32");
    process.isDefaultApp = true;

    const [settings] = await MainProcessStartFixture.startAsync(electron, process, new FakeRuntimeLauncher(handover));
    await MainProcessStartFixture.openAsync(electron);
    await Condition.waitAsync(() => JsonReader.fromValue(electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("win32"))).readString("kind") === "NewerBuild");

    Assert.areEqual(DataDirectoryLocator.locate(false, {}, process.homeFolder, MainProcessStartFixture.checkoutRoot()).root, settings?.dataDirectory.root);
    Assert.areEqual(MainProcessStartFixture.DEVELOPMENT_APP_ID, MainProcessStartFixture.firstWindow(electron).appDetails?.appId);
    Assert.areEqual(0, process.started.length);
    Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("win32"))));
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("linux", false)
  @TestData("win32", true)
  @TestData("darwin", false)
  public async namesItsMainProcessFileAndAsksForGnomesShortcutPortalOnLinux(platform: string, isPackaged: boolean): Promise<void> {
    const electron = new FakeElectron(true, isPackaged);
    const appId = isPackaged ? "com.noldova.desktop" : MainProcessStartFixture.DEVELOPMENT_APP_ID;

    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment(platform));

    Assert.areEqual(platform === "linux" ? `appendSwitch enable-features GlobalShortcutsPortalPreferredTrigger,setDesktopName ${appId}.desktop` : String.empty,
      electron.app.calls.filter(t => t.startsWith("setDesktopName") || t.startsWith("appendSwitch")).join(","));
  }

  @TestMethod
  public async keepsTheFeaturesThePersonEnabledWhenItAsksForGnomesShortcutPortal(): Promise<void> {
    const electron = new FakeElectron(true, true);
    electron.app.switches.set("enable-features", "WaylandWindowDecorations,UseOzonePlatform");

    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux"));

    Assert.areEqual("appendSwitch enable-features WaylandWindowDecorations,UseOzonePlatform,GlobalShortcutsPortalPreferredTrigger",
      electron.app.calls.filter(t => t.startsWith("appendSwitch")).join(","));
  }

  @TestMethod
  public async tellsItsWindowHowStartingTheRuntimeGoesWhenTheRuntimeIsReadyAfterTheWindowOpens(): Promise<void> {
    const connection = Promise.withResolvers<FakeRuntimeConnection>();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection.promise));
    const window = MainProcessStartFixture.firstWindow(electron);
    const before = electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("linux"));

    connection.resolve(new FakeRuntimeConnection());
    await Condition.waitAsync(() => MainProcessTests.isReady(electron));

    Assert.areEqual(JSON.stringify({ kind: "Connecting", details: [] }), JSON.stringify(before));
    Assert.areEqual(JSON.stringify([
      ["desktop:startupState", { kind: "Ready", details: [] }]
    ]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:startupState")));
    Assert.isNull(electron.ipcMain.invoke("desktop:readStartup", { sender: { id: 1 }, senderFrame: null }));
  }

  @TestMethod
  public async startsTheRuntimeBeforeElectronIsReadyAndGivesItsWindowTheStateAndTheEventsItHeld(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = new FakeElectron();
    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux"), launcher);
    await Condition.waitAsync(() => launcher.connections.length === 1);
    await setImmediate();
    launcher.listener?.onEvent(new Event(ShellEvents.modulesChanged, { sequence: 1 }));
    launcher.listener?.onEvent(new Event(ShellEvents.modulesChanged, { sequence: 2 }));
    const isReadyAtStart = electron.app.isReady;
    const windowsAtStart = electron.windows.length;

    await MainProcessStartFixture.openAsync(electron);
    await setImmediate();
    const window = MainProcessStartFixture.firstWindow(electron);

    Assert.isFalse(isReadyAtStart);
    Assert.areEqual(0, windowsAtStart);
    Assert.areEqual(1, launcher.calls.length);
    Assert.areEqual(JSON.stringify({ kind: "Ready", details: [] }), JSON.stringify(electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("linux"))));
    Assert.areEqual(JSON.stringify([
      ["desktop:runtimeEvent", ShellEvents.modulesChanged.text, { sequence: 1 }],
      ["desktop:runtimeEvent", ShellEvents.modulesChanged.text, { sequence: 2 }]
    ]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:startupState" || t[0] === "desktop:runtimeEvent")));
    Assert.isTrue(MainProcessTests.isReady(electron));
  }

  @TestMethod
  public async handsAPackagedBuildOverToANewerBuildWithItsDataArgumentsAndQuits(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/noldova-desktop/noldova-desktop"));
    const process = new FakeMainProcessEnvironment("linux", [
      "/opt/noldova-desktop/noldova-desktop-1", "--data-dir=/work/data", "--inspect=9229", "--user-data-dir=/work/profile", "--device-dir=/work/device", "--data-dir-extra"
    ]);
    const electron = new FakeElectron(true, true);
    await MainProcessStartFixture.startAsync(electron, process, new FakeRuntimeLauncher(handover));
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));
    await electron.app.becomeReadyAsync();
    await setImmediate();

    Assert.areEqual(0, electron.windows.length);
    Assert.areEqual(
      JSON.stringify([["/opt/noldova-desktop/noldova-desktop", "--data-dir=/work/data", "--user-data-dir=/work/profile", "--device-dir=/work/device"]]),
      JSON.stringify(process.started));
    Assert.areEqual("quit", electron.app.calls.at(-1));
  }

  @TestMethod
  public async logsAHandOverWhoseNewerBuildCannotStartAndQuits(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/noldova-desktop/noldova-desktop"));
    const process = new FakeMainProcessEnvironment("linux", ["/opt/noldova-desktop/noldova-desktop-1", "--data-dir=/work/data"]);
    process.startFailure = new Error("spawn /opt/noldova-desktop/noldova-desktop ENOENT");
    const electron = new FakeElectron(true, true);
    await MainProcessStartFixture.startAsync(electron, process, new FakeRuntimeLauncher(handover));
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));
    await electron.app.becomeReadyAsync();
    await setImmediate();

    Assert.areEqual(0, electron.windows.length);
    Assert.areEqual(JSON.stringify(["The newer Noldova Desktop Sample could not be started for the hand-over, so this one quits without it: Error: spawn /opt/noldova-desktop/noldova-desktop ENOENT"]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The newer Noldova Desktop Sample")));
  }

  @TestMethod
  public saysANewerBuildRunsWhenADevelopmentBuildCannotHandOver(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/electron/electron"));
    return MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(handover)).then(electron => {
      Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("linux"))));
    });
  }

  @TestMethod
  public closesItsRuntimeConnectionWhenQuitting(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    return MainProcessStartFixture.startReadyAsync("linux", launcher).then(electron => {
      electron.app.emit("will-quit");

      Assert.isTrue(launcher.connections[0]?.isClosed === true);
    });
  }

  @TestMethod
  public async waitsBeforeReconnectingAfterAConnectionEndsSoonAgainAndStopsWaitingWhenQuitting(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);

    launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => MainProcessTests.isReady(electron));
    launcher.listener?.onDisconnected(null);
    await setImmediate();
    const waiting = electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("linux"));
    electron.app.emit("will-quit");
    await setImmediate();

    Assert.areEqual(JSON.stringify({ kind: "Connecting", details: [] }), JSON.stringify(waiting));
    Assert.areEqual(2, launcher.calls.length);
  }

  @TestMethod
  public async logsAWindowWhosePageDoesNotLoad(): Promise<void> {
    const process = new FakeMainProcessEnvironment("win32");
    await MainProcessStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(), new FailingLoadElectron(), new FakeDeviceIdentity(), process);
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The window's page ").length > 0);

    const errors = MainProcessStartFixture.readErrors(process, "The window's page ");
    Assert.areEqual(1, errors.length);
    Assert.isTrue(errors[0]?.endsWith(` didn't load: Error: ${FailingLoadWindow.message}`) === true, errors.join("\n"));
  }

  @TestMethod
  public async restoresTheSavedBoundsBeforeShowingTheWindow(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async keepsTheSavedPositionUnderWaylandWhenTheCompositorMovesTheWindowAndTheWindowsUnderX11(): Promise<void> {
    for (const [platform, expected] of [["wayland", { x: 200, y: 100 }], ["x11", { x: 16, y: 10 }]] as const) {
      const connection = new FakeRuntimeConnection();
      connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
      const electron = new FakeElectron();
      electron.app.switches.set("ozone-platform", platform);
      await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), electron);
      const window = MainProcessStartFixture.firstWindow(electron);
      electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
      await Condition.waitAsync(() => window.isShown);

      window.bounds = { x: 16, y: 10, width: 1000, height: 700 };
      window.change("move");
      await Condition.waitAsync(() => connection.calls.includes("desktop.writeWindowBounds"));

      Assert.areEqual(JSON.stringify({ ...expected, width: 1000, height: 700, maximized: false }),
        JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    }
  }

  @TestMethod
  public async maximizesAWindowSavedMaximizedAsItShowsItSoItOpensFocused(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("darwin"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.calls.includes("show"));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async restoresTheSavedBoundsTheNextTimeTheRuntimeIsReadyWhenTheConnectionEndsDuringTheRead(): Promise<void> {
    const first = new FakeRuntimeConnection();
    first.deferred.set("desktop.readWindowBounds", () => {
      first.isClosed = true;
      return Promise.reject(new ConnectionClosedException());
    });
    const second = new FakeRuntimeConnection();
    second.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const reconnection = Promise.withResolvers<FakeRuntimeConnection>();
    const launcher = new FakeRuntimeLauncher(first, reconnection.promise);
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    launcher.listener?.onDisconnected(null);
    reconnection.resolve(second);
    await Condition.waitAsync(() => window.calls.some(t => t.startsWith("setBounds")));

    Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "The window's saved bounds").length);
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  public async readsTheDeviceIdentityFromTheFolderItIsGivenOrTheOperatingSystemsOne(): Promise<void> {
    const given = new FakeDeviceIdentity();
    const located = new FakeDeviceIdentity();
    const environment = { LOCALAPPDATA: "C:\\Users\\person\\AppData\\Local" };

    const first = new FakeElectron();
    const second = new FakeElectron();

    await MainProcessStartFixture.startAsync(first, new FakeMainProcessEnvironment("win32", ["--device-dir=/devices/this"]), new FakeRuntimeLauncher(), given);
    await MainProcessStartFixture.startAsync(second, new FakeMainProcessEnvironment("win32", [], environment, "C:\\Users\\person"), new FakeRuntimeLauncher(), located);
    await first.app.becomeReadyAsync();
    await second.app.becomeReadyAsync();

    Assert.areEqual(JSON.stringify(["/devices/this"]), JSON.stringify(given.folders));
    Assert.areEqual(JSON.stringify([DeviceFolder.locate("win32", environment, "C:\\Users\\person")]), JSON.stringify(located.folders));
  }

  @TestMethod
  public async showsTheOperatingSystemANotificationPostedAfterItsWindowsReadWhileNoWindowIsFocusedAndOpensItInTheWindow(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const early = MainProcessTests.wireNotification(1, "Early");
    connection.answers.set("desktop.notifications", Response.success("r", { notifications: [early], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    const later = MainProcessTests.wireNotification(2, "Later");
    await MainProcessStartFixture.showAsync(electron, "linux", window);

    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [early], quietDevices: [], mutedModules: [], sequence: 1 }));
    await MainProcessTests.requestAsync(electron, MainProcessStartFixture.trustedEvent("linux"), "desktop.notifications", {});
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [later, early], quietDevices: [], mutedModules: [], sequence: 2 }));
    window.isFocusedNow = true;
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [MainProcessTests.wireNotification(3, "Focused"), later, early], quietDevices: [], mutedModules: [], sequence: 3 }));
    window.isMinimizedNow = true;
    electron.notifications.created[0]?.click();

    Assert.areEqual("Later", electron.notifications.created.map(t => t.title).join(","));
    Assert.isTrue(String(electron.notifications.created[0]?.options.icon).endsWith("icon-dark-512.png"));
    Assert.areEqual("restore,focus", window.calls.filter(t => t === "restore" || t === "focus").join(","));
    Assert.areEqual(JSON.stringify([["desktop:notificationOpened", "2"]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:notificationOpened")));
  }

  @TestMethod
  public async holdsTheOperatingSystemsNotificationsWhileItsWindowReloadsUntilTheWindowReadsAgain(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const alarm = MainProcessTests.wireNotification(1, "Alarm");
    connection.answers.set("desktop.notifications", Response.success("r", { notifications: [alarm], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await MainProcessTests.requestAsync(electron, event, "desktop.notifications", {});
    const reposted = MainProcessTests.wireNotification(2, "Re-posted by the window");

    window.webContents.startLoading();
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [reposted, alarm], quietDevices: [], mutedModules: [], sequence: 2 }));
    const whileLoading = electron.notifications.created.length;
    connection.answers.set("desktop.notifications", Response.success("r", { notifications: [reposted, alarm], isDoNotDisturb: false, mutedModules: [], sequence: 2 }));
    await MainProcessTests.requestAsync(electron, event, "desktop.notifications", {});
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [MainProcessTests.wireNotification(3, "Posted after"), reposted, alarm], quietDevices: [], mutedModules: [], sequence: 3 }));

    Assert.areEqual(0, whileLoading);
    Assert.areEqual("Posted after", electron.notifications.created.map(t => t.title).join(","));
  }

  @TestMethod
  public async keepsShowingTheOperatingSystemsNotificationsWhenAFrameOfItsWindowLoads(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const alarm = MainProcessTests.wireNotification(1, "Alarm");
    connection.answers.set("desktop.notifications", Response.success("r", { notifications: [alarm], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    await MainProcessTests.requestAsync(electron, MainProcessStartFixture.trustedEvent("linux"), "desktop.notifications", {});

    window.webContents.startFrameLoading(false);
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [MainProcessTests.wireNotification(2, "Posted"), alarm], quietDevices: [], mutedModules: [], sequence: 2 }));

    Assert.areEqual("Posted", electron.notifications.created.map(t => t.title).join(","));
  }

  @TestMethod
  public async showsTheOperatingSystemNothingWithoutAWindowReadForAKnownDeviceOrAfterTheRuntimeLeaves(): Promise<void> {
    const first = new FakeRuntimeConnection();
    first.answers.set("desktop.notifications", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const second = new FakeRuntimeConnection();
    let reconnect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(first, new Promise<FakeRuntimeConnection>(resolve => {
      reconnect = resolve;
    }));
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lostLauncher = new FakeRuntimeLauncher(new FakeRuntimeConnection());
    const lost = await MainProcessStartFixture.startReadyAsync("linux", lostLauncher, new FakeElectron(), unidentified);
    const event = MainProcessStartFixture.trustedEvent("linux");
    const posted = new Event(ShellEvents.notifications, { notifications: [MainProcessTests.wireNotification(1, "Alarm")], quietDevices: [], mutedModules: [], sequence: 1 });

    await MainProcessTests.requestAsync(electron, event, "desktop.notifications", {});
    await MainProcessTests.requestAsync(lost, event, "desktop.notifications", {});
    launcher.listener?.onEvent(posted);
    lostLauncher.listener?.onEvent(posted);
    first.answers.set("desktop.notifications", Response.success("r", { notifications: [] }));
    await MainProcessTests.requestAsync(electron, event, "desktop.notifications", {});
    first.answers.set("desktop.notifications", Response.success("r", { notifications: [], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    await MainProcessTests.requestAsync(electron, event, "desktop.notifications", {});
    launcher.listener?.onDisconnected(null);
    reconnect(second);
    await Condition.waitAsync(() => launcher.connections.length === 2 && MainProcessTests.isReady(electron));
    launcher.listener?.onEvent(posted);

    Assert.areEqual("0,0", [electron.notifications.created.length, lost.notifications.created.length].join(","));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The notifications could not be read, so the operating system shows none until the window reads them again: ").length);
  }

  @TestMethod
  public async showsAWindowWhoseRuntimeIsSlowToStartAndRestoresItsBoundsOnceReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise(resolve => {
        arrive = resolve;
      })));
      const window = MainProcessStartFixture.firstWindow(electron);

      electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
      await setImmediate();
      mock.timers.tick(1_999);
      await setImmediate();
      const isShownBeforeTheWait = window.isShown;
      mock.timers.tick(1);
      await Condition.waitAsync(() => window.isShown);
      arrive(connection);
      await Condition.waitAsync(() => window.calls.length > 1);

      Assert.isFalse(isShownBeforeTheWait);
      Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
    }
    finally {
      mock.timers.reset();
    }
  }

  @TestMethod
  public async opensAtTheBoundsKeptOnThisDeviceAndShowsOnceItPaintsWithoutWaitingForOrMovingWithTheRuntime(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const files = new FakeDeviceFiles();
    files.windowState.kept = { x: 300, y: 150, width: 900, height: 600, maximized: false };
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })), undefined, undefined, undefined, files);
    const window = MainProcessStartFixture.firstWindow(electron);

    MainProcessTests.paint(electron, "linux", window);
    await Condition.waitAsync(() => window.isShown);
    const callsAtShow = JSON.stringify(window.calls);
    arrive(connection);
    await Condition.waitAsync(() => connection.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(JSON.stringify([900, 600]), JSON.stringify([window.options.width, window.options.height]));
    Assert.areEqual(JSON.stringify(["setBounds {\"x\":300,\"y\":150,\"width\":900,\"height\":600}", "show"]), callsAtShow);
    Assert.areEqual(callsAtShow, JSON.stringify(window.calls));
    Assert.isFalse(connection.calls.includes("desktop.readWindowBounds"));
    Assert.areEqual(
      JSON.stringify({ x: 300, y: 150, width: 900, height: 600, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async opensMaximizedAsKeptOnThisDeviceAndGivesTheRuntimeThoseBoundsInsteadOfItsOwn(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const files = new FakeDeviceFiles();
    files.windowState.kept = { x: 300, y: 150, width: 900, height: 600, maximized: true };
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(connection), undefined, undefined, undefined, files);
    const window = MainProcessStartFixture.firstWindow(electron);

    MainProcessTests.paint(electron, "darwin", window);
    await Condition.waitAsync(() => window.isShown && connection.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":300,\"y\":150,\"width\":900,\"height\":600}", "maximize", "show"]), JSON.stringify(window.calls));
    Assert.isFalse(connection.calls.includes("desktop.readWindowBounds"));
    Assert.areEqual(
      JSON.stringify({ x: 300, y: 150, width: 900, height: 600, maximized: true }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async keepsBoundsMovedBeforeTheRuntimeConnectsOnThisDevice(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.windowState.kept = { x: 300, y: 150, width: 900, height: 600, maximized: false };
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(() => undefined)),
      undefined, undefined, undefined, files);
    const window = MainProcessStartFixture.firstWindow(electron);
    MainProcessTests.paint(electron, "linux", window);
    await Condition.waitAsync(() => window.isShown);

    window.bounds = { x: 40, y: 60, width: 1000, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => files.windowState.writes.length > 0);

    Assert.areEqual(JSON.stringify([{ x: 40, y: 60, width: 1000, height: 640, maximized: false }]), JSON.stringify(files.windowState.writes));
  }

  @TestMethod
  public async logsBoundsKeptOnThisDeviceThatCannotBeReadAndWaitsForTheRuntimesBounds(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const files = new FakeDeviceFiles();
    files.windowState.readFailure = new Error("The disk is gone.");
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process, files);
    const window = MainProcessStartFixture.firstWindow(electron);

    MainProcessTests.paint(electron, "linux", window);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "show"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify(["The window's bounds kept on this device could not be read, so it waits for the runtime's: Error: The disk is gone."]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The window's bounds kept on this device")));
  }

  @TestMethod
  public async keepsTheRuntimesBoundsOnThisDeviceToo(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const files = new FakeDeviceFiles();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), undefined, undefined, undefined, files);
    const window = MainProcessStartFixture.firstWindow(electron);
    await MainProcessStartFixture.showAsync(electron, "linux", window);

    window.bounds = { x: 40, y: 60, width: 1000, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => files.windowState.writes.length > 1 && connection.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(JSON.stringify([{ x: 200, y: 100, width: 1000, height: 700, maximized: false }, { x: 40, y: 60, width: 1000, height: 640, maximized: false }]),
      JSON.stringify(files.windowState.writes));
  }

  @TestMethod
  public async keepsAndSavesWhereThePersonPlacedAWindowShownBeforeTheRuntimeWasReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await MainProcessStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })));
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("win32"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");
    arrive(connection);
    await Condition.waitAsync(() => connection.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(
      JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async logsWhereThePersonPlacedAWindowShownBeforeTheRuntimeWasReadyWhenTheRuntimeRefusesIt(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.writeWindowBounds", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const process = new FakeMainProcessEnvironment("win32");
    const files = new FakeDeviceFiles();
    files.windowState.kept = { x: 300, y: 150, width: 900, height: 600, maximized: false };
    const electron = await MainProcessStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })), new FakeElectron(), new FakeDeviceIdentity(), process, files);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("win32"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");
    arrive(connection);
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The window's bounds").length > 0);

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: WindowStateRefusedException: The runtime refused desktop.writeWindowBounds: The database is busy."]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The window's bounds")));
  }

  @TestMethod
  public async writesWhereThePersonPlacedAWindowToTheNextConnectionWhenTheFirstClosesDuringTheRestore(): Promise<void> {
    const first = new FakeRuntimeConnection();
    first.deferred.set("desktop.writeWindowBounds", () => {
      first.isClosed = true;
      return Promise.reject(new ConnectionClosedException());
    });
    const second = new FakeRuntimeConnection();
    second.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const connections = [Promise.withResolvers<FakeRuntimeConnection>(), Promise.withResolvers<FakeRuntimeConnection>()];
    const launcher = new FakeRuntimeLauncher(...connections.map(t => t.promise));
    const process = new FakeMainProcessEnvironment("win32");
    const electron = await MainProcessStartFixture.startReadyAsync("win32", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("win32"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");
    connections[0]?.resolve(first);
    await Condition.waitAsync(() => first.calls.includes("desktop.writeWindowBounds"));
    await setImmediate();
    launcher.listener?.onDisconnected(null);
    connections[1]?.resolve(second);
    await Condition.waitAsync(() => second.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.isFalse(second.calls.includes("desktop.readWindowBounds"));
    Assert.areEqual(
      JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }),
      JSON.stringify(second.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "The window's saved bounds").length);
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async restoresTheSavedBoundsOfAWindowMovedBeforeTheRuntimeWasReadyWhereTheSystemAlsoMovesIt(platform: string): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await MainProcessStartFixture.startReadyAsync(platform, new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })));
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent(platform), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.change("will-move");
    arrive(connection);
    await Condition.waitAsync(() => window.calls.some(t => t.startsWith("setBounds")));

    Assert.areEqual(0, connection.calls.filter(t => t === "desktop.writeWindowBounds").length);
  }

  @TestMethod
  public async recordsBoundsLostWhenAWindowMovedBeforeTheRuntimeWasReadyClosesFirst(): Promise<void> {
    const process = new FakeMainProcessEnvironment("win32");
    const electron = await MainProcessStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(() => undefined)), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("win32"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");

    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The window closed without saving its bounds, because the runtime could not be reached").length);
  }

  @TestMethod
  public async savesTheBoundsBeforeTheWindowCloses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    window.bounds = { x: 300, y: 150, width: 1100, height: 750 };

    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(
      JSON.stringify({ x: 300, y: 150, width: 1100, height: 750, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async stopsClosingAWindowThatIsGoneWhileItsBoundsAreSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    connection.onCall = () => {
      if (connection.calls.at(-1) === "desktop.writeWindowBounds")
        window.destroy();
    };

    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async closesEvenWhenTheBoundsCannotBeSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    connection.isFailing = true;

    window.close();
    await MainProcessStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The window's bounds could not be saved: WindowStateRefusedException: The runtime refused desktop.writeWindowBounds").length);
  }

  @TestMethod
  public async showsTheWindowWithItsDefaultBoundsWhenTheSavedOnesCannotBeUsed(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { width: 10 });
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The window's saved bounds could not be restored, so it opens with its default bounds:").length);
  }

  @TestMethod
  public async showsTheWindowWithoutKeepingBoundsWhenTheDeviceHasNoIdentity(): Promise<void> {
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const connection = new FakeRuntimeConnection();
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), device, process);
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual("desktop.agentControl,desktop.readSetting", connection.calls.filter(t => !t.startsWith("desktop.app") && !["desktop.mainWindowChanged", "desktop.readWebViewBlockedPorts", "desktop.webViewPortsBlocked"].includes(t)).join(","));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "This device's identity could not be read, so window bounds are not kept:").length);
  }

  @TestMethod
  public async showsARefusalAtOnceAndRestoresTheBoundsOnceTheRuntimeIsReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")), connection);
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);

    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    await electron.ipcMain.invoke("desktop:startupAction", MainProcessStartFixture.trustedEvent("linux"), "moveAside");
    await Condition.waitAsync(() => window.calls.includes("maximize"));

    Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async writesBoundsMovedWhileTheRuntimeWasGoneOnceItIsReadyAgain(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    let reconnect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(first, new Promise<FakeRuntimeConnection>(resolve => {
      reconnect = resolve;
    }));
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("desktop.readWindowBounds"));

    launcher.listener?.onDisconnected(null);
    const readsBeforeTheMove = window.boundsReads;
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    const writesWhileGone = [...first.calls, ...second.calls].filter(t => t === "desktop.writeWindowBounds").length;
    reconnect(second);
    await Condition.waitAsync(() => second.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(0, writesWhileGone);
    Assert.areEqual(JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }), JSON.stringify(second.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  public async keepsBoundsWhoseConnectionClosesAsItBecomesReadyForTheNextConnection(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    const third = new FakeRuntimeConnection();
    second.deferred.set("desktop.writeWindowBounds", () => {
      second.isClosed = true;
      return Promise.reject(new ConnectionClosedException());
    });
    const reconnections = [Promise.withResolvers<FakeRuntimeConnection>(), Promise.withResolvers<FakeRuntimeConnection>()];
    const launcher = new FakeRuntimeLauncher(first, ...reconnections.map(t => t.promise));
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("desktop.readWindowBounds"));

    launcher.listener?.onDisconnected(null);
    const readsBeforeTheMove = window.boundsReads;
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    reconnections[0]?.resolve(second);
    await Condition.waitAsync(() => second.calls.includes("desktop.writeWindowBounds"));
    await setImmediate();
    launcher.listener?.onDisconnected(null);
    reconnections[1]?.resolve(third);
    await Condition.waitAsync(() => third.calls.includes("desktop.writeWindowBounds"));

    Assert.areEqual(JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }), JSON.stringify(third.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, MainProcessStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  public async reportsBoundsTheRuntimeRefusesOnceItIsReadyAgain(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    second.isFailing = true;
    let reconnect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(first, new Promise<FakeRuntimeConnection>(resolve => {
      reconnect = resolve;
    }));
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("desktop.readWindowBounds"));

    launcher.listener?.onDisconnected(null);
    const readsBeforeTheMove = window.boundsReads;
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    reconnect(second);
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The window's bounds").length > 0);

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: WindowStateRefusedException: The runtime refused desktop.writeWindowBounds: The database is busy."]),
      JSON.stringify(MainProcessStartFixture.readErrors(process, "The window's bounds")));
  }

  @TestMethod
  public async movesAPackagedMacAppIntoItsInstallFolderAndStartsNothingElse(): Promise<void> {
    const name = ProductInfo.current.name;
    const program = `/Applications/${name}.app/Contents/MacOS/${name}`;
    const electron = new FakeElectron(true, true);
    const process = new FakeMainProcessEnvironment("darwin", [program]);
    process.execPath = program;
    const renames: string[] = [];
    process.files = { lstat: () => Promise.reject(new Error("ENOENT")), readlink: () => Promise.reject(new Error("EINVAL")), realpath: t => Promise.resolve(t),
      rename: (from, to) => {
        renames.push(`${from} -> ${to}`);
        return Promise.resolve();
      },
      readdir: () => Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" })) };
    const launcher = new FakeRuntimeLauncher();

    const starting = MainProcessStartFixture.startAsync(electron, process, launcher);
    for (let copied = 0; copied < 2; copied++) {
      await Condition.waitAsync(() => process.programs.waiting > 0);
      await process.programs.answerAsync(String.empty);
    }
    await electron.app.becomeReadyAsync();
    const settings = await starting;

    Assert.areEqual("Noldova", ProductInfo.current.installFolder);
    Assert.areEqual(0, settings.length);
    Assert.areEqual(2, process.programs.runs.length);
    Assert.areEqual(`/Applications/Noldova/.${process.processId}-${name}.app -> /Applications/Noldova/${name}.app`, renames.join());
    Assert.areEqual(`relaunch /Applications/Noldova/${name}.app/Contents/MacOS/${name} []`, electron.app.calls.find(t => t.startsWith("relaunch")));
    Assert.areEqual(`/Applications/${name}.app`, electron.shell.trashed.join());
  }

  @TestMethod
  public async tellsItsUpdaterWhetherItRunsFromAPackagedBuild(): Promise<void> {
    const told: boolean[] = [];
    const builds: readonly (readonly [boolean, boolean])[] = [[true, false], [false, false], [true, true]];
    for (const [isPackaged, isDefaultApp] of builds) {
      const process = new FakeMainProcessEnvironment("linux");
      process.isDefaultApp = isDefaultApp;
      await MainProcessStartFixture.startAsync(new FakeElectron(true, isPackaged), process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(), [],
        () => Promise.resolve(true), (_, packaged) => {
          told.push(packaged);
          return null;
        });
    }

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(told));
  }

  @TestMethod
  public async startsWithItsUpdatesFailedAndTheReasonLoggedWhenItsUpdaterCannotBeCreated(): Promise<void> {
    const electron = new FakeElectron();
    const process = new FakeMainProcessEnvironment("linux");
    await MainProcessStartFixture.startAsync(electron, process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(), [], () => Promise.resolve(true), () => {
      throw new Error("ERR_UPDATER_INVALID_VERSION: App version is not a valid semver version: \"0.0\"");
    });
    await MainProcessStartFixture.openAsync(electron);
    const trusted = MainProcessStartFixture.trustedEvent("linux");

    const state = electron.ipcMain.invoke("desktop:readUpdate", trusted);
    const acted = electron.ipcMain.invoke("desktop:updateAction", trusted, "Check");

    Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: null, reason: "Noldova Desktop Sample couldn't start checking for updates.", mustMove: false }), JSON.stringify(state));
    Assert.areEqual(false, acted);
    Assert.areEqual(1, electron.windows.length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process,
      "The updater could not be created, so this main process doesn't check for updates: Error: ERR_UPDATER_INVALID_VERSION: App version is not a valid semver version: \"0.0\"").length);
  }

  @TestMethod
  public async writesAnErrorItsMainProcessDoesNotCatchToItsLogRedactedAndOffersTheLogFolderInItsOwnBox(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      const process = new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`]);
      electron.dialog.answers.push(1);
      await MainProcessStartFixture.startAsync(electron, process);

      for (const listener of process.exceptionListeners)
        listener(new Error(`The pipe at ${process.homeFolder}/noldova-desktop/runtime.sock broke.`));
      for (const listener of process.rejectionListeners)
        listener(new Error("A request was left unhandled."));
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => electron.dialog.boxes.length === 2);

      Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify([process.exceptionListeners.length, process.rejectionListeners.length]));
      Assert.isTrue(process.errors.includes("The main process's main process failed with an uncaught exception: Error: The pipe at ~/noldova-desktop/runtime.sock broke.\n    at "), process.errors);
      Assert.isTrue(process.errors.includes("The main process's main process failed with an unhandled rejection: Error: A request was left unhandled.\n    at "), process.errors);
      Assert.isTrue(process.errors.includes("main-process.test"), "the log keeps the error's stack");
      Assert.areEqual(JSON.stringify([null, null]), JSON.stringify(electron.dialog.boxes.map(t => t.windowId)));
      Assert.areEqual(JSON.stringify([join(data, "logs")]), JSON.stringify(electron.shell.opened));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async stopsItsTrayHostMonitorWhenItQuitsAfterAMainProcessFailure(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      const process = new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`]);
      electron.dialog.answers.push(2);
      await MainProcessStartFixture.startAsync(electron, process);
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => process.programs.starts.length === 1);

      for (const listener of process.exceptionListeners)
        listener(new Error("The pipe broke."));
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(1, process.programs.stops);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async namesTheDataFolderItCannotUseOnStandardErrorAndInTheBoxAndOffersToRestartOrQuit(): Promise<void> {
    const electron = new FakeElectron();
    const process = new FakeMainProcessEnvironment("linux", ["/opt/noldova-desktop/noldova-desktop", "--data-dir=/var/locked/noldova-desktop"]);
    const cause = new TypeError("Failed to set path");
    electron.app.pathFailure = cause;
    electron.dialog.answers.push(1);

    const failure = await Assert.throwsAsync(() => MainProcessStartFixture.startAsync(electron, process), UnusableFolderException);
    for (const listener of process.exceptionListeners)
      listener(failure);
    await electron.app.becomeReadyAsync();
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

    const message = `Noldova Desktop Sample cannot use the data folder ${resolve("/var/locked/noldova-desktop")}: TypeError: Failed to set path`;
    Assert.areEqual(message, failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.isTrue(process.errors.includes(`The main process's main process failed with an uncaught exception: UnusableFolderException: ${message}`), process.errors);
    Assert.areEqual(JSON.stringify([`${message}\n\nThis happened while Noldova Desktop Sample was starting. Restart Noldova Desktop Sample to try again.`]), JSON.stringify(electron.dialog.boxes.map(t => t.options.detail)));
    Assert.areEqual(JSON.stringify([["Restart Noldova Desktop Sample", "Quit"]]), JSON.stringify(electron.dialog.boxes.map(t => t.options.buttons)));
    Assert.areEqual(JSON.stringify(["setName Noldova Desktop Sample", "exit 0"]), JSON.stringify(electron.app.calls));
  }

  @TestMethod
  public async startsItsLogOnceARuntimeOwnsTheDataDirectoryAndNeverInDataFromBeforeTheShell(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const owned = join(data, "owned");
      const refused = join(data, "refused");
      await mkdir(owned);
      await mkdir(refused);
      const ownedProcess = new FakeMainProcessEnvironment("linux", [`--data-dir=${owned}`]);
      const refusedProcess = new FakeMainProcessEnvironment("linux", [`--data-dir=${refused}`]);
      const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), ownedProcess);
      const refusal = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData(refused)));
      const refusedElectron = await MainProcessStartFixture.startReadyAsync("linux", refusal, new FakeElectron(), new FakeDeviceIdentity(), refusedProcess);

      electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), { background: "red" });
      refusedElectron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("linux"), { background: "red" });
      await Condition.waitAsync(() => MainProcessStartFixture.firstWindow(refusedElectron).isShown);
      await Condition.waitAsync(() => readFileSync(join(owned, "logs", "main.log"), "utf8").includes(" The window reported"));

      const lines = (await readFile(join(owned, "logs", "main.log"), "utf8")).trimEnd().split("\n");
      Assert.areEqual(1, lines.length);
      Assert.isTrue(/^\d{4}-\d\d-\d\dT[\d:.]+Z The window reported an appearance that is not valid/.test(lines[0] ?? String.empty));
      Assert.isFalse(existsSync(join(refused, "logs")));
      Assert.areEqual(1, MainProcessStartFixture.readErrors(refusedProcess, "The window reported").length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async quitsOrOpensTheLogFolderAsThePersonChoosesForAWindowWhosePageStops(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const quitting = new FakeElectron();
      quitting.dialog.answers.push(1);
      const looping = new FakeElectron();
      looping.dialog.answers.push(0, 0);
      await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), quitting);
      await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), looping, new FakeDeviceIdentity(), new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`]));

      MainProcessStartFixture.firstWindow(quitting).webContents.crashed = true;
      MainProcessStartFixture.firstWindow(quitting).webContents.goAway("crashed", 5);
      MainProcessStartFixture.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => MainProcessStartFixture.firstWindow(looping).webContents.calls.includes("reload"));
      MainProcessStartFixture.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => looping.shell.opened.length === 1 && quitting.app.calls.includes("quit"));

      Assert.areEqual(1, quitting.app.calls.filter(t => t === "quit").length);
      Assert.areEqual(JSON.stringify([join(data, "logs")]), JSON.stringify(looping.shell.opened));
      Assert.areEqual(0, looping.app.calls.filter(t => t === "quit").length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async registersTheSharedFileSchemeBeforeTheAppIsReady(): Promise<void> {
    const electron = new FakeElectron();

    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment(globalThis.process.platform));

    Assert.areEqual("[{\"scheme\":\"desktop-file\",\"privileges\":{\"standard\":true,\"secure\":true}}]", JSON.stringify(electron.protocol.schemes));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public async reportsTheAppsWindowsAndShortcutsAsTheRuntimeBecomesReadyAndAsTheyChange(): Promise<void> {
    const fixture = new TrayFixture("darwin");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    const trusted = MainProcessStartFixture.trustedEvent("darwin", window.id);
    await Condition.waitAsync(() => MainProcessTests.windowCount(fixture.connection) === 1);
    const ready = [MainProcessTests.last(fixture.connection, MainProcessTests.WINDOWS), MainProcessTests.last(fixture.connection, MainProcessTests.SHORTCUTS)];

    fixture.electron.ipcMain.send("desktop:appShortcuts", trusted, { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: true }] });
    fixture.electron.ipcMain.send("desktop:appShortcuts", { sender: { id: window.id }, senderFrame: null }, { shortcuts: [{ key: "Mod+K", command: "notes.find", isGlobal: false }] });
    fixture.send("settingsChanged", { name: "desktop.keyBindings", value: { "desktop.stopAgentControl": "Ctrl+Alt+F12" }, isSet: true });
    const changed = MainProcessTests.last(fixture.connection, MainProcessTests.SHORTCUTS);
    window.destroy();
    await Condition.waitAsync(() => MainProcessTests.windowCount(fixture.connection) === 0);

    Assert.areEqual(JSON.stringify([
      { windows: [{ handle: window.id * 1000, processId: 1000 }] },
      { shortcuts: [{ key: "Mod+Shift+Period", command: "desktop.stopAgentControl", isGlobal: true }, ...MainProcessTests.MAC_KEYS] }
    ]), JSON.stringify(ready));
    Assert.areEqual(JSON.stringify({ shortcuts: [
      { key: "Ctrl+Alt+F12", command: "desktop.stopAgentControl", isGlobal: true },
      { key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false },
      ...MainProcessTests.MAC_KEYS
    ] }), JSON.stringify(changed));
    Assert.areEqual(JSON.stringify({ shortcuts: [{ key: "Ctrl+Alt+F12", command: "desktop.stopAgentControl", isGlobal: true }, ...MainProcessTests.MAC_KEYS] }),
      JSON.stringify(MainProcessTests.last(fixture.connection, MainProcessTests.SHORTCUTS)));
  }

  @TestMethod
  @TestData("wayland", false)
  @TestData("x11", true)
  public async listsAWindowWithoutAHandleUnderWaylandAndItsX11WindowOtherwise(ozonePlatform: string, hasHandle: boolean): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = new FakeElectron();
    electron.app.switches.set("ozone-platform", ozonePlatform);
    await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), electron);
    const window = MainProcessStartFixture.firstWindow(electron);

    await Condition.waitAsync(() => MainProcessTests.windowCount(connection) === 1);

    Assert.areEqual(JSON.stringify({ windows: [{ handle: hasHandle ? window.id * 1000 : null, processId: 1000 }] }),
      JSON.stringify(MainProcessTests.last(connection, MainProcessTests.WINDOWS)));
    Assert.areEqual(hasHandle ? 1 : 0, window.mediaSourceReads);
    Assert.areEqual(JSON.stringify({ shortcuts: [{ key: "Mod+Shift+Period", command: "desktop.stopAgentControl", isGlobal: true }] }),
      JSON.stringify(MainProcessTests.last(connection, MainProcessTests.SHORTCUTS)));
  }

  @TestMethod
  public async sendsBothListsAgainToTheNextRuntimeConnection(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    const reconnection = Promise.withResolvers<FakeRuntimeConnection>();
    const launcher = new FakeRuntimeLauncher(first, reconnection.promise);
    const electron = await MainProcessStartFixture.startReadyAsync("win32", launcher);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:appShortcuts", MainProcessStartFixture.trustedEvent("win32", window.id), { shortcuts: [{ key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }] });
    await Condition.waitAsync(() => MainProcessTests.windowCount(first) === 1);

    launcher.listener?.onDisconnected(null);
    reconnection.resolve(second);
    await Condition.waitAsync(() => second.calls.includes(MainProcessTests.SHORTCUTS));

    Assert.areEqual(JSON.stringify(MainProcessTests.last(first, MainProcessTests.WINDOWS)), JSON.stringify(MainProcessTests.last(second, MainProcessTests.WINDOWS)));
    Assert.areEqual(JSON.stringify({ shortcuts: [
      { key: "Mod+Shift+Period", command: "desktop.stopAgentControl", isGlobal: true },
      { key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false }
    ] }), JSON.stringify(MainProcessTests.last(second, MainProcessTests.SHORTCUTS)));
  }

  @TestMethod
  public async reportsTheMainWindowsTitleAndWhetherItIsShownAsTheyChange(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    const reported: string[] = [];
    const reach = async (title: string, isVisible: boolean): Promise<void> => {
      const expected = JSON.stringify({ title, isVisible, isPainted: false });
      await Condition.waitAsync(() => MainProcessTests.mainWindow(connection) === expected);
      reported.push(MainProcessTests.mainWindow(connection));
    };

    window.show();
    await reach("Electron", true);
    window.setPageTitle("Notes");
    await reach("Notes", true);
    window.hide();
    await reach("Notes", false);
    window.destroy();
    await reach(String.empty, false);

    Assert.areEqual(JSON.stringify([{ title: "Electron", isVisible: true, isPainted: false }, { title: "Notes", isVisible: true, isPainted: false }, { title: "Notes", isVisible: false, isPainted: false },
      { title: String.empty, isVisible: false, isPainted: false }].map(t => JSON.stringify(t))),
      JSON.stringify(reported));
  }

  @TestMethod
  public async reportsTheMainWindowAsPaintedOnceItsPagePaintsEvenBeforeItShows(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.deferred.set("desktop.readWindowBounds", () => new Promise<Response>(() => undefined));
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => MainProcessTests.mainWindow(connection) === JSON.stringify({ title: "Electron", isVisible: false, isPainted: false }));

    MainProcessTests.paint(electron, "linux", window);
    await Condition.waitAsync(() => MainProcessTests.mainWindow(connection) === JSON.stringify({ title: "Electron", isVisible: false, isPainted: true }));

    Assert.isFalse(window.isShown);
    window.destroy();
  }

  @TestMethod
  public async reportsAWindowShownBeforeItsPagePaintedAsNotPainted(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);

    window.webContents.goAway("crashed", 5);
    await Condition.waitAsync(() => window.isShown && MainProcessTests.mainWindow(connection) === JSON.stringify({ title: "Electron", isVisible: true, isPainted: false }));

    Assert.isFalse(MainProcessTests.mainWindow(connection).includes("\"isPainted\":true"));
  }

  @TestMethod
  public async reportsTheMainWindowAsPaintedOnceItsPagePaintsAfterItWasShownUnpainted(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
      const window = MainProcessStartFixture.firstWindow(electron);
      await setImmediate();
      mock.timers.tick(10_000);
      await Condition.waitAsync(() => window.isShown && MainProcessTests.mainWindow(connection) === JSON.stringify({ title: "Electron", isVisible: true, isPainted: false }));

      MainProcessTests.paint(electron, "linux", window);

      await Condition.waitAsync(() => MainProcessTests.mainWindow(connection) === JSON.stringify({ title: "Electron", isVisible: true, isPainted: true }));
    }
    finally {
      mock.timers.reset();
    }
  }

  @TestMethod
  public async logsAListTheRuntimeRefuses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set(MainProcessTests.WINDOWS, Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const process = new FakeMainProcessEnvironment("linux");
    await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), undefined, process);

    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The runtime was not told").length > 0);

    Assert.areEqual(JSON.stringify(["The runtime was not told desktop.appWindowsChanged, so it is sent again at the next change: The database is busy."]),
      JSON.stringify([...new Set(MainProcessStartFixture.readErrors(process, "The runtime was not told"))]));
  }

  private static async startRecordingAsync(answer: boolean | Error): Promise<FakeMainProcessEnvironment> {
    const electron = new FakeElectron();
    const mainProcess = new FakeMainProcessEnvironment("linux");
    const installations: Installation[] = [];
    const recorded: Installation[] = [];
    await MainProcessStartFixture.startAsync(electron, mainProcess, undefined, undefined, undefined, undefined, installations, t => {
      recorded.push(t);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    });
    await MainProcessStartFixture.openAsync(electron);
    Assert.areEqual(1, recorded.length);
    Assert.areEqual(installations[0], recorded[0]);
    return mainProcess;
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown, page?: string): Promise<Response> {
    return Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, method, payload, page));
  }

  private static isReady(electron: FakeElectron): boolean {
    return JSON.stringify(electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("linux"))) === JSON.stringify({ kind: "Ready", details: [] });
  }

  private static paint(electron: FakeElectron, platform: string, window: FakeMainProcessWindow): void {
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent(platform, window.id), MainProcessStartFixture.APPEARANCE);
  }

  private static busy(): Response {
    return Response.failure("r", new Failure(FailureCode.Conflict, "Work is in progress.", { descriptions: ["Indexing the project"] }));
  }

  private static answerStops(connection: FakeRuntimeConnection, answers: Response[]): void {
    connection.deferred.set("desktop.stop", () => Promise.resolve(answers.shift() ?? Response.success("r", null)));
  }

  private static stops(connection: FakeRuntimeConnection): unknown[] {
    return connection.payloads.filter((_t, u) => connection.calls[u] === "desktop.stop");
  }

  private static quitQuestions(window: FakeMainProcessWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:quitQuestion").map(t => t[1]);
  }

  private static wireNotification(id: number, title: string): JsonObject {
    return { id: String(id), sequence: id, post: { kind: "clock.alarm", title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false };
  }

  private static last(connection: FakeRuntimeConnection, method: string): JsonValue | undefined {
    return connection.payloads.filter((_, index) => connection.calls[index] === method).at(-1);
  }

  private static mainWindow(connection: FakeRuntimeConnection): string {
    return JSON.stringify(MainProcessTests.last(connection, "desktop.mainWindowChanged") ?? null);
  }

  private static windowCount(connection: FakeRuntimeConnection): number | undefined {
    const windows = MainProcessTests.last(connection, MainProcessTests.WINDOWS);
    return Object.isUndefined(windows) ? undefined : JsonReader.fromValue(windows).readObjectArray("windows").length;
  }

  private static async withDataAsync(test: (data: string, launcher: FakeRuntimeLauncher, electron: FakeElectron, process: FakeMainProcessEnvironment) => Promise<void>): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const launcher = new FakeRuntimeLauncher();
      const process = new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`]);
      const electron = await MainProcessStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
      await Condition.waitAsync(() => existsSync(join(data, "logs", "main.log")));
      await test(data, launcher, electron, process);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }
}
