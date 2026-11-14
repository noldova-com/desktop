/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { InstalledPackage } from "../../../src/models/packaging/installed-package.js";

@TestClass
export class InstalledPackageTests {
  @TestMethod
  public keepsWhereThePackageInstalledItsParts(): void {
    const installed = new InstalledPackage("main", "program", "resources", null);

    Assert.areEqual("main program resources", `${installed.mainProcess} ${installed.program} ${installed.resources}`);
    Assert.isNull(installed.command);
    Assert.areEqual("command", new InstalledPackage("main", "program", "resources", "command").command);
  }
}
