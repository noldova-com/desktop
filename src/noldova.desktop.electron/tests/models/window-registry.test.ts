/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Response, FileGrant } from "@noldova/desktop.protocol";
import { FileIdentity } from "@noldova/desktop.runtime";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

interface IGrantingWindow {
  readonly electron: FakeElectron;
  readonly connection: FakeRuntimeConnection;
  readonly process: FakeMainProcessEnvironment;
  readonly window: FakeMainProcessWindow;
  readonly event: IIpcEvent;
  readonly folder: string;
}

@TestClass
export class WindowRegistryTests {
  @TestMethod
  public async ignoresMessagesFromFramesItDoesNotTrust(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);
    const windowUrl = MainProcessStartFixture.settings("linux").windowUrl;
    const untrusted: IIpcEvent[] = [
      { sender: { id: 1 }, senderFrame: null },
      { sender: { id: 1 }, senderFrame: { url: windowUrl, parent: {} } },
      { sender: { id: 1 }, senderFrame: { url: "https://example.com/", parent: null } },
      { sender: { id: 7 }, senderFrame: { url: windowUrl, parent: null } }
    ];

    for (const event of untrusted) {
      electron.ipcMain.send("desktop:ready", event, MainProcessStartFixture.APPEARANCE);
      electron.ipcMain.send("desktop:appearance", event, MainProcessStartFixture.APPEARANCE);
      Assert.isFalse(electron.ipcMain.invoke("desktop:closeAnswer", event, "request", true) === true);
    }

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.isNull(window.backgroundColor);
  }

  @TestMethod
  public async cancelsAPageRequestsOnceTheNextPageNamesItselfIncludingOneSentAfterTheLoadStartedAndAnswersALaterOneCancelled(): Promise<void> {
    const connection = WindowRegistryTests.holdingConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux", window.webContents.id);
    electron.ipcMain.send("desktop:page", event, "first");
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "first");
    window.webContents.startLoading();
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "first");
    const whileLoading = WindowRegistryTests.openSignals(connection).map(t => t.aborted).join(" ");

    electron.ipcMain.send("desktop:page", event, "second");
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "second");
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "first");

    Assert.areEqual("false false", whileLoading);
    Assert.areEqual("true true false true", WindowRegistryTests.openSignals(connection).map(t => t.aborted).join(" "));
  }

  @TestMethod
  public async cancelsNothingWhenALoadStartsWithoutANewPageOrThePageNamesItselfAgainOrAnUntrustedOrUnnamedPageSpeaks(): Promise<void> {
    const connection = WindowRegistryTests.holdingConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux", window.webContents.id);
    electron.ipcMain.send("desktop:page", event, "first");
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "first");

    window.webContents.startLoading();
    electron.ipcMain.send("desktop:page", event, "first");
    electron.ipcMain.send("desktop:page", { ...event, senderFrame: null }, "other");
    electron.ipcMain.send("desktop:page", event, String.empty);
    electron.ipcMain.send("desktop:page", event, 5);
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "first");

    Assert.areEqual("false false", WindowRegistryTests.openSignals(connection).map(t => t.aborted).join(" "));
  }

  @TestMethod
  public async cancelsThePageRequestsInFlightOnceItsPageGoesAndNotThoseOfThePageItsRecoveryLoads(): Promise<void> {
    const connection = WindowRegistryTests.holdingConnection();
    const electron = new FakeElectron();
    electron.dialog.answers.push(0);
    await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), electron);
    const window = MainProcessStartFixture.firstWindow(electron);
    const event = MainProcessStartFixture.trustedEvent("linux", window.webContents.id);
    electron.ipcMain.send("desktop:page", event, "first");
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "first");

    window.webContents.goAway("crashed", 5);
    const isCancelledWhenGone = WindowRegistryTests.lastSignal(connection).aborted;
    await Condition.waitAsync(() => window.webContents.calls.includes("reload"));
    window.webContents.startLoading();
    electron.ipcMain.send("desktop:page", event, "second");
    void WindowRegistryTests.requestAsync(electron, event, "terminal.open", null, "second");

    Assert.isTrue(isCancelledWhenGone);
    Assert.areEqual("true false", WindowRegistryTests.openSignals(connection).map(t => t.aborted).join(" "));
  }

  @TestMethod
  public async cancelsThePageRequestsInFlightWhenItsWindowCloses(): Promise<void> {
    const connection = WindowRegistryTests.holdingConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = MainProcessStartFixture.firstWindow(electron);
    void WindowRegistryTests.requestAsync(electron, MainProcessStartFixture.trustedEvent("linux", window.webContents.id), "terminal.open", null);

    window.destroy();

    Assert.isTrue(WindowRegistryTests.lastSignal(connection).aborted);
  }

  @TestMethod
  public endsEveryPagesGrantsAndSharesWhenTheNextPageNamesItself(): Promise<void> {
    return WindowRegistryTests.runAsync(async t => {
      const file = join(t.folder, "notes.txt");
      await writeFile(file, "notes");
      t.electron.ipcMain.send("desktop:page", t.event, "second");
      await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", [{ name: "notes.txt", type: String.empty, path: file, size: 5 }], {}, "second");
      const granted = WindowRegistryTests.grants(t.connection)[0]?.page ?? 0;

      t.electron.ipcMain.send("desktop:page", t.event, "third");
      t.electron.ipcMain.send("desktop:page", t.event, "third");
      t.electron.ipcMain.send("desktop:page", t.event, "fourth");

      Assert.areEqual(JSON.stringify([granted - 1, granted, granted + 1].map(page => ({ window: t.window.webContents.id, page }))),
        JSON.stringify(WindowRegistryTests.payloads(t.connection, "desktop.endFileGrants").slice(-3)));
    });
  }

  @TestMethod
  public servesAShareOnTheWindowsOwnSessionOnlyWhileItsPageIsCurrent(): Promise<void> {
    return WindowRegistryTests.runAsync(async t => {
      const grant = "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21";
      const address = `desktop-file://${grant}/`;
      const file = join(t.folder, "photo.png");
      await writeFile(file, "png");
      await t.electron.ipcMain.invoke("desktop:request", t.event, "notes.open", null, "first");
      const page = t.connection.pages[t.connection.calls.indexOf("notes.open")] ?? 0;
      const stats = await lstat(file, { bigint: true });
      t.connection.answers.set("desktop.resolveFileShare",
        Response.success("r", new FileGrant(grant, file, "photo.png", "image/png", 3, FileIdentity.of(stats), "notes", t.window.webContents.id, page, 600_000, false).toJson()));
      const protocol = t.electron.windowSession.protocol;

      const served = await protocol.serveAsync(address);
      const text = await served.text();
      t.electron.ipcMain.send("desktop:page", t.event, "second");
      const ended = await protocol.serveAsync(address);
      t.window.destroy();
      const closed = await protocol.serveAsync(address);

      Assert.areEqual("desktop-file", protocol.handled.join(","));
      Assert.areEqual("200|png|image/png|404|404", [served.status, text, served.headers.get("Content-Type"), ended.status, closed.status].join("|"));
      Assert.areEqual(JSON.stringify(Array.from({ length: 3 }, () => ({ grant }))), JSON.stringify(WindowRegistryTests.payloads(t.connection, "desktop.resolveFileShare")));
      Assert.areEqual(2, WindowRegistryTests.count(t.process, "A shared file was not served: its page ended."));
    });
  }

  @TestMethod
  public sendsAPagesRequestsWithItsSerialAndLetsItDiscardItsGrants(): Promise<void> {
    return WindowRegistryTests.runAsync(async t => {
      const discard = await t.electron.ipcMain.invoke("desktop:request", t.event, "desktop.discardFileGrants", { grants: ["1".repeat(32)] }, "first");
      t.electron.ipcMain.send("desktop:page", t.event, "second");
      await t.electron.ipcMain.invoke("desktop:request", t.event, "notes.open", null, "second");

      const sent = t.connection.calls.flatMap((call, index) => call === "desktop.discardFileGrants" || call === "notes.open" ? [`${call}:${t.connection.pages[index]}`] : []);
      Assert.isFalse(Response.fromJson(discard).hasFailed);
      Assert.areEqual(2, new Set(sent.map(s => s.slice(s.indexOf(":") + 1))).size);
      Assert.isTrue(sent.every(s => /:[1-9][0-9]*$/.test(s)), sent.join(","));
    });
  }

  private static holdingConnection(): FakeRuntimeConnection {
    const connection = new FakeRuntimeConnection();
    connection.deferred.set("terminal.open", () => new Promise<Response>(() => undefined));
    return connection;
  }

  private static openSignals(connection: FakeRuntimeConnection): AbortSignal[] {
    return connection.signals.filter((t, index): t is AbortSignal => connection.calls[index] === "terminal.open" && !Object.isUndefined(t));
  }

  private static lastSignal(connection: FakeRuntimeConnection): AbortSignal {
    const signal = WindowRegistryTests.openSignals(connection).at(-1);
    Assert.isDefined(signal);
    return signal;
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown, page?: string): Promise<Response> {
    return Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, method, payload, page));
  }

  private static async runAsync(test: (window: IGrantingWindow) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-file-grants-"));
    try {
      const connection = new FakeRuntimeConnection();
      connection.answers.set("notes.open", Response.success("r", null));
      const platform = globalThis.process.platform;
      const process = new FakeMainProcessEnvironment(platform, [`--data-dir=${join(folder, "data")}`]);
      const electron = await MainProcessStartFixture.startReadyAsync(platform, new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
      const window = MainProcessStartFixture.firstWindow(electron);
      const event = MainProcessStartFixture.trustedEvent(platform, window.webContents.id);
      electron.ipcMain.send("desktop:page", event, "first");
      await test({ electron, connection, process, window, event, folder });
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static grants(connection: FakeRuntimeConnection): FileGrant[] {
    return WindowRegistryTests.payloads(connection, "desktop.grantFile").map(p => FileGrant.fromJson(p));
  }

  private static payloads(connection: FakeRuntimeConnection, method: string): unknown[] {
    return connection.payloads.filter((_, index) => connection.calls[index] === method);
  }

  private static count(process: FakeMainProcessEnvironment, message: string): number {
    return process.errors.split("\n").filter(line => line.includes(message)).length;
  }
}
