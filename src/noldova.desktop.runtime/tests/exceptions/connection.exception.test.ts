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
import {
  CallUnansweredException,
  ConnectionClosedException,
  ConnectionException,
  ConnectionRefusedException,
  EndpointUnavailableException,
  HandshakeClosedException,
  HandshakeIdentityMismatchException,
  HandshakeTimedOutException,
  RuntimeUnreachableException
} from "@noldova/desktop.runtime";

@TestClass
export class ConnectionExceptionTests {
  @TestMethod
  public isTheCategoryOfItsConditions(): void {
    const exceptions: readonly Error[] = [
      new RuntimeUnreachableException("tcp://127.0.0.1:4100"),
      new HandshakeTimedOutException(),
      new HandshakeClosedException(),
      new HandshakeIdentityMismatchException(),
      new ConnectionRefusedException(new Failure(FailureCode.Unauthorized, "The capability token is not valid for this runtime.")),
      new CallUnansweredException("desktop.work"),
      new ConnectionClosedException(),
      new EndpointUnavailableException()
    ];

    for (const exception of exceptions)
      Assert.isTrue(exception instanceof ConnectionException, exception.name);
  }
}
