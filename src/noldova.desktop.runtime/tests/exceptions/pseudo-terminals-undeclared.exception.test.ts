/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, PseudoTerminalsUndeclaredException } from "@noldova/desktop.runtime";

@TestClass
export class PseudoTerminalsUndeclaredExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new PseudoTerminalsUndeclaredException("terminal", "bash");

    Assert.areEqual("bash was not started, because the module terminal does not declare pseudoTerminals.", exception.message);
    Assert.areEqual("terminal", exception.moduleId);
    Assert.areEqual("bash", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("PseudoTerminalsUndeclaredException", exception.name);
  }
}
