/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchException, RuntimeExitedWithoutReasonException } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeExitedWithoutReasonExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new RuntimeExitedWithoutReasonException();

    Assert.areEqual("The runtime exited while starting and left no reason.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("RuntimeExitedWithoutReasonException", exception.name);
  }
}
