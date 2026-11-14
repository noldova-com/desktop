/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, PseudoTerminalBatchRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class PseudoTerminalBatchRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new PseudoTerminalBatchRefusedException("C:/tools/build.cmd");

    Assert.areEqual("C:/tools/build.cmd is a batch file whose program could not be traced, and a pseudo-terminal starts no batch file through cmd.exe.", exception.message);
    Assert.areEqual("C:/tools/build.cmd", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("PseudoTerminalBatchRefusedException", exception.name);
  }
}
