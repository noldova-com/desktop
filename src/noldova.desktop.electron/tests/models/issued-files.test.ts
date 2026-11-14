/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { IssuedFiles } from "@noldova/desktop.electron";

@TestClass
export class IssuedFilesTests {
  @TestMethod
  public writesTheGrantedFilesAndTheRefusedNames(): void {
    const issued = new IssuedFiles([{ name: "report.pdf", token: "a1" }], ["run.exe"]);

    Assert.areEqual(JSON.stringify({ granted: [{ name: "report.pdf", token: "a1" }], refused: ["run.exe"] }), JSON.stringify(issued.toJson()));
  }

  @TestMethod
  public issuesNothingAsNone(): void {
    Assert.areEqual(JSON.stringify({ granted: [], refused: [] }), JSON.stringify(IssuedFiles.none.toJson()));
  }
}
