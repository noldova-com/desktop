/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CallUnansweredException, ConnectionException } from "@noldova/desktop.runtime";

@TestClass
export class CallUnansweredExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new CallUnansweredException("desktop.work");

    Assert.areEqual("The runtime did not answer desktop.work in time.", exception.message);
    Assert.areEqual("desktop.work", exception.method);
    Assert.isNull(exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("CallUnansweredException", exception.name);
  }
}
