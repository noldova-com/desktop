/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { MainProcessSettings } from "../../src/models/main-process-settings.js";
import { ScreenArea } from "../../src/models/screen-area.js";
import { TaskbarIdentity } from "../../src/models/taskbar-identity.js";
import { WindowState } from "../../src/models/window-state.js";
import { AppIcons } from "../../src/services/app-icons.js";
import { SenderPolicy } from "../../src/services/sender-policy.js";
import { WindowFactory } from "../../src/services/window-factory.js";
import { Condition } from "../fixtures/condition.fixture.js";
import { FailingLoadElectron } from "../fixtures/failing-load-electron.fixture.js";
import { FailingLoadWindow } from "../fixtures/failing-load-window.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { PreloadArgumentFixture } from "../fixtures/preload-argument.fixture.js";

@TestClass
export class WindowFactoryTests {
  @TestMethod
  public async describesItsWindowsToTheWindowsTaskbarAsThisBuild(): Promise<void> {
    const data = resolve("data");
    const packaged = new FakeElectron(true, true);
    await MainProcessStartFixture.startAsync(packaged, new FakeMainProcessEnvironment("win32", [`--data-dir=${data}`]));
    const development = new FakeElectron();
    await MainProcessStartFixture.startAsync(development, new FakeMainProcessEnvironment("win32"));
    const linux = new FakeElectron();
    await MainProcessStartFixture.startAsync(linux, new FakeMainProcessEnvironment("linux"));
    await Promise.all([MainProcessStartFixture.openAsync(packaged), MainProcessStartFixture.openAsync(development), MainProcessStartFixture.openAsync(linux)]);
    const developmentPackage = join(resolve(dirname(fileURLToPath(MainProcessStartFixture.MODULE_URL)), "..", "..", ".."), "_build", "development-package");

    Assert.areEqual(`"/electron/electron" "--data-dir=${data}"`, MainProcessStartFixture.firstWindow(packaged).appDetails?.relaunchCommand);
    Assert.areEqual("com.noldova.desktop", MainProcessStartFixture.firstWindow(packaged).appDetails?.appId);
    Assert.areEqual(`"/electron/electron" "${developmentPackage}"`, MainProcessStartFixture.firstWindow(development).appDetails?.relaunchCommand);
    Assert.areEqual(MainProcessStartFixture.DEVELOPMENT_APP_ID, MainProcessStartFixture.firstWindow(development).appDetails?.appId);
    Assert.isNull(MainProcessStartFixture.firstWindow(linux).appDetails);
  }

  @TestMethod
  public opensAHiddenSecureWindowWithTheTitleBarOverlayOnWindows(): Promise<void> {
    return WindowFactoryTests.verifyWindowAsync("win32", window => {
      Assert.isTrue(window.options.titleBarOverlay === true);
      Assert.isUndefined(window.options.trafficLightPosition);
    });
  }

  @TestMethod
  public opensAHiddenSecureWindowWithoutTheTitleBarOverlayOnLinuxSoThePageDrawsItsOwnControls(): Promise<void> {
    return WindowFactoryTests.verifyWindowAsync("linux", window => {
      Assert.isUndefined(window.options.titleBarOverlay);
      Assert.isUndefined(window.options.trafficLightPosition);
    });
  }

  @TestMethod
  public opensAHiddenSecureWindowWithTrafficLightsOnMacOS(): Promise<void> {
    return WindowFactoryTests.verifyWindowAsync("darwin", window => {
      Assert.isUndefined(window.options.titleBarOverlay);
      Assert.areEqual(JSON.stringify({ x: 12, y: 9 }), JSON.stringify(window.options.trafficLightPosition));
    });
  }

  @TestMethod
  public async keepsTheWindowOnItsOwnPage(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const contents = MainProcessStartFixture.firstWindow(electron).webContents;
    const windowUrl = MainProcessStartFixture.settings("linux").windowUrl;

    Assert.isTrue(contents.navigate("will-navigate", "https://example.com/"));
    Assert.isFalse(contents.navigate("will-navigate", `${windowUrl}#settings`));
    Assert.isTrue(contents.navigate("will-redirect", "https://example.com/"));
    Assert.isFalse(contents.navigate("will-redirect", windowUrl));
    Assert.isFalse(contents.navigate("will-attach-webview"));
    Assert.areEqual(JSON.stringify({ action: "deny" }), JSON.stringify(contents.openWindow()));
  }

  @TestMethod
  @TestData("linux", "null")
  @TestData("win32", "{\"color\":\"#FFFFFF\",\"symbolColor\":\"#111111\",\"height\":35}")
  @TestData("darwin", "null")
  public async paintsTheWindowAgainWhenItsPageReportsAChangedAppearanceWithoutShowingItAgain(platform: string, overlay: string): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent(platform), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    electron.ipcMain.send("desktop:appearance", MainProcessStartFixture.trustedEvent(platform),
      { background: "#FFFFFF", titleBar: "#FFFFFF", titleBarText: "#111111", titleBarHeight: 35 });

    Assert.areEqual("#FFFFFF", window.backgroundColor);
    Assert.areEqual(overlay, JSON.stringify(window.overlay));
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async logsAWindowPageThatFailsToLoad(platform: string): Promise<void> {
    const electron = new FailingLoadElectron();
    const settings = MainProcessSettings.fromModule(resolve("module"), platform);
    const line = Promise.withResolvers<string>();
    const factory = new WindowFactory(settings, new SenderPolicy(settings.windowUrl), electron, new TaskbarIdentity("app", "app.ico", "app"),
      new AppIcons(resolve("icons"), platform, electron.theme, new Set()), t => line.resolve(t));

    const window = factory.create(WindowState.createDefault(ScreenArea.of({ x: 0, y: 0, width: 1920, height: 1080 })), null);

    Assert.areEqual(`The window's page ${settings.windowIndexPath} didn't load: Error: ${FailingLoadWindow.message}`, await line.promise);
    Assert.areEqual(1, electron.windows.length);
    Assert.isTrue(electron.windows[0] === window, "the factory returns the window it loaded");
  }

  private static async verifyWindowAsync(platform: string, verifyTitleBar: (window: FakeMainProcessWindow) => void): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);
    const window = MainProcessStartFixture.firstWindow(electron);
    const settings = MainProcessStartFixture.settings(platform);

    Assert.areEqual(1, electron.windows.length);
    Assert.areEqual(JSON.stringify({
      width: 1280,
      height: 800,
      minWidth: 640,
      minHeight: 480,
      show: false,
      title: "Noldova Desktop Sample",
      titleBarStyle: "hidden",
      webPreferences: {
        preload: settings.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webviewTag: true,
        webSecurity: true,
        spellcheck: true
      }
    }), JSON.stringify({ ...window.options, titleBarOverlay: undefined, trafficLightPosition: undefined, icon: undefined, webPreferences: { ...window.options.webPreferences, additionalArguments: undefined } }));
    const preload = PreloadArgumentFixture.read(window.options.webPreferences?.additionalArguments);
    Assert.areEqual("desktop|67108864|null", `${preload.readString("bridge")}|${preload.readInteger("pastedByteLimit")}|${JSON.stringify(preload.readValue("appearance"))}`);
    Assert.areEqual("desktop:ready|desktop:windowError", `${preload.readObject("channels").readString("ready")}|${preload.readObject("channels").readString("windowError")}`);
    Assert.areEqual(settings.windowIndexPath, window.loadedFile);
    Assert.isFalse(window.isShown);
    verifyTitleBar(window);
  }
}
