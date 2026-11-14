/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConnectionException, EndpointUnavailableException } from "@noldova/desktop.runtime";

@TestClass
export class EndpointUnavailableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new EndpointUnavailableException();

    Assert.areEqual("The runtime's local endpoint has no address.", exception.message);
    Assert.isNull(exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("EndpointUnavailableException", exception.name);
  }
}
