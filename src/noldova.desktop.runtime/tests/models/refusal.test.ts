/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, ShellMethods } from "@noldova/desktop.protocol";
import { Refusal } from "@noldova/desktop.runtime";

@TestClass
export class RefusalTests {
  @TestMethod
  public keepsTheFailureAndTheAllowedMethod(): void {
    const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.");

    const refusal = new Refusal(failure, ShellMethods.moveAside);

    Assert.areEqual(failure, refusal.failure);
    Assert.areEqual(ShellMethods.moveAside, refusal.method);
  }
}
