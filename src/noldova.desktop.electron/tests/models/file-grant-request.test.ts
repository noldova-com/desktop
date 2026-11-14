/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FileGrantRequest } from "@noldova/desktop.electron";

@TestClass
export class FileGrantRequestTests {
  @TestMethod
  public readsTheModuleAndTakesTenMinutesAndOneFileUnlessTheOptionsSayOtherwise(): void {
    const plain = FileGrantRequest.read("notes", {});
    const chosen = FileGrantRequest.read("git-hub", { lifetime: 1_000, multiple: true });

    Assert.areEqual("notes|600000|false", `${plain?.module}|${plain?.lifetime}|${plain?.isMultiple}`);
    Assert.areEqual("git-hub|1000|true", `${chosen?.module}|${chosen?.lifetime}|${chosen?.isMultiple}`);
  }

  @TestMethod
  @TestData("desktop", {})
  @TestData("Notes", {})
  @TestData(5, {})
  @TestData("notes", null)
  @TestData("notes", [])
  @TestData("notes", { lifetime: 600_001 })
  @TestData("notes", { lifetime: 0 })
  @TestData("notes", { lifetime: 1.5 })
  @TestData("notes", { lifetime: "60000" })
  @TestData("notes", { multiple: "yes" })
  public refusesAnotherOwnerAndOptionsOutsideTheLimits(module: unknown, options: unknown): void {
    Assert.isNull(FileGrantRequest.read(module, options));
  }
}
