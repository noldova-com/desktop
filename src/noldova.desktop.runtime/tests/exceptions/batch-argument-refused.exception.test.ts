/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BatchArgumentRefusedException, ProcessStartException } from "@noldova/desktop.runtime";

@TestClass
export class BatchArgumentRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new BatchArgumentRefusedException("C:/tools/build.cmd");

    Assert.areEqual("C:/tools/build.cmd is a batch file whose program could not be traced, and cmd.exe cannot be given an argument that holds %, \", !, a line break or a NUL character.", exception.message);
    Assert.areEqual("C:/tools/build.cmd", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("BatchArgumentRefusedException", exception.name);
  }
}
