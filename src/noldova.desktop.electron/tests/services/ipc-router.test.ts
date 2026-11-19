/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PreShellData } from "@noldova/desktop.protocol";
import { PreShellDataFoundException, RuntimeBuild } from "@noldova/desktop.runtime";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class IpcRouterTests {
  @TestMethod
  public carriesOutThePersonsStartupChoiceFromItsWindowOnly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    return MainProcessStartFixture.startReadyAsync("linux", launcher).then(async electron => {
      const window = MainProcessStartFixture.firstWindow(electron);

      const startup = JSON.stringify(electron.ipcMain.invoke("desktop:readStartup", MainProcessStartFixture.trustedEvent("linux")));
      Assert.areEqual(false, electron.ipcMain.invoke("desktop:startupAction", { sender: { id: 1 }, senderFrame: null }, "moveAside"));
      window.isGone = true;
      const sent = window.webContents.sent.length;
      Assert.areEqual(true, await electron.ipcMain.invoke("desktop:startupAction", MainProcessStartFixture.trustedEvent("linux"), "moveAside"));

      Assert.isTrue(startup.includes("\"PreShellData\""), startup);
      Assert.areEqual(JSON.stringify(["attach main IfIdle", "moveAside main IfIdle"]), JSON.stringify(launcher.calls));
      Assert.areEqual(sent, window.webContents.sent.length);
    });
  }

  @TestMethod
  public async tellsOnlyItsOwnWindowWhichBuildItIs(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");

    const build = electron.ipcMain.invoke("desktop:readBuild", MainProcessStartFixture.trustedEvent("linux"));
    const refused = electron.ipcMain.invoke("desktop:readBuild", { sender: { id: 1 }, senderFrame: null });

    Assert.areEqual(JSON.stringify(RuntimeBuild.identity.toJson()), JSON.stringify(build));
    Assert.isNull(refused);
  }

  @TestMethod
  public async readsWhetherItsTrustedWindowIsInFullScreen(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), new FakeMainProcessEnvironment("darwin"));
    const trusted = MainProcessStartFixture.trustedEvent("darwin");
    const window = MainProcessStartFixture.firstWindow(electron);

    const before = electron.ipcMain.invoke("desktop:readFullScreen", trusted);
    window.isFullScreenNow = true;
    const after = electron.ipcMain.invoke("desktop:readFullScreen", trusted);
    const untrusted = electron.ipcMain.invoke("desktop:readFullScreen", { ...trusted, senderFrame: null });

    Assert.areEqual("[false,true,null]", JSON.stringify([before, after, untrusted]));
  }

  @TestMethod
  public async readsWhetherItsTrustedWindowIsMaximized(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const window = MainProcessStartFixture.firstWindow(electron);

    const before = electron.ipcMain.invoke("desktop:readMaximized", trusted);
    window.isMaximizedNow = true;
    const after = electron.ipcMain.invoke("desktop:readMaximized", trusted);
    const untrusted = electron.ipcMain.invoke("desktop:readMaximized", { ...trusted, senderFrame: null });

    Assert.areEqual("[false,true,null]", JSON.stringify([before, after, untrusted]));
  }
}
