/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectoryInspection, DataDirectoryState } from "@noldova/desktop.runtime";

@TestClass
export class DataDirectoryInspectionTests {
  @TestMethod
  public keepsItsStateAndACopyOfItsEntries(): void {
    const entries = ["noldova-desktop.db"];
    const inspection = new DataDirectoryInspection(DataDirectoryState.PreShell, entries);
    entries.push("other");

    Assert.areEqual(DataDirectoryState.PreShell, inspection.state);
    Assert.areEqual("noldova-desktop.db", inspection.entries.join(","));
  }
}
