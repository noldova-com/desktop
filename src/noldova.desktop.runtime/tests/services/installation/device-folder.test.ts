/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeviceFolder } from "@noldova/desktop.runtime";

@TestClass
export class DeviceFolderTests {
  @TestMethod
  public isInTheOperatingSystemsLocalApplicationData(): void {
    Assert.areEqual(path.join("C:\Users\person\AppData\Local", "Noldova", "Desktop"), DeviceFolder.locate("win32", { LOCALAPPDATA: "C:\Users\person\AppData\Local" }, "C:\Users\person"));
    Assert.areEqual(path.join("C:\Users\person", "AppData", "Local", "Noldova", "Desktop"), DeviceFolder.locate("win32", {}, "C:\Users\person"));
    Assert.areEqual(path.join("/Users/person", "Library", "Application Support", "Noldova", "Desktop"), DeviceFolder.locate("darwin", {}, "/Users/person"));
    Assert.areEqual(path.join("/state", "noldova", "desktop"), DeviceFolder.locate("linux", { XDG_STATE_HOME: "/state" }, "/home/person"));
    Assert.areEqual(path.join("/home/person", ".local", "state", "noldova", "desktop"), DeviceFolder.locate("linux", { XDG_STATE_HOME: " " }, "/home/person"));
    Assert.areEqual(path.join("/home/person", ".local", "state", "noldova", "desktop"), DeviceFolder.locate("linux", {}, "/home/person"));
  }
}
