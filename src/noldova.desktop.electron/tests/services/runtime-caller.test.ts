/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PreShellData, Response } from "@noldova/desktop.protocol";
import { CallUnansweredException, ConnectionClosedException, PreShellDataFoundException } from "@noldova/desktop.runtime";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class RuntimeCallerTests {
  @TestMethod
  public async answersDisconnectedWithoutARuntimeOrAfterItsConnectionEndsAndPassesOnDefects(): Promise<void> {
    const refused = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.length > 0);

    const unconnected = await RuntimeCallerTests.requestAsync(refused, event, "notes.open", null);
    connection.rejection = new CallUnansweredException("notes.open");
    const late = await RuntimeCallerTests.requestAsync(electron, event, "notes.open", null);
    connection.isClosed = true;
    connection.rejection = new ConnectionClosedException();
    const closed = await RuntimeCallerTests.requestAsync(electron, event, "notes.open", null);
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => RuntimeCallerTests.requestAsync(electron, event, "notes.open", null), TypeError);
    Assert.areEqual(JSON.stringify({ code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." }), JSON.stringify(unconnected.failure?.toJson()));
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "The runtime did not answer notes.open in time." }), JSON.stringify(late.failure?.toJson()));
    Assert.areEqual(JSON.stringify({ code: "Disconnected", message: "The connection to the runtime is closed." }), JSON.stringify(closed.failure?.toJson()));
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown, page?: string): Promise<Response> {
    return Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, method, payload, page));
  }
}
