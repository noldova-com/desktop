/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExitWaitTimedOutException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class ExitWaitTimedOutExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ExitWaitTimedOutException(4100, 2000);

    Assert.areEqual("Process 4100 was still running 2000 ms after its output closed, so its exit code could not be read.", exception.message);
    Assert.areEqual(4100, exception.processId);
    Assert.areEqual(2000, exception.milliseconds);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("ExitWaitTimedOutException", exception.name);
  }
}
