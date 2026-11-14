/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchException, StopTimedOutException } from "@noldova/desktop.runtime";

@TestClass
export class StopTimedOutExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new StopTimedOutException();

    Assert.areEqual("The other build's runtime did not stop in time.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("StopTimedOutException", exception.name);
  }
}
