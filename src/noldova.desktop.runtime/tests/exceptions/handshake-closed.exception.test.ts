/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConnectionException, HandshakeClosedException } from "@noldova/desktop.runtime";

@TestClass
export class HandshakeClosedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new HandshakeClosedException();

    Assert.areEqual("The runtime closed the connection during the handshake.", exception.message);
    Assert.isNull(exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("HandshakeClosedException", exception.name);
  }
}
