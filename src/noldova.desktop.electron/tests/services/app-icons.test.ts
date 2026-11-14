/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDockHost } from "../fixtures/fake-dock-host.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";

@TestClass
export class AppIconsTests {
  private static readonly LIGHT_ICONS: readonly string[] = ["icon-light.ico", "icon-light-512.png"];

  @TestMethod
  @TestData("win32", true, false, "icon-light.ico")
  @TestData("win32", false, true, "icon-dark.ico")
  @TestData("linux", false, true, "icon-light-512.png")
  @TestData("linux", true, false, "icon-dark-512.png")
  public async givesItsWindowTheIconThatShowsOnTheTaskbarsThemeWhichOnWindowsIsTheSystemsOwn(platform: string, isDarkApps: boolean, isDarkSystem: boolean, icon: string): Promise<void> {
    await MainProcessStartFixture.withIconsAsync(AppIconsTests.LIGHT_ICONS, async (icons, moduleUrl) => {
      const electron = new FakeElectron();
      electron.theme.shouldUseDarkColors = isDarkApps;
      electron.theme.shouldUseDarkColorsForSystemIntegratedUI = isDarkSystem;

      const window = MainProcessStartFixture.firstWindow(await MainProcessStartFixture.startReadyAsync(platform, undefined, electron, undefined, undefined, undefined, moduleUrl));

      Assert.areEqual(join(icons, icon), window.options.icon);
      Assert.areEqual(platform === "win32" ? join(icons, "icon-dark.ico") : undefined, window.appDetails?.appIconPath);
    });
  }

  @TestMethod
  public async changesItsWindowsIconWhenTheThemeChangesUntilTheWindowCloses(): Promise<void> {
    await MainProcessStartFixture.withIconsAsync(AppIconsTests.LIGHT_ICONS, async (icons, moduleUrl) => {
      const electron = new FakeElectron();
      const window = MainProcessStartFixture.firstWindow(await MainProcessStartFixture.startReadyAsync("linux", undefined, electron, undefined, undefined, undefined, moduleUrl));

      electron.theme.update(false, true);
      electron.theme.update(true, false);
      const listening = electron.theme.listenerCount;
      window.destroy();
      electron.theme.update(false, false);

      Assert.areEqual(JSON.stringify([join(icons, "icon-light-512.png"), join(icons, "icon-dark-512.png")]), JSON.stringify(window.icons));
      Assert.areEqual(JSON.stringify([2, 1]), JSON.stringify([listening, electron.theme.listenerCount]));
    });
  }

  @TestMethod
  @TestData("win32", "icon-dark.ico")
  @TestData("linux", "icon-dark-512.png")
  public async keepsTheDarkIconOnALightTaskbarWhenTheAppBringsNoLightOne(platform: string, icon: string): Promise<void> {
    const electron = new FakeElectron();
    electron.theme.update(false, false);
    const window = MainProcessStartFixture.firstWindow(await MainProcessStartFixture.startReadyAsync(platform, undefined, electron));

    electron.theme.update(false, false);

    Assert.areEqual(MainProcessStartFixture.icon(icon), window.options.icon);
    Assert.areEqual(JSON.stringify([MainProcessStartFixture.icon(icon)]), JSON.stringify(window.icons));
  }

  @TestMethod
  public async pointsAPackagedBuildsTaskbarAtItsProgramWhoseIconTheShellCanRead(): Promise<void> {
    const process = new FakeMainProcessEnvironment("win32");
    const window = MainProcessStartFixture.firstWindow(await MainProcessStartFixture.startReadyAsync("win32", undefined, new FakeElectron(true, true), undefined, process));

    Assert.areEqual(MainProcessStartFixture.icon("icon-dark.ico"), window.options.icon);
    Assert.areEqual(process.execPath, window.appDetails?.appIconPath);
  }

  @TestMethod
  public async showsItsIconInTheDockOnMacOSAndLeavesTheWindowsIconToTheBundleWhateverTheTheme(): Promise<void> {
    const electron = new FakeElectron();
    const dock = new FakeDockHost();
    electron.app.dock = dock;

    await MainProcessStartFixture.startReadyAsync("darwin", undefined, electron);
    electron.theme.update(false, false);

    Assert.areEqual(JSON.stringify([MainProcessStartFixture.icon("icon-dock-512.png")]), JSON.stringify(dock.icons));
    Assert.isUndefined(MainProcessStartFixture.firstWindow(electron).options.icon);
    Assert.areEqual(JSON.stringify([0, 0]), JSON.stringify([electron.theme.listenerCount, MainProcessStartFixture.firstWindow(electron).icons.length]));
  }
}
