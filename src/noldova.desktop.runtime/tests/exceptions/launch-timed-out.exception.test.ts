/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchException, LaunchTimedOutException } from "@noldova/desktop.runtime";

@TestClass
export class LaunchTimedOutExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new LaunchTimedOutException();

    Assert.areEqual("The runtime did not start in time.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("LaunchTimedOutException", exception.name);
  }
}
