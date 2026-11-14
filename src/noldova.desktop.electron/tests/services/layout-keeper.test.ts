/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PreShellData } from "@noldova/desktop.protocol";
import { CallUnansweredException, ConnectionClosedException, PreShellDataFoundException } from "@noldova/desktop.runtime";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class LayoutKeeperTests {
  @TestMethod
  public async keepsItsWindowsLayoutForThisDeviceThroughTheRuntime(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");

    const before = await LayoutKeeperTests.invokeAsync(electron, "desktop:readLayout", event);
    const written = await LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", event, { version: 1 });
    const after = await LayoutKeeperTests.invokeAsync(electron, "desktop:readLayout", event);

    Assert.areEqual(JSON.stringify({ payload: null }), JSON.stringify(before));
    Assert.areEqual(JSON.stringify({ payload: null }), JSON.stringify(written));
    Assert.areEqual(JSON.stringify({ payload: { version: 1 } }), JSON.stringify(after));
    Assert.areEqual(JSON.stringify({ version: 1 }), JSON.stringify(connection.states.get(`writeWindowLayout:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async refusesALayoutFromAnUntrustedSenderOrOneThatIsNotAnObject(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const untrusted = { sender: { id: 1 }, senderFrame: null };
    const trusted = MainProcessStartFixture.trustedEvent("linux");

    const answers = [
      await LayoutKeeperTests.invokeAsync(electron, "desktop:readLayout", untrusted),
      await LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", untrusted, { version: 1 }),
      await LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", trusted, [1])
    ];

    Assert.areEqual(
      JSON.stringify([
        { code: "Unauthorized", message: "Only Noldova Desktop Sample's own window may call the runtime." },
        { code: "Unauthorized", message: "Only Noldova Desktop Sample's own window may call the runtime." },
        { code: "InvalidMessage", message: "The layout must be a JSON object." }
      ]),
      JSON.stringify(answers.map(t => t["failure"])));
    Assert.isFalse(connection.calls.some(t => t.endsWith("Layout")));
  }

  @TestMethod
  public async answersThatItKeepsNoLayoutWhenTheDeviceHasNoIdentity(): Promise<void> {
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), device, process);
    const event = MainProcessStartFixture.trustedEvent("linux");

    const read = await LayoutKeeperTests.invokeAsync(electron, "desktop:readLayout", event);
    const write = await LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", event, { version: 1 });

    const failure = { code: "Unavailable", message: "This device has no identity, so the window's layout and Do not disturb are not kept." };
    Assert.areEqual(JSON.stringify([failure, failure]), JSON.stringify([read["failure"], write["failure"]]));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "This device's identity").length);
  }

  @TestMethod
  public async answersALayoutTheRuntimeCannotKeepAsAFailureAndPassesOnDefects(): Promise<void> {
    const refused = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = MainProcessStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.length > 0);

    const unconnected = await LayoutKeeperTests.invokeAsync(refused, "desktop:writeLayout", event, { version: 1 });
    connection.isFailing = true;
    const busy = await LayoutKeeperTests.invokeAsync(electron, "desktop:readLayout", event);
    connection.rejection = new CallUnansweredException("desktop.writeWindowLayout");
    const late = await LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", event, { version: 1 });
    connection.isClosed = true;
    connection.rejection = new ConnectionClosedException();
    const closed = await LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", event, { version: 1 });
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => LayoutKeeperTests.invokeAsync(electron, "desktop:writeLayout", event, { version: 1 }), TypeError);
    Assert.areEqual(
      JSON.stringify([
        { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." },
        { code: "Internal", message: "The database is busy." },
        { code: "Unavailable", message: "The runtime did not answer desktop.writeWindowLayout in time." },
        { code: "Disconnected", message: "The connection to the runtime is closed." }
      ]),
      JSON.stringify([unconnected["failure"], busy["failure"], late["failure"], closed["failure"]]));
  }

  private static async invokeAsync(electron: FakeElectron, channel: string, event: IIpcEvent, ...values: unknown[]): Promise<JsonObject> {
    return JsonReader.fromValue(await electron.ipcMain.invoke(channel, event, ...values)).toJson();
  }
}
