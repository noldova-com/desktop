/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, Response } from "@noldova/desktop.protocol";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class RuntimeRequestsTests {
  private static readonly NOTIFICATION_METHODS: readonly string[] = [
    "desktop.notifications", "desktop.postNotification", "desktop.dismissNotification", "desktop.markNotificationsRead", "desktop.clearNotifications"
  ];

  @TestMethod
  public async passesItsWindowsRequestsToTheRuntimeAndAnswersAsItDoes(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("notes.open", Response.success("r", { title: "Notes" }));
    connection.answers.set("desktop.modules", Response.success("r", { modules: [] }));
    connection.answers.set("desktop.commands", Response.success("r", { commands: [] }));
    connection.answers.set("desktop.runCommand", Response.success("r", 3));
    connection.answers.set("desktop.programs", Response.success("r", { programs: [], sequence: 2 }));
    connection.answers.set("desktop.agentControl", Response.success("r", { isStopped: true, isActing: false }));
    for (const name of RuntimeRequestsTests.NOTIFICATION_METHODS)
      connection.answers.set(name, Response.success("r", name));
    connection.answers.set("notes.missing", Response.failure("r", new Failure(FailureCode.NotFound, "There is no such note.")));
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");

    const opened = await RuntimeRequestsTests.requestAsync(electron, event, "notes.open", { path: "/notes/a.md" });
    const modules = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.modules", null);
    const commands = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.commands", null);
    const ran = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.runCommand", { name: "clock.tick", arguments: null });
    const programs = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.programs", null);
    const agentControl = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.agentControl", null);
    const notifications = [];
    for (const name of RuntimeRequestsTests.NOTIFICATION_METHODS)
      notifications.push((await RuntimeRequestsTests.requestAsync(electron, event, name, null)).payload);
    const missing = await RuntimeRequestsTests.requestAsync(electron, event, "notes.missing", null);

    Assert.areEqual(JSON.stringify({ title: "Notes" }), JSON.stringify(opened.payload));
    Assert.areEqual(JSON.stringify({ modules: [] }), JSON.stringify(modules.payload));
    Assert.areEqual(JSON.stringify({ commands: [] }), JSON.stringify(commands.payload));
    Assert.areEqual("3", JSON.stringify(ran.payload));
    Assert.areEqual(JSON.stringify({ programs: [], sequence: 2 }), JSON.stringify(programs.payload));
    Assert.areEqual(JSON.stringify({ isStopped: true, isActing: false }), JSON.stringify(agentControl.payload));
    Assert.areEqual(RuntimeRequestsTests.NOTIFICATION_METHODS.join(","), notifications.join(","));
    Assert.areEqual(JSON.stringify({ code: "NotFound", message: "There is no such note." }), JSON.stringify(missing.failure?.toJson()));
  }

  @TestMethod
  public async addsThisDeviceToItsWindowsSettingsRequests(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    for (const name of ["desktop.settings", "desktop.readSetting", "desktop.setSetting", "desktop.resetSetting"])
      connection.answers.set(name, Response.success("r", name));
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.includes("desktop.readSetting"));
    const start = connection.calls.length;

    const answers = [
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.settings", {}),
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.readSetting", { name: "notes.wrapLines", scope: { name: "notes.project", id: "p1" } }),
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.setSetting", { name: "desktop.panelSize", value: 15 }),
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.resetSetting", { name: "desktop.panelSize", device: "another" })
    ];
    const sent = connection.calls.flatMap((t, index) => index >= start && (t.includes("Setting") || t === "desktop.settings") ? [connection.payloads[index]] : []);

    Assert.areEqual("desktop.settings,desktop.readSetting,desktop.setSetting,desktop.resetSetting", answers.map(t => t.payload).join(","));
    Assert.areEqual(JSON.stringify([
      { device: FakeDeviceIdentity.ID },
      { name: "notes.wrapLines", scope: { name: "notes.project", id: "p1" }, device: FakeDeviceIdentity.ID },
      { name: "desktop.panelSize", value: 15, device: FakeDeviceIdentity.ID },
      { name: "desktop.panelSize", device: FakeDeviceIdentity.ID }
    ]), JSON.stringify(sent));
  }

  @TestMethod
  public async refusesADeviceRequestWithoutAnObjectOrADevice(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const anonymous = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new FakeRuntimeConnection()), new FakeElectron(), device);
    const event = MainProcessStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.includes("desktop.readSetting"));
    const start = connection.calls.length;

    const failures = [
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.settings", null),
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.setSetting", [1]),
      await RuntimeRequestsTests.requestAsync(electron, event, "desktop.recentCommands", null),
      await RuntimeRequestsTests.requestAsync(anonymous, event, "desktop.settings", {}),
      await RuntimeRequestsTests.requestAsync(anonymous, event, "desktop.recordCommand", { id: "notes.newNote" })
    ].map(t => t.failure?.toJson());

    Assert.areEqual(JSON.stringify([
      { code: "InvalidMessage", message: "A request that belongs to this device must have a JSON object as its payload." },
      { code: "InvalidMessage", message: "A request that belongs to this device must have a JSON object as its payload." },
      { code: "InvalidMessage", message: "A request that belongs to this device must have a JSON object as its payload." },
      { code: "Unavailable", message: "This device has no identity, so a request that belongs to it cannot be made." },
      { code: "Unavailable", message: "This device has no identity, so a request that belongs to it cannot be made." }
    ]), JSON.stringify(failures));
    Assert.isFalse(connection.calls.slice(start).some(t => t.includes("etting") || t.includes("ommand")));
  }

  @TestMethod
  public async refusesRequestsItsWindowMayNotMake(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const requests: readonly [IIpcEvent, unknown, unknown][] = [
      [{ sender: { id: 1 }, senderFrame: null }, "notes.open", null],
      [trusted, 5, null],
      [trusted, "notes", null],
      [trusted, "notes.open", { at: (): number => 1 }],
      [trusted, "desktop.stop", { policy: "IfIdle" }],
      [trusted, "desktop.writeWindowLayout", null]
    ];

    const answers: string[] = [];
    for (const [event, method, payload] of requests)
      answers.push(String((await RuntimeRequestsTests.requestAsync(electron, event, method, payload)).failure?.code));

    Assert.areEqual(JSON.stringify(["Unauthorized", "InvalidMessage", "InvalidMessage", "InvalidMessage", "Unauthorized", "Unauthorized"]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["desktop.readWindowBounds"]), JSON.stringify(connection.calls.filter(t => !["desktop.work", "desktop.notifications", "desktop.readSetting", "desktop.agentControl", "desktop.appWindowsChanged",
      "desktop.appShortcutsChanged", "desktop.mainWindowChanged"].includes(t))));
  }

  @TestMethod
  public async addsItsOwnDeviceToItsWindowsNotificationReadsAndRefusesTheirDoNotDisturbSwitch(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.notifications", Response.success("r", { notifications: [], isDoNotDisturb: true, mutedModules: ["notes"], sequence: 2 }));
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lost = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new FakeRuntimeConnection()), new FakeElectron(), unidentified);
    await Condition.waitAsync(() => connection.calls.includes("desktop.readSetting"));
    const start = connection.calls.length;

    const state = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.notifications", {});
    const quiet = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.setDoNotDisturb", { isOn: true });
    const noDevice = await RuntimeRequestsTests.requestAsync(lost, event, "desktop.notifications", {});

    const sent = connection.calls.map((t, index) => `${t} ${JSON.stringify(connection.payloads[index])}`).slice(start).filter(t => t.startsWith("desktop.notifications") || t.startsWith("desktop.setDoNotDisturb"));
    Assert.areEqual(JSON.stringify([`desktop.notifications {"device":"${FakeDeviceIdentity.ID}"}`]), JSON.stringify(sent));
    Assert.areEqual("{\"notifications\":[],\"isDoNotDisturb\":true,\"mutedModules\":[\"notes\"],\"sequence\":2}", JSON.stringify(state.payload));
    Assert.areEqual(FailureCode.Unauthorized, quiet.failure?.code);
    Assert.areEqual(FailureCode.Unavailable, noDevice.failure?.code);
  }

  @TestMethod
  public async sendsEachRequestWithItsWindowThroughReloadsAndTellsTheRuntimeOnceTheWindowCloses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("terminal.open", Response.success("r", null));
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux", window.webContents.id);
    const start = connection.calls.length;

    await RuntimeRequestsTests.requestAsync(electron, event, "terminal.open", null);
    window.webContents.reload();
    window.webContents.startLoading();
    await RuntimeRequestsTests.requestAsync(electron, event, "terminal.open", null);
    window.destroy();
    await Condition.waitAsync(() => connection.calls.includes("desktop.windowClosed"));
    const late = await RuntimeRequestsTests.requestAsync(electron, event, "terminal.open", null);

    const sent = connection.calls.flatMap((t, index) => index >= start && (t === "terminal.open" || t === "desktop.windowClosed")
      ? [`${t} ${JSON.stringify(connection.payloads[index])} ${connection.windows[index]}`] : []);
    const id = window.webContents.id;
    Assert.areEqual(`terminal.open null ${id}|terminal.open null ${id}|desktop.windowClosed {"window":${id}} undefined`, sent.join("|"));
    Assert.areEqual(FailureCode.Unauthorized, late.failure?.code);
  }

  @TestMethod
  public async addsItsOwnDeviceToItsWindowsRecentCommandsRequests(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("desktop.recentCommands", Response.success("r", { ids: ["notes.newNote"] }));
    connection.answers.set("desktop.recordCommand", Response.success("r", null));
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");

    const recent = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.recentCommands", {});
    const recorded = await RuntimeRequestsTests.requestAsync(electron, event, "desktop.recordCommand", { id: "notes.newNote" });

    const sent = connection.calls.map((t, index) => `${t} ${JSON.stringify(connection.payloads[index])}`).filter(t => t.startsWith("desktop.recentCommands") || t.startsWith("desktop.recordCommand"));
    Assert.areEqual(JSON.stringify([
      `desktop.recentCommands ${JSON.stringify({ device: FakeDeviceIdentity.ID })}`,
      `desktop.recordCommand ${JSON.stringify({ id: "notes.newNote", device: FakeDeviceIdentity.ID })}`
    ]), JSON.stringify(sent));
    Assert.areEqual(JSON.stringify({ ids: ["notes.newNote"] }), JSON.stringify(recent.payload));
    Assert.isFalse(recorded.hasFailed);
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown, page?: string): Promise<Response> {
    return Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, method, payload, page));
  }
}
