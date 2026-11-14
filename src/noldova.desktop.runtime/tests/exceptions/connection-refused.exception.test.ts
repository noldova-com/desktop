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
import { ConnectionException, ConnectionRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class ConnectionRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const failure = new Failure(FailureCode.Unauthorized, "The capability token is not valid for this runtime.");

    const exception = new ConnectionRefusedException(failure);

    Assert.areEqual("The capability token is not valid for this runtime.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("ConnectionRefusedException", exception.name);
  }
}
