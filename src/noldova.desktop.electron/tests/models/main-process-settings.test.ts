/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { MainProcessSettings } from "@noldova/desktop.electron";

@TestClass
export class MainProcessSettingsTests {
  @TestMethod
  public findsTheBuiltWindowAndThePreloadFromTheInstalledPackage(): void {
    const module = resolve("repository", "node_modules", "@noldova", "desktop.electron");
    const settings = MainProcessSettings.fromModule(module, "linux");

    Assert.areEqual("linux", settings.platform);
    Assert.areEqual(resolve("repository", "_build", "window", "browser", "index.html"), settings.windowIndexPath);
    Assert.areEqual(join(module, "preload.cjs"), settings.preloadPath);
    Assert.areEqual(pathToFileURL(settings.windowIndexPath).href, settings.windowUrl);
  }

  @TestMethod
  @TestData("darwin", true)
  @TestData("win32", false)
  @TestData("linux", false)
  public knowsWhetherItRunsOnMacOS(platform: string, expected: boolean): void {
    Assert.areEqual(expected, new MainProcessSettings(platform, "index.html", "preload.cjs").isMac);
  }

  @TestMethod
  @TestData(" ", "index.html", "preload.cjs")
  @TestData("linux", String.empty, "preload.cjs")
  @TestData("linux", "index.html", " ")
  public needsEveryValue(platform: string, windowIndexPath: string, preloadPath: string): void {
    Assert.throws(() => new MainProcessSettings(platform, windowIndexPath, preloadPath), ArgumentException);
  }
}
