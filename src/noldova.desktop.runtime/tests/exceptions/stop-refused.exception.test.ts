/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { LaunchException, StopRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class StopRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const failure = new Failure(FailureCode.Unavailable, "The runtime is stopping already.");

    const exception = new StopRefusedException(failure);

    Assert.areEqual("The other build's runtime refused to stop: The runtime is stopping already.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("StopRefusedException", exception.name);
  }
}
