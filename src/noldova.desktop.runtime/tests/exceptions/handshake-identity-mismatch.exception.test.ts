/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConnectionException, HandshakeIdentityMismatchException } from "@noldova/desktop.runtime";

@TestClass
export class HandshakeIdentityMismatchExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new HandshakeIdentityMismatchException();

    Assert.areEqual("The runtime answered the handshake with another build's identity.", exception.message);
    Assert.isNull(exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("HandshakeIdentityMismatchException", exception.name);
  }
}
