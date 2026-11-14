/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateException, UpdateInfoInvalidException } from "@noldova/desktop.electron";

@TestClass
export class UpdateInfoInvalidExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateInfoInvalidException(new ExceptionOptions(cause));

    Assert.areEqual("The release's information is invalid.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("UpdateInfoInvalidException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
