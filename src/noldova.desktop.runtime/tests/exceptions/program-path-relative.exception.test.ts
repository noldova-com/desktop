/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, ProgramPathRelativeException } from "@noldova/desktop.runtime";

@TestClass
export class ProgramPathRelativeExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ProgramPathRelativeException("bin/tool");

    Assert.areEqual("bin/tool is neither a program's name nor an absolute path.", exception.message);
    Assert.areEqual("bin/tool", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("ProgramPathRelativeException", exception.name);
  }
}
