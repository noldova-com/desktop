/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode } from "@noldova/desktop.protocol";
import { ConnectionClosedException, ConnectionException } from "@noldova/desktop.runtime";

@TestClass
export class ConnectionClosedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ConnectionClosedException();

    Assert.areEqual("The connection to the runtime is closed.", exception.message);
    Assert.areEqual(FailureCode.Disconnected, exception.failure?.code);
    Assert.areEqual("The connection to the runtime is closed.", exception.failure?.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("ConnectionClosedException", exception.name);
  }
}
