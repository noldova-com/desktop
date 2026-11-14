/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConnectionException, RuntimeUnreachableException } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeUnreachableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new RuntimeUnreachableException("tcp://127.0.0.1:4100", new ExceptionOptions(cause));

    Assert.areEqual("The runtime at tcp://127.0.0.1:4100 cannot be reached.", exception.message);
    Assert.areEqual("tcp://127.0.0.1:4100", exception.endpoint);
    Assert.isNull(exception.failure);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof ConnectionException);
    Assert.areEqual("RuntimeUnreachableException", exception.name);
  }
}
