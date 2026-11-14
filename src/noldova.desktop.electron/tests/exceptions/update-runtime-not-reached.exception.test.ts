/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateRuntimeNotReachedException, UpdateStopException } from "@noldova/desktop.electron";

@TestClass
export class UpdateRuntimeNotReachedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const dataDirectory = "/data";
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateRuntimeNotReachedException(dataDirectory, new ExceptionOptions(cause));

    Assert.areEqual("Noldova Desktop Sample couldn't reach the runtime of /data to stop it for the update.", failure.message);
    Assert.areEqual(dataDirectory, failure.dataDirectory);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("UpdateRuntimeNotReachedException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
