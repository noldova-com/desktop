/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, PseudoTerminalCommandLineRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class PseudoTerminalCommandLineRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new PseudoTerminalCommandLineRefusedException("bash");

    Assert.areEqual("bash was given a command line to pass as it is, which a pseudo-terminal takes only on Windows.", exception.message);
    Assert.areEqual("bash", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("PseudoTerminalCommandLineRefusedException", exception.name);
  }
}
