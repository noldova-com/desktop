/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FolderProtectorFactory, MacFolderProtector, PosixFolderProtector, SystemCommand, WindowsFolderProtector } from "@noldova/desktop.runtime";

@TestClass
export class FolderProtectorFactoryTests {
  @TestMethod
  public choosesSystemToolsOnWindows(): void {
    Assert.isInstanceOf(FolderProtectorFactory.create("win32", new SystemCommand(), {}), WindowsFolderProtector);
  }

  @TestMethod
  public choosesPermissionsReadBackOnMacOS(): void {
    Assert.isInstanceOf(FolderProtectorFactory.create("darwin", new SystemCommand(), {}), MacFolderProtector);
  }

  @TestMethod
  @TestData("linux")
  @TestData("freebsd")
  public choosesPosixPermissionsElsewhere(platform: string): void {
    Assert.isInstanceOf(FolderProtectorFactory.create(platform, new SystemCommand(), {}), PosixFolderProtector);
  }
}
