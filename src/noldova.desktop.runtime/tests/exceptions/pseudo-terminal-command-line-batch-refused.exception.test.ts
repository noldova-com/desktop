/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, PseudoTerminalCommandLineBatchRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class PseudoTerminalCommandLineBatchRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new PseudoTerminalCommandLineBatchRefusedException("C:/tools/build.cmd");

    Assert.areEqual("C:/tools/build.cmd is a batch file, and a pseudo-terminal passes a command line as it is only to a program that isn't one; give cmd.exe the batch file in its command line instead.", exception.message);
    Assert.areEqual("C:/tools/build.cmd", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("PseudoTerminalCommandLineBatchRefusedException", exception.name);
  }
}
