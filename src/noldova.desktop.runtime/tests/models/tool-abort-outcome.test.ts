/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ToolFailureCode } from "../../src/enums/tool-failure-code.js";
import { ToolAbortOutcome } from "../../src/models/tool-abort-outcome.js";

@TestClass
export class ToolAbortOutcomeTests {
  @TestMethod
  public keepsTheCodeAndTheMessage(): void {
    const outcome = new ToolAbortOutcome(ToolFailureCode.Stopped, "Stopped.");

    Assert.areEqual(ToolFailureCode.Stopped, outcome.code);
    Assert.areEqual("Stopped.", outcome.message);
  }
}
