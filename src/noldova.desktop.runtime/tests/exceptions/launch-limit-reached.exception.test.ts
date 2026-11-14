/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchException, LaunchLimitReachedException } from "@noldova/desktop.runtime";

@TestClass
export class LaunchLimitReachedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new LaunchLimitReachedException(120000);

    Assert.areEqual("A runtime held the data directory but was not reachable within 120 s.", exception.message);
    Assert.areEqual(120000, exception.milliseconds);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("LaunchLimitReachedException", exception.name);
  }
}
