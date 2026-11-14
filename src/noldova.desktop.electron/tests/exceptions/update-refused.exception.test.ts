/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateRefusedException, UpdateStopException } from "@noldova/desktop.electron";
import { Failure, FailureCode } from "@noldova/desktop.protocol";

@TestClass
export class UpdateRefusedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const dataDirectory = "/data";
    const failure = new Failure(FailureCode.Conflict, "Work is running.");

    const exception = new UpdateRefusedException(dataDirectory, failure);

    Assert.areEqual("The runtime of /data could not prepare for the update: Work is running.", exception.message);
    Assert.areEqual(dataDirectory, exception.dataDirectory);
    Assert.areEqual(failure, exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("UpdateRefusedException", exception.name);
    Assert.isInstanceOf(exception, UpdateStopException);
  }
}
