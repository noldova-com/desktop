/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConnectionException, HandshakeTimedOutException } from "@noldova/desktop.runtime";

@TestClass
export class HandshakeTimedOutExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new HandshakeTimedOutException();

    Assert.areEqual("The runtime did not answer the handshake in time.", exception.message);
    Assert.isNull(exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("HandshakeTimedOutException", exception.name);
  }
}
