/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, PseudoTerminalCommandLineWithArgumentsException } from "@noldova/desktop.runtime";

@TestClass
export class PseudoTerminalCommandLineWithArgumentsExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new PseudoTerminalCommandLineWithArgumentsException("cmd.exe");

    Assert.areEqual("cmd.exe was given both a command line to pass as it is and arguments, and a pseudo-terminal takes one or the other.", exception.message);
    Assert.areEqual("cmd.exe", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("PseudoTerminalCommandLineWithArgumentsException", exception.name);
  }
}
