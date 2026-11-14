/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, NotificationState, Response, SettingValue, WorkReport } from "@noldova/desktop.protocol";
import type { MenuItemConstructorOptions } from "electron";

import { UpdateStateKind } from "../../src/enums/update-state-kind.js";
import { UpdateStatus } from "../../src/models/update-status.js";
import { AppIcons } from "../../src/services/app-icons.js";
import { TrayController } from "../../src/services/tray-controller.js";
import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayControllerTests {
  private static readonly READY: UpdateStatus = new UpdateStatus(UpdateStateKind.Ready, "1.3.0", null, null, null, false);

  @TestMethod
  public async showsTheLightIconsOnALightTaskbarAndChangesThemWithTheThemeOnWindowsAndLinux(): Promise<void> {
    await MainProcessStartFixture.withIconsAsync(["tray/tray-idle-light.ico", "tray/tray-idle-light.png", "tray/tray-running-light.ico"], async (icons, moduleUrl) => {
      const windows = new TrayFixture("win32");
      const linux = new TrayFixture("linux");
      windows.electron.theme.update(true, false);
      linux.electron.theme.update(false, true);

      await windows.startAsync(moduleUrl);
      await linux.startAsync(moduleUrl);
      await linux.process.programs.answerAsync("(<true>,)\n");
      windows.electron.theme.update(false, true);
      windows.electron.theme.update(false, true);
      linux.electron.theme.update(true, false);

      Assert.areEqual(
        JSON.stringify([join(icons, "tray", "tray-idle-light.ico"), join(icons, "tray", "tray-idle.ico")]),
        JSON.stringify(windows.tray.images));
      Assert.areEqual(
        JSON.stringify([join(icons, "tray", "tray-idle-light.png"), join(icons, "tray", "tray-idle.png")]),
        JSON.stringify(linux.tray.images));
    });
  }

  @TestMethod
  public async keepsTheDarkTrayIconOnALightTaskbarForAStateWithoutALightOne(): Promise<void> {
    await MainProcessStartFixture.withIconsAsync(["tray/tray-idle-light.ico"], async (icons, moduleUrl) => {
      const fixture = new TrayFixture("win32");
      fixture.electron.theme.update(false, false);
      await fixture.startAsync(moduleUrl);

      fixture.send("work", { descriptions: ["Build"], sequence: 1 });

      Assert.areEqual(
        JSON.stringify([join(icons, "tray", "tray-idle-light.ico"), join(icons, "tray", "tray-running.ico")]),
        JSON.stringify(fixture.tray.images));
    });
  }

  @TestMethod
  public async showsTheIdleIconWithItsToolTipAndMenuOnWindowsAndReadsWorkNotificationsAndTheSettingOnceTheRuntimeIsReady(): Promise<void> {
    const fixture = new TrayFixture("win32");

    await fixture.startAsync();

    Assert.areEqual(1, fixture.electron.tray.trays.length);
    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-idle.ico"), fixture.tray.images.at(-1));
    Assert.areEqual("Noldova Desktop Sample", fixture.tray.toolTips.at(-1));
    Assert.areEqual(JSON.stringify(["No work running (disabled)", "-", "Stop agents", "Open Noldova Desktop Sample", "Turn on Do not disturb", "-", "Quit Noldova Desktop Sample"]), JSON.stringify(fixture.rows));
    const reads = fixture.connection.calls.map((t, index) => `${t} ${JSON.stringify(fixture.connection.payloads[index])}`)
      .filter(t => t.startsWith("desktop.readSetting") || t.startsWith("desktop.notifications"));
    Assert.areEqual(
      JSON.stringify([`desktop.notifications {"device":"${FakeDeviceIdentity.ID}"}`, "desktop.readSetting {\"name\":\"desktop.keyBindings\"}",
        `desktop.readSetting {"name":"desktop.trayIcon","device":"${FakeDeviceIdentity.ID}"}`]),
      JSON.stringify(reads.sort()));
  }

  @TestMethod
  public async showsRunningWorkAndUnreadNotificationsAsTheBellCountsThemInItsImageToolTipAndMenu(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const work = ["Reply to author", "Run the tests", "Build", "Lint", "Format", "Deploy", "Index"];

    fixture.send("work", { descriptions: work, sequence: 2 });
    fixture.send("work", { descriptions: [], sequence: 1 });
    const running = [fixture.tray.images.at(-1), fixture.tray.toolTips.at(-1)];
    fixture.send("notifications", {
      notifications: [
        TrayFixture.notification(5, "Muted", "notes"), TrayFixture.notification(4, "Fourth"), TrayFixture.notification(3, "Third"), TrayFixture.notification(2, "Read", "clock", true),
        TrayFixture.notification(1, "First")
      ],
      quietDevices: [], mutedModules: ["notes"], sequence: 5
    });

    Assert.areEqual(JSON.stringify([MainProcessStartFixture.icon("tray/tray-running.ico"), "Noldova Desktop Sample: 7 running"]), JSON.stringify(running));
    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-both.ico"), fixture.tray.images.at(-1));
    Assert.areEqual("Noldova Desktop Sample: 7 running, 3 unread", fixture.tray.toolTips.at(-1));
    Assert.areEqual(
      JSON.stringify([
        "Reply to author (disabled)", "Run the tests (disabled)", "Build (disabled)", "Lint (disabled)", "Format (disabled)", "and 2 more (disabled)",
        "Fourth", "Third", "First", "-", "Stop agents", "Open Noldova Desktop Sample", "Turn on Do not disturb", "-", "Quit Noldova Desktop Sample"
      ]),
      JSON.stringify(fixture.rows));
  }

  @TestMethod
  public async showsTheUnreadImageWithoutWorkAndChangesOnlyWhatChanged(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const menus = fixture.tray.menus.length;
    const broadcast = { notifications: [TrayFixture.notification(1, "Alarm")], quietDevices: [], mutedModules: [], sequence: 1 };

    fixture.send("notifications", broadcast);
    fixture.send("notifications", broadcast);
    fixture.send("notifications", { notifications: [], quietDevices: [], mutedModules: [], sequence: 0 });

    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-unread.ico"), fixture.tray.images.at(-1));
    Assert.areEqual("Noldova Desktop Sample: 1 unread", fixture.tray.toolTips.at(-1));
    Assert.areEqual(2, fixture.tray.images.length);
    Assert.areEqual(2, fixture.tray.toolTips.length);
    Assert.areEqual(menus + 1, fixture.tray.menus.length);
  }

  @TestMethod
  public async opensANotificationFromItsMenuAndTurnsOffDoNotDisturbForThisDeviceOnly(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);

    fixture.send("notifications", { notifications: [TrayFixture.notification(1, "Alarm & clock")], quietDevices: [FakeDeviceIdentity.ID], mutedModules: [], sequence: 1 });
    fixture.click("Alarm && clock");
    fixture.click("Turn off Do not disturb");
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.setSetting"));
    fixture.send("notifications", { notifications: [], quietDevices: ["desk"], mutedModules: [], sequence: 1 });

    Assert.isTrue(fixture.rows.includes("Turn on Do not disturb"));
    Assert.areEqual(JSON.stringify([["desktop:notificationOpened", "1"]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:notificationOpened")));
    const set = SettingValue.fromJson(fixture.connection.payloads[fixture.connection.calls.indexOf("desktop.setSetting")]);
    Assert.areEqual(`desktop.doNotDisturb ${FakeDeviceIdentity.ID} false`, `${set.key.name.text} ${set.key.device ?? String.empty} ${String(set.value)}`);
  }

  @TestMethod
  public async logsWhenDoNotDisturbCannotBeSetAndSetsNothingWithoutADevice(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.setSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    await fixture.startAsync();
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lost = new FakeElectron();
    const lostConnection = new FakeRuntimeConnection();
    await MainProcessStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(lostConnection), lost, unidentified);
    const menus = fixture.tray.menus.length;
    const lostMenus = lost.tray.shown?.menus.length ?? 0;

    fixture.click("Turn on Do not disturb");
    MainProcessStartFixture.click(lost.menu.templates.find(t => t === lost.tray.shown?.menus.at(-1))?.find(t => t.label === "Turn on Do not disturb"));
    await Condition.waitAsync(() => fixture.tray.menus.length > menus && (lost.tray.shown?.menus.length ?? 0) > lostMenus);
    await setImmediate();

    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "Do not disturb could not be changed from the tray: The database is busy.").length);
    Assert.areEqual(menus + 1, fixture.tray.menus.length);
    Assert.areEqual(lostMenus + 1, lost.tray.shown?.menus.length);
    Assert.isTrue(fixture.rows.includes("Turn on Do not disturb"));
    Assert.isFalse(lostConnection.calls.includes("desktop.setSetting"));
    Assert.isFalse(lostConnection.calls.includes("desktop.notifications"));
  }

  @TestMethod
  public async opensTheWindowFromItsMenuOrAClickOnWindowsAndLinuxAndLeavesAMacClickToTheMenu(): Promise<void> {
    const windows = new TrayFixture("win32");
    await windows.startAsync();
    const window = MainProcessStartFixture.firstWindow(windows.electron);
    const linux = new TrayFixture("linux");
    await linux.startAsync();
    await linux.process.programs.answerAsync("(<true>,)\n");
    const mac = new TrayFixture("darwin");
    await mac.startAsync();
    await MainProcessStartFixture.showAsync(windows.electron, "win32", window);
    await MainProcessStartFixture.showAsync(linux.electron, "linux", MainProcessStartFixture.firstWindow(linux.electron));
    window.isMinimizedNow = true;

    windows.tray.click();
    window.isMinimizedNow = false;
    windows.click("Open Noldova Desktop Sample");
    linux.tray.click();
    window.destroy();
    windows.click("Open Noldova Desktop Sample");
    windows.click("Quit Noldova Desktop Sample");
    const reopened = windows.electron.windows[1];
    Assert.isDefined(reopened);
    await MainProcessStartFixture.answerSaveAsync(windows.electron, "win32", reopened, 1);
    await Condition.waitAsync(() => windows.electron.app.calls.includes("quit"));

    Assert.areEqual("restore,focus,focus", window.calls.filter(t => t === "restore" || t === "focus").join(","));
    Assert.areEqual(2, windows.electron.windows.length);
    Assert.isTrue(MainProcessStartFixture.firstWindow(linux.electron).calls.includes("focus"));
    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-idle.png"), linux.tray.images.at(-1));
    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-idleTemplate.png"), mac.tray.images.at(-1));
    Assert.areEqual("1,1,0", [windows.tray.listeners, linux.tray.listeners, mac.tray.listeners].join(","));
    Assert.isTrue(windows.electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async showsOnMacOSOnlyOnceTheSettingIsOn(): Promise<void> {
    const fixture = new TrayFixture("darwin");
    fixture.connection.answers.set("desktop.readSetting", Response.success("r", { name: "desktop.trayIcon", value: false, isSet: false }));

    await fixture.startAsync();
    const before = fixture.electron.tray.trays.length;
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: true });

    Assert.areEqual(0, before);
    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-idleTemplate.png"), fixture.tray.images.at(-1));
  }

  @TestMethod
  public async showsOnLinuxOnlyWhileTheSessionBusHasATrayHost(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    const before = fixture.electron.tray.trays.length;

    await fixture.process.programs.answerAsync("(<true>,)\n");
    const shown = fixture.electron.tray.shown;
    fixture.process.programs.output("StatusNotifierHostUnregistered");
    await fixture.process.programs.answerAsync("(<false>,)\n");

    Assert.areEqual(0, before);
    Assert.isDefined(shown);
    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual("/usr/bin/gdbus", fixture.process.programs.starts[0]?.file);
  }

  @TestMethod
  public async showsOnLinuxOnceTheSettingTurnsOnAfterAHostAppearedWhileItWasOff(): Promise<void> {
    const fixture = new TrayFixture("linux");
    fixture.connection.answers.set("desktop.readSetting", Response.success("r", { name: "desktop.trayIcon", value: false, isSet: true }));
    await fixture.startAsync();

    await fixture.process.programs.answerAsync("(<true>,)\n");
    const whileOff = fixture.electron.tray.trays.length;
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: true });

    Assert.areEqual(0, whileOff);
    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-idle.png"), fixture.tray.images.at(-1));
  }

  @TestMethod
  public async startsFromTheSettingLastHeardOnThisDeviceAndRemembersEachChange(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.files.state.kept = { trayCloseHintShown: true, trayIcon: false };
    const answer = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("desktop.readSetting", () => answer.promise);
    await fixture.startAsync();

    const beforeAnswer = fixture.electron.tray.trays.length;
    answer.resolve(Response.success("r", { name: "desktop.trayIcon", value: true, isSet: false }));
    await Condition.waitAsync(() => fixture.files.state.writes.length > 0);
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    await Condition.waitAsync(() => fixture.files.state.writes.length > 1);

    Assert.areEqual(0, beforeAnswer);
    Assert.areEqual(1, fixture.electron.tray.trays.length);
    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual(JSON.stringify([{ trayCloseHintShown: true, trayIcon: true }, { trayCloseHintShown: true, trayIcon: false }]), JSON.stringify(fixture.files.state.writes));
  }

  @TestMethod
  public async ignoresARememberedSettingThatIsNotOnOrOff(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.files.state.kept = { trayIcon: "on" };
    const answer = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("desktop.readSetting", () => answer.promise);
    await fixture.startAsync();

    Assert.isDefined(fixture.electron.tray.shown);
    answer.resolve(Response.success("r", { name: "desktop.trayIcon", value: true, isSet: false }));
    await setImmediate();
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    await Condition.waitAsync(() => fixture.files.state.writes.length === 1);

    Assert.areEqual(JSON.stringify([{ trayIcon: false }]), JSON.stringify(fixture.files.state.writes));
  }

  @TestMethod
  public async showsAgainWhenTheSettingIsResetToItsDefault(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();

    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    const hidden = fixture.electron.tray.shown;
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: false });

    Assert.isUndefined(hidden);
    Assert.areEqual(2, fixture.electron.tray.trays.length);
    Assert.isDefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async readsEverythingAgainOnTheNextReadyAndDropsWhatTheEarlierConnectionAnswersLate(): Promise<void> {
    const fixture = new TrayFixture("win32");
    const late = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("desktop.work", () => late.promise);
    await fixture.startAsync();

    fixture.launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => fixture.launcher.connections[1]?.calls.includes("desktop.readSetting") === true);
    late.resolve(Response.success("r", { descriptions: ["Build"], sequence: 9 }));
    await setImmediate();

    Assert.areEqual(JSON.stringify(["desktop.notifications", "desktop.readSetting", "desktop.readSetting", "desktop.work"]),
      JSON.stringify(fixture.launcher.connections[1]?.calls.filter(t => ["desktop.work", "desktop.notifications", "desktop.readSetting"].includes(t)).sort()));
    Assert.isFalse(fixture.tray.images.includes(MainProcessStartFixture.icon("tray/tray-running.ico")));
    Assert.areEqual("Noldova Desktop Sample", fixture.tray.toolTips.at(-1));
  }

  @TestMethod
  public async showsNoIconOnceAppQuitsEvenWhenTheSettingTurnsOnAfterwards(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.readSetting", Response.success("r", { name: "desktop.trayIcon", value: false, isSet: true }));
    await fixture.startAsync();

    fixture.electron.app.emit("will-quit");
    fixture.send("settingsChanged", { name: "desktop.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: true });

    Assert.areEqual(1, fixture.electron.tray.trays.length);
    Assert.isUndefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async triesAgainOnLinuxWhenATrayHostAppearsAfterTheIconFailedToShow(): Promise<void> {
    const fixture = new TrayFixture("linux");
    fixture.electron.tray.failure = new Error("The tray host refused the icon.");
    await fixture.startAsync();

    await fixture.process.programs.answerAsync("(<true>,)\n");
    const failed = fixture.electron.tray.trays.length;
    fixture.electron.tray.failure = null;
    fixture.process.programs.output("StatusNotifierHostUnregistered");
    await fixture.process.programs.answerAsync("(<false>,)\n");
    fixture.process.programs.output("StatusNotifierHostRegistered");
    await fixture.process.programs.answerAsync("(<true>,)\n");

    Assert.areEqual(0, failed);
    Assert.isDefined(fixture.electron.tray.shown);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "The tray icon could not be shown: Error: The tray host refused the icon.").length);
  }

  @TestMethod
  public async tellsItsTrustedWindowsWhetherATrayHostCanShowTheIcon(): Promise<void> {
    const linux = new TrayFixture("linux");
    await linux.startAsync();
    const windows = new TrayFixture("win32");
    await windows.startAsync();
    const event = MainProcessStartFixture.trustedEvent("linux");
    const window = MainProcessStartFixture.firstWindow(linux.electron);

    const before = linux.electron.ipcMain.invoke("desktop:readTrayAvailable", event);
    await linux.process.programs.answerAsync("(<true>,)\n");
    const after = linux.electron.ipcMain.invoke("desktop:readTrayAvailable", event);
    const untrusted = linux.electron.ipcMain.invoke("desktop:readTrayAvailable", { ...event, senderFrame: null });
    linux.process.programs.output("StatusNotifierHostUnregistered");
    await linux.process.programs.answerAsync("(<false>,)\n");

    Assert.areEqual("[false,true,null,true]", JSON.stringify([before, after, untrusted, windows.electron.ipcMain.invoke("desktop:readTrayAvailable", MainProcessStartFixture.trustedEvent("win32"))]));
    Assert.areEqual(JSON.stringify([["desktop:trayAvailable", true], ["desktop:trayAvailable", false]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:trayAvailable")));
  }

  @TestMethod
  public async logsOnceWhenTheIconCannotShowAndTriesNoMore(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.tray.failure = new Error("The notification area is not available.");

    await fixture.startAsync();
    fixture.send("work", { descriptions: ["Build"], sequence: 1 });

    Assert.areEqual(0, fixture.electron.tray.trays.length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "The tray icon could not be shown: Error: The notification area is not available.").length);
  }

  @TestMethod
  public async showsIdleWhileTheRuntimeIsAwayAndRemovesItsIconAndStopsWatchingWhenAppQuits(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    fixture.send("work", { descriptions: ["Build"], sequence: 1 });
    const running = fixture.tray.images.at(-1);

    fixture.launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => fixture.tray.images.at(-1) === MainProcessStartFixture.icon("tray/tray-idle.png"));
    const tray = fixture.tray;
    fixture.electron.app.emit("will-quit");

    Assert.areEqual(MainProcessStartFixture.icon("tray/tray-running.png"), running);
    Assert.isTrue(tray.isDestroyed);
    Assert.areEqual(1, fixture.process.programs.stops);
  }

  @TestMethod
  public async asksAgainWhenTheLinuxTrayHostMonitorEndsAndRemovesTheIconWhenTheHostIsGone(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    const shown = fixture.electron.tray.shown;

    fixture.process.programs.exit();
    await fixture.process.programs.answerAsync("(<false>,)\n");

    Assert.isDefined(shown);
    Assert.isTrue(shown?.isDestroyed === true);
    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual(2, fixture.process.programs.runs.length);
  }

  @TestMethod
  @TestData("win32", "tray-idle.ico", "tray-unread.ico")
  @TestData("darwin", "tray-idleTemplate.png", "tray-unreadTemplate.png")
  @TestData("linux", "tray-idle.png", "tray-unread.png")
  public async offersAReadyUpdateAtTheTopOfItsMenuWithTheUnreadIconUntilTheUpdateIsNoLongerReady(platform: string, idle: string, unread: string): Promise<void> {
    await MainProcessStartFixture.withIconsAsync([], async icons => {
      const electron = new FakeElectron();
      const restarts: string[] = [];
      const tray = await TrayControllerTests.createAsync(electron, icons, platform, () => restarts.push("restart"));

      tray.receiveUpdate(TrayControllerTests.READY);
      const ready = TrayControllerTests.rows(electron);
      MainProcessStartFixture.click(TrayControllerTests.menu(electron).find(t => t.label === "Restart to update to 1.3.0"));
      const toolTip = electron.tray.shown?.toolTips.at(-1);
      tray.receiveUpdate(new UpdateStatus(UpdateStateKind.Downloading, "1.4.0", 0.5, null, null, false));

      Assert.areEqual(JSON.stringify(["Restart to update to 1.3.0", "-", "No work running (disabled)"]), JSON.stringify(ready.slice(0, 3)));
      Assert.areEqual(JSON.stringify(["restart"]), JSON.stringify(restarts));
      Assert.areEqual("Noldova Desktop Sample: update ready", toolTip);
      Assert.areEqual("No work running (disabled)", TrayControllerTests.rows(electron)[0]);
      Assert.areEqual(JSON.stringify([idle, unread, idle].map(t => join(icons, "tray", t))), JSON.stringify(electron.tray.shown?.images));
    });
  }

  @TestMethod
  @TestData("win32", "tray-update.ico", "tray-running.ico")
  @TestData("darwin", "tray-updateTemplate.png", "tray-runningTemplate.png")
  @TestData("linux", "tray-update.png", "tray-running.png")
  public async showsTheAppsUpdateIconWhenItBringsOneAndLetsRunningWorkTakeTheIcon(platform: string, update: string, running: string): Promise<void> {
    await MainProcessStartFixture.withIconsAsync([join("tray", update)], async icons => {
      const electron = new FakeElectron();
      const tray = await TrayControllerTests.createAsync(electron, icons, platform, () => undefined);

      tray.receiveUpdate(TrayControllerTests.READY);
      const shown = electron.tray.shown?.images.at(-1);
      tray.receiveWork(WorkReport.fromJson({ descriptions: ["Build"], sequence: 1 }));

      Assert.areEqual(JSON.stringify([update, running].map(t => join(icons, "tray", t))), JSON.stringify([shown, electron.tray.shown?.images.at(-1)]));
      Assert.areEqual("Restart to update to 1.3.0", TrayControllerTests.rows(electron)[0]);
    });
  }

  @TestMethod
  @TestData("win32", "tray-update.ico", "tray-unread.ico")
  @TestData("darwin", "tray-updateTemplate.png", "tray-unreadTemplate.png")
  @TestData("linux", "tray-update.png", "tray-unread.png")
  public async showsTheUpdateIconAheadOfUnreadNotificationsAndKeepsTheUnreadInTheToolTip(platform: string, update: string, unread: string): Promise<void> {
    await MainProcessStartFixture.withIconsAsync([join("tray", update)], async icons => {
      const electron = new FakeElectron();
      const tray = await TrayControllerTests.createAsync(electron, icons, platform, () => undefined);

      tray.receiveNotifications(NotificationState.fromJson({ notifications: [TrayFixture.notification(1, "Alarm")], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
      const before = electron.tray.shown?.images.at(-1);
      tray.receiveUpdate(TrayControllerTests.READY);

      Assert.areEqual(JSON.stringify([unread, update].map(t => join(icons, "tray", t))), JSON.stringify([before, electron.tray.shown?.images.at(-1)]));
      Assert.areEqual("Noldova Desktop Sample: 1 unread, update ready", electron.tray.shown?.toolTips.at(-1));
      Assert.areEqual(JSON.stringify(["Restart to update to 1.3.0", "-"]), JSON.stringify(TrayControllerTests.rows(electron).slice(0, 2)));
      Assert.isTrue(TrayControllerTests.rows(electron).includes("Alarm"), TrayControllerTests.rows(electron).join(", "));
    });
  }

  private static async createAsync(electron: FakeElectron, icons: string, platform: string, restart: () => void): Promise<TrayController> {
    const tray = new TrayController(electron.tray, electron.menu, await AppIcons.locateAsync(icons, platform, electron.theme), platform,
      { open: () => undefined, openNotification: () => undefined, setDoNotDisturb: () => undefined, stopAgents: () => undefined, resumeAgents: () => undefined, restartToUpdate: restart,
        quit: () => undefined }, () => undefined, () => undefined);
    tray.setEnabled(true);
    tray.setHostAvailable(true);
    return tray;
  }

  private static menu(electron: FakeElectron): MenuItemConstructorOptions[] {
    const template = electron.menu.templates.at(-1);
    Assert.isDefined(template, "The tray icon has no menu.");
    return template;
  }

  private static rows(electron: FakeElectron): string[] {
    return TrayControllerTests.menu(electron).map(t => t.type === "separator" ? "-" : `${t.label ?? String.empty}${t.enabled === false ? " (disabled)" : String.empty}`);
  }
}
