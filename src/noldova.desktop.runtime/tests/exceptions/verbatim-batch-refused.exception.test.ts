/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, VerbatimBatchRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class VerbatimBatchRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new VerbatimBatchRefusedException("C:/tools/build.cmd");

    Assert.areEqual("C:/tools/build.cmd is a batch file, and a process request passes its arguments as they are only to a program that isn't one; give cmd.exe the batch file in its arguments instead.", exception.message);
    Assert.areEqual("C:/tools/build.cmd", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("VerbatimBatchRefusedException", exception.name);
  }
}
