/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateException, UpdateFailedUnexpectedlyException } from "@noldova/desktop.electron";

@TestClass
export class UpdateFailedUnexpectedlyExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateFailedUnexpectedlyException(new ExceptionOptions(cause));

    Assert.areEqual("The update stopped on an unexpected error.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("UpdateFailedUnexpectedlyException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
