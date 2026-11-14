/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WindowStateException, WindowStateRefusedException } from "@noldova/desktop.electron";
import { Failure, FailureCode, QualifiedName } from "@noldova/desktop.protocol";

@TestClass
export class WindowStateRefusedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const method = new QualifiedName("desktop", "writeWindowBounds");
    const failure = new Failure(FailureCode.Internal, "The database is busy.");

    const exception = new WindowStateRefusedException(method, failure);

    Assert.areEqual("The runtime refused desktop.writeWindowBounds: The database is busy.", exception.message);
    Assert.areEqual(method, exception.method);
    Assert.areEqual(failure, exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("WindowStateRefusedException", exception.name);
    Assert.isInstanceOf(exception, WindowStateException);
  }
}
