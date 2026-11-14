/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PreShellDataException } from "@noldova/desktop.runtime";

@TestClass
export class PreShellDataExceptionTests {
  @TestMethod
  public listsTheEarlierReleasesEntries(): void {
    const entries = ["noldova-desktop.db", "attachments"];
    const exception = new PreShellDataException("/data/noldova-desktop", entries);
    entries.push("other");

    Assert.areEqual("The data directory /data/noldova-desktop holds data from a release before the shell: noldova-desktop.db, attachments.", exception.message);
    Assert.areEqual("/data/noldova-desktop", exception.root);
    Assert.areEqual("noldova-desktop.db,attachments", exception.entries.join(","));
    Assert.areEqual("PreShellDataException", exception.name);
  }
}
