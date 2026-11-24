/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { LeftEntries } from "../../../src/models/packaging/left-entries.js";

@TestClass
export class LeftEntriesTests {
  @TestMethod
  public keepsWhatAnUninstallLeftAndWhatHoldsIt(): void {
    const left = new LeftEntries(["bin", "app.exe"], "app.exe: explorer.exe (1234)");

    Assert.areEqual("bin app.exe", left.names.join(" "));
    Assert.areEqual("app.exe: explorer.exe (1234)", left.holders);
    Assert.isNull(new LeftEntries([], null).holders);
  }
}
