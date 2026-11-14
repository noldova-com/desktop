/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessResult } from "../../../src/models/processes/process-result.js";

@TestClass
export class ProcessResultTests {
  @TestMethod
  public succeedsOnlyWithTheExitCodeZero(): void {
    Assert.areEqual("true,false,false", [0, 1, null].map(t => String(new ProcessResult(t, "", "").isSuccessful)).join(","));
  }

  @TestMethod
  public joinsItsOutputsAndTrimsThem(): void {
    const result = new ProcessResult(1, " out ", "err ");

    Assert.areEqual("out err", result.text);
    Assert.areEqual(" out ", result.output);
    Assert.areEqual("err ", result.errorOutput);
  }
}
